import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { loadMatches } from "@/lib/adsSpy.server";

export const Route = createFileRoute("/api/ads-spy/products/$productId/ads")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ params }) =>
        Response.json(await loadMatches(params.productId), { headers: { "Cache-Control": "no-store" } }),
    },
  },
});
