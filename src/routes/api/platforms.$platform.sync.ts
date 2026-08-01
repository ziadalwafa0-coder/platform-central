import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/platforms/$platform/sync")({
  server: {
    middleware: [requireApiAdmin],
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

        // Idempotency support (24h window): client can send `Idempotency-Key` header.
        const idemKey = request.headers.get("idempotency-key");
        const { idempotencyBegin, idempotencyComplete } = await import("@/lib/reliability.server");
        if (idemKey) {
          const { fresh, existing } = await idempotencyBegin(idemKey, "safka.sync");
          if (!fresh && existing) {
            return Response.json(
              { success: existing.status === "done", idempotent: true, replayed: true, ...(existing.result as object ?? {}) },
              { status: 200, headers: { "Idempotent-Replayed": "true" } },
            );
          }
        }

        try {
          const { createSyncRun, syncSafkaIntoDb } = await import("@/lib/safkaSync.server");
          let runId: string;
          try {
            runId = await createSyncRun({ triggeredBy, manualOrAuto: "manual" });
          } catch (lockErr: any) {
            if (String(lockErr?.message ?? "").startsWith("sync_locked")) {
              if (idemKey) await idempotencyComplete(idemKey, "failed", { error: lockErr.message });
              return Response.json(
                { success: false, code: "sync_locked", error: lockErr.message },
                { status: 409 },
              );
            }
            throw lockErr;
          }
          const result = await syncSafkaIntoDb({ runId, triggeredBy, manualOrAuto: "manual" });
          const payload = { success: true, platform: "safka", ...result };
          if (idemKey) await idempotencyComplete(idemKey, "done", payload, runId);
          return Response.json(payload);
        } catch (err: any) {
          const msg = String(err?.message ?? "Unknown error");
          if (idemKey) await idempotencyComplete(idemKey, "failed", { error: msg });
          const status = msg.startsWith("circuit_open") ? 503 : 500;
          return Response.json(
            {
              success: false,
              platform: "safka",
              code: msg.split(":")[0],
              error: msg,
              endpoint: "/api/platforms/safka/sync",
            },
            { status },
          );
        }
      },
    },
  },
});
