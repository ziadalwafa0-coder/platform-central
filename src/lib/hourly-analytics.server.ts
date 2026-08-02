// Shared server-side helpers for the "تحليل الساعات" (hourly analytics) endpoints.
// All day/hour boundaries come from src/lib/cairo-time.ts (DST-aware, single
// source of truth). All sr_snapshots reads go through fetchAllRows (this table
// has already proven it exceeds PostgREST's default row cap).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAllRows } from "@/lib/fetchAllRows.server";
import { cairoDateHourUtcMs, cairoDateStr, cairoHourOf } from "@/lib/cairo-time";

export type SnapshotRow = {
  external_product_id: string;
  platform: string | null;
  previous_quantity: number | null;
  current_quantity: number | null;
  quantity_decrease: number | null;
  restock_amount: number | null;
  observed_at: string;
};

export type ProductRow = {
  id: string;
  external_product_id: string;
  platform: string | null;
  name: string;
  sku: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  product_url: string | null;
  category: string | null;
  current_quantity: number | null;
  previous_quantity: number | null;
  last_checked_at: string | null;
};

const SNAPSHOT_COLS =
  "external_product_id, platform, previous_quantity, current_quantity, quantity_decrease, restock_amount, observed_at";

/** Inclusive-start / exclusive-end UTC ISO bounds for one Cairo calendar day. */
export function cairoDayWindow(dateStr: string): { startIso: string; endIso: string } {
  return {
    startIso: new Date(cairoDateHourUtcMs(dateStr, 0)).toISOString(),
    endIso: new Date(cairoDateHourUtcMs(dateStr, 24)).toISOString(),
  };
}

/** Cairo minute-of-hour (0-59) for an instant. */
export function cairoMinuteOf(at: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      minute: "2-digit",
    }).format(at),
  );
}

export { cairoDateStr, cairoHourOf };

/** Products, optionally narrowed by platform and category. */
export async function loadProducts(
  platform = "all",
  category = "all",
): Promise<ProductRow[]> {
  let q = supabaseAdmin
    .from("sr_products")
    .select(
      "id, external_product_id, platform, name, sku, price, currency, image_url, product_url, category, current_quantity, previous_quantity, last_checked_at",
    );
  if (platform && platform !== "all") q = q.eq("platform", platform);
  if (category && category !== "all") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProductRow[];
}

/**
 * Snapshots for a Cairo day, filtered by platform and (via the product catalog)
 * by category. Returns the rows plus the product index used for the filter.
 */
export async function loadDaySnapshots(opts: {
  date: string;
  platform?: string;
  category?: string;
  onlyDecreases?: boolean;
}): Promise<{ snapshots: SnapshotRow[]; products: ProductRow[]; byExternalId: Map<string, ProductRow> }> {
  const { date, platform = "all", category = "all", onlyDecreases = false } = opts;
  const { startIso, endIso } = cairoDayWindow(date);

  const products = await loadProducts(platform, category);
  const byExternalId = new Map(products.map((p) => [p.external_product_id, p]));

  const rows = await fetchAllRows<SnapshotRow>(
    supabaseAdmin as any,
    "sr_snapshots",
    SNAPSHOT_COLS,
    1000,
    (q) => {
      let b = q.gte("observed_at", startIso).lt("observed_at", endIso);
      if (platform && platform !== "all") b = b.eq("platform", platform);
      if (onlyDecreases) b = b.gt("quantity_decrease", 0);
      return b;
    },
  );

  const filterByCategory = category && category !== "all";
  const snapshots = filterByCategory
    ? rows.filter((r) => byExternalId.has(r.external_product_id))
    : rows;

  return { snapshots, products, byExternalId };
}

/** Snapshots across an arbitrary UTC range (used by multi-day analyses). */
export async function loadRangeSnapshots(opts: {
  startIso: string;
  endIso: string;
  platform?: string;
  onlyDecreases?: boolean;
}): Promise<SnapshotRow[]> {
  const { startIso, endIso, platform = "all", onlyDecreases = false } = opts;
  return fetchAllRows<SnapshotRow>(
    supabaseAdmin as any,
    "sr_snapshots",
    SNAPSHOT_COLS,
    1000,
    (q) => {
      let b = q.gte("observed_at", startIso).lt("observed_at", endIso);
      if (platform && platform !== "all") b = b.eq("platform", platform);
      if (onlyDecreases) b = b.gt("quantity_decrease", 0);
      return b;
    },
  );
}

