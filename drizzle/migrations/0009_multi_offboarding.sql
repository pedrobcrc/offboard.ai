CREATE TABLE public.offboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departing_name text NOT NULL,
  departing_role text NOT NULL,
  departing_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  last_working_day date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','completed')),
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.offboardings TO anon, authenticated;
GRANT ALL ON public.offboardings TO service_role;
ALTER TABLE public.offboardings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read offboardings" ON public.offboardings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can start an offboarding" ON public.offboardings FOR INSERT TO anon, authenticated WITH CHECK (is_sample = false);
CREATE POLICY "Anyone can progress an offboarding" ON public.offboardings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.offboardings (id, departing_name, departing_role, last_working_day, status, is_sample, created_at)
SELECT '00000000-0000-4000-8000-0000000000a1', departing_buyer_name, departing_buyer_role, departing_on, 'in_review', true, '2026-01-01'
FROM public.workspace_info WHERE id = 1;
INSERT INTO public.offboardings (id, departing_name, departing_role, last_working_day, status, is_sample, created_at)
SELECT '00000000-0000-4000-8000-0000000000a1', 'Laura Martín', 'Senior Buyer', '2026-11-25', 'in_review', true, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM public.offboardings WHERE id = '00000000-0000-4000-8000-0000000000a1');

ALTER TABLE public.team_members ADD COLUMN departed boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN offboarding_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1' REFERENCES public.offboardings(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN offboarding_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1' REFERENCES public.offboardings(id) ON DELETE CASCADE;
ALTER TABLE public.task_decisions ADD COLUMN offboarding_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1' REFERENCES public.offboardings(id) ON DELETE CASCADE;
CREATE INDEX documents_offboarding_idx ON public.documents (offboarding_id);
CREATE INDEX tasks_offboarding_idx ON public.tasks (offboarding_id);
CREATE INDEX task_decisions_offboarding_idx ON public.task_decisions (offboarding_id);

-- Same filename may exist in different offboardings.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_filename_key;
CREATE UNIQUE INDEX documents_offboarding_filename_key ON public.documents (offboarding_id, filename);

GRANT INSERT ON public.tasks TO anon, authenticated;
CREATE POLICY "Anyone can add pending tasks" ON public.tasks FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND EXISTS (SELECT 1 FROM public.offboardings o WHERE o.id = offboarding_id AND o.is_sample = false AND o.status <> 'completed'));

-- Decision log rows inherit their task's offboarding.
CREATE OR REPLACE FUNCTION public.decision_offboarding() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  SELECT offboarding_id INTO NEW.offboarding_id FROM public.tasks WHERE id = NEW.task_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER decision_offboarding BEFORE INSERT ON public.task_decisions FOR EACH ROW EXECUTE FUNCTION public.decision_offboarding();

-- Workload counted within the task's own offboarding.
CREATE OR REPLACE FUNCTION public.validate_review_capacity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE load integer; BEGIN
 IF NEW.status IN ('proposed','approved') AND NEW.assigned_member_id IS NOT NULL THEN
 SELECT capacity + coalesce((SELECT sum(CASE WHEN criticality='High' THEN 10 ELSE 5 END) FROM public.tasks WHERE id<>NEW.id AND offboarding_id=NEW.offboarding_id AND status IN ('proposed','approved') AND assigned_member_id=NEW.assigned_member_id),0) + CASE WHEN NEW.criticality='High' THEN 10 ELSE 5 END INTO load FROM public.team_members WHERE id=NEW.assigned_member_id;
 IF load>100 THEN RAISE EXCEPTION 'This decision would exceed 100 percent workload.'; END IF;
 END IF; RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.search_offboarding_chunks(p_offboarding_id uuid, p_question text, p_limit integer DEFAULT 4)
