import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/analytics/revision")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async () => {
        try {
          const { data } = await supabaseAdmin
            .from("sr_products")
            .select("last_checked_at")
            .order("last_checked_at", { ascending: false })
            .limit(1);
          const rev = data?.[0]?.last_checked_at ?? new Date().toISOString();
          return Response.json({ success: true, revision: String(rev) });
        } catch {
          return Response.json({ success: true, revision: String(Date.now()) });
        }
      },
    },
  },
});
