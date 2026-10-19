import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { evaluateWarEntryRules } from "../rules/turnEngine";
import { getValidTargets } from "../rules/orderResolution";
import { AI_COUNTRY_PROFILES, AI_NATIONAL_GOALS, AI_ROUTE_WEIGHTS } from "../content/aiObjectives";
import { planCountryTurn, type BotAction } from "./heuristicBot";
import { buildRouteDistances } from "./pathfinding";
import type { CountryId, GameState } from "../state/types";

const SAMPLE_COUNTRIES: CountryId[] = ["RUSSIA", "ROMANIA", "AUSTRIA"];

function fresh(countryId: CountryId = "RUSSIA"): GameState {
  return evaluateWarEntryRules(createInitialState(countryId));
}

function withController(state: GameState, regionId: string, countryId: CountryId): GameState {
  const region = state.regions[regionId];
  return {
    ...state,
    regions: {
      ...state.regions,
      [regionId]: {
        ...region,
        controllerCountryId: countryId,
        controllerBlocId: state.countries[countryId].blocId,
      },
    },
  };
}

function relocateUnit(state: GameState, unitId: string, regionId: string): GameState {
  return { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], regionId } } };
}

function cloneUnit(state: GameState, templateUnitId: string, unitId: string, regionId: string): GameState {
  return {
    ...state,
    units: {
      ...state.units,
      [unitId]: { ...state.units[templateUnitId], id: unitId, regionId },
    },
  };
}

// Mirrors the desired-defender formula in getCountryFrontlineData. Filling
// every deficit keeps the reinforcement march out of the way, so a spare unit
// is free to stage for the primary objective.
function garrisonDeficits(state: GameState): GameState {
  let next = state;
  let cloneIndex = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const blocId = next.countries.RUSSIA.blocId;
    const deficits = Object.values(next.regions)
      .filter((region) => region.controllerCountryId === "RUSSIA")
      .map((region) => {
        const hostileAdjacents = region.adjacentRegionIds.filter((adjacentId) => {
          const adjacent = next.regions[adjacentId];
          return (
            adjacent.controllerBlocId !== undefined &&
            adjacent.controllerBlocId !== blocId &&
            next.countryStates[adjacent.controllerCountryId]?.atWar === true
          );
        }).length;
        const defenders = Object.values(next.units).filter(
          (unit) =>
            unit.countryId === "RUSSIA" &&
            (unit.type === "infantry" || unit.type === "armor") &&
            unit.regionId === region.id
        ).length;
        const isKey = region.isCapital || region.isKeyCity;
        const desired = Math.max(
          isKey ? 1 : 0,
          (hostileAdjacents > 0 ? Math.min(3, 1 + hostileAdjacents + (isKey ? 1 : 0)) : isKey ? 1 : 0) - 1
        );
        return { regionId: region.id, deficit: Math.max(0, desired - defenders) };
      })
      .filter((entry) => entry.deficit > 0);
    if (deficits.length === 0) break;
    for (const { regionId, deficit } of deficits) {
      for (let i = 0; i < deficit; i += 1) {
        next = cloneUnit(next, "ru-inf-1", `test-garrison-${cloneIndex++}`, regionId);
      }
    }
  }
  return next;
}

// Tallinn becomes Russia's only hostile border, hence its primary objective.
function onlyTallinnHostile(state: GameState): GameState {
  return withController(withController(state, "gdansk", "MOLDOVA"), "kaunas", "MOLDOVA");
}

