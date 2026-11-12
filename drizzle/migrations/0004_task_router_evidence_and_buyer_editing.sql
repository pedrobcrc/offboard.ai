ALTER TABLE public.tasks ADD COLUMN supplier text NOT NULL DEFAULT '', ADD COLUMN due_date date, ADD COLUMN criticality text NOT NULL DEFAULT 'Medium', ADD COLUMN confidence text, ADD COLUMN source_file text, ADD COLUMN assigned_member_id uuid;
GRANT UPDATE ON public.team_members TO anon, authenticated;
CREATE POLICY "Demo buyers can be edited" ON public.team_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.apply_task_allocations(p_allocations jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE item jsonb; member public.team_members; task public.tasks; projected integer;
BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE;
 PERFORM id FROM public.team_members ORDER BY id FOR UPDATE;
 IF jsonb_array_length(p_allocations) <> (SELECT count(*) FROM public.tasks WHERE status = 'pending') THEN RAISE EXCEPTION 'Tasks changed. Refresh and distribute again.'; END IF;
 IF (SELECT count(DISTINCT x->>'task_id') FROM jsonb_array_elements(p_allocations) x) <> jsonb_array_length(p_allocations) THEN RAISE EXCEPTION 'Duplicate task assignment.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
  SELECT * INTO task FROM public.tasks WHERE id = (item->>'task_id')::uuid AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is no longer pending.'; END IF;
  SELECT * INTO member FROM public.team_members WHERE id = (item->>'buyer_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buyer not found.'; END IF;
  IF item->>'confidence' NOT IN ('High','Medium','Low') OR item->>'confidence' IS NULL THEN RAISE EXCEPTION 'Invalid confidence.'; END IF;
  IF item->>'source_file' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.documents WHERE filename = item->>'source_file') THEN RAISE EXCEPTION 'Source not found.'; END IF;
  UPDATE public.tasks SET status = 'assigned', assigned_member_id = member.id, assigned_buyer = member.name, assigned_initials = member.initials, assigned_tone = member.tone, rationale = item->>'rationale', confidence = item->>'confidence', source_file = item->>'source_file', assigned_at = now() WHERE id = task.id;
 END LOOP;
 FOR member IN SELECT * FROM public.team_members LOOP
  SELECT member.capacity + coalesce(sum(CASE WHEN criticality = 'High' THEN 10 ELSE 5 END),0) INTO projected FROM public.tasks WHERE status = 'assigned' AND assigned_member_id = member.id;
  IF projected > 100 THEN RAISE EXCEPTION 'Allocation exceeds 100 percent workload for %.', member.name; END IF;
 END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_task_allocations(jsonb) TO anon, authenticated, service_role;