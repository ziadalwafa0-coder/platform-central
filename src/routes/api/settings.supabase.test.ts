import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/settings/supabase/test")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const url = String(body.url ?? "").trim();
        const secretKey = String(body.secretKey ?? "").trim();

        const {
          validateMirrorInput,
          testMirrorConnection,
          readMirrorConfig,
        } = await import("@/lib/mirrorSupabase.server");

        // No credentials supplied → test the primary app database instead.
        if (!url && !secretKey) {
          const stored = await readMirrorConfig();
          if (!stored.url) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin
              .from("sr_products")
              .select("id", { head: true, count: "exact" });
            return error
              ? Response.json({ success: false, error: error.message }, { status: 500 })
              : Response.json({
                  success: true,
                  target: "primary",
                  message: "قاعدة البيانات الأساسية متصلة وتعمل بشكل سليم.",
                });
          }
          const t = await testMirrorConnection(stored.url, stored.secretKey);
          return t.ok
            ? Response.json({ success: true, target: "mirror", tables: t.tables, message: "الاتصال بالمشروع المحفوظ ناجح." })
            : Response.json({ success: false, error: t.error }, { status: 400 });
        }

        const invalid = validateMirrorInput(url, secretKey);
        if (invalid) return Response.json({ success: false, error: invalid }, { status: 400 });

        const t = await testMirrorConnection(url, secretKey);
        if (!t.ok) return Response.json({ success: false, error: t.error }, { status: 400 });

        return Response.json({
          success: true,
          target: "mirror",
          tables: t.tables,
          message: t.tables.length
            ? `تم الاتصال بنجاح. الجداول الموجودة: ${t.tables.join(", ")}`
            : "تم الاتصال بنجاح.",
          ...(t.tables.length === 0
            ? { warning: "الاتصال ناجح لكن جداول Stock Radaar غير موجودة في هذا المشروع بعد." }
            : {}),
        });
      },
    },
  },
});
