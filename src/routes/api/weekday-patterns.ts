import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateHourUtcMs } from "@/lib/cairo-time";
import {
  arabicHourLabel,
  cairoDateStr,
  cairoHourOf,
  loadProducts,
  loadRangeSnapshots,
} from "@/lib/hourly-analytics.server";

const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const LOOKBACK_DAYS = 28;

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export const Route = createFileRoute("/api/weekday-patterns")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";
        const today = cairoDateStr();
        const startDate = addDays(today, -(LOOKBACK_DAYS - 1));

        const startIso = new Date(cairoDateHourUtcMs(startDate, 0)).toISOString();
        const endIso = new Date(cairoDateHourUtcMs(today, 24)).toISOString();

        const [snapshots, products] = await Promise.all([
          loadRangeSnapshots({ startIso, endIso, platform, onlyDecreases: true }),
          loadProducts(platform, category),
        ]);
        const allowed =
          category && category !== "all"
            ? new Set(products.map((p) => p.external_product_id))
            : null;

        // day -> { hour totals, affected products }
        const perDay = new Map<string, { hours: number[]; products: Set<string> }>();
        for (const s of snapshots) {
          if (allowed && !allowed.has(s.external_product_id)) continue;
          const at = new Date(s.observed_at);
          const day = cairoDateStr(at);
          const bucket = perDay.get(day) ?? { hours: new Array(24).fill(0), products: new Set<string>() };
          bucket.hours[cairoHourOf(at)] += Number(s.quantity_decrease ?? 0);
          bucket.products.add(s.external_product_id);
          perDay.set(day, bucket);
        }

        // Count every calendar day in the window as a sample (zero-activity days
        // are real data, not missing data).
        const sampleDays = new Array(7).fill(0);
        for (let i = 0; i < LOOKBACK_DAYS; i++) {
          sampleDays[weekdayIndex(addDays(startDate, i))] += 1;
        }

        const totals = Array.from({ length: 7 }, () => ({
          decrease: 0,
          affected: 0,
          hours: new Array(24).fill(0),
        }));
        for (const [day, bucket] of perDay) {
          const wd = weekdayIndex(day);
          totals[wd].decrease += bucket.hours.reduce((a, b) => a + b, 0);
          totals[wd].affected += bucket.products.size;
          bucket.hours.forEach((v, h) => {
            totals[wd].hours[h] += v;
          });
        }

        const data = AR_DAYS.map((dayName, wd) => {
          const n = Math.max(1, sampleDays[wd]);
          const t = totals[wd];
          let peakHour = -1;
          let peakVal = 0;
          t.hours.forEach((v, h) => {
            if (v > peakVal) {
              peakVal = v;
              peakHour = h;
            }
          });
          return {
            dayName,
            averageDecrease: Math.round(t.decrease / n),
            averageAffectedProducts: Math.round(t.affected / n),
            mostActiveHour: peakHour >= 0 ? arabicHourLabel(peakHour) : "غير متوفر",
            sampleDays: sampleDays[wd],
            hourlyBreakdown: t.hours.map((v, hour) => ({
              hour,
              label: arabicHourLabel(hour),
              averageDecrease: Math.round((v / n) * 10) / 10,
              totalDecrease: v,
            })),
          };
        });

        return Response.json(
          { success: true, lookbackDays: LOOKBACK_DAYS, platform, category, data },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
