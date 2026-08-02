import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateStr, cairoHourOf, loadDaySnapshots } from "@/lib/hourly-analytics.server";

export const Route = createFileRoute("/api/analytics/hourly-withdrawals/$hour/products")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";
        const revision = url.searchParams.get("revision") || null;
        const hour = Number(params.hour);

        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
          return Response.json({ success: false, error: "hour must be 0-23" }, { status: 400 });
        }

        const { snapshots, byExternalId } = await loadDaySnapshots({ date, platform, category });

        type Agg = {
          decrease: number;
          restock: number;
          firstPrev: number | null;
          lastCurr: number | null;
          firstAt: string;
          lastAt: string;
        };
        const agg = new Map<string, Agg>();

        for (const s of snapshots) {
          const at = new Date(s.observed_at);
          if (cairoHourOf(at) !== hour) continue;
          const cur = agg.get(s.external_product_id);
          const dec = Number(s.quantity_decrease ?? 0);
          const res = Number(s.restock_amount ?? 0);
          if (!cur) {
            agg.set(s.external_product_id, {
              decrease: dec,
              restock: res,
              firstPrev: s.previous_quantity,
              lastCurr: s.current_quantity,
              firstAt: s.observed_at,
              lastAt: s.observed_at,
            });
            continue;
          }
          cur.decrease += dec;
          cur.restock += res;
          if (s.observed_at < cur.firstAt) {
            cur.firstAt = s.observed_at;
            cur.firstPrev = s.previous_quantity;
          }
          if (s.observed_at >= cur.lastAt) {
            cur.lastAt = s.observed_at;
            cur.lastCurr = s.current_quantity;
          }
        }

        const products = Array.from(agg.entries())
          .map(([externalId, a]) => {
            const p = byExternalId.get(externalId);
            return {
              product_id: p?.id ?? externalId,
              external_product_id: externalId,
              product_name: p?.name ?? externalId,
              name: p?.name ?? externalId,
              sku: p?.sku ?? "",
              image_url: p?.image_url ?? "",
              product_url: p?.product_url ?? "",
              platform: p?.platform ?? "safka",
              category: p?.category ?? "",
              price: p?.price ?? null,
              currency: p?.currency ?? "EGP",
              previous_quantity: a.firstPrev,
              current_quantity: a.lastCurr ?? p?.current_quantity ?? 0,
              quantity_decrease: a.decrease,
              restock_amount: a.restock,
              last_observed_at: a.lastAt,
            };
          })
          .sort((x, y) => y.quantity_decrease - x.quantity_decrease);

        return Response.json(
          { success: true, selectedDate: date, hour, revision, products },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
