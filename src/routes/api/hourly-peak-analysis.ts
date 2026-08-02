import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoDateHourUtcMs } from "@/lib/cairo-time";
import {
  arabicHourLabel,
  cairoDateStr,
  cairoHourOf,
  loadDaySnapshots,
  loadRangeSnapshots,
} from "@/lib/hourly-analytics.server";

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/hourly-peak-analysis")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";

        // Today (selected date)
        const { snapshots: today } = await loadDaySnapshots({ date, platform, category });
        const todayHours = new Array(24).fill(0);
        for (const s of today) {
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec > 0) todayHours[cairoHourOf(new Date(s.observed_at))] += dec;
        }
        let peakHour = -1;
        let peakValue = 0;
        todayHours.forEach((v, h) => {
          if (v > peakValue) {
            peakValue = v;
            peakHour = h;
          }
        });

        // Trailing 7 days ending on the selected date (inclusive)
        const startDate = addDays(date, -6);
        const startIso = new Date(cairoDateHourUtcMs(startDate, 0)).toISOString();
        const endIso = new Date(cairoDateHourUtcMs(date, 24)).toISOString();
        const range = await loadRangeSnapshots({ startIso, endIso, platform, onlyDecreases: true });

        const perDayHour = new Map<string, number[]>();
        for (const s of range) {
          const at = new Date(s.observed_at);
          const day = cairoDateStr(at);
          const arr = perDayHour.get(day) ?? new Array(24).fill(0);
          arr[cairoHourOf(at)] += Number(s.quantity_decrease ?? 0);
          perDayHour.set(day, arr);
        }

        const dayCount = Math.max(1, perDayHour.size);
        const hourTotals = new Array(24).fill(0);
        const peakCounts = new Array(24).fill(0);
        for (const arr of perDayHour.values()) {
          let dPeak = -1;
          let dPeakVal = 0;
          arr.forEach((v, h) => {
            hourTotals[h] += v;
            if (v > dPeakVal) {
              dPeakVal = v;
              dPeak = h;
            }
          });
          if (dPeak >= 0) peakCounts[dPeak] += 1;
        }

        let bestAvgHour = -1;
        let bestAvgVal = 0;
        hourTotals.forEach((total, h) => {
          const avg = total / dayCount;
          if (avg > bestAvgVal) {
            bestAvgVal = avg;
            bestAvgHour = h;
          }
        });

        let repeatedHour = -1;
        let repeatedDays = 0;
        peakCounts.forEach((c, h) => {
          if (c > repeatedDays) {
            repeatedDays = c;
            repeatedHour = h;
          }
        });

        return Response.json(
          {
            success: true,
            selectedDate: date,
            peakHourToday: peakHour >= 0 ? arabicHourLabel(peakHour) : null,
            peakHourTodayValue: peakValue,
            highestAvgHour7Days: bestAvgHour >= 0 ? arabicHourLabel(bestAvgHour) : null,
            highestAvgHour7DaysValue: Math.round(bestAvgVal),
            mostRepeatedPeakHour: repeatedHour >= 0 ? arabicHourLabel(repeatedHour) : null,
            mostRepeatedPeakHourDays: repeatedDays,
            daysAnalyzed: perDayHour.size,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
