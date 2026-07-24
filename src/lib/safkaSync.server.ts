// Sync Safka products into sr_products + sr_snapshots with full run tracking.
// Server-only. Uses service-role admin client (bypasses RLS).

import { fetchSafkaProducts, type SchemaDriftWarning } from "./safka.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SafkaSyncResult {
  runId: string;
  productsFetched: number;
  productsInserted: number;
  productsUpdated: number;
  productsFailed: number;
  snapshotsCreated: number;
  totalDecrease: number;
  totalRestock: number;
  totalInventory: number;
  pagesFetched: number;
  durationMs: number;
  apiResponseTimeMs: number;
  driftWarnings: SchemaDriftWarning[];
  fetchedAt: string;
}

async function log(
  runId: string,
  level: "debug" | "info" | "warn" | "error",
  code: string,
  message: string,
  extra: Partial<{ page: number; external_product_id: string; meta: unknown }> = {},
) {
  try {
    await supabaseAdmin.from("sr_sync_logs").insert({
      run_id: runId,
      level,
      code,
      message,
      page: extra.page ?? null,
      external_product_id: extra.external_product_id ?? null,
      meta: (extra.meta ?? null) as any,
    });
  } catch {
    // swallow log-of-log failures only; never propagate
  }
}

async function isCancelled(runId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("sr_sync_runs")
    .select("cancel_requested")
    .eq("id", runId)
    .maybeSingle();
  return !!data?.cancel_requested;
}

export interface SyncOptions {
  runId?: string;
  triggeredBy?: string | null;
  manualOrAuto?: "manual" | "auto";
}

export async function createSyncRun(opts: SyncOptions = {}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("sr_sync_runs")
    .insert({
      platform: "safka",
      status: "pending",
      triggered_by: opts.triggeredBy ?? null,
      manual_or_auto: opts.manualOrAuto ?? "manual",
    })
    .select("id")
    .single();
  if (error) throw new Error(`createSyncRun failed: ${error.message}`);
  return data.id as string;
}

