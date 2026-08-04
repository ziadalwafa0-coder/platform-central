import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";
import {
  readMirrorConfig,
  testMirrorConnection,
  writeMirrorConfig,
  validateMirrorInput,
} from "@/lib/mirrorSupabase.server";

async function saveConfig(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(body.url ?? "").trim();
  const secretKey = String(body.secretKey ?? "").trim();
  const enabled = body.enabled === true;

  // Clearing the config (disable + empty fields) is always allowed.
  if (!url && !secretKey) {
    await writeMirrorConfig({ url: "", secretKey: "", enabled: false, lastTestedAt: null, lastTestOk: null });
    return Response.json({ success: true, cleared: true, enabled: false });
  }

  const invalid = validateMirrorInput(url, secretKey);
  if (invalid) return Response.json({ success: false, error: invalid }, { status: 400 });

  // Never persist a target we cannot actually reach.
  const test = await testMirrorConnection(url, secretKey);
  if (!test.ok) {
    return Response.json({ success: false, error: `فشل الاتصال بالمشروع الجديد: ${test.error}` }, { status: 400 });
  }

  const saved = await writeMirrorConfig({
    url,
    secretKey,
    enabled,
    lastTestedAt: new Date().toISOString(),
    lastTestOk: true,
  });
  if (!saved.ok) return Response.json({ success: false, error: saved.error }, { status: 500 });

  return Response.json({
    success: true,
    enabled,
    url,
    tables: test.tables,
    message: "تم التحقق من الاتصال وحفظ إعدادات المشروع الثاني بنجاح.",
  });
}

export const Route = createFileRoute("/api/settings/supabase")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      GET: async () => {
        const cfg = await readMirrorConfig();
        return Response.json(
          {
            success: true,
            configured: !!(cfg.url && cfg.secretKey),
            supabaseConfig: {
              url: cfg.url,
              secretKey: cfg.secretKey,
              enabled: cfg.enabled,
              lastTestedAt: cfg.lastTestedAt,
              lastTestOk: cfg.lastTestOk,
              updatedAt: cfg.updatedAt,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      PUT: async ({ request }) => saveConfig(request),
      POST: async ({ request }) => saveConfig(request),
    },
  },
});
