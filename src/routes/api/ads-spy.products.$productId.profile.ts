import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapProfile } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/products/$productId/profile")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("sr_ads_spy_profiles")
          .select("*")
          .eq("product_id", params.productId)
          .maybeSingle();
        return Response.json(mapProfile(data), { headers: { "Cache-Control": "no-store" } });
      },

      POST: async ({ params, request }) => {
        const body = (await request.json().catch(() => ({}))) as any;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("sr_ads_spy_profiles")
          .upsert(
            {
              product_id: params.productId,
              keywords: Array.isArray(body.keywords) ? body.keywords.filter(Boolean) : [],
              country_codes: Array.isArray(body.country_codes) && body.country_codes.length ? body.country_codes : ["EG"],
              providers: Array.isArray(body.providers) && body.providers.length ? body.providers : ["meta"],
              max_results_per_query: Math.min(50, Math.max(1, Number(body.max_results_per_query ?? 20))),
              is_active: body.is_active !== false,
              sync_interval_hours: Math.min(168, Math.max(1, Number(body.sync_interval_hours ?? 24))),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "product_id" },
          )
          .select("*")
          .single();

        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        return Response.json(mapProfile(data));
      },
    },
  },
});
