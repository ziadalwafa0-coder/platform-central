/**
 * Delivery / returns classification — SINGLE shared methodology.
 *
 * Both `/api/delivery-returns-audit` and
 * `/api/products/:productId/delivery-returns-report` use this module, so the two
 * screens can never drift into two silently-different definitions of the same
 * metric again.
 *
 * Data model note: the current `sr_snapshots` schema has no boolean
 * "isRestockMarker" flag (that was the pre-migration model). It has integer
 * `quantity_decrease` and `restock_amount` columns, so classification is derived
 * from the amounts themselves:
 *
 *   - quantity_decrease > 0            -> WITHDRAWAL, adds to the pending balance
 *   - restock_amount > 0, pending > 0  -> the part covered by the pending balance
 *                                         is an ESTIMATED_RETURN; any excess above
 *                                         the pending balance is a CONFIRMED_RESTOCK
 *                                         (more stock came back than ever left)
 *   - restock_amount > 0, pending == 0 -> UNCLASSIFIED_INCREASE
 *
 * Two aggregation modes are produced from the same classification pass because
 * the UI shows both side by side:
 *   - cross-restock (`totals`)      : a confirmed restock does NOT clear the pending
 *                                     balance, so later returns still match.
 *   - per-batch (`perBatchTotals`)  : a confirmed restock clears the pending balance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "./fetchAllRows.server";
import { cairoDateHourUtcMs } from "./cairo-time";
import { cairoDateStr } from "./hourly-analytics.server";
import { DEFAULT_RETURN_WINDOW_DAYS, DEFAULT_RETURN_WINDOW_MS } from "./deliveryReturns";

export { DEFAULT_RETURN_WINDOW_DAYS, DEFAULT_RETURN_WINDOW_MS };


export const ALGORITHM = {
  name: "Stock-cycle balance verification (cross-restock + per-batch)",
  version: "2.0",
  limitations: [
    "المرتجعات تقديرية: لا يوفر مصدر البيانات تصنيفاً صريحاً لكل زيادة مخزون، والتصنيف مستنتج من حركة الكميات فقط.",
    "أي زيادة تتجاوز رصيد السحب المعلق تُعتبر توريداً مؤكداً وليست مرتجعاً.",
    "الزيادات التي تحدث بدون رصيد سحب معلق تُصنَّف كزيادة غير مصنفة ولا تدخل في نسب التسليم.",
    "دقة النتائج تعتمد على انتظام المزامنة: أي فترة لم تُجرَ فيها مزامنة تعني حركات غير مرصودة نهائياً.",
    "الحركات الأصغر من دورة مزامنة واحدة (سحب ثم إرجاع بين قراءتين) لا يمكن رصدها.",
  ],
} as const;

export type MovementClass =
  | "WITHDRAWAL"
  | "ESTIMATED_RETURN"
  | "CONFIRMED_RESTOCK"
  | "UNCLASSIFIED_INCREASE";

export interface Movement {
  checkedAt: string;
  quantityChange: number;
  classifiedAs: MovementClass;
  reason: string;
  currentQuantity: number | null;
  pendingWithdrawalBalanceAfter: number;
  cycleId: number;
}

export interface ModeTotals {
  weeklyWithdrawals: number;
  estimatedReturns: number;
  confirmedRestock: number;
  unclassifiedIncreases: number;
  netDelivered: number;
  deliveryRate: number | null;
  returnRate: number | null;
  pendingWithdrawalBalanceEnd: number;
}

export interface DayTotals extends ModeTotals {
  date: string;
  withdrawals: number;
}

export interface SnapshotRow {
  external_product_id: string;
  previous_quantity: number | null;
  current_quantity: number | null;
  quantity_decrease: number | null;
  restock_amount: number | null;
  observed_at: string;
}

function rates(t: Omit<ModeTotals, "netDelivered" | "deliveryRate" | "returnRate">): ModeTotals {
  const netDelivered = Math.max(t.weeklyWithdrawals - t.estimatedReturns, 0);
  const deliveryRate = t.weeklyWithdrawals > 0 ? (netDelivered / t.weeklyWithdrawals) * 100 : null;
  const returnRate = t.weeklyWithdrawals > 0 ? (t.estimatedReturns / t.weeklyWithdrawals) * 100 : null;
  return { ...t, netDelivered, deliveryRate, returnRate };
}

interface ProductClassification {
  movements: Movement[];
  totals: ModeTotals;
  perBatchTotals: ModeTotals;
  days: DayTotals[];
  snapshotCount: number;
}

/** Classify one product's ordered snapshots. */
export function classifyProduct(snaps: SnapshotRow[]): ProductClassification {
  const ordered = [...snaps].sort((a, b) => a.observed_at.localeCompare(b.observed_at));

  const movements: Movement[] = [];
  const perDay = new Map<
    string,
    { withdrawals: number; returns: number; restock: number; unclassified: number }
  >();

  const pendingQueue: { amount: number; observedAt: number }[] = [];
  const pendingSum = () => pendingQueue.reduce((a, q) => a + q.amount, 0);
  let pending = 0; // cross-restock pending balance (windowed FIFO)

  let pendingBatch = 0; // per-batch pending balance
  let cycleId = 1;

  const acc = { weeklyWithdrawals: 0, estimatedReturns: 0, confirmedRestock: 0, unclassifiedIncreases: 0 };
  const accBatch = { weeklyWithdrawals: 0, estimatedReturns: 0, confirmedRestock: 0, unclassifiedIncreases: 0 };

  const bump = (day: string, k: "withdrawals" | "returns" | "restock" | "unclassified", n: number) => {
    const cur = perDay.get(day) ?? { withdrawals: 0, returns: 0, restock: 0, unclassified: 0 };
    cur[k] += n;
    perDay.set(day, cur);
  };

  for (const s of ordered) {
    const day = cairoDateStr(new Date(s.observed_at));
    const dec = Number(s.quantity_decrease ?? 0);
    const inc = Number(s.restock_amount ?? 0);

    if (dec > 0) {
      pendingQueue.push({ amount: dec, observedAt: new Date(s.observed_at).getTime() });
      pending = pendingSum();

      pendingBatch += dec;
      acc.weeklyWithdrawals += dec;
      accBatch.weeklyWithdrawals += dec;
      bump(day, "withdrawals", dec);
      movements.push({
        checkedAt: s.observed_at,
        quantityChange: -dec,
        classifiedAs: "WITHDRAWAL",
        reason: "انخفاض في المخزون مقارنة بالقراءة السابقة (طلب شحن/سحب)",
        currentQuantity: s.current_quantity,
        pendingWithdrawalBalanceAfter: pending,
        cycleId,
      });
    }

    if (inc > 0) {
      // FIFO match, oldest-first, only against pending withdrawals still inside
      // the return window (DEFAULT_RETURN_WINDOW_DAYS).
      const t = new Date(s.observed_at).getTime();
      let remaining = inc;
      let returnPart = 0;
      while (remaining > 0 && pendingQueue.length > 0) {
        const head = pendingQueue[0]!;
        if (t - head.observedAt > DEFAULT_RETURN_WINDOW_MS) break;
        const take = Math.min(remaining, head.amount);
        head.amount -= take;
        remaining -= take;
        returnPart += take;
        if (head.amount === 0) pendingQueue.shift();
      }
      const restockPart = remaining;

      if (returnPart > 0) {
        pending = pendingSum();
        acc.estimatedReturns += returnPart;

        bump(day, "returns", returnPart);
        movements.push({
          checkedAt: s.observed_at,
          quantityChange: returnPart,
          classifiedAs: "ESTIMATED_RETURN",
          reason: "زيادة مخزون في حدود رصيد السحب المعلق ⇒ مرتجع تقديري",
          currentQuantity: s.current_quantity,
          pendingWithdrawalBalanceAfter: pending,
          cycleId,
        });
      }

      if (restockPart > 0) {
        if (pending === 0 && returnPart === 0) {
          acc.unclassifiedIncreases += restockPart;
          bump(day, "unclassified", restockPart);
          movements.push({
            checkedAt: s.observed_at,
            quantityChange: restockPart,
            classifiedAs: "UNCLASSIFIED_INCREASE",
            reason: "زيادة مخزون بدون رصيد سحب معلق ⇒ غير مصنفة",
            currentQuantity: s.current_quantity,
            pendingWithdrawalBalanceAfter: pending,
            cycleId,
          });
        } else {
          acc.confirmedRestock += restockPart;
          bump(day, "restock", restockPart);
          movements.push({
            checkedAt: s.observed_at,
            quantityChange: restockPart,
            classifiedAs: "CONFIRMED_RESTOCK",
            reason: "زيادة تتجاوز رصيد السحب المعلق ⇒ توريد مؤكد",
            currentQuantity: s.current_quantity,
            pendingWithdrawalBalanceAfter: pending,
            cycleId,
          });
          cycleId += 1;
        }
      }

      // per-batch mode: same split, but a confirmed restock resets the balance
      const batchReturn = Math.min(inc, pendingBatch);
      const batchRestock = inc - batchReturn;
      if (batchReturn > 0) {
        pendingBatch -= batchReturn;
        accBatch.estimatedReturns += batchReturn;
      }
      if (batchRestock > 0) {
        if (pendingBatch === 0 && batchReturn === 0) {
          accBatch.unclassifiedIncreases += batchRestock;
        } else {
          accBatch.confirmedRestock += batchRestock;
          pendingBatch = 0;
        }
      }
    }
  }

  const days: DayTotals[] = Array.from(perDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const t = rates({
        weeklyWithdrawals: d.withdrawals,
        estimatedReturns: d.returns,
        confirmedRestock: d.restock,
        unclassifiedIncreases: d.unclassified,
        pendingWithdrawalBalanceEnd: 0,
      });
      return { date, withdrawals: d.withdrawals, ...t };
    });

  // Withdrawals that aged out of the return window are presumed delivered, so they
  // no longer count as an open pending balance at the end of the period.
  const lastTs = ordered.length ? new Date(ordered[ordered.length - 1]!.observed_at).getTime() : 0;
  const pendingEnd = pendingQueue
    .filter((q) => lastTs - q.observedAt <= DEFAULT_RETURN_WINDOW_MS)
    .reduce((a, q) => a + q.amount, 0);

  return {
    movements,
    totals: rates({ ...acc, pendingWithdrawalBalanceEnd: pendingEnd }),

    perBatchTotals: rates({ ...accBatch, pendingWithdrawalBalanceEnd: pendingBatch }),
    days,
    snapshotCount: ordered.length,
  };
}

