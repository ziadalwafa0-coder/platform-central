import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";
import { runJob } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/worker/run-once")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pending } = await supabaseAdmin
          .from("sr_ads_spy_jobs")
          .select("id")
          .in("status", ["PENDING", "PROCESSING"])
          .order("created_at", { ascending: true })
          .limit(3);

        const ran: string[] = [];
        for (const job of pending ?? []) {
          await runJob(job.id).catch(() => null);
          ran.push(job.id);
        }

        return Response.json({
          status: "ok",
          message: ran.length ? `تم تشغيل ${ran.length} مهمة معلقة.` : "لا توجد مهام معلقة.",
          ran,
        });
      },
    },
  },
});
