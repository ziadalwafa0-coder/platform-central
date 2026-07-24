import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

        // DB check
        const t1 = Date.now();
        try {
          const { error } = await supabaseAdmin.from("sr_sync_runs").select("id", { count: "exact", head: true }).limit(1);
          checks.database = { ok: !error, latencyMs: Date.now() - t1, detail: error?.message };
        } catch (e: any) {
          checks.database = { ok: false, latencyMs: Date.now() - t1, detail: e?.message };
        }

        // Safka API config check (not a live probe — avoid rate-limiting our upstream)
        checks.safka_api_key = { ok: !!process.env.SAFKA_API_KEY };

        // Circuit breaker
        let cbState = "unknown";
        try {
          const { data } = await supabaseAdmin.from("sr_circuit_state").select("state").eq("platform", "safka").maybeSingle();
          cbState = data?.state ?? "closed";
        } catch { /* ignore */ }
        checks.circuit_breaker = { ok: cbState !== "open", detail: cbState };

        // Stuck runs
        let stuckCount = 0;
        try {
          const { count } = await supabaseAdmin
            .from("sr_sync_runs").select("id", { count: "exact", head: true })
            .in("status", ["pending", "running"])
            .lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
          stuckCount = count ?? 0;
        } catch { /* ignore */ }
        checks.stuck_runs = { ok: stuckCount === 0, detail: `${stuckCount} stuck` };

        // DLQ unresolved
        let dlqCount = 0;
        try {
          const { count } = await supabaseAdmin
            .from("sr_dead_letter").select("id", { count: "exact", head: true }).is("resolved_at", null);
          dlqCount = count ?? 0;
        } catch { /* ignore */ }
        checks.dead_letter_queue = { ok: dlqCount < 50, detail: `${dlqCount} unresolved` };

        const allOk = Object.values(checks).every((c) => c.ok);
        return Response.json(
          {
            status: allOk ? "healthy" : "degraded",
            uptimeCheckMs: Date.now() - started,
            checks,
            timestamp: new Date().toISOString(),
          },
          { status: allOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
