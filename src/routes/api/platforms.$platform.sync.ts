import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/platforms/$platform/sync")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        if (params.platform !== "safka") {
          return Response.json(
            { success: false, error: `منصة غير مدعومة حالياً: ${params.platform}` },
            { status: 400 },
          );
        }

        let triggeredBy: string | null = null;
        try {
          const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
          if (auth) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin.auth.getUser(auth);
            triggeredBy = data.user?.id ?? null;
          }
        } catch { /* keep null */ }

        try {
          const { createSyncRun, syncSafkaIntoDb } = await import("@/lib/safkaSync.server");
          const runId = await createSyncRun({ triggeredBy, manualOrAuto: "manual" });
          const result = await syncSafkaIntoDb({ runId, triggeredBy, manualOrAuto: "manual" });
          return Response.json({ success: true, platform: "safka", ...result });
        } catch (err: any) {
          return Response.json(
            {
              success: false,
              platform: "safka",
              error: err?.message ?? "Unknown error",
              endpoint: "/api/platforms/safka/sync",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
