import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cairoMidnightUtcIso } from "@/lib/cairo-time";
import { fetchAllRows } from "@/lib/fetchAllRows.server";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/products/withdrawal-activity")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async () => {
        const cairoMidnightUtc = cairoMidnightUtcIso();

        const snaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "external_product_id, quantity_decrease, observed_at",
          1000,
          (q) => q.gte("observed_at", cairoMidnightUtc).gt("quantity_decrease", 0),
        );

        type Agg = { pieces: number; events: number; lastAt: string | null };
        const perProduct = new Map<string, Agg>();
        for (const s of snaps ?? []) {
          const eid = (s as any).external_product_id as string;
          const dec = Number((s as any).quantity_decrease ?? 0);
          const at = (s as any).observed_at as string | null;
          const cur = perProduct.get(eid) ?? { pieces: 0, events: 0, lastAt: null };
          cur.pieces += dec;
          cur.events += 1;
          if (at && (!cur.lastAt || at > cur.lastAt)) cur.lastAt = at;
          perProduct.set(eid, cur);
        }
        const ids = Array.from(perProduct.keys());
        if (ids.length === 0) return Response.json({ success: true, products: [] });

        const { data: prods } = await supabaseAdmin
          .from("sr_products")
          .select("*")
          .in("external_product_id", ids);

        const products = (prods ?? []).map((p: any) => {
          const agg = perProduct.get(p.external_product_id) ?? { pieces: 0, events: 0, lastAt: null };
          return {
            id: p.id,
            externalProductId: p.external_product_id,
            name: p.name,
            sku: p.sku ?? "",
            imageUrl: p.image_url ?? "",
            productUrl: p.product_url ?? "",
            category: p.category ?? "",
            price: p.price,
            currency: p.currency ?? "EGP",
            currentQuantity: p.current_quantity,
            previousQuantity: p.previous_quantity,
            lastCheckedAt: p.last_checked_at,
            withdrawnPieces: agg.pieces,
            withdrawalEvents: agg.events,
            lastWithdrawalAt: agg.lastAt,
          };
        });

        return Response.json({ success: true, products });
      },
    },
  },
});
