import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/sync/progress")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const runId = url.searchParams.get("runId");

        let run: any = null;
        if (runId) {
          const { data } = await supabaseAdmin.from("sr_sync_runs").select("*").eq("id", runId).maybeSingle();
          run = data;
        } else {
          const { data } = await supabaseAdmin.from("sr_sync_runs").select("*")
            .order("started_at", { ascending: false }).limit(1).maybeSingle();
          run = data;
        }

        if (!run) {
          return Response.json({
            success: true, syncing: false, processedCount: 0, totalProducts: 0,
            statusText: "لا توجد مزامنة سابقة", percentage: 0,
          });
        }

        const syncing = run.status === "running" || run.status === "pending";
        const total = run.products_total || 0;
        const processed = run.products_processed || 0;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : (syncing ? 5 : 100);

        return Response.json({
          success: true,
          runId: run.id,
          status: run.status,
          syncing,
          processedCount: processed,
          totalProducts: total,
          pagesFetched: run.pages_fetched ?? 0,
          startedAt: run.started_at,
          finishedAt: run.finished_at,
          durationMs: run.duration_ms,
          statusText: {
            pending: "قيد الإعداد", running: "جاري المزامنة",
            success: "اكتملت", failed: "فشلت", cancelled: "أُلغيت",
          }[run.status as string] ?? run.status,
          percentage,
          error: run.error_message ?? null,
        });
      },
    },
  },
});
