// Tager platform API client.
// Server-only: never import from client code. Tokens are never logged.
//
// The Tager endpoint shape is configurable via env so the integration can be
// pointed at the exact contract without code changes:
//   TAGER_BASE_URL        (default https://api.taager.com)
//   TAGER_PRODUCTS_PATH   (default /v1/products)
//   TAGER_VALIDATE_PATH   (default = products path, with limit=1)
//   TAGER_AUTH_HEADER     (default Authorization)
//   TAGER_AUTH_SCHEME     (default "Bearer"; set to "" for a raw token header)
//   TAGER_PAGE_PARAM      (default page)
//   TAGER_LIMIT_PARAM     (default limit)
import { retry, withTimeout } from "@/lib/reliability.server";

export const TAGER_PLATFORM = "tager";

function cfg() {
  return {
    baseUrl: (process.env["TAGER_BASE_URL"] ?? "https://api.taager.com").replace(/\/+$/, ""),
    productsPath: process.env["TAGER_PRODUCTS_PATH"] ?? "/v1/products",
    validatePath: process.env["TAGER_VALIDATE_PATH"] ?? process.env["TAGER_PRODUCTS_PATH"] ?? "/v1/products",
    authHeader: process.env["TAGER_AUTH_HEADER"] ?? "Authorization",
    authScheme: process.env["TAGER_AUTH_SCHEME"] ?? "Bearer",
    pageParam: process.env["TAGER_PAGE_PARAM"] ?? "page",
    limitParam: process.env["TAGER_LIMIT_PARAM"] ?? "limit",
  };
}

export class TagerApiError extends Error {
  status: number | null;
  code: string;
  retryable: boolean;
  tokenInvalid: boolean;
  constructor(message: string, opts: { status?: number | null; code?: string } = {}) {
    super(message);
    this.name = "TagerApiError";
    this.status = opts.status ?? null;
    const s = this.status;
    this.tokenInvalid = s === 401 || s === 403;
    this.code =
      opts.code ??
      (s === 401 ? "unauthorized"
        : s === 403 ? "forbidden"
        : s === 404 ? "not_found"
        : s === 429 ? "rate_limited"
        : s && s >= 500 ? "upstream_error"
        : "request_failed");
    this.retryable = this.code === "rate_limited" || this.code === "upstream_error" || this.code === "network_error" || this.code === "timeout";
  }
}

export interface TagerProduct {
  externalProductId: string;
  name: string;
  sku: string | null;
  price: number | null;
  currency: string;
  stock: number | null;
  image: string | null;
  category: string | null;
  brand: string | null;
  status: string | null;
  lastUpdated: string | null;
  metadata: Record<string, unknown>;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}
