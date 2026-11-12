ALTER TABLE public.tasks ADD COLUMN ai_proposed_buyer text, ADD COLUMN proposal_id uuid, ADD COLUMN overridden boolean NOT NULL DEFAULT false;
CREATE TABLE public.task_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL, proposal_id uuid NOT NULL, task_title text NOT NULL, action text NOT NULL, ai_proposal text NOT NULL, final_decision text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.task_decisions TO anon, authenticated;
GRANT ALL ON public.task_decisions TO service_role;
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo decisions read" ON public.task_decisions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo decisions insert" ON public.task_decisions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public demo decisions reset" ON public.task_decisions FOR DELETE TO anon, authenticated USING (true);
CREATE OR REPLACE FUNCTION public.capture_ai_proposal() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF NEW.status='assigned' THEN
  NEW.status := 'proposed'; NEW.ai_proposed_buyer := NEW.assigned_buyer; NEW.proposal_id := gen_random_uuid(); NEW.overridden := false;
  INSERT INTO public.task_decisions(task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason) VALUES(NEW.id,NEW.proposal_id,NEW.title,'propose',NEW.assigned_buyer,'Proposed by AI','Awaiting manager approval');
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER capture_ai_proposal BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.capture_ai_proposal();
CREATE OR REPLACE FUNCTION public.validate_review_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE load integer; BEGIN
 IF NEW.status IN ('proposed','approved') AND NEW.assigned_member_id IS NOT NULL THEN
 SELECT capacity + coalesce((SELECT sum(CASE WHEN criticality='High' THEN 10 ELSE 5 END) FROM public.tasks WHERE id<>NEW.id AND status IN ('proposed','approved') AND assigned_member_id=NEW.assigned_member_id),0) + CASE WHEN NEW.criticality='High' THEN 10 ELSE 5 END INTO load FROM public.team_members WHERE id=NEW.assigned_member_id;
 IF load>100 THEN RAISE EXCEPTION 'This decision would exceed 100 percent workload.'; END IF;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER validate_review_capacity BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.validate_review_capacity();
CREATE OR REPLACE FUNCTION public.review_task(p_task_id uuid,p_action text,p_buyer_id uuid DEFAULT NULL,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE t public.tasks; b public.team_members; decision text; BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE; PERFORM id FROM public.team_members ORDER BY id FOR UPDATE;
 SELECT * INTO t FROM public.tasks WHERE id=p_task_id;
 IF NOT FOUND OR t.status<>'proposed' THEN RAISE EXCEPTION 'Only proposed tasks can be reviewed. Refresh the workspace.'; END IF;
 IF p_action NOT IN ('approve','reassign','reject') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid action.'; END IF;
 IF p_action IN ('reassign','reject') AND length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'A reason of at least 10 characters is required.'; END IF;
 IF p_action='approve' THEN
  UPDATE public.tasks SET status='approved' WHERE id=t.id; decision := 'Approved by manager: ' || t.assigned_buyer;
 ELSIF p_action='reassign' THEN
  SELECT * INTO b FROM public.team_members WHERE id=p_buyer_id;
  IF NOT FOUND OR b.id=t.assigned_member_id THEN RAISE EXCEPTION 'Choose another buyer.'; END IF;
  UPDATE public.tasks SET assigned_member_id=b.id,assigned_buyer=b.name,assigned_initials=b.initials,assigned_tone=b.tone,overridden=true WHERE id=t.id;
  decision := 'Reassigned to ' || b.name || ' — awaiting approval';
 ELSE
  UPDATE public.tasks SET status='pending',assigned_member_id=null,assigned_buyer=null,assigned_initials=null,assigned_tone=null,overridden=true WHERE id=t.id; decision := 'Rejected — unassigned';
 END IF;
 INSERT INTO public.task_decisions(task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason) VALUES(t.id,t.proposal_id,t.title,p_action,t.ai_proposed_buyer,decision,CASE WHEN p_action='approve' THEN 'Manager approved the proposed owner' ELSE btrim(p_reason) END);
END; $$;
GRANT EXECUTE ON FUNCTION public.review_task(uuid,text,uuid,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.approve_remaining_tasks() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE t public.tasks; BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE;
 FOR t IN SELECT * FROM public.tasks WHERE status='proposed' ORDER BY position LOOP PERFORM public.review_task(t.id,'approve'); END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_remaining_tasks() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.reset_task_demo() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE;
 UPDATE public.tasks SET status='pending',assigned_buyer=null,assigned_initials=null,assigned_tone=null,assigned_member_id=null,rationale=null,confidence=null,source_file=null,assigned_at=null,ai_proposed_buyer=null,proposal_id=null,overridden=false;
 DELETE FROM public.task_decisions WHERE id IS NOT NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.reset_task_demo() TO anon,authenticated,service_role;