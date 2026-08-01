import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/diagnostics/error")({
  server: {
    middleware: [requireApiAuth],
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
