import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

/**
 * Tager connection management.
 * GET    → connection status (never returns the token)
 * POST   → save + validate an API token (stored encrypted)
 * DELETE → remove the connection and all its data
 */
export const Route = createFileRoute("/api/integrations/tager/connection")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ context }) => {
        const { userId } = context as { userId: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("tager_connections")
          .select("id, status, last_sync, last_error, created_at, updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        return Response.json({
          success: true,
          connected: !!data && data.status === "connected",
          connection: data ?? null,
        });
      },

      POST: async ({ request, context }) => {
        const { userId } = context as { userId: string };
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const token = typeof body?.token === "string" ? body.token.trim() : "";
        if (token.length < 8 || token.length > 4096) {
          return Response.json({ success: false, error: "API Token غير صالح" }, { status: 400 });
        }

        const { validateTagerToken } = await import("@/lib/tager.server");
        const check = await validateTagerToken(token);
        if (!check.valid) {
          return Response.json(
            { success: false, code: check.code, error: `فشل التحقق من التوكن: ${check.message}` },
            { status: check.code === "unauthorized" || check.code === "forbidden" ? 401 : 502 },
          );
        }

        const { encryptToken, tokenHint } = await import("@/lib/tokenCrypto.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("tager_connections")
          .upsert(
            {
              user_id: userId,
              encrypted_token: encryptToken(token),
              status: "connected",
              last_error: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
          .select("id, status, last_sync, last_error")
          .maybeSingle();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

        return Response.json({
          success: true,
          connection: data,
          tokenHint: tokenHint(token),
        });
      },

      DELETE: async ({ context }) => {
        const { userId } = context as { userId: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("tager_connections").delete().eq("user_id", userId);
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        return Response.json({ success: true, disconnected: true });
      },
    },
  },
});
