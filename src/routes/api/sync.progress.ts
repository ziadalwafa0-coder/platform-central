import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync/progress")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          success: true,
          syncing: false,
          processedCount: 0,
          totalProducts: 0,
          statusText: "",
          percentage: 0,
        }),
    },
  },
});
