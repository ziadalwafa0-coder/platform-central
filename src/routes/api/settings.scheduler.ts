import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/settings/scheduler")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ success: true, enabled: true, intervalMinutes: 20, timezone: "Africa/Cairo" }),
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        return Response.json({ success: true, ...body });
      },
    },
  },
});
