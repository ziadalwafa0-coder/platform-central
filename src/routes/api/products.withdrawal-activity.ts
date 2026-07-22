import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/products/withdrawal-activity")({
  server: {
    handlers: {
      GET: async () => {
        const cairoOffsetMs = 2 * 60 * 60 * 1000;
        const cairoNow = new Date(Date.now() + cairoOffsetMs);
        const cairoMidnightUtc = new Date(
          Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), cairoNow.getUTCDate()) - cairoOffsetMs,
        ).toISOString();

        const { data: snaps } = await supabaseAdmin
          .from("sr_snapshots")
          .select("external_product_id, quantity_decrease")
          .gte("observed_at", cairoMidnightUtc)
          .gt("quantity_decrease", 0);

        const perProduct = new Map<string, number>();
        for (const s of snaps ?? []) {
          const eid = (s as any).external_product_id as string;
          perProduct.set(eid, (perProduct.get(eid) ?? 0) + ((s as any).quantity_decrease ?? 0));
        }
        const ids = Array.from(perProduct.keys());
        if (ids.length === 0) return Response.json({ success: true, products: [] });

        const { data: prods } = await supabaseAdmin
          .from("sr_products")
          .select("*")
          .in("external_product_id", ids);

        const products = (prods ?? []).map((p: any) => ({
          id: p.id,
          externalProductId: p.external_product_id,
          name: p.name,
          sku: p.sku ?? "",
          imageUrl: p.image_url ?? "",
          currentQuantity: p.current_quantity,
          withdrawnPieces: perProduct.get(p.external_product_id) ?? 0,
        }));

        return Response.json({ success: true, products });
      },
    },
  },
});
