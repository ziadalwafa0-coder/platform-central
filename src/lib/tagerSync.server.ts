// Tager sync engine + diff engine.
// Server-only. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/tokenCrypto.server";
import { fetchAllTagerProducts, TagerApiError, TAGER_PLATFORM, type TagerProduct } from "@/lib/tager.server";
import { circuitAllows, circuitRecordFailure, circuitRecordSuccess, pushDeadLetter, recordMetric } from "@/lib/reliability.server";

export type TagerEventType = "withdrawal" | "restock" | "increase" | "decrease" | "out_of_stock";

export interface TagerSyncResult {
  runId: string | null;
  connectionId: string;
  productsSynced: number;
  productsInserted: number;
  productsUpdated: number;
  eventsDetected: number;
  eventsByType: Record<string, number>;
  pagesFetched: number;
  executionTimeMs: number;
  errors: Array<{ code: string; message: string }>;
}

interface ConnectionRow {
  id: string;
  user_id: string;
  encrypted_token: string;
  status: string;
}

/** Classifies a stock transition. Returns null when nothing changed. */
export function classifyChange(
  previous: number | null,
  current: number | null,
): { type: TagerEventType; difference: number } | null {
  if (current === null) return null;
  const prev = previous ?? null;
  if (prev === null || prev === current) return null;

  const diff = current - prev;
  if (current === 0) return { type: "out_of_stock", difference: diff };
  if (prev === 0) return { type: "restock", difference: diff };
  if (diff < 0) return { type: "withdrawal", difference: diff };
  return { type: "increase", difference: diff };
}

async function logError(connectionId: string | null, runId: string | null, err: unknown) {
  const e = err as TagerApiError;
  await supabaseAdmin.from("tager_errors").insert({
    connection_id: connectionId,
    run_id: runId,
    status_code: e?.status ?? null,
    code: e?.code ?? "unknown",
    message: String((e as Error)?.message ?? err).slice(0, 2000),
  });
}

