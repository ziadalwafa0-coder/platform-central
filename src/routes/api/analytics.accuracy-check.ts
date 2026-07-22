import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analytics/accuracy-check")({
  server: {
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
