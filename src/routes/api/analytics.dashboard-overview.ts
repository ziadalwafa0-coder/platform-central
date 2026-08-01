import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cairoOffsetMs as getCairoOffsetMs, cairoNow as getCairoNow, cairoMidnightUtcIso, cairoHourUtcMs } from "@/lib/cairo-time";
import { fetchAllRows } from "@/lib/fetchAllRows.server";

export const Route = createFileRoute("/api/analytics/dashboard-overview")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date();
        const cairoNow = getCairoNow(now);
        const cairoMidnightUtc = cairoMidnightUtcIso(now);

        // Last completed Cairo hour range (DST-aware)
        const cairoHour = cairoNow.getUTCHours();
        const cairoHourStartUtc = new Date(cairoHourUtcMs(cairoHour - 1, now)).toISOString();
        const cairoHourEndUtc = new Date(cairoHourUtcMs(cairoHour, now)).toISOString();
        void getCairoOffsetMs;

        const { count: monitored } = await supabaseAdmin
          .from("sr_products")
          .select("id", { count: "exact", head: true });

        const hourSnaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "external_product_id, quantity_decrease",
          1000,
          (q) => q.gte("observed_at", cairoHourStartUtc).lt("observed_at", cairoHourEndUtc),
        );

        const daySnaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "external_product_id, quantity_decrease",
          1000,
          (q) => q.gte("observed_at", cairoMidnightUtc),
        );

        let withdrawnPiecesLastCompletedHour = 0;
        for (const s of hourSnaps ?? []) withdrawnPiecesLastCompletedHour += (s as any).quantity_decrease ?? 0;

        let withdrawnPiecesToday = 0;
        let withdrawalEventsToday = 0;
        const affected = new Set<string>();
        for (const s of daySnaps ?? []) {
          const dec = (s as any).quantity_decrease ?? 0;
          if (dec > 0) {
            withdrawnPiecesToday += dec;
            withdrawalEventsToday += 1;
            affected.add((s as any).external_product_id);
          }
        }

        return Response.json({
          success: true,
          monitoredProducts: monitored ?? 0,
          withdrawnPiecesLastCompletedHour,
          withdrawnPiecesToday,
          acceleratedProducts: 0,
          withdrawalEventsToday,
          affectedProductsToday: affected.size,
          dataCompletenessPercentage: 100,
          apiHealthPercentage: 100,
          activeCairoDate: cairoNow.toISOString().slice(0, 10),
          lastCompletedCairoDate: cairoNow.toISOString().slice(0, 10),
          lastCompletedCairoHour: (cairoHour + 23) % 24,
        });
      },
    },
  },
});
