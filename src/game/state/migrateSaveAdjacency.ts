import { createInitialState } from "./createInitialState";
import type { GameState, RegionDefinition } from "./types";

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Rebuilds both adjacency graphs in a loaded save from the current scenario content.
 *
 * Saves serialize adjacency, so a noding change would otherwise leave old campaigns on the old
 * graph. Only `adjacentRegionIds` is replaced: ownership, units, economy and orders are untouched.
 * Ids missing from the save are dropped from the rebuilt lists, and regions missing from the
 * current content keep their saved adjacency. Returns the same state object when nothing changed.
 */
export function migrateSaveAdjacency(state: GameState): GameState {
  const fresh = createInitialState(state.playerCountryId);
  const freshById = new Map(fresh.scenario.regions.map((region) => [region.id, region]));
  const knownIds = new Set(Object.keys(state.regions));

  let changed = false;

  const migrate = (region: RegionDefinition): RegionDefinition => {
    const source = freshById.get(region.id);
    if (!source) return region;
    const nextIds = source.adjacentRegionIds.filter((id) => knownIds.has(id));
    if (sameIds(region.adjacentRegionIds, nextIds)) return region;
    changed = true;
    return { ...region, adjacentRegionIds: nextIds };
  };

  const regions = Object.fromEntries(
    Object.entries(state.regions).map(([id, region]) => [id, migrate(region)])
  );
  const scenarioRegions = state.scenario.regions.map(migrate);

  if (!changed) return state;

  return {
    ...state,
    regions,
    scenario: { ...state.scenario, regions: scenarioRegions },
  };
}
