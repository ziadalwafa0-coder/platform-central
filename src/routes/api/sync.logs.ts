import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/sync/logs")({
  server: {
    handlers: {
      GET: async () => {
        const { data } = await supabaseAdmin
          .from("sr_snapshots")
          .select("*")
          .order("observed_at", { ascending: false })
          .limit(200);
        const logs = (data ?? []).map((s: any) => ({
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
        return Response.json({ success: true, logs });
      },
    },
  },
});
