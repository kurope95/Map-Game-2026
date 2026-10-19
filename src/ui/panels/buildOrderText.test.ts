import { describe, expect, it } from "vitest";
import type { EconomyBuildOrder, Facility } from "../../game/state/types";
import { cancelRefundLabel, committedCostLabel, describeBuildOrder } from "./buildOrderText";

function order(overrides: Partial<EconomyBuildOrder>): EconomyBuildOrder {
  return {
    id: "order-1",
    countryId: "RUSSIA",
    regionId: "moscow",
    type: "buildFacility",
    turnsRemaining: 2,
    totalTurns: 2,
    committed: {},
    ...overrides,
  };
}

const facilities: Facility[] = [
  { id: "farm-1", type: "farm", level: 2, regionId: "moscow", damaged: false },
  { id: "barracks-1", type: "barracks", level: 1, regionId: "moscow", damaged: false },
];

describe("describeBuildOrder", () => {
  it("labels a facility build", () => {
    expect(describeBuildOrder(order({ facilityType: "farm" }), facilities)).toBe("Build Farm");
  });

  it("labels facility upgrades and repairs by the target facility type", () => {
    expect(describeBuildOrder(order({ type: "upgradeFacility", facilityId: "barracks-1" }), facilities)).toBe(
      "Upgrade Barracks"
    );
    expect(describeBuildOrder(order({ type: "repairFacility", facilityId: "farm-1" }), facilities)).toBe(
      "Repair Farm"
    );
  });

  it("labels recruitment and replenishment by unit type", () => {
    expect(describeBuildOrder(order({ type: "recruitUnit", unitType: "armor" }), facilities)).toBe("Recruit Armor");
    expect(describeBuildOrder(order({ type: "replenishUnit", unitType: "fighter" }), facilities)).toBe(
      "Replenish Fighter"
    );
  });

  it("labels fortification orders", () => {
    expect(describeBuildOrder(order({ type: "buildFortification" }), facilities)).toBe("Build fortification");
    expect(describeBuildOrder(order({ type: "upgradeFortification" }), facilities)).toBe("Upgrade fortification");
    expect(describeBuildOrder(order({ type: "repairFortification" }), facilities)).toBe("Repair fortification");
  });
});

describe("cancelRefundLabel", () => {
  it("promises the full refund before any work is done", () => {
    expect(cancelRefundLabel(order({ turnsRemaining: 3, totalTurns: 3 }))).toBe("Cancel (full refund)");
  });

  it("states the share that comes back once work has started", () => {
    expect(cancelRefundLabel(order({ turnsRemaining: 2, totalTurns: 3 }))).toBe("Cancel (67% refund)");
    expect(cancelRefundLabel(order({ turnsRemaining: 1, totalTurns: 4 }))).toBe("Cancel (25% refund)");
  });
});

describe("committedCostLabel", () => {
  it("lists committed resources with their display labels", () => {
    expect(committedCostLabel(order({ committed: { steel: 12, fuel: 3 } }))).toBe("12 Steel · 3 Fuel");
  });

  it("reports no cost when nothing is committed", () => {
    expect(committedCostLabel(order({ committed: {} }))).toBe("No cost");
  });
});
