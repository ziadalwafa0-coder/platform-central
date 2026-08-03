import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { mapMatch } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/matches/$matchId/reject")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      POST: async ({ params, context }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("sr_ads_spy_matches")
          .update({
            match_status: "REJECTED",
            user_decision: "REJECTED",
            reviewed_by_user: (context as any)?.userId ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.matchId)
          .select("*, ad:sr_ads_spy_ads(*), analysis:sr_ads_spy_analyses(*)")
          .maybeSingle();

        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        if (!data) return Response.json({ success: false, error: "المطابقة غير موجودة" }, { status: 404 });
        return Response.json(mapMatch(data));
      },
    },
  },
});
