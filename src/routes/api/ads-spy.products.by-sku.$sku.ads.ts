import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { buildSummary, loadMatches } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/products/by-sku/$sku/ads")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sku = decodeURIComponent(params.sku).trim();
        const { data: product } = await supabaseAdmin
          .from("sr_products")
          .select("id, external_product_id, name, sku, category, image_url, product_url")
          .eq("sku", sku)
          .maybeSingle();

        if (!product) {
          return Response.json({ success: false, error: `لا يوجد منتج بالكود ${sku}` }, { status: 404 });
        }

        const ads = await loadMatches(product.external_product_id);
        return Response.json(
          {
            product: {
              id: product.id,
              name: product.name,
              sku: product.sku ?? "",
              category: product.category ?? "",
              imageUrl: product.image_url ?? "",
              productUrl: product.product_url ?? "",
            },
            ads,
            summary: buildSummary(ads),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
