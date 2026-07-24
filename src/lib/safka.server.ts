// Server-only helpers for the Safka platform API.
// Never import this file from client code.

const SAFKA_BASE_URL = "https://api.safka-eg.com";
const SAFKA_PRODUCTS_PATH = "/api/v1/public/products";
const SAFKA_API_KEY_HEADER = "api-safka-key";

// Fields we intentionally consume or ignore. Anything outside this set is
// surfaced as schema drift — never silently swallowed.
const KNOWN_PRODUCT_FIELDS = new Set<string>([
  "_id","id","name","title","sku","code","barcode",
  "price","sale_price","currency",
  "image","image_url","thumbnail","images",
  "url","product_url","description","note","media_url",
  "category","category_name",
  "quantity","stock","available_quantity",
  "variants","properties",
  "is_active","faqs","createdAt","updatedAt","created_at","updated_at",
]);
const KNOWN_VARIANT_FIELDS = new Set<string>([
  "_id","id","name","title","key",
  "quantity","stock","available","value",
  "min_quantity","minQuantity","min",
  "price","sale_price",
  "is_available","isAvailable",
]);

export interface SafkaVariant {
  externalVariantId: string;
  name: string;
  currentQuantity: number | null;
  minQuantity: number | null;
  price: number | null;
  isAvailable: boolean;
}

export interface SafkaProduct {
  externalProductId: string;
  name: string;
  sku: string;
  price: number | null;
  currency: string;
  imageUrl: string;
  productUrl: string;
  originalCategory: string;
  currentQuantity: number | null;
  variants: SafkaVariant[];
  schemaVersion: "legacy" | "properties" | "flat";
  raw: unknown;
}

export interface SchemaDriftWarning {
  fieldPath: string;
  sampleValue: unknown;
}

