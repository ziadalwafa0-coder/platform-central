import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/platforms/$platform/sync")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (params.platform !== "safka") {
          return Response.json(
            { success: false, error: `منصة غير مدعومة حالياً: ${params.platform}` },
            { status: 400 },
          );
        }

        try {
          const { fetchSafkaProducts } = await import("@/lib/safka.server");
          const { products, pagesFetched, durationMs } =
            await fetchSafkaProducts();

          return Response.json({
            success: true,
            platform: "safka",
            productsFetched: products.length,
            pagesFetched,
            durationMs,
            fetchedAt: new Date().toISOString(),
            sample: products.slice(0, 5).map((p) => ({
              externalProductId: p.externalProductId,
              name: p.name,
              sku: p.sku,
              price: p.price,
              currentQuantity: p.currentQuantity,
              originalCategory: p.originalCategory,
            })),
          });
        } catch (err: any) {
          console.error("[safka sync] failed:", err);
          return Response.json(
            {
              success: false,
              platform: "safka",
              error: err?.message ?? "Unknown error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
