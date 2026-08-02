import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import {
  cairoDateStr,
  cairoHourOf,
  deriveHourStatus,
  loadDaySnapshots,
  loadHourCoverage,
} from "@/lib/hourly-analytics.server";

export const Route = createFileRoute("/api/analytics/hourly-withdrawals")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // DashboardOverview passes startDate/endDate; HourlyAnalyticsPage passes date.
        const date =
          url.searchParams.get("date") || url.searchParams.get("startDate") || cairoDateStr();
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";

        const [{ snapshots, products }, coverage] = await Promise.all([
          loadDaySnapshots({ date, platform, category }),
          loadHourCoverage(date, platform),
        ]);

        const pieces = new Array(24).fill(0);
        const productSets: Set<string>[] = Array.from({ length: 24 }, () => new Set<string>());

        for (const s of snapshots) {
          const hour = cairoHourOf(new Date(s.observed_at));
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec > 0) {
            pieces[hour] += dec;
            productSets[hour].add(s.external_product_id);
          }
        }

        const now = new Date();
        const todayStr = cairoDateStr(now);
        const currentHour = cairoHourOf(now);
        const catalogSize = products.length;

        const hours = Array.from({ length: 24 }, (_, hour) => {
          const isFuture = date > todayStr || (date === todayStr && hour > currentHour);
          const isCurrentHour = date === todayStr && hour === currentHour;
          const cov = coverage.get(hour);
          const status = deriveHourStatus({ hour, isFuture, isCurrentHour, coverage: cov });
          const expected = cov?.expected && cov.expected > 0 ? cov.expected : catalogSize;
          const successful = cov ? Math.min(cov.successful, expected) : isFuture ? expected : 0;
          return {
            hour,
            totalWithdrawals: pieces[hour],
            productsWithWithdrawals: productSets[hour].size,
            status,
            expectedProductCount: expected,
            successfulProductCount: status === "NOT_STARTED" ? expected : successful,
          };
        });

        return Response.json(
          { success: true, selectedDate: date, platform, category, hours },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