export interface DataQuality {
  status: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;
  issues: { code: string; message: string }[];
}

export function scoreDataQuality(c: ProductClassification): DataQuality {
  const issues: { code: string; message: string }[] = [];
  let score = 100;

  const t = c.totals;
  if (c.snapshotCount < 3) {
    score -= 30;
    issues.push({ code: "FEW_SNAPSHOTS", message: "عدد قراءات المخزون في هذه الفترة قليل جداً لبناء دورة موثوقة." });
  }
  if (t.weeklyWithdrawals === 0) {
    score -= 20;
    issues.push({ code: "NO_WITHDRAWALS", message: "لا توجد سحوبات مرصودة، لذا لا يمكن حساب نسب تسليم أو مرتجعات." });
  }
  const noise = t.unclassifiedIncreases;
  if (noise > 0) {
    const share = t.weeklyWithdrawals > 0 ? noise / t.weeklyWithdrawals : 1;
    score -= Math.min(35, Math.round(share * 100));
    issues.push({
      code: "UNCLASSIFIED_INCREASES",
      message: `${noise} قطعة زيادة غير مصنفة (خارج دورة سحب نشطة) تُخفّض دقة التصنيف.`,
    });
  }
  if (t.pendingWithdrawalBalanceEnd > 0 && t.weeklyWithdrawals > 0) {
    const share = t.pendingWithdrawalBalanceEnd / t.weeklyWithdrawals;
    if (share > 0.5) {
      score -= 15;
      issues.push({
        code: "LARGE_OPEN_BALANCE",
        message: "جزء كبير من السحوبات ما زال معلقاً في نهاية الفترة (قد يُسلَّم أو يُرتجع لاحقاً).",
      });
    }
  }
  if (t.confirmedRestock > 0) {
    issues.push({
      code: "CONFIRMED_RESTOCK_PRESENT",
      message: "توجد عمليات توريد مؤكدة، وهي سبب اختلاف النسب بين منهجية التصفير ومنهجية المطابقة المتقاطعة.",
    });
  }

  const confidenceScore = Math.max(0, Math.min(100, score));
  const status = confidenceScore >= 80 ? "HIGH" : confidenceScore >= 50 ? "MEDIUM" : "LOW";
  return { status, confidenceScore, issues };
}

/** Inclusive Cairo-day window [startDate, endDate] as ISO instants. */
export function cairoWindow(startDate: string, endDate: string) {
  return {
    startIso: new Date(cairoDateHourUtcMs(startDate, 0)).toISOString(),
    endIso: new Date(cairoDateHourUtcMs(endDate, 24)).toISOString(),
  };
}

export async function loadWindowSnapshots(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
  externalProductId?: string,
): Promise<SnapshotRow[]> {
  return fetchAllRows<SnapshotRow>(
    supabase,
    "sr_snapshots",
    "external_product_id, previous_quantity, current_quantity, quantity_decrease, restock_amount, observed_at",
    1000,
    (q) => {
      let b = q.gte("observed_at", startIso).lt("observed_at", endIso).order("observed_at", { ascending: true });
      if (externalProductId) b = b.eq("external_product_id", externalProductId);
      return b;
    },
  );
}

export function averageOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