export async function syncSafkaIntoDb(opts: SyncOptions = {}): Promise<SafkaSyncResult> {
  const runId = opts.runId ?? (await createSyncRun(opts));
  const startedAt = Date.now();

  await supabaseAdmin.from("sr_sync_runs").update({ status: "running" }).eq("id", runId);
  await log(runId, "info", "sync.start", "بدء المزامنة");

  try {
    // ---- Fetch ----
    const fetchRes = await fetchSafkaProducts({
      onPage: async ({ page, count, durationMs }) => {
        await log(runId, "info", "sync.page", `تم جلب صفحة ${page} (${count} منتج) في ${durationMs}ms`, { page, meta: { count, durationMs } });
        try {
          await supabaseAdmin.from("sr_sync_runs").update({ pages_fetched: page }).eq("id", runId);
        } catch { /* non-fatal */ }
        if (await isCancelled(runId)) throw new Error("__cancelled__");
      },
    });

    const { products, pagesFetched, durationMs: fetchMs, apiResponseTimeMs, driftWarnings, schemaMix } = fetchRes;
    await log(runId, "info", "sync.fetched", `اكتمل الجلب: ${products.length} منتج عبر ${pagesFetched} صفحة`, {
      meta: { apiResponseTimeMs, fetchMs, schemaMix },
    });

    // ---- Schema drift ----
    for (const w of driftWarnings) {
      await log(runId, "warn", "schema.drift", `حقل غير معروف: ${w.fieldPath}`, {
        meta: { sampleValue: w.sampleValue },
      });
      const platform = "safka";
      const now = new Date().toISOString();
      const { data: existing } = await supabaseAdmin
        .from("sr_schema_warnings")
        .select("id, occurrences")
        .eq("platform", platform)
        .eq("field_path", w.fieldPath)
        .maybeSingle();
      if (existing?.id) {
        await supabaseAdmin.from("sr_schema_warnings").update({
          last_seen_at: now,
          occurrences: (existing.occurrences ?? 0) + 1,
          sample_value: w.sampleValue as any,
        }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("sr_schema_warnings").insert({
          platform, field_path: w.fieldPath, sample_value: w.sampleValue as any,
        });
      }
    }

    // ---- Load previous state ----
    const externalIds = products.map((p) => p.externalProductId);
    const existingMap = new Map<string, { current_quantity: number | null }>();
    for (let i = 0; i < externalIds.length; i += 500) {
      const slice = externalIds.slice(i, i + 500);
      const { data, error } = await supabaseAdmin
        .from("sr_products")
        .select("external_product_id, current_quantity")
        .in("external_product_id", slice);
      if (error) throw new Error(`read existing failed: ${error.message}`);
      for (const row of data ?? []) {
        existingMap.set(row.external_product_id as string, { current_quantity: (row as any).current_quantity });
      }
    }

    // ---- Diff ----
    const nowIso = new Date().toISOString();
    const upserts: any[] = [];
    const snapshots: any[] = [];
    let totalDecrease = 0, totalRestock = 0, totalInventory = 0;
    let inserts = 0, updates = 0;

    for (const p of products) {
      const prev = existingMap.get(p.externalProductId);
      const prevQty = prev?.current_quantity ?? null;
      const currQty = p.currentQuantity ?? 0;
      totalInventory += currQty;
      if (prev === undefined) inserts++; else updates++;

      let decrease = 0, restock = 0;
      if (prevQty !== null && prevQty !== undefined) {
        const diff = prevQty - currQty;
        if (diff > 0) decrease = diff;
        else if (diff < 0) restock = -diff;
      }
      totalDecrease += decrease;
      totalRestock += restock;

      upserts.push({
        external_product_id: p.externalProductId,
        platform: "safka",
        name: p.name,
        sku: p.sku || null,
        price: p.price,
        currency: p.currency,
        image_url: p.imageUrl || null,
        product_url: p.productUrl || null,
        category: p.originalCategory || null,
        previous_quantity: prevQty,
        current_quantity: currQty,
        last_checked_at: nowIso,
        updated_at: nowIso,
      });

      if (prevQty === null || prevQty === undefined || decrease > 0 || restock > 0) {
        snapshots.push({
          external_product_id: p.externalProductId,
          platform: "safka",
          previous_quantity: prevQty,
          current_quantity: currQty,
          quantity_decrease: decrease,
          restock_amount: restock,
          observed_at: nowIso,
        });
      }
    }

    // ---- Write (batched) ----
    let productsFailed = 0;
    for (let i = 0; i < upserts.length; i += 500) {
      const chunk = upserts.slice(i, i + 500);
      const { error } = await supabaseAdmin
        .from("sr_products").upsert(chunk, { onConflict: "external_product_id" });
      if (error) {
        productsFailed += chunk.length;
        await log(runId, "error", "sync.upsert.failed", `فشل حفظ دفعة (${chunk.length}): ${error.message}`, {
          meta: { code: error.code, details: error.details },
        });
      }
    }
    let snapshotsCreated = 0;
    for (let i = 0; i < snapshots.length; i += 500) {
      const chunk = snapshots.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("sr_snapshots").insert(chunk);
      if (error) {
        await log(runId, "error", "sync.snapshot.failed", `فشل حفظ لقطات (${chunk.length}): ${error.message}`, {
          meta: { code: error.code },
        });
      } else snapshotsCreated += chunk.length;
    }

    const durationMs = Date.now() - startedAt;
    await supabaseAdmin.from("sr_sync_runs").update({
      status: "success",
      finished_at: nowIso,
      duration_ms: durationMs,
      pages_fetched: pagesFetched,
      products_total: products.length,
      products_processed: products.length,
      products_inserted: inserts,
      products_updated: updates,
      products_failed: productsFailed,
      total_inventory: totalInventory,
      inventory_delta: totalRestock - totalDecrease,
      withdrawal_delta: totalDecrease,
      restock_delta: totalRestock,
    }).eq("id", runId);

    await log(runId, "info", "sync.done",
      `اكتملت المزامنة: ${inserts} إضافة، ${updates} تحديث، ${snapshotsCreated} لقطة، سحوبات ${totalDecrease}`,
      { meta: { durationMs } });

    return {
      runId,
      productsFetched: products.length,
      productsInserted: inserts,
      productsUpdated: updates,
      productsFailed,
      snapshotsCreated,
      totalDecrease,
      totalRestock,
      totalInventory,
      pagesFetched,
      durationMs,
      apiResponseTimeMs,
      driftWarnings,
      fetchedAt: nowIso,
    };
  } catch (err: any) {
    const cancelled = err?.message === "__cancelled__";
    const status = cancelled ? "cancelled" : "failed";
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("sr_sync_runs").update({
      status,
      finished_at: nowIso,
      duration_ms: Date.now() - startedAt,
      error_message: cancelled ? "تم إلغاء المزامنة" : String(err?.message ?? err),
    }).eq("id", runId);
    await log(runId, cancelled ? "warn" : "error",
      cancelled ? "sync.cancelled" : "sync.failed",
      cancelled ? "تم إلغاء المزامنة يدوياً" : `فشل المزامنة: ${err?.message ?? err}`,
      { meta: { stack: err?.stack } });
    throw err;
  }
}

export async function requestCancelSync(runId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("sr_sync_runs").update({ cancel_requested: true }).eq("id", runId);
  return !error;
}
