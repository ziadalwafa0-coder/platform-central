import { createServerFn } from "@tanstack/react-start";

export interface SafkaSyncSummary {
  success: boolean;
  productsFetched: number;
  pagesFetched: number;
  durationMs: number;
  sample: Array<{
    externalProductId: string;
    name: string;
    sku: string;
    price: number | null;
    currentQuantity: number | null;
    originalCategory: string;
    imageUrl: string;
  }>;
  fetchedAt: string;
}

export const syncSafkaProducts = createServerFn({ method: "POST" }).handler(
  async (): Promise<SafkaSyncSummary> => {
    const { fetchSafkaProducts } = await import("./safka.server");
    const { products, pagesFetched, durationMs } = await fetchSafkaProducts();

    return {
      success: true,
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
        imageUrl: p.imageUrl,
      })),
    };
  },
);