function actionFor(state: GameState, countryId: CountryId, unitId: string): BotAction {
  const action = planCountryTurn(state, countryId).actions.find((candidate) => candidate.unitId === unitId);
  expect(action).toBeDefined();
  return action!;
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

describe("planCountryTurn route progress", () => {
  it("moves a rear unit one step toward an unresolved national goal", () => {
    let state = fresh();
    for (const goal of AI_NATIONAL_GOALS.RUSSIA.filter((regionId) => regionId !== "vilnius")) {
      state = withController(state, goal, "RUSSIA");
    }
    state = relocateUnit(state, "ru-inf-1", "saint-petersburg-neva-corridor");
    const distances = buildRouteDistances(state, "RUSSIA", new Set(["vilnius"]));

    const action = actionFor(state, "RUSSIA", "ru-inf-1");

    expect(action.orderType).toBe("move");
    expect(distances.distances.get(action.targetRegionId)!).toBeLessThan(
      distances.distances.get("saint-petersburg-neva-corridor")!
    );
    expect(
      action.reasons.some((reason) => reason.includes("National goal: Route step closes 1 hop on Vilnius."))
    ).toBe(true);
  });

  it("moves a rear unit one step toward a lost starting region", () => {
    let state = fresh();
    for (const goal of AI_NATIONAL_GOALS.RUSSIA) {
      state = withController(state, goal, "RUSSIA");
    }
    state = withController(state, "kaliningrad", "UKRAINE");
    state = relocateUnit(state, "ru-inf-1", "saint-petersburg-neva-corridor");
    const distances = buildRouteDistances(state, "RUSSIA", new Set(["kaliningrad"]));

    const action = actionFor(state, "RUSSIA", "ru-inf-1");

    expect(action.orderType).toBe("move");
    expect(distances.distances.get(action.targetRegionId)!).toBeLessThan(
      distances.distances.get("saint-petersburg-neva-corridor")!
    );
    expect(
      action.reasons.some((reason) => reason.includes("Homeland cohesion: Route step closes 1 hop on Kaliningrad."))
    ).toBe(true);
  });

  it("moves a rear unit one step toward an allied shield objective", () => {
    let state = fresh();
    for (const goal of AI_NATIONAL_GOALS.RUSSIA) {
      state = withController(state, goal, "RUSSIA");
    }
    state = relocateUnit(state, "ru-inf-1", "nizhny-novgorod-oka-district");
    const distances = buildRouteDistances(state, "RUSSIA", new Set(["gomel", "minsk", "brest"]));

    const action = actionFor(state, "RUSSIA", "ru-inf-1");

    expect(action.orderType).toBe("move");
    expect(distances.distances.get(action.targetRegionId)!).toBeLessThan(
      distances.distances.get("nizhny-novgorod-oka-district")!
    );
    expect(
      action.reasons.some((reason) => reason.includes("Ally support: Route step closes 1 hop on Gomel."))
    ).toBe(true);
  });
});

describe("planCountryTurn reinforcement marches", () => {
  it("marches a surplus rear unit toward a threatened front", () => {
    let state = fresh();
    for (const goal of AI_NATIONAL_GOALS.RUSSIA) state = withController(state, goal, "RUSSIA");
    // Deep in the interior, with no adjacent front and no national goal pulling
    // it: the only reason to move is the reinforcement march.
    state = relocateUnit(state, "ru-inf-1", "kursk");
    state = relocateUnit(state, "ru-arm-1", "kursk");

    const action = actionFor(state, "RUSSIA", "ru-inf-1");
    const marchReason = action.reasons.find((reason) => reason.includes("Marches to reinforce"));

    expect(action.orderType).toBe("move");
    expect(marchReason).toBeDefined();

    const threatenedName = marchReason!.match(/Marches to reinforce (.+);/)?.[1];
    const threatenedId = Object.values(state.regions).find((region) => region.name === threatenedName)?.id;
    expect(threatenedId).toBeDefined();

    const distances = buildRouteDistances(state, "RUSSIA", new Set([threatenedId!]));
    expect(distances.distances.get(action.targetRegionId)!).toBeLessThan(distances.distances.get("kursk")!);
  });

  it("stages a spare unit toward its primary objective", () => {
    let state = fresh();
    state = onlyTallinnHostile(state);
    state = garrisonDeficits(state);
    state = cloneUnit(state, "ru-inf-1", "spare-unit", "moscow");

    const action = actionFor(state, "RUSSIA", "spare-unit");
    const stagingReason = action.reasons.find((reason) => reason.includes("Stages for the attack on Tallinn"));

    expect(action.orderType).toBe("move");
    expect(stagingReason).toBeDefined();

    const stagingDistances = buildRouteDistances(state, "RUSSIA", new Set(["saint-petersburg"]));
    expect(stagingDistances.distances.get(action.targetRegionId)!).toBeLessThan(
      stagingDistances.distances.get("moscow")!
    );
  });

  it("stages no more units than the primary objective attack cap", () => {
    let state = fresh();
    state = onlyTallinnHostile(state);
    state = garrisonDeficits(state);
    for (let i = 0; i < 10; i += 1) {
      state = cloneUnit(state, "ru-inf-1", `spare-${i}`, "moscow");
    }

    // Raise the staging weight so every spare becomes a staging candidate; the
    // cap is what then decides how many actually stage.
    const profile = AI_COUNTRY_PROFILES.RUSSIA!;
    const routeWeights = AI_ROUTE_WEIGHTS as { primaryStagingBase: number };
    const originalCap = profile.primaryObjectiveAttackCap;
    const originalBase = routeWeights.primaryStagingBase;
    profile.primaryObjectiveAttackCap = 3;
    routeWeights.primaryStagingBase = 100;
    try {
      const staged = planCountryTurn(state, "RUSSIA").actions.filter((action) =>
        action.reasons.some((reason) => reason.includes("Stages for the attack"))
      );

      expect(staged).toHaveLength(3);
    } finally {
      profile.primaryObjectiveAttackCap = originalCap;
      routeWeights.primaryStagingBase = originalBase;
    }
  });

  it("does not march a critically unsupplied unit out of supply", () => {
    let state = fresh();
    for (const goal of AI_NATIONAL_GOALS.RUSSIA) state = withController(state, goal, "RUSSIA");
    // Lose the capital: no region is connected to the supply network anymore.
    state = withController(state, "moscow", "UKRAINE");
    state = relocateUnit(state, "ru-inf-1", "voronezh");
    state = {
      ...state,
      units: {
        ...state.units,
        "ru-inf-1": { ...state.units["ru-inf-1"], supplyTurnsRemaining: 0 },
      },
    };

    const action = actionFor(state, "RUSSIA", "ru-inf-1");

    expect(action.orderType).not.toBe("move");
  });
});
