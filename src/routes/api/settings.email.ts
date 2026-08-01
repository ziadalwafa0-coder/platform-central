import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/settings/email")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      GET: async () =>
        Response.json({ success: true, enabled: false, host: "", port: 587, user: "", from: "", to: "" }),
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        return Response.json({ success: true, ...body });
      },
    },
  },
});
