import { createFileRoute } from "@tanstack/react-router";

/**
 * Automatic Tager sync, called by the scheduler (pg_cron) every 5 minutes.
 * Public prefix, so the caller must present the backend anon key.
 */
export const Route = createFileRoute("/api/public/hooks/tager-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anonKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!anonKey || provided !== anonKey) {
          return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const started = Date.now();
        try {
          const { syncAllTagerConnections } = await import("@/lib/tagerSync.server");
          const result = await syncAllTagerConnections();
          return Response.json({ success: true, ...result, execution_time: Date.now() - started });
        } catch (err: any) {
          return Response.json(
            { success: false, error: String(err?.message ?? err), execution_time: Date.now() - started },
            { status: 500 },
          );
        }
      },
    },
  },
});
