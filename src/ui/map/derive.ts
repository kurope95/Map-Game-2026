import type {
  CountryId,
  GameState,
  OrderType,
  UnitDefinition,
  UnitType
} from "../../game/state/types";
import type { MapGeometry } from "./geometry/buildMapGeometry";
import { getStartingControllers } from "./startingControllers";
import { NATION_COLORS } from "../theme/palette";

export interface UnitStackInfo {
  regionId: string;
  unitIds: string[];
  majorityCountryId: CountryId;
  secondaryCountryId?: CountryId;
  majorityType: UnitType;
}

export interface OrderArrow {
  fromRegionId: string;
  toRegionId: string;
  type: Exclude<OrderType, "hold">;
  count: number;
}

export interface DerivedMapData {
  /** Controller color per region. */
  fillByRegion: Map<string, string>;
  /** Occupied regions only, mapped to the pre-war controller. */
  occupiedBy: Map<string, CountryId>;
  /** Indexes into `geometry.edges`. */
  frontEdgeIndexes: number[];
  /** Regions holding at least one unit. */
  stacks: Map<string, UnitStackInfo>;
  /** The player's pending orders except hold, merged by from|to|type. */
  arrows: OrderArrow[];
  holdUnitIds: Set<string>;
  supply: { supplied: [string, string][]; unsupplied: [string, string][] } | null;
}

/** Two regions form a front pair when different blocs at war with each other control them. */
export function isFrontPair(state: GameState, regionA: string, regionB: string): boolean {
  const a = state.regions[regionA];
  const b = state.regions[regionB];
  if (!a || !b) return false;
  if (a.controllerCountryId === b.controllerCountryId) return false;
  if (!a.controllerBlocId || !b.controllerBlocId) return false;
  if (a.controllerBlocId === b.controllerBlocId) return false;
  return Boolean(
    state.countryStates[a.controllerCountryId]?.atWar &&
      state.countryStates[b.controllerCountryId]?.atWar
  );
}

function buildStack(regionId: string, units: UnitDefinition[]): UnitStackInfo {
  const countryCounts = new Map<CountryId, number>();
  for (const unit of units) {
    countryCounts.set(unit.countryId, (countryCounts.get(unit.countryId) ?? 0) + 1);
  }

  // Strictly-greater comparison keeps the first unit's country on a tie (insertion order).
  let majorityCountryId = units[0].countryId;
  let majorityCount = 0;
  for (const [countryId, count] of countryCounts) {
    if (count > majorityCount) {
      majorityCountryId = countryId;
      majorityCount = count;
    }
  }

  let secondaryCountryId: CountryId | undefined;
  if (countryCounts.size > 1) {
    let secondaryCount = -1;
    for (const [countryId, count] of countryCounts) {
      if (countryId === majorityCountryId) continue;
      if (count > secondaryCount) {
        secondaryCountryId = countryId;
        secondaryCount = count;
      }
    }
  }

  const typeCounts = new Map<UnitType, number>();
  for (const unit of units) {
    if (unit.countryId !== majorityCountryId) continue;
    typeCounts.set(unit.type, (typeCounts.get(unit.type) ?? 0) + 1);
  }
  let majorityType = units.find((unit) => unit.countryId === majorityCountryId)!.type;
  let typeCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > typeCount) {
      majorityType = type;
      typeCount = count;
    }
  }

  return {
    regionId,
    unitIds: units.map((unit) => unit.id),
    majorityCountryId,
    secondaryCountryId,
    majorityType
  };
}

