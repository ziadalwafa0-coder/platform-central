import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/reset")({
  server: {
    handlers: {
      POST: async () => {
        await supabaseAdmin.from("sr_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabaseAdmin.from("sr_products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        return Response.json({ success: true });
      },
    },
  },
});