RETURNS TABLE(chunk_id bigint, document_id uuid, filename text, content text, score double precision)
LANGUAGE sql STABLE AS $function$
  with scope as (
    select dc.* from public.document_chunks dc join public.documents d on d.id = dc.document_id where d.offboarding_id = p_offboarding_id
  ),
  q as (select coalesce(nullif(btrim(plainto_tsquery('english', p_question)::text), ''), '') as txt),
  terms as (select t from q, unnest(string_to_array(q.txt, ' & ')) as t where q.txt <> ''),
  term_stats as (
    select t, (select count(*) from scope dc where dc.search @@ to_tsquery('english', terms.t))::double precision as df from terms
  ),
  or_query as (select to_tsquery('english', coalesce(string_agg(t, ' | '), '""')) as tsq from terms),
  scored as (
    select dc.id,
           sum(case when dc.search @@ to_tsquery('english', ts.t) then 1.0 / (1.0 + ts.df) else 0 end) as idf_score,
           max(ts_rank(dc.search, oq.tsq)) as rank
    from scope dc cross join term_stats ts cross join or_query oq
    group by dc.id, dc.search, oq.tsq
    having bool_or(dc.search @@ to_tsquery('english', ts.t))
  )
  select dc.id, d.id, d.filename, dc.content, (s.idf_score + 0.2 * s.rank)::double precision as score
  from scored s join public.document_chunks dc on dc.id = s.id join public.documents d on d.id = dc.document_id
  order by score desc, dc.id
  limit greatest(1, least(coalesce(p_limit, 4), 10));
$function$;
GRANT EXECUTE ON FUNCTION public.search_offboarding_chunks(uuid, text, integer) TO anon, authenticated, service_role;

-- Legacy entry point now searches the sample offboarding only.
CREATE OR REPLACE FUNCTION public.search_chunks(p_question text, p_limit integer DEFAULT 4)
RETURNS TABLE(chunk_id bigint, document_id uuid, filename text, content text, score double precision)
LANGUAGE sql STABLE AS $$ SELECT * FROM public.search_offboarding_chunks('00000000-0000-4000-8000-0000000000a1', p_question, p_limit) $$;

CREATE OR REPLACE FUNCTION public.apply_offboarding_allocations(p_offboarding_id uuid, p_allocations jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE item jsonb; member public.team_members; task public.tasks; projected integer; ob public.offboardings;
BEGIN
 SELECT * INTO ob FROM public.offboardings WHERE id = p_offboarding_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Offboarding not found.'; END IF;
 IF ob.status = 'completed' THEN RAISE EXCEPTION 'This offboarding is completed and read-only.'; END IF;
 PERFORM id FROM public.tasks WHERE offboarding_id = p_offboarding_id ORDER BY id FOR UPDATE;
 PERFORM id FROM public.team_members ORDER BY id FOR UPDATE;
 IF jsonb_array_length(p_allocations) <> (SELECT count(*) FROM public.tasks WHERE offboarding_id = p_offboarding_id AND status = 'pending') THEN RAISE EXCEPTION 'Tasks changed. Refresh and distribute again.'; END IF;
 IF (SELECT count(DISTINCT x->>'task_id') FROM jsonb_array_elements(p_allocations) x) <> jsonb_array_length(p_allocations) THEN RAISE EXCEPTION 'Duplicate task assignment.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
  SELECT * INTO task FROM public.tasks WHERE id = (item->>'task_id')::uuid AND status = 'pending' AND offboarding_id = p_offboarding_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is no longer pending.'; END IF;
  SELECT * INTO member FROM public.team_members WHERE id = (item->>'buyer_id')::uuid AND NOT departed AND id IS DISTINCT FROM ob.departing_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buyer not available.'; END IF;
  IF item->>'confidence' NOT IN ('High','Medium','Low') OR item->>'confidence' IS NULL THEN RAISE EXCEPTION 'Invalid confidence.'; END IF;
  IF item->>'source_file' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.documents WHERE filename = item->>'source_file' AND offboarding_id = p_offboarding_id) THEN RAISE EXCEPTION 'Source not found.'; END IF;
  UPDATE public.tasks SET status = 'assigned', assigned_member_id = member.id, assigned_buyer = member.name, assigned_initials = member.initials, assigned_tone = member.tone, rationale = item->>'rationale', confidence = item->>'confidence', source_file = item->>'source_file', assigned_at = now() WHERE id = task.id;
 END LOOP;
 FOR member IN SELECT * FROM public.team_members LOOP
  SELECT member.capacity + coalesce(sum(CASE WHEN criticality = 'High' THEN 10 ELSE 5 END),0) INTO projected FROM public.tasks WHERE offboarding_id = p_offboarding_id AND status IN ('proposed','approved') AND assigned_member_id = member.id;
  IF projected > 100 THEN RAISE EXCEPTION 'Allocation exceeds 100 percent workload for %.', member.name; END IF;
 END LOOP;
