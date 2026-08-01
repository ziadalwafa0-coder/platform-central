import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/reset")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json().catch(() => ({} as any));
        if (body?.confirm !== "RESET") {
          return Response.json(
            {
              success: false,
              error: 'This permanently deletes all data. Send { "confirm": "RESET" } to proceed.',
            },
            { status: 400 },
          );
        }
        console.warn(`[reset] full data wipe requested by user ${(context as any)?.userId ?? "unknown"}`);
        await supabaseAdmin.from("sr_snapshots").delete().gt("observed_at", "1970-01-01");
        await supabaseAdmin.from("sr_products").delete().gt("last_checked_at", "1970-01-01");
        return Response.json({ success: true });
      },

    },
  },
});
