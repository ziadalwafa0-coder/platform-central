import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

/** Manual Tager sync: POST /api/integrations/tager/sync */
export const Route = createFileRoute("/api/integrations/tager/sync")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      POST: async ({ context }) => {
        const { userId } = context as { userId: string };
        const started = Date.now();

        try {
          const { syncTagerConnection } = await import("@/lib/tagerSync.server");
          const result = await syncTagerConnection({ userId, triggeredBy: userId, manualOrAuto: "manual" });
          return Response.json({
            success: true,
            products_synced: result.productsSynced,
            products_inserted: result.productsInserted,
            products_updated: result.productsUpdated,
            events_detected: result.eventsDetected,
            events_by_type: result.eventsByType,
            pages_fetched: result.pagesFetched,
            execution_time: result.executionTimeMs,
            run_id: result.runId,
            errors: result.errors,
          });
        } catch (err: any) {
          const message = String(err?.message ?? err);
          const code = err?.code ?? message.split(":")[0];
          const status =
            message === "tager_not_connected" ? 400
              : err?.tokenInvalid ? 401
              : message.startsWith("circuit_open") ? 503
              : code === "rate_limited" ? 429
              : 500;
          return Response.json(
            {
              success: false,
              code,
              error: message === "tager_not_connected" ? "لم يتم ربط منصة تاجر بعد" : message,
              token_expired: !!err?.tokenInvalid,
              execution_time: Date.now() - started,
              errors: [{ code, message }],
            },
            { status },
          );
        }
      },
    },
  },
});
