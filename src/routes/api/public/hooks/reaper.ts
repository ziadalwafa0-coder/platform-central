// Reaper: mark stuck syncs failed + retry a bounded slice of DLQ items.
// Called by pg_cron every few minutes. Public route; validates apikey header.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/reaper")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const providedKey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!anon || providedKey !== anon) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Reap stuck runs
        let reaped = 0;
        try {
          const { data } = await supabaseAdmin.rpc("reap_stuck_sync_runs", { _older_than_minutes: 10 });
          reaped = (data as unknown as number) ?? 0;
        } catch { /* non-fatal */ }

        // 2) Retry a bounded slice of DLQ (products first)
        let retried = 0, resolved = 0, stillFailing = 0;
        try {
          const { data: items } = await supabaseAdmin
            .from("sr_dead_letter").select("id, kind, payload, attempts")
            .is("resolved_at", null).lt("attempts", 5)
            .order("created_at", { ascending: true }).limit(50);

          for (const item of items ?? []) {
            retried++;
            const now = new Date().toISOString();
            try {
              if (item.kind === "product_upsert") {
                const { error } = await supabaseAdmin
                  .from("sr_products").upsert(item.payload as any, { onConflict: "external_product_id" });
                if (error) throw error;
              } else if (item.kind === "snapshot_insert") {
                const { error } = await supabaseAdmin.from("sr_snapshots").insert(item.payload as any);
                if (error) throw error;
              }
              await supabaseAdmin.from("sr_dead_letter").update({
                resolved_at: now, attempts: (item.attempts ?? 0) + 1, last_attempt_at: now,
              }).eq("id", item.id);
              resolved++;
            } catch (err: any) {
              stillFailing++;
              await supabaseAdmin.from("sr_dead_letter").update({
                attempts: (item.attempts ?? 0) + 1,
                last_attempt_at: now,
                error_message: String(err?.message ?? err).slice(0, 1000),
              }).eq("id", item.id);
            }
          }
        } catch { /* non-fatal */ }

        // 3) Clean expired idempotency keys
        try {
          await supabaseAdmin.from("sr_idempotency_keys").delete().lt("expires_at", new Date().toISOString());
        } catch { /* non-fatal */ }

        return Response.json({
          ok: true, reaped, dlq: { retried, resolved, stillFailing },
          at: new Date().toISOString(),
        });
      },
    },
  },
});
