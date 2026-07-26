import { createFileRoute } from "@tanstack/react-router";
import { cairoNow } from "@/lib/cairo-time";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/sync/logs")({
  server: {
    handlers: {
      GET: async () => {
        const { data: snaps } = await supabaseAdmin
          .from("sr_snapshots")
          .select("*")
          .order("observed_at", { ascending: false })
          .limit(200);

        const logs = (snaps ?? []).map((s: any) => ({
          id: s.id,
          timestamp: s.observed_at,
          platform: s.platform ?? "safka",
          externalProductId: s.external_product_id,
          previousQuantity: s.previous_quantity,
          currentQuantity: s.current_quantity,
          quantityDecrease: s.quantity_decrease ?? 0,
          restockAmount: s.restock_amount ?? 0,
          message:
            (s.quantity_decrease ?? 0) > 0
              ? `سحب ${s.quantity_decrease} قطعة`
              : (s.restock_amount ?? 0) > 0
                ? `إعادة تخزين ${s.restock_amount} قطعة`
                : "أول رصد",
          level: "info",
        }));

        const { count: productsCount } = await supabaseAdmin
          .from("sr_products")
          .select("*", { count: "exact", head: true });
        const { count: snapsCount } = await supabaseAdmin
          .from("sr_snapshots")
          .select("*", { count: "exact", head: true });

        const totalDecreases = logs.reduce((a, l) => a + (l.quantityDecrease || 0), 0);
        const nowUtc = new Date();
        const cairo = cairoNow(nowUtc);

        return Response.json({
          success: true,
          logs,
          latencyStats30Days: [],
          successfulRunsLatency30Days: [],
          summary: {
            totalRuns: logs.length,
            successRuns: logs.length,
            failedRuns: 0,
            processingRuns: 0,
            totalProductsReceived: productsCount ?? 0,
            totalSnapshotsCreated: snapsCount ?? 0,
            totalDecreasesDetected: totalDecreases,
          },
          diagnostics: {
            activeSyncProgress: {
              syncing: false,
              processedCount: 0,
              totalProducts: productsCount ?? 0,
              statusText: "خامل",
              lastError: null,
              lastErrorPlatform: null,
            },
            isSupabaseConfigured: true,
            dataBackend: "supabase",
            nodeEnv: "production",
            serverTimeUtc: nowUtc.toISOString(),
            serverTimeCairo: {
              dateStr: cairo.toISOString().slice(0, 10),
              hour: cairo.getUTCHours(),
              minute: cairo.getUTCMinutes(),
            },
            totalProductsInDb: productsCount ?? 0,
            totalSnapshotsInDb: snapsCount ?? 0,
            systemInsight: `${productsCount ?? 0} منتج و ${snapsCount ?? 0} snapshot في القاعدة.`,
          },
        });
      },
    },
  },
});
