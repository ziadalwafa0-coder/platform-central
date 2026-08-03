import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapJob, log } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/jobs/$jobId/cancel")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      POST: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .update({
            status: "CANCELLED",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.jobId)
          .select("*")
          .maybeSingle();

        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        if (!data) return Response.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });

        await log(supabaseAdmin, params.jobId, "meta", "cancel", "WARNING", "تم إلغاء المهمة يدوياً.");
        return Response.json(mapJob(data as any));
      },
    },
  },
});
