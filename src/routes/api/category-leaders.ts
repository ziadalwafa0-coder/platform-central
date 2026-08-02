import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateStr, cairoHourOf, loadDaySnapshots } from "@/lib/hourly-analytics.server";

function riskLabel(hoursLeft: number): string {
  if (hoursLeft <= 6) return "خطر حرج";
  if (hoursLeft <= 24) return "خطر مرتفع";
  return "خطر منخفض";
}

/** Confidence reflects how many distinct hours contributed to the trend. */
function confidenceLabel(hoursObserved: number): string {
  if (hoursObserved >= 6) return "مرتفع";
  if (hoursObserved >= 3) return "متوسط";
  return "منخفض";
}

export const Route = createFileRoute("/api/category-leaders")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";

        const { snapshots, byExternalId } = await loadDaySnapshots({ date, platform });

        type Agg = { decrease: number; hours: Set<number> };
        const perProduct = new Map<string, Agg>();
        for (const s of snapshots) {
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec <= 0) continue;
          const cur = perProduct.get(s.external_product_id) ?? { decrease: 0, hours: new Set<number>() };
          cur.decrease += dec;
          cur.hours.add(cairoHourOf(new Date(s.observed_at)));
          perProduct.set(s.external_product_id, cur);
        }

        const now = new Date();
        const elapsedHours = date === cairoDateStr(now) ? Math.max(1, cairoHourOf(now) + 1) : 24;

        // Best product per category
        const perCategory = new Map<
          string,
          { name: string; decrease: number; hours: number; qty: number }
        >();
        for (const [externalId, agg] of perProduct) {
          const p = byExternalId.get(externalId);
          const categoryName = (p?.category || "غير مصنف").trim() || "غير مصنف";
          const candidate = {
            name: p?.name ?? externalId,
            decrease: agg.decrease,
            hours: agg.hours.size,
            qty: Number(p?.current_quantity ?? 0),
          };
          const existing = perCategory.get(categoryName);
          if (!existing || candidate.decrease > existing.decrease) perCategory.set(categoryName, candidate);
        }

        const data = Array.from(perCategory.entries())
          .map(([categoryName, top]) => {
            const rate = top.decrease / elapsedHours;
            const hoursLeft = rate > 0 ? Math.floor(top.qty / rate) : Number.POSITIVE_INFINITY;
            return {
              categoryName,
              topProduct: { name: top.name, decrease: top.decrease },
              risk: riskLabel(hoursLeft),
              confidence: confidenceLabel(top.hours),
              estimatedHoursLeft: Number.isFinite(hoursLeft) ? hoursLeft : null,
            };
          })
          .sort((a, b) => b.topProduct.decrease - a.topProduct.decrease);

        return Response.json(
          { success: true, selectedDate: date, platform, data },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
