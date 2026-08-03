-- ============ settings ============
CREATE TABLE public.sr_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sr_settings TO authenticated;
GRANT ALL ON public.sr_settings TO service_role;
ALTER TABLE public.sr_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read settings" ON public.sr_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.sr_settings(key, value) VALUES
  ('scheduler', '{"enabled": true, "intervalMinutes": 20, "timezone": "Africa/Cairo", "lastAutoRunAt": null}'::jsonb);

-- ============ ads spy ============
CREATE TABLE public.sr_ads_spy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL UNIQUE,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  providers TEXT[] NOT NULL DEFAULT '{meta}',
  max_results_per_query INT NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sync_interval_hours INT NOT NULL DEFAULT 24,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sr_ads_spy_profiles TO authenticated;
GRANT ALL ON public.sr_ads_spy_profiles TO service_role;
ALTER TABLE public.sr_ads_spy_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads profiles" ON public.sr_ads_spy_profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sr_ads_spy_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  search_profile_id UUID REFERENCES public.sr_ads_spy_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  providers TEXT[] NOT NULL DEFAULT '{}',
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  max_results_per_query INT NOT NULL DEFAULT 20,
  progress_percentage INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  worker_id TEXT,
  heartbeat_at TIMESTAMPTZ,
  relevant_ads_discovered INT NOT NULL DEFAULT 0,
  queries_attempted INT NOT NULL DEFAULT 0,
  trigger_reason TEXT NOT NULL DEFAULT 'MANUAL',
  business_date DATE,
  withdrawal_events_count INT NOT NULL DEFAULT 0,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ads_spy_jobs_product ON public.sr_ads_spy_jobs(product_id, created_at DESC);
GRANT SELECT ON public.sr_ads_spy_jobs TO authenticated;
GRANT ALL ON public.sr_ads_spy_jobs TO service_role;
ALTER TABLE public.sr_ads_spy_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads jobs" ON public.sr_ads_spy_jobs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sr_ads_spy_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL,
  external_ad_id TEXT NOT NULL,
  advertiser_name TEXT NOT NULL DEFAULT '',
  advertiser_id TEXT,
  ad_url TEXT,
  image_url TEXT,
  video_url TEXT,
  headline TEXT,
  body_text TEXT,
  cta_label TEXT,
  published_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  raw_scraped_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_platform, external_ad_id)
);
GRANT SELECT ON public.sr_ads_spy_ads TO authenticated;
GRANT ALL ON public.sr_ads_spy_ads TO service_role;
ALTER TABLE public.sr_ads_spy_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads" ON public.sr_ads_spy_ads FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sr_ads_spy_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  ad_id UUID NOT NULL REFERENCES public.sr_ads_spy_ads(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.sr_ads_spy_jobs(id) ON DELETE SET NULL,
  match_score NUMERIC NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  user_decision TEXT,
  reviewed_by_user UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, ad_id)
);
CREATE INDEX idx_ads_spy_matches_product ON public.sr_ads_spy_matches(product_id);
GRANT SELECT ON public.sr_ads_spy_matches TO authenticated;
GRANT ALL ON public.sr_ads_spy_matches TO service_role;
ALTER TABLE public.sr_ads_spy_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads matches" ON public.sr_ads_spy_matches FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sr_ads_spy_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_match_id UUID NOT NULL REFERENCES public.sr_ads_spy_matches(id) ON DELETE CASCADE UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_name TEXT,
  prompt_version TEXT,
  raw_output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sr_ads_spy_analyses TO authenticated;
GRANT ALL ON public.sr_ads_spy_analyses TO service_role;
ALTER TABLE public.sr_ads_spy_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads analyses" ON public.sr_ads_spy_analyses FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sr_ads_spy_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID REFERENCES public.sr_ads_spy_jobs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  screenshot_url TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ads_spy_logs_job ON public.sr_ads_spy_logs(job_id, created_at DESC);
GRANT SELECT ON public.sr_ads_spy_logs TO authenticated;
GRANT ALL ON public.sr_ads_spy_logs TO service_role;
ALTER TABLE public.sr_ads_spy_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ads logs" ON public.sr_ads_spy_logs FOR SELECT TO authenticated USING (true);