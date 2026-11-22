CREATE FUNCTION public.reset_demo_with_outcomes()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.reset_task_demo();
  DELETE FROM public.allocation_outcomes
  WHERE offboarding_id = '00000000-0000-4000-8000-0000000000a1';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_demo_with_outcomes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_with_outcomes() TO service_role;