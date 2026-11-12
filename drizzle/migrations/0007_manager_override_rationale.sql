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
  UPDATE public.tasks SET assigned_member_id=b.id,assigned_buyer=b.name,assigned_initials=b.initials,assigned_tone=b.tone,overridden=true,rationale='Manager override: ' || btrim(p_reason) WHERE id=t.id;
  decision := 'Reassigned to ' || b.name || ' — awaiting approval';
 ELSE
  UPDATE public.tasks SET status='pending',assigned_member_id=null,assigned_buyer=null,assigned_initials=null,assigned_tone=null,overridden=true,rationale=null WHERE id=t.id; decision := 'Rejected — unassigned';
 END IF;
 INSERT INTO public.task_decisions(task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason) VALUES(t.id,t.proposal_id,t.title,p_action,t.ai_proposed_buyer,decision,CASE WHEN p_action='approve' THEN 'Manager approved the proposed owner' ELSE btrim(p_reason) END);
END; $$;