
-- === Dead Letter Queue ===
CREATE TABLE public.sr_dead_letter (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'safka',
  run_id UUID,
  kind TEXT NOT NULL, -- 'product_upsert' | 'snapshot_insert'
  payload JSONB NOT NULL,
  error_code TEXT,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sr_dead_letter_unresolved_idx ON public.sr_dead_letter (platform, resolved_at) WHERE resolved_at IS NULL;
GRANT SELECT ON public.sr_dead_letter TO authenticated;
GRANT ALL ON public.sr_dead_letter TO service_role;
ALTER TABLE public.sr_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dead letter" ON public.sr_dead_letter FOR SELECT TO authenticated USING (true);

-- === Circuit Breaker State ===
CREATE TABLE public.sr_circuit_state (
  platform TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'closed', -- closed | open | half_open
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  next_probe_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sr_circuit_state TO authenticated;
GRANT ALL ON public.sr_circuit_state TO service_role;
ALTER TABLE public.sr_circuit_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read circuit state" ON public.sr_circuit_state FOR SELECT TO authenticated USING (true);
INSERT INTO public.sr_circuit_state (platform) VALUES ('safka') ON CONFLICT (platform) DO NOTHING;

-- === Idempotency Keys ===
CREATE TABLE public.sr_idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  run_id UUID,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | done | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX sr_idem_expires_idx ON public.sr_idempotency_keys (expires_at);
GRANT SELECT ON public.sr_idempotency_keys TO authenticated;
GRANT ALL ON public.sr_idempotency_keys TO service_role;
ALTER TABLE public.sr_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read idem" ON public.sr_idempotency_keys FOR SELECT TO authenticated USING (true);

-- === Health Metrics ===
CREATE TABLE public.sr_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL,
  tags JSONB,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sr_health_metrics_metric_time_idx ON public.sr_health_metrics (metric, observed_at DESC);
GRANT SELECT ON public.sr_health_metrics TO authenticated;
GRANT ALL ON public.sr_health_metrics TO service_role;
ALTER TABLE public.sr_health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read health metrics" ON public.sr_health_metrics FOR SELECT TO authenticated USING (true);

-- === Distributed lock: at most one running run per platform ===
CREATE UNIQUE INDEX sr_sync_runs_one_running_per_platform
  ON public.sr_sync_runs (platform)
  WHERE status IN ('pending','running');

-- Helpful indexes for observability queries
CREATE INDEX IF NOT EXISTS sr_sync_runs_platform_started_idx
  ON public.sr_sync_runs (platform, started_at DESC);
CREATE INDEX IF NOT EXISTS sr_sync_logs_run_time_idx
  ON public.sr_sync_logs (run_id, observed_at DESC);

-- === Reaper: mark stuck runs failed ===
CREATE OR REPLACE FUNCTION public.reap_stuck_sync_runs(_older_than_minutes INT DEFAULT 10)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.sr_sync_runs
     SET status = 'failed',
         finished_at = now(),
         error_message = COALESCE(error_message, 'reaped: stuck > ' || _older_than_minutes || 'm')
   WHERE status IN ('pending','running')
     AND started_at < now() - (_older_than_minutes || ' minutes')::INTERVAL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
