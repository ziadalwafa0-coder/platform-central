import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateStr, cairoHourOf, loadDaySnapshots } from "@/lib/hourly-analytics.server";

function riskLabel(hoursLeft: number): string {
  if (hoursLeft <= 6) return "خطر حرج";
  if (hoursLeft <= 24) return "خطر مرتفع";
  return "خطر متوسط";
}

export const Route = createFileRoute("/api/stockout-risk")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";

        const { snapshots, byExternalId } = await loadDaySnapshots({ date, platform, category });

        const decreaseByProduct = new Map<string, number>();
        const hoursByProduct = new Map<string, Set<number>>();
        for (const s of snapshots) {
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec <= 0) continue;
          decreaseByProduct.set(
            s.external_product_id,
            (decreaseByProduct.get(s.external_product_id) ?? 0) + dec,
          );
          const set = hoursByProduct.get(s.external_product_id) ?? new Set<number>();
          set.add(cairoHourOf(new Date(s.observed_at)));
          hoursByProduct.set(s.external_product_id, set);
        }

        const now = new Date();
        const isToday = date === cairoDateStr(now);
        const elapsedHours = isToday ? Math.max(1, cairoHourOf(now) + 1) : 24;

        const data = Array.from(decreaseByProduct.entries())
          .map(([externalId, totalDecrease]) => {
            const p = byExternalId.get(externalId);
            const qty = Number(p?.current_quantity ?? 0);
            const ratePerHour = totalDecrease / elapsedHours;
            if (ratePerHour <= 0) return null;
            const hoursLeft = Math.max(0, Math.floor(qty / ratePerHour));
            if (hoursLeft > 72) return null;
            return {
              id: p?.id ?? externalId,
              external_product_id: externalId,
              name: p?.name ?? externalId,
              sku: p?.sku ?? "",
              imageUrl: p?.image_url ?? "",
              currentQuantity: qty,
              totalDecreaseToday: totalDecrease,
              withdrawalHours: hoursByProduct.get(externalId)?.size ?? 0,
              ratePerHour: Math.round(ratePerHour * 10) / 10,
              estimatedHoursLeft: hoursLeft,
              riskLevel: riskLabel(hoursLeft),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => a.estimatedHoursLeft - b.estimatedHoursLeft)
          .slice(0, 50);

        return Response.json(
          { success: true, selectedDate: date, platform, category, data },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
