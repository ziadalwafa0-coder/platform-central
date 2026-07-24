
-- =========== ROLES ===========
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','manager','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========== SYNC RUNS ===========
CREATE TABLE IF NOT EXISTS public.sr_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'safka',
  status text NOT NULL DEFAULT 'pending', -- pending|running|success|failed|cancelled
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  pages_fetched integer NOT NULL DEFAULT 0,
  products_total integer NOT NULL DEFAULT 0,
  products_processed integer NOT NULL DEFAULT 0,
  products_inserted integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_failed integer NOT NULL DEFAULT 0,
  total_inventory bigint NOT NULL DEFAULT 0,
  inventory_delta bigint NOT NULL DEFAULT 0,
  withdrawal_delta bigint NOT NULL DEFAULT 0,
  restock_delta bigint NOT NULL DEFAULT 0,
  error_message text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manual_or_auto text NOT NULL DEFAULT 'manual',
  cancel_requested boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.sr_sync_runs TO authenticated;
GRANT ALL ON public.sr_sync_runs TO service_role;
ALTER TABLE public.sr_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read sync runs" ON public.sr_sync_runs;
CREATE POLICY "auth read sync runs" ON public.sr_sync_runs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS sr_sync_runs_started_idx ON public.sr_sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS sr_sync_runs_status_idx  ON public.sr_sync_runs(status);

-- =========== SYNC LOGS ===========
CREATE TABLE IF NOT EXISTS public.sr_sync_logs (
  id bigserial PRIMARY KEY,
  run_id uuid REFERENCES public.sr_sync_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info', -- debug|info|warn|error
  code text,
  message text NOT NULL,
  page integer,
  external_product_id text,
  meta jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sr_sync_logs TO authenticated;
GRANT ALL ON public.sr_sync_logs TO service_role;
ALTER TABLE public.sr_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read sync logs" ON public.sr_sync_logs;
CREATE POLICY "auth read sync logs" ON public.sr_sync_logs FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS sr_sync_logs_run_idx ON public.sr_sync_logs(run_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS sr_sync_logs_level_idx ON public.sr_sync_logs(level, observed_at DESC);

-- =========== SCHEMA DRIFT ===========
CREATE TABLE IF NOT EXISTS public.sr_schema_warnings (
  id bigserial PRIMARY KEY,
  platform text NOT NULL DEFAULT 'safka',
  field_path text NOT NULL,
  sample_value jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 1,
  UNIQUE (platform, field_path)
);
GRANT SELECT ON public.sr_schema_warnings TO authenticated;
GRANT ALL ON public.sr_schema_warnings TO service_role;
ALTER TABLE public.sr_schema_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read schema warnings" ON public.sr_schema_warnings;
CREATE POLICY "auth read schema warnings" ON public.sr_schema_warnings FOR SELECT TO authenticated USING (true);

-- =========== PERFORMANCE INDEXES ===========
CREATE INDEX IF NOT EXISTS sr_products_qty_idx      ON public.sr_products(current_quantity);
CREATE INDEX IF NOT EXISTS sr_products_updated_idx  ON public.sr_products(updated_at DESC);
CREATE INDEX IF NOT EXISTS sr_snapshots_time_idx    ON public.sr_snapshots(observed_at DESC);
CREATE INDEX IF NOT EXISTS sr_snapshots_product_idx ON public.sr_snapshots(external_product_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS sr_snapshots_decrease_idx ON public.sr_snapshots(observed_at DESC) WHERE quantity_decrease > 0;
