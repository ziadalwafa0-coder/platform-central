import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/diagnostics/error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          console.error("[client-error]", body);
        } catch {}
        return Response.json({ success: true });
      },
    },
  },
});
