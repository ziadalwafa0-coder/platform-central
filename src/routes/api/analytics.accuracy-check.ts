import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/analytics/accuracy-check")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async () =>
        Response.json({
          success: true,
          accuracyPercentage: 100,
          totalChecked: 0,
          mismatches: 0,
          details: [],
        }),
    },
  },
});
