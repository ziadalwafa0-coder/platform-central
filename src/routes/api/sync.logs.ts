import { createFileRoute } from "@tanstack/react-router";
import { cairoNow, cairoDateStr } from "@/lib/cairo-time";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiAuth } from "@/lib/api-auth.server";

type UiStatus = "COMPLETED" | "PROCESSING" | "CONNECTING" | "FAILED";

function mapStatus(status: string): UiStatus {
  switch (status) {
    case "success":
      return "COMPLETED";
    case "running":
      return "PROCESSING";
    case "pending":
      return "CONNECTING";
    default:
      return "FAILED"; // failed | cancelled | anything unknown
  }
}

export const Route = createFileRoute("/api/sync/logs")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async () => {
        // ---- Real sync runs (source of truth) ----
        const { data: runs, error: runsError } = await supabaseAdmin
          .from("sr_sync_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(200);

        if (runsError) {
          return Response.json(
            { success: false, error: `فشل قراءة سجلات المزامنة: ${runsError.message}` },
            { status: 500 },
          );
        }

        const logs = (runs ?? []).map((r: any) => {
          const status = mapStatus(r.status);
          return {
            id: r.id,
            platform: r.platform ?? "safka",
            status,
            rawStatus: r.status,
            createdAt: r.started_at,
            startedAt: r.started_at,
            completedAt: r.finished_at,
            durationMs: r.duration_ms ?? null,
            pagesRequested: r.pages_fetched ?? 0,
            pagesCompleted: r.pages_fetched ?? 0,
            productsReceived: r.products_total ?? 0,
            productsUpdated: r.products_updated ?? 0,
            productsInserted: r.products_inserted ?? 0,
            productsSkipped: r.products_failed ?? 0,
            snapshotsCreated: (r.withdrawal_delta ?? 0) > 0 || (r.restock_delta ?? 0) > 0
              ? r.products_processed ?? 0
              : 0,
            quantityDecreasesDetected: r.withdrawal_delta ?? 0,
            restocksDetected: r.restock_delta ?? 0,
            withdrawalDelta: r.withdrawal_delta ?? 0,
            restockDelta: r.restock_delta ?? 0,
            retryCount: 0,
            errors: r.error_message ? [String(r.error_message)] : [],
            errorSummary: r.error_message ?? null,
            errorMessage: r.error_message ?? null,
            manualOrAuto: r.manual_or_auto ?? "manual",
          };
        });

        // ---- 30-day stability stats (per Cairo day) ----
        const dayMap = new Map<string, { success: number; failed: number; total: number }>();
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const l of logs) {
          if (!l.startedAt) continue;
          const t = new Date(l.startedAt).getTime();
          if (Number.isNaN(t) || t < cutoff) continue;
          const dateStr = cairoDateStr(new Date(t));
          const bucket = dayMap.get(dateStr) ?? { success: 0, failed: 0, total: 0 };
          bucket.total++;
          if (l.status === "COMPLETED") bucket.success++;
          else if (l.status === "FAILED") bucket.failed++;
          dayMap.set(dateStr, bucket);
        }
        const thirtyDaysStats = [...dayMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([dateStr, b]) => ({
            dateStr,
            success: b.success,
            failed: b.failed,
            total: b.total,
            successRate: b.total > 0 ? Math.round((b.success / b.total) * 100) : 0,
          }));

        const successfulRunsLatency30Days = logs
          .filter(
            (l) =>
              l.status === "COMPLETED" &&
              typeof l.durationMs === "number" &&
              l.startedAt &&
              new Date(l.startedAt).getTime() >= cutoff,
          )
          .map((l) => ({
            id: l.id,
            platform: l.platform,
            startedAt: l.startedAt,
            durationMs: l.durationMs as number,
            productsReceived: l.productsReceived,
          }))
          .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

        // ---- DB counts ----
        const { count: productsCount } = await supabaseAdmin
          .from("sr_products")
          .select("*", { count: "exact", head: true });
        const { count: snapsCount } = await supabaseAdmin
          .from("sr_snapshots")
          .select("*", { count: "exact", head: true });

        const successRuns = logs.filter((l) => l.status === "COMPLETED").length;
        const failedRuns = logs.filter((l) => l.status === "FAILED").length;
        const processingRuns = logs.filter(
          (l) => l.status === "PROCESSING" || l.status === "CONNECTING",
        ).length;
        const totalDecreasesDetected = logs.reduce((a, l) => a + (l.withdrawalDelta || 0), 0);

        const active = logs.find((l) => l.status === "PROCESSING" || l.status === "CONNECTING");
        const lastFailed = logs.find((l) => l.status === "FAILED");

        const nowUtc = new Date();
        const cairo = cairoNow(nowUtc);

        return Response.json({
          success: true,
          logs,
          thirtyDaysStats,
          successfulRunsLatency30Days,
          latencyStats30Days: successfulRunsLatency30Days,
          summary: {
            totalRuns: logs.length,
            successRuns,
            failedRuns,
            processingRuns,
            totalProductsReceived: productsCount ?? 0,
            totalSnapshotsCreated: snapsCount ?? 0,
            totalDecreasesDetected,
          },
          diagnostics: {
            activeSyncProgress: {
              syncing: !!active,
              processedCount: active?.productsUpdated ?? 0,
              totalProducts: productsCount ?? 0,
              statusText: active
                ? active.status === "PROCESSING"
                  ? "جاري المزامنة"
                  : "جاري الاتصال"
                : "خامل",
              lastError: lastFailed?.errorMessage ?? null,
              lastErrorPlatform: lastFailed?.platform ?? null,
            },
            isSupabaseConfigured: true,
            dataBackend: "supabase",
            nodeEnv: "production",
            serverTimeUtc: nowUtc.toISOString(),
            serverTimeCairo: {
              dateStr: cairoDateStr(nowUtc),
              hour: cairo.getUTCHours(),
              minute: cairo.getUTCMinutes(),
            },
            totalProductsInDb: productsCount ?? 0,
            totalSnapshotsInDb: snapsCount ?? 0,
            systemInsight: `${logs.length} عملية مزامنة مسجلة (${successRuns} ناجحة، ${failedRuns} فاشلة، ${processingRuns} جارية) — ${productsCount ?? 0} منتج و ${snapsCount ?? 0} لقطة في القاعدة.`,
          },
        });
      },
    },
  },
});
