import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import { evaluateWarEntryRules } from "../../game/rules/turnEngine";
import type { BlocId, CountryId, GameState, UnitDefinition, UnitType } from "../../game/state/types";
import { NATION_COLORS } from "../theme/palette";
import { getStartingControllers } from "./startingControllers";
import { buildMapGeometry } from "./geometry/buildMapGeometry";
import { deriveMapData } from "./derive";

const fresh = () => evaluateWarEntryRules(createInitialState("RUSSIA"));
const state = fresh();
const geometry = buildMapGeometry(state.regions, getStartingControllers(state));
const options = { playerCountryId: "RUSSIA" as CountryId, showSupply: false };

function makeUnit(
  id: string,
  type: UnitType,
  countryId: CountryId,
  blocId: BlocId,
  regionId: string
): UnitDefinition {
  return { id, type, blocId, countryId, regionId, strength: 10, supplyTurnsRemaining: 3 };
}

describe("deriveMapData", () => {
  it("marks no region as occupied at the start", () => {
    expect(deriveMapData(state, geometry, options).occupiedBy.size).toBe(0);
  });

  it("reports an occupied region and paints it with the controller color", () => {
    const captureLublin: GameState = {
      ...state,
      regions: {
        ...state.regions,
        lublin: { ...state.regions.lublin, controllerCountryId: "RUSSIA", controllerBlocId: "BRICS" }
      }
    };
    const derived = deriveMapData(captureLublin, geometry, options);
    expect(derived.occupiedBy.size).toBe(1);
    expect(derived.occupiedBy.get("lublin")).toBe("POLAND");
    expect(derived.fillByRegion.get("lublin")).toBe(NATION_COLORS.RUSSIA);
  });

  it("marks front edges only between at-war controllers of different blocs", () => {
    const derived = deriveMapData(state, geometry, options);
    expect(derived.frontEdgeIndexes.length).toBeGreaterThan(0);
    for (const index of derived.frontEdgeIndexes) {
      const edge = geometry.edges[index];
      expect(edge.b).not.toBeNull();
      const a = state.regions[edge.a];
      const b = state.regions[edge.b!];
      expect(a.controllerBlocId).not.toBe(b.controllerBlocId);
      expect(state.countryStates[a.controllerCountryId].atWar, a.id).toBe(true);
      expect(state.countryStates[b.controllerCountryId].atWar, b.id).toBe(true);
    }
  });

  it("leaves Belarus out of the front line at turn 1", () => {
    const derived = deriveMapData(state, geometry, options);
    expect(state.countryStates.BELARUS.atWar).toBe(false);
    for (const index of derived.frontEdgeIndexes) {
      const edge = geometry.edges[index];
      const controllers = [state.regions[edge.a].controllerCountryId, state.regions[edge.b!].controllerCountryId];
      expect(controllers).not.toContain("BELARUS");
    }
  });

  it("finds a front edge between Novorossia and Ukraine", () => {
    const derived = deriveMapData(state, geometry, options);
    const found = derived.frontEdgeIndexes.some((index) => {
      const edge = geometry.edges[index];
      const controllers = [state.regions[edge.a].controllerCountryId, state.regions[edge.b!].controllerCountryId];
      return controllers.includes("NOVOROSSIA") && controllers.includes("UKRAINE");
    });
    expect(found).toBe(true);
  });

  it("picks the majority and secondary country of a stack", () => {
    const stackState: GameState = {
      ...state,
      units: {
        r1: makeUnit("r1", "infantry", "RUSSIA", "BRICS", "moscow"),
        r2: makeUnit("r2", "armor", "RUSSIA", "BRICS", "moscow"),
        b1: makeUnit("b1", "infantry", "BELARUS", "NEUTRAL", "moscow")
      }
    };
    const stack = deriveMapData(stackState, geometry, options).stacks.get("moscow");
    expect(stack).toBeDefined();
    expect(stack!.unitIds).toEqual(["r1", "r2", "b1"]);
    expect(stack!.majorityCountryId).toBe("RUSSIA");
    expect(stack!.secondaryCountryId).toBe("BELARUS");
    expect(stack!.majorityType).toBe("infantry");
  });

  it("merges identical player orders into one arrow and lists holds", () => {
    const orderState: GameState = {
      ...state,
      units: {
        r1: makeUnit("r1", "infantry", "RUSSIA", "BRICS", "moscow"),
        r2: makeUnit("r2", "infantry", "RUSSIA", "BRICS", "moscow"),
        r3: makeUnit("r3", "armor", "RUSSIA", "BRICS", "moscow")
      },
      pendingOrders: {
        ...state.pendingOrders,
        RUSSIA: [
          { unitId: "r1", type: "move", targetRegionId: "smolensk" },
          { unitId: "r2", type: "move", targetRegionId: "smolensk" },
          { unitId: "r3", type: "hold", targetRegionId: "moscow" }
        ]
      }
    };
    const derived = deriveMapData(orderState, geometry, options);
    expect(derived.arrows).toEqual([
      { fromRegionId: "moscow", toRegionId: "smolensk", type: "move", count: 2 }
    ]);
    expect([...derived.holdUnitIds]).toEqual(["r3"]);
  });

  it("lists every unit with a pending order, hold included, for the gold counter edge", () => {
    const orderState: GameState = {
      ...state,
      units: {
        r1: makeUnit("r1", "infantry", "RUSSIA", "BRICS", "moscow"),
        r2: makeUnit("r2", "infantry", "RUSSIA", "BRICS", "moscow"),
        r3: makeUnit("r3", "armor", "RUSSIA", "BRICS", "moscow")
      },
      pendingOrders: {
        ...state.pendingOrders,
        RUSSIA: [
          { unitId: "r1", type: "move", targetRegionId: "smolensk" },
          { unitId: "r3", type: "hold", targetRegionId: "moscow" }
        ]
      }
    };
    expect([...deriveMapData(orderState, geometry, options).orderedUnitIds].sort()).toEqual(["r1", "r3"]);
    expect(deriveMapData(state, geometry, options).orderedUnitIds.size).toBe(0);
  });

  it("only computes supply lines when the overlay is shown", () => {
    expect(deriveMapData(state, geometry, options).supply).toBeNull();
    const withSupply = deriveMapData(state, geometry, { ...options, showSupply: true }).supply;
    expect(withSupply).not.toBeNull();
    const capital = state.countries.RUSSIA.capitalRegionId;
    expect(
      withSupply!.supplied.some(([a, b]) => a === capital || b === capital)
    ).toBe(true);
  });

  it("returns the same object for the same state and overlay", () => {
    const first = deriveMapData(state, geometry, options);
    const second = deriveMapData(state, geometry, options);
    expect(second).toBe(first);
    expect(deriveMapData(state, geometry, { ...options, showSupply: true })).not.toBe(first);
  });
});
