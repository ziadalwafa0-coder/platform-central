import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

const MIN_INTERVAL = 5;
const MAX_INTERVAL = 1440;

async function readSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sr_settings")
    .select("value, updated_at")
    .eq("key", "scheduler")
    .maybeSingle();
  const cfg = (data?.value ?? {}) as Record<string, unknown>;
  return {
    enabled: cfg.enabled !== false,
    intervalMinutes: Number(cfg.intervalMinutes ?? 20),
    timezone: "Africa/Cairo",
    lastAutoRunAt: (cfg.lastAutoRunAt as string | null) ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

export const Route = createFileRoute("/api/settings/scheduler")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      GET: async () => {
        const s = await readSettings();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: lastRun } = await supabaseAdmin
          .from("sr_sync_runs")
          .select("id, status, started_at, manual_or_auto")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextRunAt = lastRun?.started_at
          ? new Date(new Date(lastRun.started_at).getTime() + s.intervalMinutes * 60_000).toISOString()
          : null;

        return Response.json(
          { success: true, ...s, lastRun: lastRun ?? null, nextRunAt },
          { headers: { "Cache-Control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const current = await readSettings();

        const enabled = typeof body.enabled === "boolean" ? body.enabled : current.enabled;
        const rawInterval = body.intervalMinutes ?? current.intervalMinutes;
        const interval = Number(rawInterval);

        if (!Number.isFinite(interval) || !Number.isInteger(interval)) {
          return Response.json(
            { success: false, error: "intervalMinutes يجب أن يكون رقماً صحيحاً بالدقائق." },
            { status: 400 },
          );
        }
        if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
          return Response.json(
            {
              success: false,
              error: `intervalMinutes يجب أن يكون بين ${MIN_INTERVAL} و ${MAX_INTERVAL} دقيقة.`,
            },
            { status: 400 },
          );
        }

        const value = {
          enabled,
          intervalMinutes: interval,
          timezone: "Africa/Cairo",
          lastAutoRunAt: current.lastAutoRunAt,
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("sr_settings")
          .upsert({ key: "scheduler", value, updated_at: new Date().toISOString() }, { onConflict: "key" });

        if (error) {
          return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, ...value });
      },
    },
  },
});
