import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/reset")({
  server: {
    handlers: {
      POST: async () => {
        await supabaseAdmin.from("sr_snapshots").delete().gt("observed_at", "1970-01-01");
        await supabaseAdmin.from("sr_products").delete().gt("last_checked_at", "1970-01-01");
        return Response.json({ success: true });
      },
    },
  },
});
