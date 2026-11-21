CREATE FUNCTION public.n8n_outcomes_due(p_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE result jsonb;
BEGIN
  IF p_days IS NULL OR p_days < 0 OR p_days > 365 THEN
    RAISE EXCEPTION 'days must be an integer from 0 to 365' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(due)), '[]'::jsonb) INTO result
  FROM (
    with latest as (
      select proposal_id, task_id, offboarding_id, task_title, action, created_at,
             row_number() over (partition by proposal_id order by created_at desc) as rn
      from public.task_decisions
    )
    select l.proposal_id, l.task_id, l.offboarding_id, l.task_title, l.action, l.created_at,
           (l.created_at + interval '1 day' * p_days)::date as due_date
    from latest l
    where l.rn = 1
      and l.action in ('approve', 'reassign')
      and l.created_at + interval '1 day' * p_days <= now()
      and not exists (select 1 from public.allocation_outcomes o where o.proposal_id = l.proposal_id)
    order by l.offboarding_id, l.created_at
  ) due;
  RETURN result;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.n8n_outcomes_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_outcomes_due(integer) TO service_role;

CREATE FUNCTION public.n8n_outcomes_mark_sent(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE item jsonb; affected integer; inserted integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a nonempty array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a nonempty array' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(item) <> 'object' OR item->>'proposal_id' IS NULL
       OR item->>'task_id' IS NULL OR item->>'offboarding_id' IS NULL
       OR item->>'due_date' IS NULL THEN
      RAISE EXCEPTION 'Each item requires proposal_id, task_id, offboarding_id and due_date' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.allocation_outcomes (proposal_id, task_id, offboarding_id, due_date, request_sent_at)
    VALUES ((item->>'proposal_id')::uuid, (item->>'task_id')::uuid,
            (item->>'offboarding_id')::uuid, (item->>'due_date')::date, now())
    ON CONFLICT (proposal_id) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    inserted := inserted + affected;
  END LOOP;
  RETURN inserted;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.n8n_outcomes_mark_sent(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_outcomes_mark_sent(jsonb) TO service_role;