import crypto from "crypto";

export interface LogFareAdRecord {
  evidence_id: string;
  platform: string;
  external_ad_id: string;
  advertiser_name: string;
  ad_url: string;
  body_text: string;
  is_active: boolean;
  product_image_urls: string[];
  metadata: {
    source_keyword: string;
    source_url: string;
    landing_page_url: string | null;
    source_scope: string | null;
    scraped_at: string;
  };
}

/**
 * Checks if KIMI_ENABLED is true, maps metadata/images correctly, and
 * sends mapped records to the LogFare analysis endpoint with a verification step
 * to confirm successful image extraction.
 */
export async function analyzeNewAdEvidenceRecordsWithLogFare(
  ads: any[],
  platform: string,
  keyword: string
): Promise<void> {
  const isEnabled = typeof process !== "undefined" && process?.env?.KIMI_ENABLED === "true";
  if (!isEnabled) {
    console.log("[LogFare Analysis] KIMI_ENABLED is not true, skipping LogFare analysis.");
    return;
  }

  const apiKey = typeof process !== "undefined" ? process?.env?.LOGFARE_API_KEY : undefined;
  const baseURL = (typeof process !== "undefined" ? process?.env?.LOGFARE_BASE_URL : undefined) || "https://logfare.ai/v1";

  if (!apiKey) {
    console.warn("[LogFare Analysis] KIMI_ENABLED is true but LOGFARE_API_KEY is missing. Skipping LogFare analysis.");
    return;
  }

  // Ensure that both product image URLs and metadata fields are properly mapped before passing them to the analysis provider
  const mappedRecords: LogFareAdRecord[] = [];

  for (const ad of ads) {
    const imageUrls = ad.raw_scraped_data?.image_urls || (ad.image_url ? [ad.image_url] : []);
    
    // VERIFICATION STEP: Confirm successful image extraction
    const validImageUrls = imageUrls.filter((url: any) => typeof url === "string" && url.trim().length > 0);
    const extractionSuccessful = validImageUrls.length > 0;
    
    if (extractionSuccessful) {
      console.log(`[LogFare Analysis] Image extraction VERIFICATION SUCCESS for ad ${ad.id || ad.external_ad_id}: extracted ${validImageUrls.length} valid image URL(s).`);
    } else {
      console.warn(`[LogFare Analysis] Image extraction VERIFICATION WARNING for ad ${ad.id || ad.external_ad_id}: No valid image URLs extracted.`);
    }

    mappedRecords.push({
      evidence_id: ad.id || ad.external_ad_id || crypto.randomUUID(),
      platform: ad.source_platform || platform,
      external_ad_id: ad.external_ad_id || "",
      advertiser_name: ad.advertiser_name || "غير ظاهر في المصدر",
      ad_url: ad.ad_url || "",
      body_text: ad.body_text || "",
      is_active: ad.is_active !== false,
      product_image_urls: validImageUrls,
      metadata: {
        source_keyword: keyword,
        source_url: ad.raw_scraped_data?.source_url || ad.ad_url || "",
        landing_page_url: ad.raw_scraped_data?.landing_page_url || null,
        source_scope: ad.raw_scraped_data?.source_scope || null,
        scraped_at: new Date().toISOString()
      }
    });
  }

  if (mappedRecords.length === 0) {
    console.log("[LogFare Analysis] No new ad records to analyze via LogFare.");
    return;
  }

  console.log(`[LogFare Analysis] Calling LogFare analysis endpoint for ${mappedRecords.length} new ad evidence records...`);

  try {
    const url = `${baseURL}/analysis`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        platform,
        keyword,
        records: mappedRecords
      })
    });

    if (!response.ok) {
      console.warn(`[LogFare Analysis] LogFare analysis endpoint returned HTTP status ${response.status}: ${response.statusText}`);
    } else {
      console.log(`[LogFare Analysis] LogFare analysis succeeded for ${mappedRecords.length} records.`);
    }
  } catch (err: any) {
    console.error(`[LogFare Analysis] Error calling LogFare analysis endpoint: ${err.message}`);
  }
}