/** Same BFS as the legacy map's supply overlay: the player's capital and the bloc regions it reaches. */
function deriveSupply(
  state: GameState,
  playerCountryId: CountryId
): { supplied: [string, string][]; unsupplied: [string, string][] } {
  const playerCountry = state.countries[playerCountryId];
  const playerBlocId = playerCountry?.blocId;
  const capitalRegionId = playerCountry?.capitalRegionId;
  if (!playerBlocId || !capitalRegionId) return { supplied: [], unsupplied: [] };

  const suppliedSet = new Set<string>();
  const queue = [capitalRegionId];
  suppliedSet.add(capitalRegionId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const region = state.regions[current];
    if (!region) continue;
    for (const adjacentId of region.adjacentRegionIds) {
      if (suppliedSet.has(adjacentId)) continue;
      const adjacent = state.regions[adjacentId];
      if (!adjacent) continue;
      if (adjacent.controllerBlocId === playerBlocId) {
        suppliedSet.add(adjacentId);
        queue.push(adjacentId);
      }
    }
  }

  const supplied: [string, string][] = [];
  const unsupplied: [string, string][] = [];
  const seen = new Set<string>();
  for (const regionId of suppliedSet) {
    const region = state.regions[regionId];
    if (!region) continue;
    for (const adjacentId of region.adjacentRegionIds) {
      const edgeKey = [regionId, adjacentId].sort().join("::");
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);
      if (suppliedSet.has(adjacentId)) {
        supplied.push([regionId, adjacentId]);
      } else if (state.regions[adjacentId]?.controllerBlocId === playerBlocId) {
        unsupplied.push([regionId, adjacentId]);
      }
    }
  }
  return { supplied, unsupplied };
}

// Rules return a new state for every change, so identity is a safe cache key.
const cache = new WeakMap<GameState, Map<boolean, DerivedMapData>>();

export function deriveMapData(
  state: GameState,
  geometry: Pick<MapGeometry, "edges">,
  opts: { playerCountryId: CountryId; showSupply: boolean }
): DerivedMapData {
  let bySupply = cache.get(state);
  if (!bySupply) {
    bySupply = new Map();
    cache.set(state, bySupply);
  }
  const cached = bySupply.get(opts.showSupply);
  if (cached) return cached;

  const startingControllers = getStartingControllers(state);
  const fillByRegion = new Map<string, string>();
  const occupiedBy = new Map<string, CountryId>();
  for (const region of Object.values(state.regions)) {
    fillByRegion.set(region.id, NATION_COLORS[region.controllerCountryId]);
    const preWar = startingControllers[region.id];
    if (preWar !== undefined && preWar !== region.controllerCountryId) {
      occupiedBy.set(region.id, preWar);
    }
  }

  const frontEdgeIndexes: number[] = [];
  geometry.edges.forEach((edge, index) => {
    if (edge.b !== null && isFrontPair(state, edge.a, edge.b)) {
      frontEdgeIndexes.push(index);
    }
  });

  const unitsByRegion = new Map<string, UnitDefinition[]>();
  for (const unit of Object.values(state.units)) {
    const list = unitsByRegion.get(unit.regionId) ?? [];
    list.push(unit);
    unitsByRegion.set(unit.regionId, list);
  }
  const stacks = new Map<string, UnitStackInfo>();
  for (const [regionId, units] of unitsByRegion) {
    stacks.set(regionId, buildStack(regionId, units));
  }

  const arrows: OrderArrow[] = [];
  const arrowByKey = new Map<string, OrderArrow>();
  const holdUnitIds = new Set<string>();
  for (const order of state.pendingOrders[opts.playerCountryId] ?? []) {
    if (order.type === "hold") {
      holdUnitIds.add(order.unitId);
      continue;
    }
    const unit = state.units[order.unitId];
    if (!unit) continue;
    const key = `${unit.regionId}|${order.targetRegionId}|${order.type}`;
    const existing = arrowByKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const arrow: OrderArrow = {
        fromRegionId: unit.regionId,
        toRegionId: order.targetRegionId,
        type: order.type,
        count: 1
      };
      arrowByKey.set(key, arrow);
      arrows.push(arrow);
    }
  }

  const data: DerivedMapData = {
    fillByRegion,
    occupiedBy,
    frontEdgeIndexes,
    stacks,
    arrows,
    holdUnitIds,
    supply: opts.showSupply ? deriveSupply(state, opts.playerCountryId) : null
  };
  bySupply.set(opts.showSupply, data);
  return data;
}