export type HourCoverage = {
  runs: number;
  hasActive: boolean;
  hasSuccess: boolean;
  hasFailure: boolean;
  expected: number;
  successful: number;
};

/**
 * Per-hour sync coverage for a Cairo day, derived from sr_sync_runs.
 * Snapshots are only written when a quantity actually changed, so coverage
 * (expected vs successful product counts) must come from the run records.
 */
export async function loadHourCoverage(
  date: string,
  platform = "all",
): Promise<Map<number, HourCoverage>> {
  const { startIso, endIso } = cairoDayWindow(date);
  let q = supabaseAdmin
    .from("sr_sync_runs")
    .select("status, started_at, products_total, products_processed, products_failed, platform")
    .gte("started_at", startIso)
    .lt("started_at", endIso);
  if (platform && platform !== "all") q = q.eq("platform", platform);
  const { data, error } = await q;
  if (error) throw error;

  const map = new Map<number, HourCoverage>();
  for (const r of (data ?? []) as any[]) {
    const hour = cairoHourOf(new Date(r.started_at));
    const cur =
      map.get(hour) ??
      ({ runs: 0, hasActive: false, hasSuccess: false, hasFailure: false, expected: 0, successful: 0 } as HourCoverage);
    cur.runs += 1;
    const status = String(r.status ?? "");
    if (status === "running" || status === "pending") cur.hasActive = true;
    if (status === "success") cur.hasSuccess = true;
    if (status === "failed" || status === "cancelled") cur.hasFailure = true;
    const total = Number(r.products_total ?? 0);
    const processed = Number(r.products_processed ?? 0);
    const failed = Number(r.products_failed ?? 0);
    cur.expected = Math.max(cur.expected, total);
    cur.successful = Math.max(cur.successful, Math.max(0, processed - failed));
    map.set(hour, cur);
  }
  return map;
}

export type HourStatus =
  | "COMPLETE"
  | "RUNNING"
  | "PENDING"
  | "FAILED"
  | "PARTIAL"
  | "NOT_STARTED";

/** Derives an hour's status from wall-clock position + sync coverage. */
export function deriveHourStatus(args: {
  hour: number;
  isFuture: boolean;
  isCurrentHour: boolean;
  coverage?: HourCoverage;
}): HourStatus {
  const { isFuture, isCurrentHour, coverage } = args;
  if (isFuture) return "NOT_STARTED";
  if (!coverage || coverage.runs === 0) return isCurrentHour ? "PENDING" : "NOT_STARTED";
  if (coverage.hasActive) return "RUNNING";
  if (!coverage.hasSuccess && coverage.hasFailure) return "FAILED";
  if (coverage.expected > 0 && coverage.successful < coverage.expected) return "PARTIAL";
  if (isCurrentHour) return "RUNNING";
  return "COMPLETE";
}

/** "12 ص" style Arabic 12-hour label for an hour index. */
export function arabicHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12 ص";
  if (h < 12) return `${h} ص`;
  if (h === 12) return "12 م";
  return `${h - 12} م`;
}

/** "12:00 - 12:19 ص" style label for a 20-minute slot inside an hour. */
export function arabicIntervalLabel(hour: number, slot: number): string {
  const h = ((hour % 24) + 24) % 24;
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const suffix = h < 12 ? "ص" : "م";
  const from = String(slot * 20).padStart(2, "0");
  const to = String(slot * 20 + 19).padStart(2, "0");
  return `${String(display).padStart(2, "0")}:${from} - ${String(display).padStart(2, "0")}:${to} ${suffix}`;
}

/** Shared per-slot / per-hour data status vocabulary. */
export function deriveDataStatus(args: {
  status: HourStatus;
  pieces: number;
}): string {
  const { status, pieces } = args;
  if (status === "FAILED") return "FAILED";
  if (status === "PARTIAL") return "PARTIAL";
  if (status === "RUNNING" || status === "PENDING") return "CURRENT_INCOMPLETE";
  if (status === "NOT_STARTED") return "NOT_SCHEDULED";
  return pieces > 0 ? "SUCCESS_WITH_ACTIVITY" : "SUCCESS_ZERO";
}