END; $function$;
GRANT EXECUTE ON FUNCTION public.apply_offboarding_allocations(uuid, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_task_allocations(p_allocations jsonb)
RETURNS void LANGUAGE sql AS $$ SELECT public.apply_offboarding_allocations('00000000-0000-4000-8000-0000000000a1', p_allocations) $$;

-- Review: completed offboardings are read-only; reassign only within the available pool.
CREATE OR REPLACE FUNCTION public.review_task(p_task_id uuid, p_action text, p_buyer_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT ''::text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ DECLARE t public.tasks; b public.team_members; ob public.offboardings; decision text; BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE; PERFORM id FROM public.team_members ORDER BY id FOR UPDATE;
 SELECT * INTO t FROM public.tasks WHERE id=p_task_id;
 IF NOT FOUND OR t.status<>'proposed' THEN RAISE EXCEPTION 'Only proposed tasks can be reviewed. Refresh the workspace.'; END IF;
 SELECT * INTO ob FROM public.offboardings WHERE id=t.offboarding_id;
 IF ob.status='completed' THEN RAISE EXCEPTION 'This offboarding is completed and read-only.'; END IF;
 IF p_action NOT IN ('approve','reassign','reject') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid action.'; END IF;
 IF p_action IN ('reassign','reject') AND length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'A reason of at least 10 characters is required.'; END IF;
 IF p_action='approve' THEN
  UPDATE public.tasks SET status='approved' WHERE id=t.id; decision := 'Approved by manager: ' || t.assigned_buyer;
 ELSIF p_action='reassign' THEN
  SELECT * INTO b FROM public.team_members WHERE id=p_buyer_id AND NOT departed AND id IS DISTINCT FROM ob.departing_member_id;
  IF NOT FOUND OR b.id=t.assigned_member_id THEN RAISE EXCEPTION 'Choose another buyer.'; END IF;
  UPDATE public.tasks SET assigned_member_id=b.id,assigned_buyer=b.name,assigned_initials=b.initials,assigned_tone=b.tone,overridden=true,rationale='Manager override: ' || btrim(p_reason) WHERE id=t.id;
  decision := 'Reassigned to ' || b.name || ' — awaiting approval';
 ELSE
  UPDATE public.tasks SET status='pending',assigned_member_id=null,assigned_buyer=null,assigned_initials=null,assigned_tone=null,overridden=true,rationale=null WHERE id=t.id; decision := 'Rejected — unassigned';
 END IF;
 INSERT INTO public.task_decisions(task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason) VALUES(t.id,t.proposal_id,t.title,p_action,t.ai_proposed_buyer,decision,CASE WHEN p_action='approve' THEN 'Manager approved the proposed owner' ELSE btrim(p_reason) END);
END; $function$;

CREATE OR REPLACE FUNCTION public.approve_offboarding_tasks(p_offboarding_id uuid) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t public.tasks; BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE;
 FOR t IN SELECT * FROM public.tasks WHERE status='proposed' AND offboarding_id=p_offboarding_id ORDER BY position LOOP PERFORM public.review_task(t.id,'approve'); END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_offboarding_tasks(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.approve_remaining_tasks() RETURNS void LANGUAGE sql AS $$ SELECT public.approve_offboarding_tasks('00000000-0000-4000-8000-0000000000a1') $$;

-- Reset only ever touches the sample offboarding.
CREATE OR REPLACE FUNCTION public.reset_task_demo() RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$ BEGIN
 PERFORM id FROM public.tasks WHERE offboarding_id='00000000-0000-4000-8000-0000000000a1' ORDER BY id FOR UPDATE;
 UPDATE public.tasks SET status='pending',assigned_buyer=null,assigned_initials=null,assigned_tone=null,assigned_member_id=null,rationale=null,confidence=null,source_file=null,assigned_at=null,ai_proposed_buyer=null,proposal_id=null,overridden=false WHERE offboarding_id='00000000-0000-4000-8000-0000000000a1';
 DELETE FROM public.task_decisions WHERE offboarding_id='00000000-0000-4000-8000-0000000000a1';
 DELETE FROM public.documents WHERE offboarding_id='00000000-0000-4000-8000-0000000000a1' AND detail = 'Uploaded document' AND filename NOT IN ('AMCOR_Paper_Supplier_Contract.pdf','Email_Log_PlasticsCorp.eml','Laura_Personal_Notes.docx','LogisticsCorp_Service_Agreement.pdf','ChemSol_Contract.pdf','Q3_Vendor_Spend.xlsx');
 UPDATE public.offboardings SET status='in_review' WHERE id='00000000-0000-4000-8000-0000000000a1';
END; $function$;