import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { evaluateWarEntryRules } from "../rules/turnEngine";
import type { CountryId, GameState } from "../state/types";
import { recordAllyAttackClaims, shouldDeferAttackToAlly } from "./allyCoordination";

const RU = "RUSSIA" as const;
const TARGET = "moscow";

function fresh(): GameState {
  return evaluateWarEntryRules(createInitialState(RU));
}

function withEnemyDefender(state: GameState, strength: number): GameState {
  const source = Object.values(state.units).find((unit) => unit.blocId === "EU_NATO");
  if (!source) throw new Error("scenario has no EU_NATO unit");

  return {
    ...state,
    units: {
      ...state.units,
      "test-enemy-defender": { ...source, id: "test-enemy-defender", regionId: TARGET, strength },
    },
  };
}

function withClaim(state: GameState, countryId: CountryId, strength: number): GameState {
  return {
    ...state,
    allyTargetClaims: { BRICS: { [TARGET]: { countryId, strength } } },
  };
}

describe("shouldDeferAttackToAlly", () => {
  it("does not defer when no ally has claimed the target", () => {
    const state = withEnemyDefender(fresh(), 4);
    expect(shouldDeferAttackToAlly(state, RU, "BRICS", TARGET, 5).defer).toBe(false);
  });

  it("does not defer to the country's own claim", () => {
    const state = withClaim(withEnemyDefender(fresh(), 4), RU, 10);
    expect(shouldDeferAttackToAlly(state, RU, "BRICS", TARGET, 5).defer).toBe(false);
  });

  it("defers to an ally claim at 1.5x defenders when the unit is not stronger", () => {
    const state = withClaim(withEnemyDefender(fresh(), 4), "BELARUS", 6);
    const result = shouldDeferAttackToAlly(state, RU, "BRICS", TARGET, 5);

    expect(result.defer).toBe(true);
    expect(result.reason).toContain(state.countries.BELARUS.name);
  });

  it("does not defer when the ally claim is below 1.5x defenders", () => {
    const state = withClaim(withEnemyDefender(fresh(), 4), "BELARUS", 5);
    expect(shouldDeferAttackToAlly(state, RU, "BRICS", TARGET, 5).defer).toBe(false);
  });

  it("does not defer when the unit is stronger than the ally claim", () => {
    const state = withClaim(withEnemyDefender(fresh(), 4), "BELARUS", 6);
    expect(shouldDeferAttackToAlly(state, RU, "BRICS", TARGET, 7).defer).toBe(false);
  });
});

describe("recordAllyAttackClaims", () => {
  it("accumulates claims from the same country", () => {
    const state = withEnemyDefender(fresh(), 4);
    const unit = Object.values(state.units).find(
      (candidate) => candidate.countryId === RU && candidate.blocId === "BRICS"
    );
    expect(unit).toBeDefined();

    const once = recordAllyAttackClaims(state, RU, [{ unitId: unit!.id, targetRegionId: TARGET }]);
    const twice = recordAllyAttackClaims(once, RU, [{ unitId: unit!.id, targetRegionId: TARGET }]);

    expect(twice.allyTargetClaims?.BRICS?.[TARGET]).toEqual({
      countryId: RU,
      strength: unit!.strength * 2,
    });
  });

  it("replaces a weaker claim from another country", () => {
    const base = withClaim(withEnemyDefender(fresh(), 4), "BELARUS", 2);
    const unit = Object.values(base.units).find(
      (candidate) => candidate.countryId === RU && candidate.blocId === "BRICS" && candidate.strength > 2
    );
    expect(unit).toBeDefined();

    const next = recordAllyAttackClaims(base, RU, [{ unitId: unit!.id, targetRegionId: TARGET }]);

    expect(next.allyTargetClaims?.BRICS?.[TARGET]).toEqual({
      countryId: RU,
      strength: unit!.strength,
    });
  });

  it("keeps a stronger claim from another country", () => {
    const base = withClaim(withEnemyDefender(fresh(), 4), "BELARUS", 100);
    const unit = Object.values(base.units).find(
      (candidate) => candidate.countryId === RU && candidate.blocId === "BRICS"
    );
    expect(unit).toBeDefined();

    const next = recordAllyAttackClaims(base, RU, [{ unitId: unit!.id, targetRegionId: TARGET }]);

    expect(next.allyTargetClaims?.BRICS?.[TARGET]).toEqual({
      countryId: "BELARUS",
      strength: 100,
    });
  });
});
