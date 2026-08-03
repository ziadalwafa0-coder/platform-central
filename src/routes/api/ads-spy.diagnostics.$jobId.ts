import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/diagnostics/$jobId")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: job }, { data: logs }, { count: matches }] = await Promise.all([
          supabaseAdmin.from("sr_ads_spy_jobs").select("*").eq("id", params.jobId).maybeSingle(),
          supabaseAdmin
            .from("sr_ads_spy_logs")
            .select("*")
            .eq("job_id", params.jobId)
            .order("created_at", { ascending: false })
            .limit(100),
          supabaseAdmin
            .from("sr_ads_spy_matches")
            .select("id", { count: "exact", head: true })
            .eq("job_id", params.jobId),
        ]);

        if (!job) return Response.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });

        return Response.json(
          {
            success: true,
            job: mapJob(job as any),
            matchesCreated: matches ?? 0,
            collectors: {
              meta: process.env.META_ADS_TOKEN ? "ready" : "missing_token",
              tiktok: "unavailable_no_public_api",
            },
            logs: (logs ?? []).map((l: any) => ({ ...l, id: String(l.id) })),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
