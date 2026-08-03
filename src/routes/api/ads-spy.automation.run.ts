import { createFileRoute } from "@tanstack/react-router";
import { runJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/automation/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("x-ads-spy-secret") ??
          request.headers.get("apikey") ??
          request.headers.get("x-api-key");
        if (!anon || provided !== anon) {
          return Response.json({ status: "unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const { data: profiles } = await supabaseAdmin
          .from("sr_ads_spy_profiles")
          .select("*")
          .eq("is_active", true)
          .or(`next_sync_at.is.null,next_sync_at.lte.${nowIso}`)
          .limit(5);

        const started: string[] = [];
        for (const p of profiles ?? []) {
          const { data: job } = await supabaseAdmin
            .from("sr_ads_spy_jobs")
            .insert({
              product_id: p.product_id,
              search_profile_id: p.id,
              providers: p.providers,
              keywords: p.keywords,
              country_codes: p.country_codes,
              max_results_per_query: p.max_results_per_query,
              trigger_reason: "DAILY_WITHDRAWAL",
              status: "PENDING",
            })
            .select("id")
            .maybeSingle();

          if (!job) continue;
          started.push(job.id);
          await runJob(job.id).catch(() => null);
          await supabaseAdmin
            .from("sr_ads_spy_profiles")
            .update({
              last_synced_at: nowIso,
              next_sync_at: new Date(Date.now() + (p.sync_interval_hours ?? 24) * 3_600_000).toISOString(),
              updated_at: nowIso,
            })
            .eq("id", p.id);
        }

        return Response.json({ status: "ok", started });
      },
    },
  },
});
