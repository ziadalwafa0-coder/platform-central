import { safeFetchJson } from "./api";
import { 
  AdSpySearchProfile, 
  AdSpyJob, 
  AdSpyProductMatch, 
  AdsSpySummary,
  AdSpyRunLog
} from "../ads-spy-types";

export interface CreateJobPayload {
  product_id: string;
  providers: ("meta" | "tiktok")[];
  country_codes: string[];
  keywords: string[];
  max_results_per_query?: number;
}

export interface SaveProfilePayload {
  keywords: string[];
  country_codes: string[];
  providers: ("meta" | "tiktok")[];
  max_results_per_query?: number;
  is_active: boolean;
  sync_interval_hours?: number;
}

export interface AdsBySkuResponse {
  product: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    imageUrl?: string;
    productUrl?: string;
  };
  ads: AdSpyProductMatch[];
  summary: AdsSpySummary;
}

export interface KeywordPlanResponse {
  tier1: string[];
  tier2: string[];
  tier3: string[];
  tier4: string[];
  tier5: string[];
}

export const adsSpyApi = {
  getHealth: () => 
    safeFetchJson<{ status: string; timestamp: string }>("/api/ads-spy/health"),

  getSearchProfile: (productId: string) => 
    safeFetchJson<AdSpySearchProfile | null>(`/api/ads-spy/products/${productId}/profile`),

  getKeywordPlan: (productId: string) =>
    safeFetchJson<KeywordPlanResponse>(`/api/ads-spy/products/${productId}/keywords/plan`),

  saveSearchProfile: (productId: string, payload: SaveProfilePayload) => 
    safeFetchJson<AdSpySearchProfile>(`/api/ads-spy/products/${productId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),

  getJobs: (productId?: string) => 
    safeFetchJson<AdSpyJob[]>(`/api/ads-spy/jobs${productId ? `?productId=${encodeURIComponent(productId)}` : ""}`),

  createJob: (payload: CreateJobPayload) => 
    safeFetchJson<AdSpyJob>(`/api/ads-spy/jobs?productId=${encodeURIComponent(payload.product_id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),

  getJobStatus: (jobId: string) => 
    safeFetchJson<AdSpyJob>(`/api/ads-spy/jobs/${jobId}`),

  cancelJob: (jobId: string) => 
    safeFetchJson<AdSpyJob>(`/api/ads-spy/jobs/${jobId}/cancel`, {
      method: "POST"
    }),

  retryJob: (jobId: string) => 
    safeFetchJson<AdSpyJob>(`/api/ads-spy/jobs/${jobId}/retry`, {
      method: "POST"
    }),

  getJobLogs: (jobId: string) =>
    safeFetchJson<{ success: boolean; logs: AdSpyRunLog[] }>(`/api/ads-spy/jobs/${jobId}/logs`),

  getProductAds: (productId: string) => 
    safeFetchJson<AdSpyProductMatch[]>(`/api/ads-spy/products/${productId}/ads`),

  getAdsBySku: (sku: string) =>
    safeFetchJson<AdsBySkuResponse>(`/api/ads-spy/products/by-sku/${encodeURIComponent(sku.trim())}/ads`),

  getProductSummary: (productId: string) => 
    safeFetchJson<AdsSpySummary>(`/api/ads-spy/products/${productId}/summary`),

  approveMatch: (matchId: string) => 
    safeFetchJson<AdSpyProductMatch>(`/api/ads-spy/matches/${matchId}/approve`, {
      method: "POST"
    }),

  rejectMatch: (matchId: string) => 
    safeFetchJson<AdSpyProductMatch>(`/api/ads-spy/matches/${matchId}/reject`, {
      method: "POST"
    }),

  getDiagnostics: (jobId: string) => 
    safeFetchJson<any>(`/api/ads-spy/diagnostics/${jobId}`),

  triggerWorkerRunOnce: () => 
    safeFetchJson<{ status: string; message: string }>("/api/ads-spy/worker/run-once", {
      method: "POST"
    }),

  triggerCron: (cronSecret: string) => 
    safeFetchJson<{ status: string }>("/api/ads-spy/automation/run", {
      method: "POST",
      headers: { "X-Ads-Spy-Secret": cronSecret }
    })
};
