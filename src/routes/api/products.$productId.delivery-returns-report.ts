import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import {
  ALGORITHM,
  cairoWindow,
  classifyProduct,
  loadWindowSnapshots,
  scoreDataQuality,
} from "@/lib/deliveryReturns.server";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export const Route = createFileRoute("/api/products/$productId/delivery-returns-report")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const d = defaultRange();
        const weekStart = url.searchParams.get("weekStart") || d.start;
        const weekEnd = url.searchParams.get("weekEnd") || d.end;

        if (weekStart > weekEnd) {
          return Response.json(
            { success: false, error: "تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // productId may be the internal uuid or the platform's external id.
        const { data: product } = await supabaseAdmin
          .from("sr_products")
          .select("id, external_product_id, name, sku, image_url, product_url, platform, category, current_quantity")
          .or(`id.eq.${params.productId},external_product_id.eq.${params.productId}`)
          .maybeSingle();

        if (!product) {
          return Response.json({ success: false, error: "المنتج غير موجود." }, { status: 404 });
        }

        const { startIso, endIso } = cairoWindow(weekStart, weekEnd);
        const snaps = await loadWindowSnapshots(
          supabaseAdmin as any,
          startIso,
          endIso,
          product.external_product_id,
        );

        const c = classifyProduct(snaps);

        return Response.json(
          {
            success: true,
            report: {
              productId: product.id,
              externalProductId: product.external_product_id,
              productName: product.name,
              sku: product.sku ?? "",
              imageUrl: product.image_url ?? "",
              currentQuantity: product.current_quantity ?? null,
              weekStart,
              weekEnd,
              snapshotsAnalyzed: snaps.length,
              totals: c.totals,
              perBatchTotals: c.perBatchTotals,
              days: c.days,
              movements: c.movements,
              dataQuality: scoreDataQuality(c),
              algorithm: ALGORITHM,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
