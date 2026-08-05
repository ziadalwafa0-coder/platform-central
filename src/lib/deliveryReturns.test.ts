import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETURN_WINDOW_MS,
  classifyDeliveryReturns,
  type SnapshotInput,
} from "./deliveryReturns";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();
const DAY = 86_400_000;
const opts = { returnWindowMs: DEFAULT_RETURN_WINDOW_MS };

const w = (offset: number, n: number): SnapshotInput => ({
  observedAt: iso(offset),
  quantityDecrease: n,
  restockAmount: 0,
});
const r = (offset: number, n: number): SnapshotInput => ({
  observedAt: iso(offset),
  quantityDecrease: 0,
  restockAmount: n,
});

describe("classifyDeliveryReturns", () => {
  it("1. exact-match return", () => {
    const res = classifyDeliveryReturns([w(0, 10), r(DAY, 10)], opts);
    expect(res.totalWithdrawals).toBe(10);
    expect(res.estimatedReturns).toBe(10);
    expect(res.confirmedRestock).toBe(0);
    expect(res.netDelivered).toBe(0);
    expect(res.returnRatePct).toBe(100);
    expect(res.deliveryRatePct).toBe(0);
  });

  it("2. no return ever: withdrawal decays after window, presumed delivered", () => {
    const res = classifyDeliveryReturns([w(0, 10), w(10 * DAY, 0)], opts);
    expect(res.estimatedReturns).toBe(0);
    expect(res.netDelivered).toBe(10);
    expect(res.deliveryRatePct).toBe(100);
    expect(res.pendingWithdrawalBalanceEnd).toBe(0);
  });

  it("3. late-arriving increase is restock, not return", () => {
    const res = classifyDeliveryReturns([w(0, 10), r(6 * DAY, 10)], opts);
    expect(res.estimatedReturns).toBe(0);
    expect(res.confirmedRestock).toBe(10);
    expect(res.netDelivered).toBe(10);
  });

  it("4. pure restock with no prior withdrawal", () => {
    const res = classifyDeliveryReturns([r(0, 25)], opts);
    expect(res.totalWithdrawals).toBe(0);
    expect(res.confirmedRestock).toBe(25);
    expect(res.deliveryRatePct).toBeNull();
    expect(res.returnRatePct).toBeNull();
  });

  it("5. partial return", () => {
    const res = classifyDeliveryReturns([w(0, 10), r(DAY, 4)], opts);
    expect(res.estimatedReturns).toBe(4);
    expect(res.confirmedRestock).toBe(0);
    expect(res.netDelivered).toBe(6);
    expect(res.returnRatePct).toBe(40);
  });

  it("6. oversized increase splits into return + restock", () => {
    const res = classifyDeliveryReturns([w(0, 10), r(DAY, 15)], opts);
    expect(res.estimatedReturns).toBe(10);
    expect(res.confirmedRestock).toBe(5);
    expect(res.movements.filter((m) => m.type === "ESTIMATED_RETURN")).toHaveLength(1);
    expect(res.movements.filter((m) => m.type === "CONFIRMED_RESTOCK")).toHaveLength(1);
  });

  it("7. FIFO ordering across multiple withdrawals", () => {
    const res = classifyDeliveryReturns([w(0, 5), w(DAY, 7), r(2 * DAY, 6)], opts);
    expect(res.estimatedReturns).toBe(6);
    // oldest (5) fully consumed, 1 taken from the second -> 6 pending left
    expect(res.pendingWithdrawalBalanceEnd).toBe(6);
  });

  it("8. null (not 0/NaN) rates with no withdrawal activity", () => {
    const res = classifyDeliveryReturns([], opts);
    expect(res.deliveryRatePct).toBeNull();
    expect(res.returnRatePct).toBeNull();
    expect(Number.isNaN(res.netDelivered)).toBe(false);
  });

  it("9. window boundary is inclusive", () => {
    const res = classifyDeliveryReturns([w(0, 8), r(DEFAULT_RETURN_WINDOW_MS, 8)], opts);
    expect(res.estimatedReturns).toBe(8);
    expect(res.confirmedRestock).toBe(0);
  });

  it("10. one withdrawal drained across two return events", () => {
    const res = classifyDeliveryReturns([w(0, 10), r(DAY, 4), r(2 * DAY, 6)], opts);
    expect(res.estimatedReturns).toBe(10);
    expect(res.confirmedRestock).toBe(0);
    expect(res.netDelivered).toBe(0);
    expect(res.pendingWithdrawalBalanceEnd).toBe(0);
  });
});
