import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import type { GameState, UnitDefinition } from "../state/types";
import { evaluateWarEntryRules } from "./turnEngine";
import { issueOrder, resolveOrders, setCombatSeed } from "./orderResolution";

/**
 * Characterization test pinned before the combat helpers were exported for the attack preview.
 * The seeds and numbers below are observed resolver output; any change means combat behavior moved.
 */
const ODESA_DEFENDER: UnitDefinition = {
  id: "ua-def",
  type: "infantry",
  blocId: "EU_NATO",
  countryId: "UKRAINE",
  regionId: "odesa",
  strength: 8,
  supplyTurnsRemaining: 2,
  battlesWon: 1,
  entrenchmentTurns: 2
};

function fortifiedBattle(): GameState {
  const state = evaluateWarEntryRules(createInitialState("RUSSIA"));
  return {
    ...state,
    units: { ...state.units, [ODESA_DEFENDER.id]: ODESA_DEFENDER }
  };
}

describe("resolveOrders characterization", () => {
  it("resolves a fixed-seed attack on Odesa to the same result as before the helper export", () => {
    const ordered = issueOrder(fortifiedBattle(), {
      unitId: "pmr-ru-inf-1",
      type: "attack",
      targetRegionId: "odesa"
    });
    setCombatSeed(12345);
    const after = resolveOrders(ordered, "RUSSIA");

    expect(after.combatLog).toEqual([
      {
        attackerUnitId: "pmr-ru-inf-1",
        attackerUnitIds: ["pmr-ru-inf-1"],
        defenderUnitIds: ["ua-def"],
        regionId: "odesa",
        attackerStrengthBefore: 8,
        defenderStrengthBefore: 8,
        attackerStrengthAfter: 3,
        defenderStrengthAfter: 7,
        attackerWon: false,
        terrainModifier: 1.15,
        facilitiesDamaged: ["fort:1"]
      }
    ]);
    expect(after.units["pmr-ru-inf-1"]).toMatchObject({ strength: 3, regionId: "chisinau-pridnestrovie" });
    expect(after.units["ua-def"]).toMatchObject({ strength: 7, regionId: "odesa" });
    expect(after.regions.odesa.controllerCountryId).toBe("UKRAINE");
    expect(after.regionEconomies.odesa.fortification).toMatchObject({ level: 3, health: 23, maxHealth: 24, damaged: true });
    expect(after.eventLog).toContain(
      "Battle of Odesa:  Ratio 0.22. Surprising attacker breakthrough. [fort -1] [assault bounced]"
    );
  });
});
