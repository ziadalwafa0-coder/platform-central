import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import {
  ALGORITHM,
  averageOf,
  cairoWindow,
  classifyProduct,
  loadWindowSnapshots,
  scoreDataQuality,
  type SnapshotRow,
} from "@/lib/deliveryReturns.server";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export const Route = createFileRoute("/api/delivery-returns-audit")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const d = defaultRange();
        const weekStart = url.searchParams.get("weekStart") || d.start;
        const weekEnd = url.searchParams.get("weekEnd") || d.end;

        if (weekStart > weekEnd) {
          return Response.json(
            { success: false, error: "تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { startIso, endIso } = cairoWindow(weekStart, weekEnd);

        const [snapshots, productsRes] = await Promise.all([
          loadWindowSnapshots(supabaseAdmin as any, startIso, endIso),
          supabaseAdmin
            .from("sr_products")
            .select("id, external_product_id, name, sku, image_url, product_url, platform, category, current_quantity"),
        ]);

        const products = productsRes.data ?? [];
        const byExternal = new Map(products.map((p) => [p.external_product_id, p]));

        const grouped = new Map<string, SnapshotRow[]>();
        for (const s of snapshots) {
          const arr = grouped.get(s.external_product_id) ?? [];
          arr.push(s);
          grouped.set(s.external_product_id, arr);
        }

        const rows = Array.from(grouped.entries()).map(([externalId, snaps]) => {
          const c = classifyProduct(snaps);
          const p = byExternal.get(externalId);
          return {
            productId: p?.id ?? externalId,
            externalProductId: externalId,
            productName: p?.name ?? externalId,
            sku: p?.sku ?? "",
            imageUrl: p?.image_url ?? "",
            productUrl: p?.product_url ?? "",
            platform: p?.platform ?? "safka",
            category: p?.category ?? "",
            currentQuantity: p?.current_quantity ?? null,
            totals: c.totals,
            perBatchTotals: c.perBatchTotals,
            days: c.days,
            movements: c.movements,
            dataQuality: scoreDataQuality(c),
          };
        });

        rows.sort((a, b) => b.totals.weeklyWithdrawals - a.totals.weeklyWithdrawals);

        const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + pick(r), 0);

        const totals = {
          productsAnalyzed: rows.length,
          averageConfidenceScore: averageOf(rows.map((r) => r.dataQuality.confidenceScore)) ?? 0,
          averageDeliveryRate: averageOf(rows.map((r) => r.totals.deliveryRate)),
          averageReturnRate: averageOf(rows.map((r) => r.totals.returnRate)),
          totalWithdrawals: sum((r) => r.totals.weeklyWithdrawals),
          totalEstimatedReturns: sum((r) => r.totals.estimatedReturns),
          totalConfirmedRestock: sum((r) => r.totals.confirmedRestock),
          totalUnclassifiedIncreases: sum((r) => r.totals.unclassifiedIncreases),
          totalNetDelivered: sum((r) => r.totals.netDelivered),
          perBatchTotals: {
            averageDeliveryRate: averageOf(rows.map((r) => r.perBatchTotals.deliveryRate)),
            averageReturnRate: averageOf(rows.map((r) => r.perBatchTotals.returnRate)),
            totalEstimatedReturns: sum((r) => r.perBatchTotals.estimatedReturns),
            totalNetDelivered: sum((r) => r.perBatchTotals.netDelivered),
          },
          crossRestockTotals: {
            averageDeliveryRate: averageOf(rows.map((r) => r.totals.deliveryRate)),
            averageReturnRate: averageOf(rows.map((r) => r.totals.returnRate)),
            totalEstimatedReturns: sum((r) => r.totals.estimatedReturns),
            totalNetDelivered: sum((r) => r.totals.netDelivered),
          },
        };

        return Response.json(
          {
            success: true,
            weekStart,
            weekEnd,
            snapshotsAnalyzed: snapshots.length,
            totals,
            products: rows,
            algorithm: ALGORITHM,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
