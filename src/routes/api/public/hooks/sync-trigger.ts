// Automatic Safka sync trigger. Called by pg_cron every 5 minutes; it reads the
// scheduler settings row and only starts a sync when the configured interval has
// elapsed. Public route (bypasses site auth) so it validates the apikey header.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-trigger")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const providedKey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!anon || providedKey !== anon) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("sr_settings")
          .select("value")
          .eq("key", "scheduler")
          .maybeSingle();

        const cfg = (row?.value ?? {}) as {
          enabled?: boolean;
          intervalMinutes?: number;
          lastAutoRunAt?: string | null;
        };
        const enabled = cfg.enabled !== false;
        const intervalMinutes = Math.min(1440, Math.max(5, Number(cfg.intervalMinutes ?? 20)));

        if (!enabled) {
          return Response.json({ ok: true, skipped: "disabled", at: new Date().toISOString() });
        }

        // Prefer the real last run time from sr_sync_runs so a redeploy or a manual
        // sync also counts toward the interval.
        const { data: lastRun } = await supabaseAdmin
          .from("sr_sync_runs")
          .select("started_at, status")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastAt = lastRun?.started_at ?? cfg.lastAutoRunAt ?? null;
        if (lastAt) {
          const elapsedMin = (Date.now() - new Date(lastAt).getTime()) / 60_000;
          if (elapsedMin < intervalMinutes) {
            return Response.json({
              ok: true,
              skipped: "interval_not_elapsed",
              elapsedMinutes: Math.round(elapsedMin),
              intervalMinutes,
              at: new Date().toISOString(),
            });
          }
        }

        try {
          const { createSyncRun, syncSafkaIntoDb } = await import("@/lib/safkaSync.server");
          let runId: string;
          try {
            runId = await createSyncRun({ manualOrAuto: "auto" });
          } catch (lockErr: any) {
            if (String(lockErr?.message ?? "").startsWith("sync_locked")) {
              return Response.json({ ok: true, skipped: "sync_locked", at: new Date().toISOString() });
            }
            throw lockErr;
          }

          const result = await syncSafkaIntoDb({ runId, manualOrAuto: "auto" });

          await supabaseAdmin
            .from("sr_settings")
            .update({
              value: { ...cfg, enabled, intervalMinutes, lastAutoRunAt: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            })
            .eq("key", "scheduler");

          return Response.json({ ok: true, triggered: true, runId, result, at: new Date().toISOString() });
        } catch (err: any) {
          const msg = String(err?.message ?? err);
          console.error("[sync-trigger] failed:", msg);
          return Response.json(
            { ok: false, error: msg, at: new Date().toISOString() },
            { status: msg.startsWith("circuit_open") ? 503 : 500 },
          );
        }
      },
    },
  },
});
