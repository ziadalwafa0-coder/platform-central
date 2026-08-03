import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/ads-spy/health")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ count: jobs }, { count: ads }] = await Promise.all([
          supabaseAdmin.from("sr_ads_spy_jobs").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("sr_ads_spy_ads").select("id", { count: "exact", head: true }),
        ]);
        return Response.json({
          status: process.env.META_ADS_TOKEN ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          collectors: {
            meta: process.env.META_ADS_TOKEN ? "ready" : "missing_token",
            tiktok: "unavailable_no_public_api",
          },
          jobs: jobs ?? 0,
          ads: ads ?? 0,
        });
      },
    },
  },
});
