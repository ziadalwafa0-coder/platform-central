import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/sync/runs")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("sr_sync_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(limit);
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        return Response.json({ success: true, runs: data ?? [] });
      },
      POST: async ({ request }) => {
        // Body: { action: "cancel", runId }
        const body = await request.json().catch(() => ({}));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (body?.action === "cancel" && body?.runId) {
          const { error } = await supabaseAdmin
            .from("sr_sync_runs")
            .update({ cancel_requested: true })
            .eq("id", body.runId);
          if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
          return Response.json({ success: true });
        }
        return Response.json({ success: false, error: "unknown action" }, { status: 400 });
      },
    },
  },
});
