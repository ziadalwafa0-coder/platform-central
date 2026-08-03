import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapJob, runJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/jobs/$jobId/retry")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      POST: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("*")
          .eq("id", params.jobId)
          .maybeSingle();
        if (!existing) return Response.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });

        await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .update({
            status: "PENDING",
            progress_percentage: 0,
            error_message: null,
            completed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.jobId);

        await runJob(params.jobId).catch(() => null);

        const { data } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("*")
          .eq("id", params.jobId)
          .maybeSingle();
        return Response.json(mapJob((data ?? existing) as any));
      },
    },
  },
});
