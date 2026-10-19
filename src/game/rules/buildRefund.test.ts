import { describe, expect, it } from "vitest";
import type { StockpileKey } from "../state/types";
import { describeCancelRefund, getCancelRefund } from "./buildRefund";

const order = (turnsRemaining: number, totalTurns: number, committed: Partial<Record<StockpileKey, number>> = { steel: 12, iron: 3 }) => ({
  turnsRemaining,
  totalTurns,
  committed,
});

describe("getCancelRefund", () => {
  it("returns the whole cost while no turn of work has been done", () => {
    expect(getCancelRefund(order(4, 4))).toEqual({ share: 1, amounts: { steel: 12, iron: 3 } });
  });

  it("returns the share of the build time still ahead once work has started, rounded down per resource", () => {
    expect(getCancelRefund(order(3, 4))).toEqual({ share: 0.75, amounts: { steel: 9, iron: 2 } });
    expect(getCancelRefund(order(2, 4))).toEqual({ share: 0.5, amounts: { steel: 6, iron: 1 } });
    expect(getCancelRefund(order(1, 4))).toEqual({ share: 0.25, amounts: { steel: 3, iron: 0 } });
  });

  it("never pays back more than the order cost", () => {
    const refund = getCancelRefund(order(2, 3, { steel: 5, fuel: 1 }));
    expect(refund.amounts).toEqual({ steel: 3, fuel: 0 });
    expect(refund.share).toBeCloseTo(2 / 3, 10);
  });

  it("treats an order with no recorded build time, or more time left than planned, as unstarted", () => {
    expect(getCancelRefund(order(2, 0))).toEqual({ share: 1, amounts: { steel: 12, iron: 3 } });
    expect(getCancelRefund(order(5, 4))).toEqual({ share: 1, amounts: { steel: 12, iron: 3 } });
  });

  it("returns nothing for a free order", () => {
    expect(getCancelRefund(order(1, 3, {}))).toEqual({ share: expect.closeTo(1 / 3, 10), amounts: {} });
  });
});

describe("describeCancelRefund", () => {
  it("says the refund was full and lists what came back", () => {
    expect(describeCancelRefund(getCancelRefund(order(4, 4)))).toBe("Order cancelled, full refund (12 steel, 3 iron)");
  });

  it("states the share and lists only what actually came back", () => {
    expect(describeCancelRefund(getCancelRefund(order(1, 4)))).toBe("Order cancelled, 25% refunded (3 steel)");
  });

  it("still reports an empty refund honestly", () => {
    expect(describeCancelRefund(getCancelRefund(order(1, 3, { iron: 1 })))).toBe("Order cancelled, 33% refunded");
  });
});
