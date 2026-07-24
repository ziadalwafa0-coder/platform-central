
REVOKE ALL ON FUNCTION public.reap_stuck_sync_runs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stuck_sync_runs(INT) TO service_role;
