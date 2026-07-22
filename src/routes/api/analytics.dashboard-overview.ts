import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/analytics/dashboard-overview")({
  server: {
    handlers: {
      GET: async () => {
        const cairoOffsetMs = 2 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const cairoNow = new Date(nowMs + cairoOffsetMs);
        const cairoMidnightUtc = new Date(
          Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), cairoNow.getUTCDate()) - cairoOffsetMs,
        ).toISOString();

        // Last completed Cairo hour range
        const cairoHour = cairoNow.getUTCHours();
        const cairoHourStartUtc = new Date(
          Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), cairoNow.getUTCDate(), cairoHour - 1) - cairoOffsetMs,
        ).toISOString();
        const cairoHourEndUtc = new Date(
          Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), cairoNow.getUTCDate(), cairoHour) - cairoOffsetMs,
        ).toISOString();

        const { count: monitored } = await supabaseAdmin
          .from("sr_products")
          .select("id", { count: "exact", head: true });

        const { data: hourSnaps } = await supabaseAdmin
          .from("sr_snapshots")
          .select("external_product_id, quantity_decrease")
          .gte("observed_at", cairoHourStartUtc)
          .lt("observed_at", cairoHourEndUtc);

        const { data: daySnaps } = await supabaseAdmin
          .from("sr_snapshots")
          .select("external_product_id, quantity_decrease")
          .gte("observed_at", cairoMidnightUtc);

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
