// Sync Safka products into sr_products + sr_snapshots.
// Server-only. Uses service-role admin client (bypasses RLS).

import { fetchSafkaProducts, type SafkaProduct } from "./safka.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SafkaSyncResult {
  productsFetched: number;
  productsUpserted: number;
  snapshotsCreated: number;
  totalDecrease: number;
  totalRestock: number;
  pagesFetched: number;
  durationMs: number;
  fetchedAt: string;
}

export async function syncSafkaIntoDb(): Promise<SafkaSyncResult> {
  const startedAt = Date.now();
  const { products, pagesFetched } = await fetchSafkaProducts();

  // Load previous state for delta calculation.
  const externalIds = products.map((p) => p.externalProductId);
  const existingMap = new Map<
    string,
    { current_quantity: number | null }
  >();

  if (externalIds.length > 0) {
    // Chunk in 500s to keep the URL small.
    for (let i = 0; i < externalIds.length; i += 500) {
      const slice = externalIds.slice(i, i + 500);
      const { data, error } = await supabaseAdmin
        .from("sr_products")
        .select("external_product_id, current_quantity")
        .in("external_product_id", slice);
      if (error) throw error;
      for (const row of data ?? []) {
        existingMap.set(row.external_product_id as string, {
          current_quantity: (row as any).current_quantity,
        });
      }
    }
  }

  const nowIso = new Date().toISOString();
  const upserts: any[] = [];
  const snapshots: any[] = [];
  let totalDecrease = 0;
  let totalRestock = 0;

  for (const p of products) {
    const prev = existingMap.get(p.externalProductId);
    const prevQty = prev?.current_quantity ?? null;
    const currQty = p.currentQuantity ?? 0;

    let decrease = 0;
    let restock = 0;
    if (prevQty !== null && prevQty !== undefined) {
      const diff = (prevQty ?? 0) - currQty;
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

    // Snapshot only when it's the first sighting or the quantity changed.
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

  // Upsert products in chunks.
  let productsUpserted = 0;
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const { error } = await supabaseAdmin
      .from("sr_products")
      .upsert(chunk, { onConflict: "external_product_id" });
    if (error) throw error;
    productsUpserted += chunk.length;
  }

  // Insert snapshots in chunks.
  let snapshotsCreated = 0;
  for (let i = 0; i < snapshots.length; i += 500) {
    const chunk = snapshots.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("sr_snapshots").insert(chunk);
    if (error) throw error;
    snapshotsCreated += chunk.length;
  }

  return {
    productsFetched: products.length,
    productsUpserted,
    snapshotsCreated,
    totalDecrease,
    totalRestock,
    pagesFetched,
    durationMs: Date.now() - startedAt,
    fetchedAt: nowIso,
  };
}
