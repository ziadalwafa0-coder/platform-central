import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { buildSummary, loadMatches } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/products/$productId/summary")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) =>
        Response.json(buildSummary(await loadMatches(params.productId)), {
          headers: { "Cache-Control": "no-store" },
        }),
    },
  },
});
