CREATE FUNCTION public.n8n_outcome_record(p_proposal_id uuid, p_worked text, p_supplier_term_lost boolean, p_comment text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE outcome public.allocation_outcomes%ROWTYPE;
BEGIN
  IF p_proposal_id IS NULL THEN
    RAISE EXCEPTION 'proposal_id must be a valid UUID' USING ERRCODE = '22023';
  END IF;
  IF p_worked IS NULL OR p_worked NOT IN ('yes', 'partly', 'no') THEN
    RAISE EXCEPTION 'worked must be yes, partly, or no' USING ERRCODE = '22023';
  END IF;
  IF p_supplier_term_lost IS NULL THEN
    RAISE EXCEPTION 'supplier_term_lost must be a boolean' USING ERRCODE = '22023';
  END IF;
  IF p_comment IS NOT NULL AND char_length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'comment must be at most 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO outcome FROM public.allocation_outcomes
    WHERE proposal_id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF outcome.answered_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_answered');
  END IF;
  UPDATE public.allocation_outcomes
    SET worked = p_worked, supplier_term_lost = p_supplier_term_lost,
        comment = p_comment, answered_at = now()
    WHERE proposal_id = p_proposal_id AND answered_at IS NULL
    RETURNING * INTO outcome;
  RETURN jsonb_build_object('updated', 1, 'row', jsonb_build_object(
    'proposal_id', outcome.proposal_id, 'task_id', outcome.task_id,
    'offboarding_id', outcome.offboarding_id, 'worked', outcome.worked,
    'supplier_term_lost', outcome.supplier_term_lost, 'comment', outcome.comment,
    'answered_at', outcome.answered_at));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.n8n_outcome_record(uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_outcome_record(uuid, text, boolean, text) TO service_role;