/** Loads the connection for a user (server-side only; includes the token). */
export async function getConnection(userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("tager_connections")
    .select("id, user_id, encrypted_token, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRow) ?? null;
}

async function createRun(triggeredBy: string | null, manualOrAuto: "manual" | "auto"): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("sr_sync_runs")
    .insert({ platform: TAGER_PLATFORM, status: "running", triggered_by: triggeredBy, manual_or_auto: manualOrAuto })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

/** Runs a full sync for one connection: fetch → upsert → snapshot → diff. */
export async function syncTagerConnection(params: {
  connection?: ConnectionRow;
  userId?: string;
  triggeredBy?: string | null;
  manualOrAuto?: "manual" | "auto";
}): Promise<TagerSyncResult> {
  const startedAt = Date.now();
  const manualOrAuto = params.manualOrAuto ?? "manual";
  const connection =
    params.connection ?? (params.userId ? await getConnection(params.userId) : null);
  if (!connection) throw new Error("tager_not_connected");

  const gate = await circuitAllows(TAGER_PLATFORM);
  if (!gate.allowed) throw new Error(`circuit_open:${gate.reason ?? "tager unavailable"}`);

  const runId = await createRun(params.triggeredBy ?? connection.user_id, manualOrAuto);
  const errors: TagerSyncResult["errors"] = [];
  const eventsByType: Record<string, number> = {};

  try {
    const token = decryptToken(connection.encrypted_token);
    const { products, pagesFetched } = await fetchAllTagerProducts(token);

    // Existing rows (stock is our previous snapshot baseline).
    const { data: existingRows } = await supabaseAdmin
      .from("tager_products")
      .select("id, external_product_id, stock")
      .eq("connection_id", connection.id);
    const existing = new Map<string, { id: string; stock: number | null }>();
    for (const r of existingRows ?? []) existing.set(r.external_product_id, { id: r.id, stock: r.stock });

    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();
    const snapshots: Array<{ product_id: string; stock: number | null; captured_at: string }> = [];
    const events: Array<{
      product_id: string;
      event_type: string;
      previous_stock: number | null;
      current_stock: number | null;
      difference: number;
      run_id: string | null;
      created_at: string;
    }> = [];

    const CHUNK = 200;
    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);
      const rows = chunk.map((p: TagerProduct) => {
        const prev = existing.get(p.externalProductId);
        if (prev) updated++; else inserted++;
        return {
          connection_id: connection.id,
          external_product_id: p.externalProductId,
          name: p.name,
          sku: p.sku,
          price: p.price,
          currency: p.currency,
          stock: p.stock,
          previous_stock: prev ? prev.stock : null,
          image: p.image,
          category: p.category,
          brand: p.brand,
          status: p.status,
          metadata: { lastUpdated: p.lastUpdated },
          last_seen: now,
          updated_at: now,
        };
      });

      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from("tager_products")
        .upsert(rows, { onConflict: "connection_id,external_product_id" })
        .select("id, external_product_id, stock");
      if (upsertErr) throw upsertErr;

      for (const row of upserted ?? []) {
        snapshots.push({ product_id: row.id, stock: row.stock, captured_at: now });
        const prev = existing.get(row.external_product_id);
        const change = classifyChange(prev ? prev.stock : null, row.stock);
        if (change) {
          eventsByType[change.type] = (eventsByType[change.type] ?? 0) + 1;
          events.push({
            product_id: row.id,
            event_type: change.type,
            previous_stock: prev?.stock ?? null,
            current_stock: row.stock,
            difference: change.difference,
            run_id: runId,
            created_at: now,
          });
        }
      }
    }

    for (let i = 0; i < snapshots.length; i += 500) {
      const { error } = await supabaseAdmin.from("tager_snapshots").insert(snapshots.slice(i, i + 500));
      if (error) errors.push({ code: "snapshot_insert_failed", message: error.message });
    }
    for (let i = 0; i < events.length; i += 500) {
      const { error } = await supabaseAdmin.from("tager_events").insert(events.slice(i, i + 500));
      if (error) errors.push({ code: "event_insert_failed", message: error.message });
    }

    await supabaseAdmin
      .from("tager_connections")
      .update({ status: "connected", last_sync: now, last_error: null })
      .eq("id", connection.id);

    const executionTimeMs = Date.now() - startedAt;
    if (runId) {
      await supabaseAdmin
        .from("sr_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: executionTimeMs,
          pages_fetched: pagesFetched,
          products_total: products.length,
          products_processed: products.length,
          products_inserted: inserted,
          products_updated: updated,
          withdrawal_delta: events
            .filter((e) => e.event_type === "withdrawal" || e.event_type === "out_of_stock")
            .reduce((a, e) => a + Math.abs(Number(e.difference ?? 0)), 0),
          restock_delta: events
            .filter((e) => e.event_type === "restock" || e.event_type === "increase")
            .reduce((a, e) => a + Math.abs(Number(e.difference ?? 0)), 0),
          total_inventory: products.reduce((a, p) => a + (p.stock ?? 0), 0),
        })
        .eq("id", runId);
    }

    await circuitRecordSuccess(TAGER_PLATFORM);
    await recordMetric("tager.sync.products", products.length, { runId });

    return {
      runId,
      connectionId: connection.id,
      productsSynced: products.length,
      productsInserted: inserted,
      productsUpdated: updated,
      eventsDetected: events.length,
      eventsByType,
      pagesFetched,
      executionTimeMs,
      errors,
    };
  } catch (err) {
    const e = err as TagerApiError;
    const message = String((e as Error)?.message ?? err);
    const tokenInvalid = e instanceof TagerApiError && e.tokenInvalid;

    await logError(connection.id, runId, err);
    await supabaseAdmin
      .from("tager_connections")
      .update({ status: tokenInvalid ? "token_expired" : "error", last_error: message.slice(0, 1000) })
      .eq("id", connection.id);

    if (runId) {
      await supabaseAdmin
        .from("sr_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error_message: message.slice(0, 1000),
        })
        .eq("id", runId);
    }

    if (!tokenInvalid) await circuitRecordFailure(TAGER_PLATFORM, err);
    await pushDeadLetter({
      platform: TAGER_PLATFORM,
      runId: runId ?? undefined,
      kind: "tager.sync",
      payload: { connectionId: connection.id },
      errorCode: e?.code ?? "unknown",
      errorMessage: message,
    });

    throw err;
  }
}

/** Auto-sync entry point: syncs every active connection, skipping expired tokens. */
export async function syncAllTagerConnections(): Promise<{
  connections: number;
  synced: number;
  skipped: number;
  results: Array<{ connectionId: string; ok: boolean; error?: string }>;
}> {
  const { data } = await supabaseAdmin
    .from("tager_connections")
    .select("id, user_id, encrypted_token, status");
  const rows = (data as ConnectionRow[]) ?? [];
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];
  let synced = 0;
  let skipped = 0;

  for (const connection of rows) {
    if (connection.status === "token_expired" || connection.status === "disabled") {
      skipped++;
      results.push({ connectionId: connection.id, ok: false, error: `skipped:${connection.status}` });
      continue;
    }
    try {
      await syncTagerConnection({ connection, triggeredBy: connection.user_id, manualOrAuto: "auto" });
      synced++;
      results.push({ connectionId: connection.id, ok: true });
    } catch (err: any) {
      results.push({ connectionId: connection.id, ok: false, error: String(err?.message ?? err) });
    }
  }

  return { connections: rows.length, synced, skipped, results };
}
