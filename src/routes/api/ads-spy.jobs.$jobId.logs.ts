import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/ads-spy/jobs/$jobId/logs")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("sr_ads_spy_logs")
          .select("*")
          .eq("job_id", params.jobId)
          .order("created_at", { ascending: false })
          .limit(200);
        return Response.json(
          { success: true, logs: (data ?? []).map((l: any) => ({ ...l, id: String(l.id) })) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