interface FetchOptions {
  maxPages?: number;
  pageSize?: number;
  signal?: AbortSignal;
  onPage?: (info: { page: number; count: number; durationMs: number }) => Promise<void> | void;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function detectDrift(
  obj: Record<string, unknown>,
  known: Set<string>,
  prefix: string,
  bag: Map<string, unknown>,
) {
  for (const k of Object.keys(obj)) {
    if (!known.has(k)) {
      const path = `${prefix}${k}`;
      if (!bag.has(path)) bag.set(path, obj[k]);
    }
  }
}

function normalizeVariant(v: any, drift: Map<string, unknown>): SafkaVariant {
  if (v && typeof v === "object") detectDrift(v, KNOWN_VARIANT_FIELDS, "variant.", drift);
  const qty = num(v?.quantity ?? v?.stock ?? v?.available ?? v?.value);
  return {
    externalVariantId: str(v?._id ?? v?.id ?? v?.key ?? ""),
    name: str(v?.name ?? v?.title ?? v?.key ?? ""),
    currentQuantity: qty,
    minQuantity: num(v?.min_quantity ?? v?.minQuantity ?? v?.min),
    price: num(v?.price ?? v?.sale_price),
    isAvailable:
      v?.is_available === true ||
      v?.isAvailable === true ||
      (qty ?? 0) > 0,
  };
}

function normalizeProduct(p: any, drift: Map<string, unknown>): SafkaProduct {
  if (p && typeof p === "object") detectDrift(p, KNOWN_PRODUCT_FIELDS, "product.", drift);

  let schemaVersion: SafkaProduct["schemaVersion"];
  let variantsRaw: any[];
  if (Array.isArray(p?.variants)) { variantsRaw = p.variants; schemaVersion = "legacy"; }
  else if (Array.isArray(p?.properties)) { variantsRaw = p.properties; schemaVersion = "properties"; }
  else { variantsRaw = []; schemaVersion = "flat"; }
  const variants = variantsRaw.map((v) => normalizeVariant(v, drift));

  const topQty = num(p?.quantity ?? p?.stock ?? p?.available_quantity);
  const variantSum = variants.reduce((a, v) => a + (v.currentQuantity ?? 0), 0);
  const currentQuantity = topQty ?? (variants.length > 0 ? variantSum : null);
  const images = Array.isArray(p?.images) ? p.images : [];

  return {
    externalProductId: str(p?._id ?? p?.id ?? ""),
    name: str(p?.name ?? p?.title ?? "بدون اسم"),
    sku: str(p?.sku ?? p?.code ?? p?.barcode ?? ""),
    price: num(p?.price ?? p?.sale_price),
    currency: str(p?.currency ?? "EGP"),
    imageUrl: str(p?.image ?? p?.image_url ?? p?.thumbnail ?? images[0] ?? ""),
    productUrl: str(p?.url ?? p?.product_url ?? ""),
    originalCategory: str(p?.category?.name ?? p?.category ?? p?.category_name ?? "غير مصنف"),
    currentQuantity,
    variants,
    schemaVersion,
    raw: p,
  };
}

export async function fetchSafkaProducts(opts: FetchOptions = {}): Promise<{
  products: SafkaProduct[];
  pagesFetched: number;
  durationMs: number;
  apiResponseTimeMs: number;
  driftWarnings: SchemaDriftWarning[];
  schemaMix: Record<string, number>;
}> {
  const apiKey = process.env.SAFKA_API_KEY;
  if (!apiKey) throw new Error("SAFKA_API_KEY is not configured");

  const maxPages = opts.maxPages ?? 50;
  const pageSize = opts.pageSize ?? 100;
  const started = Date.now();
  let apiResponseTimeMs = 0;

  const products: SafkaProduct[] = [];
  const seen = new Set<string>();
  const drift = new Map<string, unknown>();
  const schemaMix: Record<string, number> = { legacy: 0, properties: 0, flat: 0 };
  let page = 1;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const url = `${SAFKA_BASE_URL}${SAFKA_PRODUCTS_PATH}?page=${page}&size=${pageSize}`;

    // Retry with exponential backoff + jitter. Do NOT retry 4xx (except 408/429).
    const maxAttempts = 4;
    let attempt = 0;
    let res: Response | null = null;
    let dt = 0;
    let lastErr: unknown = null;
    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      if (opts.signal) opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
      const t0 = Date.now();
      try {
        res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json", [SAFKA_API_KEY_HEADER]: apiKey },
          signal: controller.signal,
        });
        dt = Date.now() - t0;
        if (res.ok) break;
        // Non-2xx: decide if retryable
        const status = res.status;
        const retryable = status >= 500 || status === 408 || status === 429;
        if (!retryable) {
          const body = await res.text().catch(() => "");
          throw new Error(`Safka API failed (page ${page}, status ${status}): ${body.slice(0, 300)}`);
        }
        lastErr = new Error(`Safka API ${status} on page ${page}`);
      } catch (err) {
        dt = Date.now() - t0;
        lastErr = err;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt >= maxAttempts) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      const backoff = Math.min(4000, 300 * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * backoff * 0.3);
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
    apiResponseTimeMs += dt;
    if (!res) throw new Error(`Safka fetch failed (page ${page})`);

    const json: any = await res.json();
    const list: any[] = Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.products) ? json.products
      : Array.isArray(json) ? json : [];
    if (list.length === 0) break;

    for (const raw of list) {
      const p = normalizeProduct(raw, drift);
      if (!p.externalProductId || seen.has(p.externalProductId)) continue;
      seen.add(p.externalProductId);
      schemaMix[p.schemaVersion]++;
      products.push(p);
    }

    pagesFetched = page;
    await opts.onPage?.({ page, count: list.length, durationMs: dt });
    if (list.length < pageSize) break;
    page++;
  }


  const driftWarnings = Array.from(drift.entries()).map(([fieldPath, sampleValue]) => ({
    fieldPath, sampleValue,
  }));

  return {
    products,
    pagesFetched,
    durationMs: Date.now() - started,
    apiResponseTimeMs,
    driftWarnings,
    schemaMix,
  };
}
