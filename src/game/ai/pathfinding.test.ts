import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { isRegionOpenForCountryTransit } from "../rules/orderResolution";
import type { GameState } from "../state/types";
import {
  buildRouteDistances,
  getRouteDistance,
  getRouteProgress,
  type RouteDistances,
} from "./pathfinding";

function fresh(): GameState {
  return createInitialState("RUSSIA");
}

function findEnemyBorder(state: GameState): { enemyId: string; friendlyId: string } {
  for (const region of Object.values(state.regions)) {
    if (region.controllerCountryId === "RUSSIA") continue;
    if (region.controllerBlocId === "BRICS") continue;

    for (const adjacentId of region.adjacentRegionIds) {
      if (state.regions[adjacentId]?.controllerCountryId === "RUSSIA") {
        return { enemyId: region.id, friendlyId: adjacentId };
      }
    }
  }

  throw new Error("expected Russia to border an enemy region");
}

describe("buildRouteDistances", () => {
  it("seeds a destination at distance 0 and names it as the source", () => {
    const state = fresh();
    const map = buildRouteDistances(state, "RUSSIA", new Set(["moscow"]));

    expect(getRouteDistance(map, "moscow")).toBe(0);
    expect(map.sources.get("moscow")).toBe("moscow");
  });

  it("gives a friendly region adjacent to an enemy-held destination distance 1", () => {
    const state = fresh();
    const { enemyId, friendlyId } = findEnemyBorder(state);
    const map = buildRouteDistances(state, "RUSSIA", new Set([enemyId]));

    expect(getRouteDistance(map, enemyId)).toBe(0);
    expect(getRouteDistance(map, friendlyId)).toBe(1);
    expect(map.sources.get(friendlyId)).toBe(enemyId);
  });

  it("only reaches destinations and legal transit regions", () => {
    const state = fresh();
    const { enemyId } = findEnemyBorder(state);
    const destinations = new Set([enemyId]);
    const map = buildRouteDistances(state, "RUSSIA", destinations);

    for (const regionId of map.distances.keys()) {
      if (destinations.has(regionId)) continue;
      expect(
        isRegionOpenForCountryTransit(state, "RUSSIA", "BRICS", regionId, {
          ignoreStacking: true,
        }),
        `${regionId} should be legal transit`
      ).toBe(true);
    }
  });

  it("does not cross neutral Moldova", () => {
    const state = fresh();
    const moldovaRegions = Object.values(state.regions).filter(
      (region) => region.homeCountryId === "MOLDOVA" && region.controllerCountryId === "MOLDOVA"
    );
    expect(moldovaRegions.length).toBeGreaterThan(0);

    const map = buildRouteDistances(state, "RUSSIA", new Set(["moscow"]));

    for (const region of moldovaRegions) {
      expect(getRouteDistance(map, region.id)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("satisfies the BFS adjacency bound on every reached edge", () => {
    const state = fresh();
    const { enemyId } = findEnemyBorder(state);
    const map = buildRouteDistances(state, "RUSSIA", new Set(["moscow", enemyId]));

    for (const region of Object.values(state.regions)) {
      const distance = map.distances.get(region.id);
      if (distance === undefined) continue;

      for (const adjacentId of region.adjacentRegionIds) {
        const adjacentDistance = map.distances.get(adjacentId);
        if (adjacentDistance === undefined) continue;
        expect(adjacentDistance).toBeLessThanOrEqual(distance + 1);
      }
    }
  });

  it("returns an empty map for an empty destination set", () => {
    const state = fresh();
    const map = buildRouteDistances(state, "RUSSIA", new Set());

    expect(map.distances.size).toBe(0);
    expect(getRouteDistance(map, "moscow")).toBe(Number.POSITIVE_INFINITY);
  });

  it("is deterministic", () => {
    const state = fresh();
    const destinations = new Set(["moscow", "berlin"]);
    const first = buildRouteDistances(state, "RUSSIA", destinations);
    const second = buildRouteDistances(state, "RUSSIA", destinations);

    expect([...first.distances.entries()].sort()).toEqual([...second.distances.entries()].sort());
    expect([...first.sources.entries()].sort()).toEqual([...second.sources.entries()].sort());
  });
});

describe("getRouteProgress", () => {
  const map: RouteDistances = {
    distances: new Map([
      ["a", 2],
      ["b", 1],
      ["c", 2],
    ]),
    sources: new Map(),
  };

  it("is +1 for a step that reduces distance", () => {
    expect(getRouteProgress(map, "a", "b")).toBe(1);
  });

  it("is 0 for a sideways step", () => {
    expect(getRouteProgress(map, "a", "c")).toBe(0);
  });

  it("is negative for a step away", () => {
    expect(getRouteProgress(map, "b", "a")).toBe(-1);
  });

  it("is 0 when either region is unreachable", () => {
    expect(getRouteProgress(map, "missing", "a")).toBe(0);
    expect(getRouteProgress(map, "a", "missing")).toBe(0);
  });
});
