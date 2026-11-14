CREATE OR REPLACE FUNCTION public.validate_review_capacity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE load integer; BEGIN
 IF NEW.status IN ('proposed','approved') AND NEW.assigned_member_id IS NOT NULL THEN
 SELECT capacity + coalesce((SELECT sum(CASE WHEN criticality='High' THEN 10 ELSE 5 END) FROM public.tasks WHERE id<>NEW.id AND offboarding_id=NEW.offboarding_id AND status IN ('proposed','approved') AND assigned_member_id=NEW.assigned_member_id),0) + CASE WHEN NEW.criticality='High' THEN 10 ELSE 5 END INTO load FROM public.team_members WHERE id=NEW.assigned_member_id;
 IF load>90 THEN RAISE EXCEPTION 'This decision would exceed 90 percent workload.'; END IF;
 END IF; RETURN NEW;
END; $$;

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
  IF projected > 90 THEN RAISE EXCEPTION 'Allocation exceeds 90 percent workload for %.', member.name; END IF;
 END LOOP;
END; $function$;