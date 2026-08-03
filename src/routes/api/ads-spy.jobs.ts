import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapJob, runJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/jobs")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const productId = new URL(request.url).searchParams.get("productId");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (productId) q = q.eq("product_id", productId);
        const { data, error } = await q;
        if (error) return Response.json([], { status: 200 });
        return Response.json((data ?? []).map(mapJob as any), {
          headers: { "Cache-Control": "no-store" },
        });
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as any;
        const productId = String(body.product_id ?? new URL(request.url).searchParams.get("productId") ?? "");
        if (!productId) {
          return Response.json({ success: false, error: "product_id مطلوب" }, { status: 400 });
        }

        const providers = Array.isArray(body.providers) && body.providers.length ? body.providers : ["meta"];
        const keywords = Array.isArray(body.keywords) ? body.keywords.filter(Boolean) : [];
        if (keywords.length === 0) {
          return Response.json({ success: false, error: "يجب إدخال كلمة مفتاحية واحدة على الأقل" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .insert({
            product_id: productId,
            providers,
            keywords,
            country_codes: Array.isArray(body.country_codes) && body.country_codes.length ? body.country_codes : ["EG"],
            max_results_per_query: Math.min(50, Math.max(1, Number(body.max_results_per_query ?? 20))),
            trigger_reason: "MANUAL",
            status: "PENDING",
          })
          .select("*")
          .single();

        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

        // No background queue on this runtime: run inline, then return the final row.
        await runJob(data.id).catch(() => null);
        const { data: finished } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("*")
          .eq("id", data.id)
          .maybeSingle();

        return Response.json(mapJob((finished ?? data) as any));
      },
    },
  },
});
