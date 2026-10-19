import type { EconomyBuildOrder, StockpileKey } from "../state/types";

export interface CancelRefund {
  /** Fraction of the committed cost that comes back (1 = everything). */
  share: number;
  /** What returns to the stockpile: one entry per committed resource. */
  amounts: Partial<Record<StockpileKey, number>>;
}

/**
 * What cancelling a pending build order gives back. Until the first end of turn no work has been done,
 * so the whole cost returns; after that only the share of the build time still ahead does
 * (turnsRemaining / totalTurns), rounded down per resource so a cancelled order never pays back more
 * than it cost. An order without a recorded build time (an old save) counts as unstarted.
 */
export function getCancelRefund(order: Pick<EconomyBuildOrder, "turnsRemaining" | "totalTurns" | "committed">): CancelRefund {
  const { turnsRemaining, totalTurns, committed } = order;
  const started = totalTurns > 0 && turnsRemaining < totalTurns;
  const turnsLeft = Math.max(0, turnsRemaining);
  const amounts: Partial<Record<StockpileKey, number>> = {};
  for (const [key, amount] of Object.entries(committed) as [StockpileKey, number | undefined][]) {
    const spent = amount ?? 0;
    amounts[key] = started ? Math.floor((spent * turnsLeft) / totalTurns) : spent;
  }
  return { share: started ? turnsLeft / totalTurns : 1, amounts };
}

/** Toast text for a cancelled order, e.g. "Order cancelled, 75% refunded (7 steel, 2 iron)". */
export function describeCancelRefund({ share, amounts }: CancelRefund): string {
  const parts = Object.entries(amounts)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([key, amount]) => `${amount} ${key}`);
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return share >= 1 ? `Order cancelled, full refund${detail}` : `Order cancelled, ${Math.round(share * 100)}% refunded${detail}`;
}
