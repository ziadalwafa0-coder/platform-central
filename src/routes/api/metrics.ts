import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/metrics")({
  server: {
    handlers: {
      GET: async () => {
        const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
        const since1h = new Date(Date.now() - 3600_000).toISOString();

        const [runs24h, runs1h, dlq, circuit, drift, products, snapshots1h] = await Promise.all([
          supabaseAdmin.from("sr_sync_runs").select("status, duration_ms, products_failed, withdrawal_delta").gte("started_at", since24h),
          supabaseAdmin.from("sr_sync_runs").select("status").gte("started_at", since1h),
          supabaseAdmin.from("sr_dead_letter").select("id", { count: "exact", head: true }).is("resolved_at", null),
          supabaseAdmin.from("sr_circuit_state").select("*").eq("platform", "safka").maybeSingle(),
          supabaseAdmin.from("sr_schema_warnings").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("sr_products").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("sr_snapshots").select("id", { count: "exact", head: true }).gte("observed_at", since1h),
        ]);

        const r24 = runs24h.data ?? [];
        const total24 = r24.length;
        const success24 = r24.filter((r) => r.status === "success").length;
        const failed24 = r24.filter((r) => r.status === "failed").length;
        const avgDuration = total24 ? Math.round(r24.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / total24) : 0;
        const withdrawals24 = r24.reduce((a, r) => a + (r.withdrawal_delta ?? 0), 0);
        const successRate = total24 ? +(success24 / total24 * 100).toFixed(2) : 100;

        return Response.json(
          {
            window: { last24h: since24h, last1h: since1h },
            sync: {
              runs_24h: total24, success_24h: success24, failed_24h: failed24,
              runs_1h: (runs1h.data ?? []).length,
              success_rate_pct: successRate,
              avg_duration_ms: avgDuration,
              withdrawal_delta_24h: withdrawals24,
            },
            products: { total: products.count ?? 0, snapshots_1h: snapshots1h.count ?? 0 },
            reliability: {
              circuit_state: circuit.data?.state ?? "closed",
              circuit_failures: circuit.data?.consecutive_failures ?? 0,
              circuit_last_error: circuit.data?.last_error ?? null,
              dead_letter_unresolved: dlq.count ?? 0,
              schema_drift_warnings: drift.count ?? 0,
            },
            timestamp: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
