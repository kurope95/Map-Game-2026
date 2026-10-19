import { describe, expect, it } from "vitest";
import { createInitialState } from "./createInitialState";
import { migrateSaveAdjacency } from "./migrateSaveAdjacency";
import type { GameState, RegionDefinition } from "./types";

function withAdjacency(
  region: RegionDefinition,
  patch: (ids: string[]) => string[]
): RegionDefinition {
  return { ...region, adjacentRegionIds: patch([...region.adjacentRegionIds]) };
}

function rewind(region: RegionDefinition): RegionDefinition {
  switch (region.id) {
    case "minsk":
      return withAdjacency(region, (ids) => ids.filter((id) => id !== "vilnius"));
    case "vilnius":
      return withAdjacency(region, (ids) => ids.filter((id) => id !== "minsk"));
    case "moscow":
      return withAdjacency(region, (ids) => (ids.includes("kazan") ? ids : [...ids, "kazan"]));
    case "kazan":
      return withAdjacency(region, (ids) => (ids.includes("moscow") ? ids : [...ids, "moscow"]));
    default:
      return region;
  }
}

/** Rewinds a fresh state to the pre-reshuffle graph: no Minsk–Vilnius, Moscow–Kazan restored. */
function oldGraphState(state: GameState): GameState {
  return {
    ...state,
    regions: Object.fromEntries(Object.entries(state.regions).map(([id, region]) => [id, rewind(region)])),
    scenario: {
      ...state.scenario,
      regions: state.scenario.regions.map(rewind),
    },
  };
}

describe("migrateSaveAdjacency", () => {
  it("restores the current graph on both adjacency maps in an old save", () => {
    const fresh = createInitialState("RUSSIA");
    const old = oldGraphState(fresh);
    expect(old.regions.minsk.adjacentRegionIds).not.toContain("vilnius");
    expect(old.regions.moscow.adjacentRegionIds).toContain("kazan");

    const migrated = migrateSaveAdjacency(old);

    expect(migrated.regions.minsk.adjacentRegionIds).toContain("vilnius");
    expect(migrated.regions.moscow.adjacentRegionIds).not.toContain("kazan");
    const migratedScenarioMinsk = migrated.scenario.regions.find((region) => region.id === "minsk")!;
    expect(migratedScenarioMinsk.adjacentRegionIds).toContain("vilnius");
    const migratedScenarioMoscow = migrated.scenario.regions.find((region) => region.id === "moscow")!;
    expect(migratedScenarioMoscow.adjacentRegionIds).not.toContain("kazan");
  });

  it("never touches campaign state outside the two adjacency graphs", () => {
    const fresh = createInitialState("RUSSIA");
    const old = oldGraphState(fresh);
    const migrated = migrateSaveAdjacency(old);

    expect(migrated.turn).toBe(old.turn);
    expect(migrated.currentActorId).toBe(old.currentActorId);
    expect(migrated.units).toBe(old.units);
    expect(migrated.countryStockpiles).toBe(old.countryStockpiles);
    expect(migrated.regionEconomies).toBe(old.regionEconomies);
    expect(migrated.pendingOrders).toBe(old.pendingOrders);
    expect(migrated.economyBuildOrders).toBe(old.economyBuildOrders);
  });

  it("returns the same state object when the save already has the current graph", () => {
    const fresh = createInitialState("RUSSIA");
    expect(migrateSaveAdjacency(fresh)).toBe(fresh);
  });

  it("keeps the save's region set even if the fresh graph has extra ids", () => {
    const fresh = createInitialState("RUSSIA");
    const { minsk: _removed, ...withoutMinsk } = fresh.regions;
    const trimmed: GameState = { ...fresh, regions: withoutMinsk };
    const migrated = migrateSaveAdjacency(trimmed);
    expect(migrated.regions.minsk).toBeUndefined();
    for (const region of Object.values(migrated.regions)) {
      for (const neighbor of region.adjacentRegionIds) {
        expect(migrated.regions[neighbor], `${region.id} -> ${neighbor}`).toBeDefined();
      }
    }
  });
});
