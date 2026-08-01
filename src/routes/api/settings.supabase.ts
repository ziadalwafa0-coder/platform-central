import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/settings/supabase")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      GET: async () => Response.json({ success: true, configured: true, url: "***", key: "***" }),
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        return Response.json({ success: true, ...body });
      },
    },
  },
});
