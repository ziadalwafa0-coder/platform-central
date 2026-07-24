// Server-only helpers for the Safka platform API.
// Never import this file from client code.

const SAFKA_BASE_URL = "https://api.safka-eg.com";
const SAFKA_PRODUCTS_PATH = "/api/v1/public/products";
const SAFKA_API_KEY_HEADER = "api-safka-key";

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
  raw: unknown;
}

interface FetchOptions {
  maxPages?: number;
  pageSize?: number;
  signal?: AbortSignal;
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

// Handles BOTH schemas:
//   - Legacy: variants[] with { _id, name, quantity, min_quantity, price, is_available }
//   - New Safka: properties[] with { _id, key, value, min, sale_price, is_available }
function normalizeVariant(v: any): SafkaVariant {
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

function normalizeProduct(p: any): SafkaProduct {
  // Support both legacy `variants[]` and new Safka `properties[]`.
  const variantsRaw = Array.isArray(p?.variants)
    ? p.variants
    : Array.isArray(p?.properties)
      ? p.properties
      : [];
  const variants = variantsRaw.map(normalizeVariant);

  const topQty = num(p?.quantity ?? p?.stock ?? p?.available_quantity);
  const variantSum = variants.reduce(
    (acc: number, v: SafkaVariant) => acc + (v.currentQuantity ?? 0),
    0,
  );
  const currentQuantity = topQty ?? (variants.length > 0 ? variantSum : null);

  const images = Array.isArray(p?.images) ? p.images : [];

  return {
    externalProductId: str(p?._id ?? p?.id ?? ""),
    name: str(p?.name ?? p?.title ?? "بدون اسم"),
    // barcode is the new Safka SKU equivalent
    sku: str(p?.sku ?? p?.code ?? p?.barcode ?? ""),
    price: num(p?.price ?? p?.sale_price),
    currency: str(p?.currency ?? "EGP"),
    imageUrl: str(
      p?.image ?? p?.image_url ?? p?.thumbnail ?? images[0] ?? "",
    ),
    productUrl: str(p?.url ?? p?.product_url ?? ""),
    originalCategory: str(
      p?.category?.name ?? p?.category ?? p?.category_name ?? "غير مصنف",
    ),
    currentQuantity,
    variants,
    raw: p,
  };
}

export async function fetchSafkaProducts(
  opts: FetchOptions = {},
): Promise<{
  products: SafkaProduct[];
  pagesFetched: number;
  durationMs: number;
}> {
  const apiKey = process.env.SAFKA_API_KEY;
  if (!apiKey) {
    throw new Error("SAFKA_API_KEY is not configured");
  }

  const maxPages = opts.maxPages ?? 50;
  const pageSize = opts.pageSize ?? 100;
  const started = Date.now();

  const products: SafkaProduct[] = [];
  const seen = new Set<string>();
  let page = 1;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const url = `${SAFKA_BASE_URL}${SAFKA_PRODUCTS_PATH}?page=${page}&size=${pageSize}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          [SAFKA_API_KEY_HEADER]: apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Safka API request failed (page ${page}, status ${res.status}): ${body.slice(0, 300)}`,
      );
    }

    const json: any = await res.json();
    const list: any[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.products)
        ? json.products
        : Array.isArray(json)
          ? json
          : [];

    if (list.length === 0) break;

    for (const raw of list) {
      const p = normalizeProduct(raw);
      if (!p.externalProductId || seen.has(p.externalProductId)) continue;
      seen.add(p.externalProductId);
      products.push(p);
    }

    pagesFetched = page;
    if (list.length < pageSize) break;
    page++;
  }

  return {
    products,
    pagesFetched,
    durationMs: Date.now() - started,
  };
}
