/**
 * Ads Radar (رادار الإعلانات) server logic.
 *
 * Contract source of truth: src/legacy/lib/adsSpyApi.ts + src/legacy/ads-spy-types.ts.
 * All shapes below are camel/snake matched to what the UI reads directly.
 *
 * Collection reality check: the pre-migration implementation scraped the Meta /
 * TikTok ad libraries with Playwright/Chromium. That cannot run on this stack
 * (no browser, no subprocesses). So collection here goes through the official
 * Meta Ad Library API when a `META_ADS_TOKEN` secret exists; without it a job is
 * closed as BLOCKED with an explicit reason instead of silently hanging.
 */

const PROVIDER_LABEL: Record<string, string> = { meta: "Meta", tiktok: "TikTok" };

export type Provider = "meta" | "tiktok";

export interface DbJob {
  id: string;
  product_id: string;
  search_profile_id: string | null;
  status: string;
  providers: string[];
  country_codes: string[];
  keywords: string[];
  max_results_per_query: number;
  progress_percentage: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  relevant_ads_discovered: number;
  queries_attempted: number;
  trigger_reason: string;
  business_date: string | null;
  withdrawal_events_count: number;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export function mapJob(row: DbJob) {
  return {
    id: String(row.id),
    product_id: row.product_id,
    search_profile_id: row.search_profile_id ?? undefined,
    status: row.status,
    providers: (row.providers ?? []) as Provider[],
    country_codes: row.country_codes ?? [],
    keywords: row.keywords ?? [],
    max_results_per_query: row.max_results_per_query,
    progress_percentage: row.progress_percentage,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_message: row.error_message,
    worker_id: row.worker_id,
    heartbeat_at: row.heartbeat_at,
    relevant_ads_discovered: row.relevant_ads_discovered,
    queries_attempted: row.queries_attempted,
    trigger_reason: row.trigger_reason,
    business_date: row.business_date,
    withdrawal_events_count: row.withdrawal_events_count,
    attempt_count: row.attempt_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapProfile(row: any) {
  if (!row) return null;
  return {
    id: String(row.id),
    product_id: row.product_id,
    keywords: row.keywords ?? [],
    country_codes: row.country_codes ?? [],
    providers: (row.providers ?? []) as Provider[],
    max_results_per_query: row.max_results_per_query,
    is_active: row.is_active,
    sync_interval_hours: row.sync_interval_hours,
    last_synced_at: row.last_synced_at,
    next_sync_at: row.next_sync_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMatch(row: any) {
  const ad = row.ad ?? null;
  const analysis = row.analysis?.[0] ?? row.analysis ?? null;
  return {
    id: String(row.id),
    product_id: row.product_id,
    ad_id: String(row.ad_id),
    job_id: String(row.job_id ?? ""),
    match_score: Number(row.match_score ?? 0),
    match_status: row.match_status,
    user_decision: row.user_decision,
    reviewed_by_user: row.reviewed_by_user,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ad: ad
      ? {
          id: String(ad.id),
          source_platform: ad.source_platform,
          external_ad_id: ad.external_ad_id,
          advertiser_name: ad.advertiser_name,
          advertiser_id: ad.advertiser_id ?? undefined,
          ad_url: ad.ad_url ?? undefined,
          image_url: ad.image_url ?? undefined,
          video_url: ad.video_url ?? undefined,
          headline: ad.headline ?? undefined,
          body_text: ad.body_text ?? undefined,
          cta_label: ad.cta_label ?? undefined,
          published_at: ad.published_at ?? undefined,
          is_active: ad.is_active,
          raw_scraped_data: ad.raw_scraped_data ?? undefined,
          created_at: ad.created_at,
          updated_at: ad.updated_at,
        }
      : undefined,
    analysis: analysis
      ? {
          id: String(analysis.id),
          product_match_id: String(analysis.product_match_id),
          ...(analysis.payload ?? {}),
          model_name: analysis.model_name ?? undefined,
          prompt_version: analysis.prompt_version ?? undefined,
          raw_output: analysis.raw_output ?? undefined,
          created_at: analysis.created_at,
          updated_at: analysis.updated_at,
        }
      : undefined,
  };
}

const AR_STOPWORDS = new Set(["من", "في", "على", "مع", "الى", "إلى", "عن", "او", "أو", "و", "the", "a", "for", "and", "with"]);

function tokens(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !AR_STOPWORDS.has(t.toLowerCase()));
}

/** Deterministic keyword planner over the product's own fields (no external calls). */
export function buildKeywordPlan(product: { name?: string | null; sku?: string | null; category?: string | null }) {
  const nameTokens = tokens(product.name ?? "");
  const category = (product.category ?? "").trim();
  const base = nameTokens.slice(0, 6);

  const tier1 = [product.name?.trim(), product.sku?.trim()].filter(Boolean) as string[];
  const tier2 = base.slice(0, 4);
  const tier3 = base.slice(0, 3).map((t) => `${t} ${category}`.trim()).filter((t) => t.length > 3);
  const tier4 = category ? [category, `${category} عرض`, `${category} خصم`] : [];
  const tier5 = base.slice(0, 2).flatMap((t) => [`${t} اونلاين`, `${t} توصيل`, `${t} مصر`]);

  const uniq = (arr: string[]) => Array.from(new Set(arr.filter((s) => s && s.trim().length > 1)));
  return { tier1: uniq(tier1), tier2: uniq(tier2), tier3: uniq(tier3), tier4: uniq(tier4), tier5: uniq(tier5) };
}

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function breakdown(values: (string | undefined | null)[], limit = 6) {
  const counts = new Map<string, number>();
  const clean = values.filter((v): v is string => Boolean(v && String(v).trim()));
  for (const v of clean) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, percentage: pct(count, clean.length) }));
}

function topStrings(values: (string | undefined | null)[], limit = 5): string[] {
  return breakdown(values, limit).map((b) => b.label);
}

/** Build the summary object the UI's analytics tab reads. */
export function buildSummary(matches: ReturnType<typeof mapMatch>[]) {
  const total = matches.length;
  const ads = matches.map((m) => m.ad).filter(Boolean) as any[];
  const analyses = matches.map((m) => m.analysis).filter(Boolean) as any[];

  const now = Date.now();
  const daysRunning = ads
    .map((a) => (a.published_at ? Math.max(0, Math.floor((now - new Date(a.published_at).getTime()) / 86_400_000)) : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const median = daysRunning.length ? daysRunning[Math.floor(daysRunning.length / 2)] : 0;

  const withinDays = (days: number) =>
    ads.filter((a) => a.created_at && now - new Date(a.created_at).getTime() <= days * 86_400_000).length;

  const videoCount = ads.filter((a) => a.video_url).length;
  const imageCount = ads.filter((a) => !a.video_url && a.image_url).length;

  const advertiserBreakdown = breakdown(ads.map((a) => a.advertiser_name));
  const creatives = new Map<string, number>();
  for (const a of ads) {
    const key = `${a.headline ?? ""}|${a.image_url ?? a.video_url ?? ""}`.trim();
    if (key !== "|") creatives.set(key, (creatives.get(key) ?? 0) + 1);
  }
  const repeated = Array.from(creatives.values()).filter((c) => c > 1).length;

  const activeAds = ads.filter((a) => a.is_active).length;
  const saturation = total > 0 ? Math.min(100, Math.round((repeated / total) * 100 + advertiserBreakdown.length * 2)) : 0;

  return {
    discovered_ads: total,
    matched_ads: matches.filter((m) => m.match_status === "APPROVED").length,
    needs_review: matches.filter((m) => m.match_status === "NEEDS_REVIEW").length,
    active_ads: activeAds,
    unique_advertisers: new Set(ads.map((a) => a.advertiser_name).filter(Boolean)).size,
    meta_count: ads.filter((a) => a.source_platform === "meta").length,
    tiktok_count: ads.filter((a) => a.source_platform === "tiktok").length,
    image_video_ratio: videoCount > 0 ? Number((imageCount / videoCount).toFixed(2)) : imageCount,
    median_running_duration_days: median,
    new_ads_7_days: withinDays(7),
    new_ads_30_days: withinDays(30),
    top_hooks: topStrings(analyses.map((a) => a.hook)),
    top_angles: topStrings(analyses.map((a) => a.marketing_angle)),
    top_offers: topStrings(analyses.map((a) => a.offer)),
    repeated_creatives_count: repeated,
    saturation_score: saturation,
    creative_opportunity_score: Math.max(0, 100 - saturation),
    analyzed_ads: analyses.length,
    analysis_coverage: pct(analyses.length, total),
    cta_breakdown: breakdown(analyses.map((a) => a.cta ?? undefined).concat(ads.map((a) => a.cta_label))),
    content_type_breakdown: breakdown(
      ads.map((a) => (a.video_url ? "فيديو" : a.image_url ? "صورة" : "غير متوفر")),
    ),
    objective_breakdown: breakdown(analyses.map((a) => a.objective)),
    platform_breakdown: breakdown(ads.map((a) => PROVIDER_LABEL[a.source_platform] ?? a.source_platform)),
    advertiser_breakdown: advertiserBreakdown,
    top_creative_styles: topStrings(analyses.map((a) => a.creative_style)),
    top_pain_points: topStrings(analyses.flatMap((a) => a.pain_points ?? [])),
    opportunity_gaps: topStrings(analyses.flatMap((a) => a.differentiation_opportunities ?? [])),
    product_recommendations: topStrings(analyses.map((a) => a.recommended_action)),
    latest_ad_seen_at: ads.length
      ? ads.map((a) => a.created_at).sort().slice(-1)[0]
      : null,
  };
}

/** Cheap token-overlap relevance score (0-100). */
export function scoreRelevance(productName: string, keywords: string[], adText: string): number {
  const target = new Set([...tokens(productName), ...keywords.flatMap(tokens)].map((t) => t.toLowerCase()));
  const adTokens = new Set(tokens(adText).map((t) => t.toLowerCase()));
  if (target.size === 0 || adTokens.size === 0) return 0;
  let hits = 0;
  for (const t of target) if (adTokens.has(t)) hits++;
  return Math.min(100, Math.round((hits / target.size) * 100));
}

export async function log(
  supabaseAdmin: any,
  jobId: string,
  provider: Provider,
  step: string,
  status: "INFO" | "WARNING" | "ERROR" | "BLOCKED",
  message: string,
) {
  try {
    await supabaseAdmin.from("sr_ads_spy_logs").insert({ job_id: jobId, provider, step, status, message });
  } catch {
    /* logging must never break a run */
  }
}

/**
 * Runs one job to completion (synchronously — Workers have no background queue).
 * Meta collection uses the official Ad Library API; TikTok has no public API,
 * so it is reported as BLOCKED rather than faked.
 */
export async function runJob(jobId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: job } = await supabaseAdmin
    .from("sr_ads_spy_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "job_not_found" };

  await supabaseAdmin
    .from("sr_ads_spy_jobs")
    .update({
      status: "PROCESSING",
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      progress_percentage: 5,
      worker_id: "edge-inline",
      attempt_count: (job.attempt_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const { data: product } = await supabaseAdmin
    .from("sr_products")
    .select("id, external_product_id, name, category, sku")
    .or(`id.eq.${job.product_id},external_product_id.eq.${job.product_id}`)
    .maybeSingle();

  const token = process.env.META_ADS_TOKEN;
  const providers = (job.providers ?? []) as Provider[];
  const keywords: string[] = job.keywords ?? [];
  const countries: string[] = job.country_codes?.length ? job.country_codes : ["EG"];

  let discovered = 0;
  let queries = 0;
  const blockedProviders: string[] = [];

  for (const provider of providers) {
    if (provider === "tiktok") {
      blockedProviders.push("tiktok");
      await log(
        supabaseAdmin,
        jobId,
        "tiktok",
        "collect",
        "BLOCKED",
        "TikTok لا يوفر واجهة برمجية عامة لمكتبة الإعلانات، ولا يمكن تشغيل متصفح آلي على هذه البنية.",
      );
      continue;
    }

    if (!token) {
      blockedProviders.push("meta");
      await log(
        supabaseAdmin,
        jobId,
        "meta",
        "collect",
        "BLOCKED",
        "لم يتم إعداد مفتاح Meta Ad Library (META_ADS_TOKEN)، لذلك لا يمكن جمع إعلانات Meta.",
      );
      continue;
    }

    for (const keyword of keywords.slice(0, 5)) {
      queries++;
      try {
        const params = new URLSearchParams({
          access_token: token,
          search_terms: keyword,
          ad_reached_countries: JSON.stringify(countries),
          ad_active_status: "ALL",
          limit: String(Math.min(50, job.max_results_per_query ?? 20)),
          fields:
            "id,ad_snapshot_url,page_name,page_id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_delivery_start_time,publisher_platforms",
        });
        const res = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params.toString()}`);
        const payload: any = await res.json();
        if (!res.ok) {
          await log(supabaseAdmin, jobId, "meta", "collect", "ERROR", `Meta API ${res.status}: ${payload?.error?.message ?? "unknown"}`);
          continue;
        }

        for (const item of payload.data ?? []) {
          const headline = item.ad_creative_link_titles?.[0] ?? null;
          const body = item.ad_creative_bodies?.[0] ?? null;
          const adText = [headline, body, item.page_name].filter(Boolean).join(" ");

          const { data: adRow } = await supabaseAdmin
            .from("sr_ads_spy_ads")
            .upsert(
              {
                source_platform: "meta",
                external_ad_id: String(item.id),
                advertiser_name: item.page_name ?? "",
                advertiser_id: item.page_id ? String(item.page_id) : null,
                ad_url: item.ad_snapshot_url ?? null,
                headline,
                body_text: body,
                cta_label: item.ad_creative_link_captions?.[0] ?? null,
                published_at: item.ad_delivery_start_time ?? null,
                is_active: true,
                raw_scraped_data: item,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "source_platform,external_ad_id" },
            )
            .select("id")
            .maybeSingle();

          if (!adRow) continue;

          const score = scoreRelevance(product?.name ?? "", keywords, adText);
          if (score < 20) continue;

          await supabaseAdmin.from("sr_ads_spy_matches").upsert(
            {
              product_id: job.product_id,
              ad_id: adRow.id,
              job_id: jobId,
              match_score: score,
              match_status: score >= 60 ? "APPROVED" : "NEEDS_REVIEW",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "product_id,ad_id" },
          );
          discovered++;
        }

        await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .update({
            progress_percentage: Math.min(95, 10 + Math.round((queries / Math.max(1, keywords.length)) * 85)),
            heartbeat_at: new Date().toISOString(),
            queries_attempted: queries,
            relevant_ads_discovered: discovered,
          })
          .eq("id", jobId);
      } catch (err: any) {
        await log(supabaseAdmin, jobId, "meta", "collect", "ERROR", String(err?.message ?? err).slice(0, 500));
      }
    }
  }

  const status =
    blockedProviders.length === providers.length
      ? "BLOCKED"
      : discovered > 0
        ? blockedProviders.length > 0
          ? "PARTIAL"
          : "COMPLETED"
        : "EMPTY";

  const errorMessage =
    status === "BLOCKED"
      ? "جمع الإعلانات غير متاح حالياً: " +
        (blockedProviders.includes("meta") ? "مفتاح Meta غير مُعد. " : "") +
        (blockedProviders.includes("tiktok") ? "TikTok بدون واجهة عامة." : "")
      : null;

  await supabaseAdmin
    .from("sr_ads_spy_jobs")
    .update({
      status,
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      relevant_ads_discovered: discovered,
      queries_attempted: queries,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await log(
    supabaseAdmin,
    jobId,
    providers[0] ?? "meta",
    "finish",
    status === "BLOCKED" ? "BLOCKED" : "INFO",
    `انتهت المهمة بالحالة ${status} — ${discovered} إعلان مرتبط من ${queries} استعلام.`,
  );

  return { ok: true, status, discovered, queries };
}

export async function loadMatches(productId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sr_ads_spy_matches")
    .select("*, ad:sr_ads_spy_ads(*), analysis:sr_ads_spy_analyses(*)")
    .eq("product_id", productId)
    .order("match_score", { ascending: false });
  return (data ?? []).map(mapMatch);
}
