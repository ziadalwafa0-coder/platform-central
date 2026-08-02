import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateStr, cairoHourOf, loadDaySnapshots } from "@/lib/hourly-analytics.server";

/** Longest run of back-to-back hours in a sorted, de-duplicated hour list. */
function longestConsecutive(hours: number[]): number {
  const sorted = [...hours].sort((a, b) => a - b);
  let best = sorted.length ? 1 : 0;
  let run = best;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export const Route = createFileRoute("/api/multi-hour-leaders")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";

        const { snapshots, byExternalId } = await loadDaySnapshots({ date, platform, category });

        const perProduct = new Map<string, { decrease: number; hours: Set<number> }>();
        for (const s of snapshots) {
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec <= 0) continue;
          const cur = perProduct.get(s.external_product_id) ?? { decrease: 0, hours: new Set<number>() };
          cur.decrease += dec;
          cur.hours.add(cairoHourOf(new Date(s.observed_at)));
          perProduct.set(s.external_product_id, cur);
        }

        const data = Array.from(perProduct.entries())
          .map(([externalId, agg]) => {
            const p = byExternalId.get(externalId);
            const hours = Array.from(agg.hours);
            return {
              id: p?.id ?? externalId,
              external_product_id: externalId,
              name: p?.name ?? externalId,
              sku: p?.sku ?? "",
              imageUrl: p?.image_url ?? "",
              hoursCount: hours.length,
              consecutiveHours: longestConsecutive(hours),
              totalDecrease: agg.decrease,
            };
          })
          .filter((x) => x.hoursCount >= 2)
          .sort(
            (a, b) =>
              b.consecutiveHours - a.consecutiveHours ||
              b.hoursCount - a.hoursCount ||
              b.totalDecrease - a.totalDecrease,
          )
          .slice(0, 30);

        return Response.json(
          { success: true, selectedDate: date, platform, category, data },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
