import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/jobs/$jobId")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("*")
          .eq("id", params.jobId)
          .maybeSingle();
        if (!data) return Response.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });
        return Response.json(mapJob(data as any), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
