import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { buildKeywordPlan } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/products/$productId/keywords/plan")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("sr_products")
          .select("name, sku, category")
          .or(`id.eq.${params.productId},external_product_id.eq.${params.productId}`)
          .maybeSingle();
        return Response.json(buildKeywordPlan(data ?? {}), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
