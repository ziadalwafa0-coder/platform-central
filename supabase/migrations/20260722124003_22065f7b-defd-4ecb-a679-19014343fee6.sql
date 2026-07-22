
CREATE TABLE public.sr_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_product_id text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'safka',
  name text NOT NULL,
  sku text,
  price numeric,
  currency text DEFAULT 'EGP',
  image_url text,
  product_url text,
  category text,
  current_quantity integer,
  previous_quantity integer,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sr_products_platform_idx ON public.sr_products(platform);

GRANT SELECT ON public.sr_products TO anon;
GRANT SELECT ON public.sr_products TO authenticated;
GRANT ALL  ON public.sr_products TO service_role;
ALTER TABLE public.sr_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sr_products" ON public.sr_products FOR SELECT USING (true);

CREATE TABLE public.sr_snapshots (
  id bigserial PRIMARY KEY,
  external_product_id text NOT NULL,
  platform text NOT NULL DEFAULT 'safka',
  previous_quantity integer,
  current_quantity integer,
  quantity_decrease integer NOT NULL DEFAULT 0,
  restock_amount integer NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sr_snapshots_ext_idx  ON public.sr_snapshots(external_product_id);
CREATE INDEX sr_snapshots_time_idx ON public.sr_snapshots(observed_at DESC);

GRANT SELECT ON public.sr_snapshots TO anon;
GRANT SELECT ON public.sr_snapshots TO authenticated;
GRANT ALL  ON public.sr_snapshots TO service_role;
ALTER TABLE public.sr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sr_snapshots" ON public.sr_snapshots FOR SELECT USING (true);
