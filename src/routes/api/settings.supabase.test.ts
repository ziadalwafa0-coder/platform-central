import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/settings/supabase/test")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { error } = await supabaseAdmin.from("sr_products").select("id", { head: true, count: "exact" });
          if (error) throw error;
          return Response.json({ success: true, message: "الاتصال ناجح" });
        } catch (e: any) {
          return Response.json({ success: false, error: e?.message ?? "فشل الاتصال" }, { status: 500 });
        }
      },
    },
  },
});
