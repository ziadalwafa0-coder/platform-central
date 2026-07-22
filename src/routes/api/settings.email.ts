import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/settings/email")({
  server: {
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
