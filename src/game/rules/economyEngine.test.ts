import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import type { EconomyBuildOrder, GameState } from "../state/types";
import { processEconomy } from "./economyEngine";

const COUNTRY = "RUSSIA" as const;

function withOrder(state: GameState, order: EconomyBuildOrder): GameState {
  return {
    ...state,
    economyBuildOrders: {
      ...state.economyBuildOrders,
      [COUNTRY]: [...(state.economyBuildOrders[COUNTRY] ?? []), order],
    },
  };
}

function completedIds(state: GameState, before: GameState): string[] {
  const knownUnits = new Set(Object.keys(before.units));
  const knownFacilities = new Set(
    Object.values(before.regionEconomies).flatMap((economy) => economy.facilities.map((facility) => facility.id))
  );
  return [
    ...Object.keys(state.units).filter((id) => !knownUnits.has(id)),
    ...Object.values(state.regionEconomies)
      .flatMap((economy) => economy.facilities.map((facility) => facility.id))
      .filter((id) => !knownFacilities.has(id)),
  ];
}

describe("processEconomy deterministic ids", () => {
  it("gives a completed recruitment the same id on identical runs", () => {
    const order: EconomyBuildOrder = {
      id: "test-recruit",
      countryId: COUNTRY,
      regionId: "moscow",
      type: "recruitUnit",
      unitType: "infantry",
      turnsRemaining: 1,
      totalTurns: 1,
      committed: {},
    };
    const base = createInitialState(COUNTRY);

    const first = processEconomy(withOrder(base, order), COUNTRY);
    const second = processEconomy(withOrder(base, order), COUNTRY);

    expect(completedIds(first, base)).toHaveLength(1);
    expect(completedIds(first, base)).toEqual(completedIds(second, base));
  });

  it("gives a completed facility build the same id on identical runs", () => {
    const order: EconomyBuildOrder = {
      id: "test-build",
      countryId: COUNTRY,
      regionId: "moscow",
      type: "buildFacility",
      facilityType: "farm",
      turnsRemaining: 1,
      totalTurns: 1,
      committed: {},
    };
    const base = createInitialState(COUNTRY);

    const first = processEconomy(withOrder(base, order), COUNTRY);
    const second = processEconomy(withOrder(base, order), COUNTRY);

    expect(completedIds(first, base)).toHaveLength(1);
    expect(completedIds(first, base)).toEqual(completedIds(second, base));
  });
});