function pick(o: any, keys: string[]): unknown {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), o);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Maps a raw Tager payload item to our canonical product shape. */
export function normalizeTagerProduct(p: any): TagerProduct {
  const stock = num(
    pick(p, ["stock", "quantity", "available_quantity", "availableQuantity", "availableStock", "inventory", "qty", "stock_quantity"]),
  );
  const images = Array.isArray(p?.images) ? p.images : [];
  const firstImage = images.length > 0 ? (typeof images[0] === "string" ? images[0] : images[0]?.url) : undefined;
  return {
    externalProductId: String(pick(p, ["id", "_id", "productId", "product_id", "prodID", "sku"]) ?? ""),
    name: String(pick(p, ["name", "title", "productName", "product_name", "nameAr", "name_ar"]) ?? ""),
    sku: str(pick(p, ["sku", "code", "productCode", "product_code", "barcode"])),
    price: num(pick(p, ["price", "productPrice", "sale_price", "salePrice", "selling_price", "sellingPrice"])),
    currency: String(pick(p, ["currency", "currencyCode"]) ?? "EGP"),
    stock,
    image: str(pick(p, ["image", "image_url", "imageUrl", "thumbnail", "mainImage"]) ?? firstImage),
    category: str(pick(p, ["category", "category_name", "categoryName", "category.name"])),
    brand: str(pick(p, ["brand", "brand_name", "brandName", "brand.name", "vendor"])),
    status: str(pick(p, ["status", "state", "availability"])) ?? (stock !== null ? (stock > 0 ? "in_stock" : "out_of_stock") : null),
    lastUpdated: str(pick(p, ["updated_at", "updatedAt", "last_updated", "lastUpdatedAt", "modified_at"])),
    metadata: (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
  };
}

/** Extracts the product array from an unknown-shaped response envelope. */
function extractItems(body: any): any[] {
  if (Array.isArray(body)) return body;
  for (const k of ["data", "products", "items", "results", "records", "rows"]) {
    const v = body?.[k];
    if (Array.isArray(v)) return v;
    if (Array.isArray(v?.products)) return v.products;
    if (Array.isArray(v?.data)) return v.data;
  }
  return [];
}

/** Reads a total-pages / total-count hint from the envelope, if present. */
function extractTotals(body: any): { totalPages: number | null; total: number | null } {
  const meta = body?.meta ?? body?.pagination ?? body?.data?.meta ?? body ?? {};
  const totalPages = num(pick(meta, ["totalPages", "total_pages", "pageCount", "last_page"]));
  const total = num(pick(meta, ["total", "totalCount", "total_count", "count", "totalItems"]));
  return { totalPages, total };
}

async function request(token: string, path: string, query: Record<string, string | number> = {}, timeoutMs = 20_000) {
  const c = cfg();
  const url = new URL(path.startsWith("http") ? path : `${c.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = {
    Accept: "application/json",
    [c.authHeader]: c.authScheme ? `${c.authScheme} ${token}` : token,
  };

  let res: Response;
  try {
    res = await withTimeout(fetch(url.toString(), { method: "GET", headers }), timeoutMs, "tager.request");
  } catch (err: any) {
    const isTimeout = String(err?.message ?? "").startsWith("timeout:");
    throw new TagerApiError(isTimeout ? "Tager request timed out" : "Network failure contacting Tager", {
      code: isTimeout ? "timeout" : "network_error",
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TagerApiError(
      `Tager API error ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
      { status: res.status },
    );
  }
  try {
    return await res.json();
  } catch {
    throw new TagerApiError("Tager returned a non-JSON response", { code: "invalid_response" });
  }
}

/** Verifies a token by making one minimal authenticated call. */
export async function validateTagerToken(token: string): Promise<{ valid: true } | { valid: false; code: string; message: string }> {
  const c = cfg();
  try {
    await request(token, c.validatePath, { [c.limitParam]: 1 }, 15_000);
    return { valid: true };
  } catch (err) {
    const e = err as TagerApiError;
    return { valid: false, code: e.code ?? "request_failed", message: e.message };
  }
}

export interface FetchAllOptions {
  pageSize?: number;
  maxPages?: number;
  onPage?: (info: { page: number; count: number; durationMs: number }) => Promise<void> | void;
  updatedSince?: string | null;
}

/**
 * Fetches every product page, de-duplicating by external product id and
 * stopping on empty/short pages. Each page is retried with backoff.
 */
export async function fetchAllTagerProducts(
  token: string,
  opts: FetchAllOptions = {},
): Promise<{ products: TagerProduct[]; pagesFetched: number }> {
  const c = cfg();
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 200;

  const byId = new Map<string, TagerProduct>();
  const seenPages = new Set<number>();
  let pagesFetched = 0;
  let totalPages: number | null = null;

  for (let page = 1; page <= maxPages; page++) {
    if (seenPages.has(page)) break;
    seenPages.add(page);

    const started = Date.now();
    const body = await retry(
      () =>
        request(token, c.productsPath, {
          [c.pageParam]: page,
          [c.limitParam]: pageSize,
          ...(opts.updatedSince ? { updated_since: opts.updatedSince } : {}),
        }),
      {
        retries: 3,
        baseMs: 500,
        maxMs: 8000,
        isRetryable: (err) => err instanceof TagerApiError && err.retryable,
      },
    );

    const items = extractItems(body);
    pagesFetched++;
    if (totalPages === null) totalPages = extractTotals(body).totalPages;

    for (const raw of items) {
      const p = normalizeTagerProduct(raw);
      if (!p.externalProductId) continue;
      byId.set(p.externalProductId, p);
    }

    await opts.onPage?.({ page, count: items.length, durationMs: Date.now() - started });

    if (items.length === 0 || items.length < pageSize) break;
    if (totalPages !== null && page >= totalPages) break;
  }

  return { products: [...byId.values()], pagesFetched };
}
