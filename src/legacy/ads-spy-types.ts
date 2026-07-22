// Type isolation for Ads Spy (رادار الإعلانات)
// Complies with section 5 of the Merge Strategy

export interface AdsSpyProduct {
  id: string; // Stock-Radaar legacy ID or UUID resolved deterministically
  name: string;
  sku?: string;
  category?: string;
  product_url?: string;
  image_url?: string;
  brand?: string;
  platform_connection_id?: string | null;
  raw_metadata?: Record<string, unknown>;
}

export interface AdSpySearchProfile {
  id: string;
  product_id: string;
  keywords: string[];
  country_codes: string[];
  providers: ("meta" | "tiktok")[];
  max_results_per_query?: number;
  is_active: boolean;
  sync_interval_hours?: number;
  last_synced_at?: string | null;
  next_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AdSpyJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "EMPTY" | "BLOCKED" | "FAILED" | "CANCELLED";

export interface AdSpyJob {
  id: string;
  product_id: string;
  search_profile_id?: string;
  status: AdSpyJobStatus;
  providers: ("meta" | "tiktok")[];
  country_codes: string[];
  keywords: string[];
  max_results_per_query: number;
  progress_percentage: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  relevant_ads_discovered?: number;
  queries_attempted?: number;
  trigger_reason?: "MANUAL" | "DAILY_WITHDRAWAL";
  business_date?: string | null;
  withdrawal_events_count?: number;
  attempt_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AdSpyAd {
  id: string;
  source_platform: "meta" | "tiktok";
  external_ad_id: string;
  advertiser_name: string;
  advertiser_id?: string;
  ad_url?: string;
  image_url?: string;
  video_url?: string;
  headline?: string;
  body_text?: string;
  cta_label?: string;
  published_at?: string;
  is_active: boolean;
  raw_scraped_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type AdSpyMatchStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

export interface AdSpyProductMatch {
  id: string;
  product_id: string;
  ad_id: string;
  job_id: string;
  match_score: number; // 0 to 100
  match_status: AdSpyMatchStatus;
  user_decision: "APPROVED" | "REJECTED" | null;
  reviewed_by_user?: string | null;
  created_at: string;
  updated_at: string;
  // Included relation
  ad?: AdSpyAd;
  analysis?: AdSpyAnalysis;
}

export interface AdSpyAnalysis {
  id: string;
  product_match_id: string;
  hook?: string;
  marketing_angle?: string;
  awareness_level?: string;
  pain_points?: string[];
  benefits?: string[];
  target_audience?: string;
  offer?: string;
  discount?: string;
  creative_style?: string;
  cta?: string;
  objections?: string[];
  strengths?: string[];
  weaknesses?: string[];
  differentiation_opportunities?: string[];
  content_type?: string;
  platforms?: string[];
  caption_summary?: string;
  objective?: string;
  funnel_stage?: string;
  persuasion_framework?: string;
  emotional_triggers?: string[];
  proof_elements?: string[];
  tone?: string;
  recommended_action?: string;
  analysis_confidence?: number;
  evidence_notes?: string[];
  product_match_confidence?: number;
  model_name?: string;
  prompt_version?: string;
  raw_output?: string;
  created_at: string;
  updated_at: string;
}

export interface AdsSpyBreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

export interface AdSpyRunLog {
  id: string;
  job_id: string;
  provider: "meta" | "tiktok";
  step: string;
  status: "INFO" | "WARNING" | "ERROR" | "BLOCKED";
  message: string;
  screenshot_url?: string;
  page_url?: string;
  created_at: string;
}

export interface AdsSpySummary {
  discovered_ads: number;
  matched_ads: number;
  needs_review: number;
  active_ads: number;
  unique_advertisers: number;
  meta_count: number;
  tiktok_count: number;
  image_video_ratio: number;
  median_running_duration_days: number;
  new_ads_7_days: number;
  new_ads_30_days: number;
  top_hooks: string[];
  top_angles: string[];
  top_offers: string[];
  repeated_creatives_count: number;
  saturation_score: number;
  creative_opportunity_score: number;
  analyzed_ads: number;
  analysis_coverage: number;
  cta_breakdown: AdsSpyBreakdownItem[];
  content_type_breakdown: AdsSpyBreakdownItem[];
  objective_breakdown: AdsSpyBreakdownItem[];
  platform_breakdown: AdsSpyBreakdownItem[];
  advertiser_breakdown: AdsSpyBreakdownItem[];
  top_creative_styles: string[];
  top_pain_points: string[];
  opportunity_gaps: string[];
  product_recommendations: string[];
  latest_ad_seen_at: string | null;
}
