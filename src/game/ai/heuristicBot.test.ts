import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { evaluateWarEntryRules } from "../rules/turnEngine";
import { getValidTargets } from "../rules/orderResolution";
import { planCountryTurn, type BotAction } from "./heuristicBot";
import type { CountryId, GameState } from "../state/types";

const SAMPLE_COUNTRIES: CountryId[] = ["RUSSIA", "ROMANIA", "AUSTRIA"];

function fresh(countryId: CountryId = "RUSSIA"): GameState {
  return evaluateWarEntryRules(createInitialState(countryId));
}

function legalTargets(state: GameState, action: BotAction): string[] {
  const unit = state.units[action.unitId];
  const targets = getValidTargets(state, unit.id);
  switch (action.orderType) {
    case "hold":
      return [unit.regionId];
    case "move":
      return targets.moves;
    case "attack":
      return targets.attacks;
    case "airSupport":
      return targets.airTargets;
    case "bombard":
      return targets.bombardTargets;
    case "missileStrike":
      return targets.missileTargets;
  }
}

describe("planCountryTurn characterization", () => {
  it("returns identical decisions for identical state", () => {
    const state = fresh();
    expect(planCountryTurn(state, "RUSSIA")).toEqual(planCountryTurn(state, "RUSSIA"));
  });

  it.each(SAMPLE_COUNTRIES)("issues exactly one action per %s unit", (countryId) => {
    const state = fresh(countryId);
    const decision = planCountryTurn(state, countryId);
    const unitIds = Object.values(state.units)
      .filter((unit) => unit.countryId === countryId)
      .map((unit) => unit.id)
      .sort();

    expect(decision.actions.map((action) => action.unitId).sort()).toEqual(unitIds);
  });

  it.each(SAMPLE_COUNTRIES)("only issues legal targets for %s", (countryId) => {
    const state = fresh(countryId);
    const decision = planCountryTurn(state, countryId);

    for (const action of decision.actions) {
      expect(
        legalTargets(state, action),
        `${action.unitId} ${action.orderType} -> ${action.targetRegionId}`
      ).toContain(action.targetRegionId);
      expect(action.fromRegionId).toBe(state.units[action.unitId].regionId);
    }
  });

  it.each(SAMPLE_COUNTRIES)("only attacks adjacent, at-war enemies as %s", (countryId) => {
    const state = fresh(countryId);
    const decision = planCountryTurn(state, countryId);

    for (const action of decision.actions.filter((candidate) => candidate.orderType === "attack")) {
      const unit = state.units[action.unitId];
      const target = state.regions[action.targetRegionId];

      expect(state.regions[unit.regionId].adjacentRegionIds).toContain(target.id);
      expect(state.countryStates[target.controllerCountryId].atWar).toBe(true);
      expect(target.controllerBlocId).not.toBe(unit.blocId);
    }
  });

  it("does not move a lone defender out of a threatened region", () => {
    const base = fresh();
    const defender = Object.values(base.units).find(
      (unit) => unit.countryId === "RUSSIA" && (unit.type === "infantry" || unit.type === "armor")
    );
    expect(defender).toBeDefined();

    const state: GameState = {
      ...base,
      units: {
        ...base.units,
        [defender!.id]: { ...defender!, regionId: "saint-petersburg" },
      },
    };

    const decision = planCountryTurn(state, "RUSSIA");
    const action = decision.actions.find((candidate) => candidate.unitId === defender!.id);

    expect(action).toBeDefined();
    expect(action!.orderType).not.toBe("move");
  });
});
