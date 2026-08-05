/**
 * Delivery / returns policy — PURE, framework-free, single source of truth.
 *
 * Policy (one paragraph):
 * Every withdrawal (stock decrease) opens a "pending withdrawal" with a timestamp.
 * Every stock increase is matched, oldest-first (FIFO), against still-open pending
 * withdrawals that are no older than `returnWindowMs`. The matched portion counts as
 * an ESTIMATED_RETURN; anything left over (nothing pending, or the pending withdrawal
 * aged out of the window) counts as CONFIRMED_RESTOCK. A withdrawal that ages out of
 * the window with nothing matched against it is presumed delivered.
 *
 * HONESTY NOTE: returns are ESTIMATES. The data source only exposes stock quantity
 * sampled on a timer — there is no return flag, batch id, or restock reason. This
 * module is internally consistent and reproducible, not ground truth.
 */

/** The one genuinely tunable assumption in this design. Egypt COD delivery/RTO cycle. */
export const DEFAULT_RETURN_WINDOW_DAYS = 5;
export const DEFAULT_RETURN_WINDOW_MS = DEFAULT_RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface SnapshotInput {
  observedAt: string;
  quantityDecrease: number;
  restockAmount: number;
}

export interface ClassifiedMovement {
  observedAt: string;
  type: "WITHDRAWAL" | "ESTIMATED_RETURN" | "CONFIRMED_RESTOCK";
  amount: number;
  pendingBalanceAfter: number;
}

export interface DeliveryReturnsResult {
  totalWithdrawals: number;
  estimatedReturns: number;
  confirmedRestock: number;
  netDelivered: number;
  deliveryRatePct: number | null;
  returnRatePct: number | null;
  pendingWithdrawalBalanceEnd: number;
  movements: ClassifiedMovement[];
}

export interface PolicyOptions {
  returnWindowMs: number;
}

export function classifyDeliveryReturns(
  snapshots: SnapshotInput[],
  opts: PolicyOptions = { returnWindowMs: DEFAULT_RETURN_WINDOW_MS },
): DeliveryReturnsResult {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
  );
  const pendingQueue: { amount: number; observedAt: number }[] = [];
  const movements: ClassifiedMovement[] = [];
  let totalWithdrawals = 0;
  let estimatedReturns = 0;
  let confirmedRestock = 0;
  const pendingBalance = () => pendingQueue.reduce((a, q) => a + q.amount, 0);

  for (const s of sorted) {
    const t = new Date(s.observedAt).getTime();

    if (s.quantityDecrease > 0) {
      totalWithdrawals += s.quantityDecrease;
      pendingQueue.push({ amount: s.quantityDecrease, observedAt: t });
      movements.push({
        observedAt: s.observedAt,
        type: "WITHDRAWAL",
        amount: s.quantityDecrease,
        pendingBalanceAfter: pendingBalance(),
      });
    }

    if (s.restockAmount > 0) {
      let remaining = s.restockAmount;
      let returnedThisEvent = 0;
      while (remaining > 0 && pendingQueue.length > 0) {
        const head = pendingQueue[0]!;
        if (t - head.observedAt > opts.returnWindowMs) break;
        const take = Math.min(remaining, head.amount);
        head.amount -= take;
        remaining -= take;
        returnedThisEvent += take;
        if (head.amount === 0) pendingQueue.shift();
      }
      if (returnedThisEvent > 0) {
        estimatedReturns += returnedThisEvent;
        movements.push({
          observedAt: s.observedAt,
          type: "ESTIMATED_RETURN",
          amount: returnedThisEvent,
          pendingBalanceAfter: pendingBalance(),
        });
      }
      if (remaining > 0) {
        confirmedRestock += remaining;
        movements.push({
          observedAt: s.observedAt,
          type: "CONFIRMED_RESTOCK",
          amount: remaining,
          pendingBalanceAfter: pendingBalance(),
        });
      }
    }
  }

  const nowRef = sorted.length ? new Date(sorted[sorted.length - 1]!.observedAt).getTime() : 0;
  let pendingWithdrawalBalanceEnd = 0;
  for (const q of pendingQueue) {
    if (nowRef - q.observedAt <= opts.returnWindowMs) pendingWithdrawalBalanceEnd += q.amount;
  }

  const netDelivered = Math.max(totalWithdrawals - estimatedReturns, 0);
  return {
    totalWithdrawals,
    estimatedReturns,
    confirmedRestock,
    netDelivered,
    deliveryRatePct: totalWithdrawals > 0 ? (netDelivered / totalWithdrawals) * 100 : null,
    returnRatePct: totalWithdrawals > 0 ? (estimatedReturns / totalWithdrawals) * 100 : null,
    pendingWithdrawalBalanceEnd,
    movements,
  };
}
