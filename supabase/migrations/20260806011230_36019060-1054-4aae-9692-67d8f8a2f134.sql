-- 1. Connections
CREATE TABLE public.tager_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  encrypted_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT (id, user_id, status, last_sync, last_error, created_at, updated_at) ON public.tager_connections TO authenticated;
GRANT DELETE ON public.tager_connections TO authenticated;
GRANT ALL ON public.tager_connections TO service_role;
ALTER TABLE public.tager_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tager connection" ON public.tager_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users delete own tager connection" ON public.tager_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. Products
CREATE TABLE public.tager_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.tager_connections(id) ON DELETE CASCADE,
  external_product_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  sku TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'EGP',
  stock INTEGER,
  previous_stock INTEGER,
  image TEXT,
  category TEXT,
  brand TEXT,
  status TEXT,
  metadata JSONB,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_product_id)
);
CREATE INDEX tager_products_conn_idx ON public.tager_products(connection_id);
GRANT SELECT ON public.tager_products TO authenticated;
GRANT ALL ON public.tager_products TO service_role;
ALTER TABLE public.tager_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tager products" ON public.tager_products
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tager_connections c WHERE c.id = connection_id AND c.user_id = auth.uid()
  ));

-- 3. Snapshots
CREATE TABLE public.tager_snapshots (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.tager_products(id) ON DELETE CASCADE,
  stock INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tager_snapshots_product_idx ON public.tager_snapshots(product_id, captured_at DESC);
GRANT SELECT ON public.tager_snapshots TO authenticated;
GRANT ALL ON public.tager_snapshots TO service_role;
ALTER TABLE public.tager_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tager snapshots" ON public.tager_snapshots
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tager_products p
    JOIN public.tager_connections c ON c.id = p.connection_id
    WHERE p.id = product_id AND c.user_id = auth.uid()
  ));

-- 4. Events
CREATE TABLE public.tager_events (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.tager_products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_stock INTEGER,
  current_stock INTEGER,
  difference INTEGER NOT NULL DEFAULT 0,
  run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tager_events_product_idx ON public.tager_events(product_id, created_at DESC);
CREATE INDEX tager_events_created_idx ON public.tager_events(created_at DESC);
GRANT SELECT ON public.tager_events TO authenticated;
GRANT ALL ON public.tager_events TO service_role;
ALTER TABLE public.tager_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tager events" ON public.tager_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tager_products p
    JOIN public.tager_connections c ON c.id = p.connection_id
    WHERE p.id = product_id AND c.user_id = auth.uid()
  ));

-- 5. Error log
CREATE TABLE public.tager_errors (
  id BIGSERIAL PRIMARY KEY,
  connection_id UUID REFERENCES public.tager_connections(id) ON DELETE CASCADE,
  run_id UUID,
  status_code INTEGER,
  code TEXT,
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tager_errors_created_idx ON public.tager_errors(created_at DESC);
GRANT SELECT ON public.tager_errors TO authenticated;
GRANT ALL ON public.tager_errors TO service_role;
ALTER TABLE public.tager_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tager errors" ON public.tager_errors
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tager_connections c WHERE c.id = connection_id AND c.user_id = auth.uid()
  ));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_tager_connections_updated_at BEFORE UPDATE ON public.tager_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tager_products_updated_at BEFORE UPDATE ON public.tager_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();