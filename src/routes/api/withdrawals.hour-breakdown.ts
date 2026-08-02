import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import {
  arabicIntervalLabel,
  cairoDateStr,
  cairoHourOf,
  cairoMinuteOf,
  deriveDataStatus,
  deriveHourStatus,
  loadDaySnapshots,
  loadHourCoverage,
} from "@/lib/hourly-analytics.server";

export const Route = createFileRoute("/api/withdrawals/hour-breakdown")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || cairoDateStr();
        const hour = Number(url.searchParams.get("hour") ?? "0");
        const platform = url.searchParams.get("platform") || "all";
        const category = url.searchParams.get("category") || "all";
        const revision = url.searchParams.get("revision") || null;

        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
          return Response.json({ success: false, error: "hour must be 0-23" }, { status: 400 });
        }

        const [{ snapshots, products }, coverage] = await Promise.all([
          loadDaySnapshots({ date, platform, category }),
          loadHourCoverage(date, platform),
        ]);

        const slots = [0, 1, 2].map(() => ({
          pieces: 0,
          events: 0,
          products: new Set<string>(),
        }));

        for (const s of snapshots) {
          const at = new Date(s.observed_at);
          if (cairoHourOf(at) !== hour) continue;
          const dec = Number(s.quantity_decrease ?? 0);
          if (dec <= 0) continue;
          const slot = Math.min(2, Math.floor(cairoMinuteOf(at) / 20));
          slots[slot].pieces += dec;
          slots[slot].events += 1;
          slots[slot].products.add(s.external_product_id);
        }

        const now = new Date();
        const todayStr = cairoDateStr(now);
        const currentHour = cairoHourOf(now);
        const currentSlot = Math.floor(cairoMinuteOf(now) / 20);
        const cov = coverage.get(hour);
        const catalogSize = products.length;
        const expected = cov?.expected && cov.expected > 0 ? cov.expected : catalogSize;

        const intervals = slots.map((agg, slot) => {
          const isFuture =
            date > todayStr ||
            (date === todayStr && (hour > currentHour || (hour === currentHour && slot > currentSlot)));
          const isCurrent = date === todayStr && hour === currentHour && slot === currentSlot;
          const status = deriveHourStatus({ hour, isFuture, isCurrentHour: isCurrent, coverage: cov });
          const completeness =
            status === "NOT_STARTED" || expected === 0
              ? 100
              : Math.min(100, Math.round(((cov?.successful ?? 0) / expected) * 100));
          return {
            slot,
            intervalLabel: arabicIntervalLabel(hour, slot),
            withdrawnPieces: agg.pieces,
            withdrawalEvents: agg.events,
            affectedProducts: agg.products.size,
            dataStatus: deriveDataStatus({ status, pieces: agg.pieces }),
            dataCompletenessPercentage: completeness,
          };
        });

        const affected = new Set<string>();
        slots.forEach((s) => s.products.forEach((id) => affected.add(id)));

        return Response.json(
          {
            success: true,
            selectedDate: date,
            hour,
            revision,
            summary: {
              withdrawn_pieces: slots.reduce((a, s) => a + s.pieces, 0),
              withdrawal_events: slots.reduce((a, s) => a + s.events, 0),
              affected_products: affected.size,
            },
            intervals,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
