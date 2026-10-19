import { getValidTargets, issueOrder } from "../rules/orderResolution";
import { BlocId, CountryId, DiplomacyActionType, FacilityType, GameState, Order, StockpileKey, UnitType } from "../state/types";
import {
  FACILITY_BUILD_COSTS,
  FORTIFICATION_MAX_LEVEL,
  UNIT_RECRUITMENT_COSTS,
  getFacilityRepairProfile,
  getFortificationBuildProfile,
  getFortificationRepairProfile,
  getMilitaryProductionTurns,
} from "../content/economyRecipes";
import { applyDiplomacyAction, getCountryLeanBloc } from "../rules/diplomacy";
import { AI_COUNTRY_PROFILES, AI_NATIONAL_GOALS, AI_ROUTE_WEIGHTS, AI_STRATEGY_WEIGHTS } from "../content/aiObjectives";
import { recordAllyAttackClaims, shouldDeferAttackToAlly } from "./allyCoordination";
import { buildRouteDistances, getRouteProgress, type RouteDistances } from "./pathfinding";

export interface BotAction {
  unitId: string;
  orderType: "move" | "attack" | "hold" | "airSupport" | "bombard" | "missileStrike";
  fromRegionId: string;
  targetRegionId: string;
  score: number;
  reasons: string[];
}

export interface BotDecision {
  type: "hold" | "aggressive" | "cautious";
  actions: BotAction[];
  reasoning: string;
}

function deterministicNoise(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return Math.max(0, Math.min(1, normalized));
}

function clampPriority(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildNationalGoalSet(state: GameState, countryId: CountryId): Set<string> {
  const configured = AI_NATIONAL_GOALS[countryId] ?? [];
  return new Set(configured.filter((regionId) => state.regions[regionId] !== undefined));
}

/** True when the country holds the region and no adjacent enemy can attack it. */
function isRearRegion(state: GameState, countryId: CountryId, regionId: string): boolean {
  const blocId = state.countries[countryId]?.blocId;
  const region = state.regions[regionId];
  if (!region) return false;

  return !region.adjacentRegionIds.some((adjacentId) => {
    const adjacent = state.regions[adjacentId];
    return (
      adjacent.controllerBlocId !== undefined &&
      adjacent.controllerBlocId !== blocId &&
      state.countryStates[adjacent.controllerCountryId]?.atWar === true
    );
  });
}

function buildNationalGoalPriorityMap(state: GameState, countryId: CountryId): Map<string, number> {
  const configured = AI_NATIONAL_GOALS[countryId] ?? [];
  const validGoals = configured.filter((regionId) => state.regions[regionId] !== undefined);
  const totalGoals = Math.max(1, validGoals.length);
  const priorities = new Map<string, number>();

  validGoals.forEach((regionId, index) => {
    const progress = (totalGoals - index) / totalGoals;
    priorities.set(regionId, Math.round(40 + progress * 60));
  });

  return priorities;
}

function getUnresolvedNationalGoals(state: GameState, countryId: CountryId, nationalGoalSet: Set<string>): Set<string> {
  const unresolved = new Set<string>();
  for (const goalRegionId of nationalGoalSet) {
    if (state.regions[goalRegionId]?.controllerCountryId !== countryId) {
      unresolved.add(goalRegionId);
    }
  }
  return unresolved;
}

function evaluateKeyNodePriority(
  state: GameState,
  countryId: CountryId,
  targetRegionId: string,
  orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike"
) {
  const target = state.regions[targetRegionId];
  if (!target) return { value: 0, reasons: [] as string[] };

  const reasons: string[] = [];
  let value = 15;

  if (target.isCapital) {
    value += 35;
    reasons.push("Capital key-node value.");
  } else if (target.isKeyCity) {
    value += 26;
    reasons.push("Key-city logistical value.");
  }

  if (target.homeCountryId === countryId && target.controllerCountryId !== countryId) {
    value += 30;
    reasons.push("Recapture own strategic node.");
  }

  if (orderType === "move" && target.controllerCountryId === countryId && (target.isCapital || target.isKeyCity)) {
    value += 18;
    reasons.push("Secure owned key node.");
  }

  if (
    target.adjacentRegionIds.some((adjacentId) => {
      const adjacent = state.regions[adjacentId];
      return adjacent && adjacent.controllerCountryId === countryId && (adjacent.isCapital || adjacent.isKeyCity);
    })
  ) {
    value += 12;
    reasons.push("Supports key-node buffer zone.");
  }

  return { value: clampPriority(value), reasons };
}

function evaluateNationalGoalPriority(
  state: GameState,
  countryId: CountryId,
  fromRegionId: string,
  targetRegionId: string,
  orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike",
  unresolvedNationalGoals: Set<string>,
  nationalGoalPriorityMap: Map<string, number>,
  routeDistances: RouteDistances
) {
  const target = state.regions[targetRegionId];
  if (!target) return { value: 0, reasons: [] as string[] };

  const reasons: string[] = [];
  let value = 10;
  const directGoalPriority = nationalGoalPriorityMap.get(targetRegionId) ?? 0;
  const adjacentGoalPriority = target.adjacentRegionIds.reduce((highest, adjacentId) => {
    if (!unresolvedNationalGoals.has(adjacentId)) return highest;
    return Math.max(highest, nationalGoalPriorityMap.get(adjacentId) ?? 0);
  }, 0);

  if (unresolvedNationalGoals.has(targetRegionId)) {
    value += orderType === "attack"
      ? 28 + directGoalPriority * 0.6
      : 18 + directGoalPriority * 0.45;
    reasons.push(`Direct national-goal target (priority ${directGoalPriority}).`);
  } else if (adjacentGoalPriority > 0) {
    value += orderType === "move"
      ? 14 + adjacentGoalPriority * 0.38
      : 8 + adjacentGoalPriority * 0.26;
    reasons.push(`Approach route to national-goal target (priority ${adjacentGoalPriority}).`);
  } else if (target.controllerCountryId === countryId) {
    value += 8;
    reasons.push("Consolidate currently held objective belt.");
  }

  if (orderType === "move" && isRearRegion(state, countryId, fromRegionId)) {
    const progress = getRouteProgress(routeDistances, fromRegionId, targetRegionId);
    if (progress > 0) {
      const sourceId = routeDistances.sources.get(targetRegionId);
      const sourcePriority = sourceId ? (nationalGoalPriorityMap.get(sourceId) ?? 55) : 55;
      const sourceName = sourceId ? (state.regions[sourceId]?.name ?? sourceId) : "national objective";
      value += AI_ROUTE_WEIGHTS.nationalGoalProgress * progress * (sourcePriority / 100);
      reasons.push(`Route step closes ${progress} hop${progress === 1 ? "" : "s"} on ${sourceName}.`);
    }
  }

  return { value: clampPriority(value), reasons };
}

function evaluateAllySupportPriority(
  state: GameState,
  countryId: CountryId,
  fromRegionId: string,
  targetRegionId: string,
  orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike",
  allyDefenseGoals: Set<string>,
  routeDistances: RouteDistances
) {
  const target = state.regions[targetRegionId];
  if (!target || allyDefenseGoals.size === 0) return { value: 0, reasons: [] as string[] };

  const blocId = state.countries[countryId].blocId;
  const reasons: string[] = [];
  let value = 0;
  const alliedControlled = target.controllerBlocId === blocId && target.controllerCountryId !== countryId;
  const adjacentToAllyGoal = target.adjacentRegionIds.some((adjacentId) => allyDefenseGoals.has(adjacentId));

  if (alliedControlled && allyDefenseGoals.has(targetRegionId) && orderType === "move") {
    value += 82;
    reasons.push("Reinforce allied shield objective.");
  } else if (adjacentToAllyGoal && alliedControlled && orderType === "move") {
    value += 54;
    reasons.push("Approach route to allied shield objective.");
  } else if (
    !alliedControlled &&
    (orderType === "attack" || orderType === "bombard" || orderType === "missileStrike") &&
    adjacentToAllyGoal
  ) {
    value += 64;
    reasons.push("Break enemy pressure on allied shield objective.");
  }

  if (orderType === "move" && isRearRegion(state, countryId, fromRegionId)) {
    const progress = getRouteProgress(routeDistances, fromRegionId, targetRegionId);
    if (progress > 0) {
      const sourceId = routeDistances.sources.get(targetRegionId);
      const sourceName = sourceId
        ? (state.regions[sourceId]?.name ?? sourceId)
        : "allied shield objective";
      value += AI_ROUTE_WEIGHTS.allyGoalProgress * progress;
      reasons.push(`Route step closes ${progress} hop${progress === 1 ? "" : "s"} on ${sourceName}.`);
    }
  }

  return { value: clampPriority(value), reasons };
}

function evaluateHomelandPriority(
  state: GameState,
  countryId: CountryId,
  fromRegionId: string,
  targetRegionId: string,
  orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike",
  suppliedRegionIds: Set<string>,
  routeDistances: RouteDistances
) {
  const target = state.regions[targetRegionId];
  if (!target) return { value: 0, reasons: [] as string[] };

  const country = state.countries[countryId];
  const homelandSet = new Set(country.startingRegionIds.filter((regionId) => state.regions[regionId] !== undefined));
  const controlledByCountry = target.controllerCountryId === countryId;
  const ownedRegionIds = Object.values(state.regions)
    .filter((region) => region.controllerCountryId === countryId)
    .map((region) => region.id);
  const unsuppliedOwned = ownedRegionIds.filter((regionId) => !suppliedRegionIds.has(regionId));

  const reasons: string[] = [];
  let value = 12;

  if (homelandSet.has(targetRegionId)) {
    if (!controlledByCountry) {
      value += orderType === "attack" ? 72 : 56;
      reasons.push("Retake lost starting territory.");
    } else {
      value += 24;
      reasons.push("Defend controlled starting territory.");
    }
  }

  if (
    target.adjacentRegionIds.some((adjacentId) => homelandSet.has(adjacentId) && state.regions[adjacentId].controllerCountryId !== countryId)
  ) {
    value += orderType === "move" ? 36 : 24;
    reasons.push("Approach route toward lost homeland.");
  }

  if (
    controlledByCountry &&
    suppliedRegionIds.has(targetRegionId) &&
    target.adjacentRegionIds.some((adjacentId) => unsuppliedOwned.includes(adjacentId))
  ) {
    value += 40;
    reasons.push("Bridge node to reconnect cut-off territory.");
  }

  if (unsuppliedOwned.includes(targetRegionId) && orderType === "move") {
    value += 32;
    reasons.push("Reinforce isolated owned region.");
  }

  if (
    !controlledByCountry &&
    (orderType === "attack" || orderType === "bombard" || orderType === "missileStrike") &&
    target.adjacentRegionIds.some((adjacentId) => unsuppliedOwned.includes(adjacentId))
  ) {
    value += 28;
    reasons.push("Break encirclement around isolated territory.");
  }

  if (orderType === "move" && isRearRegion(state, countryId, fromRegionId)) {
    const progress = getRouteProgress(routeDistances, fromRegionId, targetRegionId);
    if (progress > 0) {
      const sourceId = routeDistances.sources.get(targetRegionId);
      const sourceName = sourceId
        ? (state.regions[sourceId]?.name ?? sourceId)
        : "lost homeland";
      value += AI_ROUTE_WEIGHTS.homelandProgress * progress;
      reasons.push(`Route step closes ${progress} hop${progress === 1 ? "" : "s"} on ${sourceName}.`);
    }
  }

  return { value: clampPriority(value), reasons };
}

interface StrategicRouteDistances {
  nationalGoals: RouteDistances;
  allyGoals: RouteDistances;
  homeland: RouteDistances;
}

function buildStrategicAdjustment(
  state: GameState,
  countryId: CountryId,
  unitId: string,
  fromRegionId: string,
  targetRegionId: string,
  orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike",
  unresolvedNationalGoals: Set<string>,
  suppliedRegionIds: Set<string>,
  nationalGoalPriorityMap: Map<string, number>,
  routeDistances: StrategicRouteDistances
) {
  const profile = AI_COUNTRY_PROFILES[countryId];
  const allyDefenseGoals = new Set((profile?.allyDefenseGoals ?? []).filter((regionId) => state.regions[regionId] !== undefined));
  const homeland = evaluateHomelandPriority(state, countryId, fromRegionId, targetRegionId, orderType, suppliedRegionIds, routeDistances.homeland);
  const keyNode = evaluateKeyNodePriority(state, countryId, targetRegionId, orderType);
  const nationalGoal = evaluateNationalGoalPriority(state, countryId, fromRegionId, targetRegionId, orderType, unresolvedNationalGoals, nationalGoalPriorityMap, routeDistances.nationalGoals);
  const allySupport = evaluateAllySupportPriority(state, countryId, fromRegionId, targetRegionId, orderType, allyDefenseGoals, routeDistances.allyGoals);
  const randomPriority = deterministicNoise(`${state.turn}|${countryId}|${unitId}|${fromRegionId}|${targetRegionId}|${orderType}`) * 100;
  const weightedPriority =
    homeland.value * AI_STRATEGY_WEIGHTS.homelandCohesion +
    keyNode.value * AI_STRATEGY_WEIGHTS.keyNodeSecurity +
    nationalGoal.value * AI_STRATEGY_WEIGHTS.nationalGoals +
    randomPriority * AI_STRATEGY_WEIGHTS.randomness;
  const adjustment = (weightedPriority - 50) * 0.6 + allySupport.value * 0.35;

  const reasons = [
    ...homeland.reasons.map((reason) => `Homeland cohesion: ${reason}`),
    ...keyNode.reasons.map((reason) => `Key-node focus: ${reason}`),
    ...nationalGoal.reasons.map((reason) => `National goal: ${reason}`),
    ...allySupport.reasons.map((reason) => `Ally support: ${reason}`),
    `Strategic mix H${Math.round(homeland.value)} / G${Math.round(nationalGoal.value)} / K${Math.round(keyNode.value)} / A${Math.round(allySupport.value)} / R${Math.round(randomPriority)} -> ${adjustment >= 0 ? "+" : ""}${Math.round(adjustment)}.`,
  ];

  return { adjustment, reasons };
}

function canAffordWithReserve(state: GameState, countryId: CountryId, cost: Partial<Record<string, number>>) {
  const stockpile = state.countryStockpiles[countryId];
  const reserves = { steel: 2, food: 5 };

  for (const [key, amount] of Object.entries(cost)) {
    const reserve = key === "steel" ? reserves.steel : key === "food" ? reserves.food : 0;
    const available = stockpile[key as keyof typeof stockpile];
    if (available - (amount ?? 0) < reserve) {
      return false;
    }
  }

  return true;
}

function queueEconomyOrder(state: GameState, countryId: CountryId, order: GameState["economyBuildOrders"][CountryId][number]) {
  const stockpile = { ...state.countryStockpiles[countryId] };
  for (const [key, amount] of Object.entries(order.committed)) {
    stockpile[key as keyof typeof stockpile] -= amount ?? 0;
  }

  return {
    ...state,
    countryStockpiles: {
      ...state.countryStockpiles,
      [countryId]: stockpile,
    },
    economyBuildOrders: {
      ...state.economyBuildOrders,
      [countryId]: [...(state.economyBuildOrders[countryId] ?? []), order],
    },
  };
}

function createEconomyOrder(
  countryId: CountryId,
  regionId: string,
  turns: number,
  committed: Partial<Record<string, number>>,
  details:
    | {
        type: "buildFacility";
        facilityType: NonNullable<GameState["economyBuildOrders"][CountryId][number]["facilityType"]>;
        chemicalMode?: GameState["economyBuildOrders"][CountryId][number]["chemicalMode"];
      }
    | { type: "recruitUnit"; unitType: NonNullable<GameState["economyBuildOrders"][CountryId][number]["unitType"]> }
    | { type: "repairFacility"; facilityId: NonNullable<GameState["economyBuildOrders"][CountryId][number]["facilityId"]> }
    | { type: "buildFortification" }
    | { type: "upgradeFortification" }
    | { type: "repairFortification" }
): GameState["economyBuildOrders"][CountryId][number] {
  return {
    id: `ai-${countryId.toLowerCase()}-${details.type}-${Math.random().toString(36).slice(2, 7)}`,
    countryId,
    regionId,
    turnsRemaining: turns,
    totalTurns: turns,
    committed,
    ...details,
  };
}

function getFacilityRecipe(facilityType: FacilityType) {
  return FACILITY_BUILD_COSTS.find((entry) => entry.facilityType === facilityType);
}

function getUnitRecipe(unitType: UnitType) {
  return UNIT_RECRUITMENT_COSTS.find((entry) => entry.unitType === unitType);
}

function getSuppliedRegionIds(state: GameState, countryId: CountryId): Set<string> {
  const blocId = state.countries[countryId].blocId;
  const capitalRegionId = state.countries[countryId].capitalRegionId;
  const capitalRegion = state.regions[capitalRegionId];

  if (!blocId || !capitalRegion || capitalRegion.controllerBlocId !== blocId) {
    return new Set<string>();
  }

  const supplied = new Set<string>();
  const queue = [capitalRegionId];

  while (queue.length > 0) {
    const regionId = queue.shift()!;
    if (supplied.has(regionId)) continue;

    const region = state.regions[regionId];
    if (region.controllerBlocId !== blocId) continue;

    supplied.add(regionId);

    for (const adjacentId of region.adjacentRegionIds) {
      const adjacent = state.regions[adjacentId];
      if (!supplied.has(adjacentId) && adjacent.controllerBlocId === blocId) {
        queue.push(adjacentId);
      }
    }
  }

  return supplied;
}

export function aiEconomyTurn(state: GameState, countryId: CountryId): GameState {
  let currentState = state;
  const profile = AI_COUNTRY_PROFILES[countryId];

  const country = state.countries[countryId];
  const maxQueues = country.tier === "major" ? 4 : country.tier === "middle" ? 3 : 2;

  // Loop to fill all available queue slots instead of returning after one action
  for (let iteration = 0; iteration < maxQueues; iteration++) {
    const stockpile = currentState.countryStockpiles[countryId];
    const atWar = currentState.countryStates[countryId].atWar;
    const leaningBloc = getCountryLeanBloc(currentState, countryId);
    const militaryPreparationAllowed =
      atWar ||
      country.alignment === "aligned_non_belligerent" ||
      (country.alignment === "neutral" && leaningBloc !== undefined);
    const myRegionIds = Object.values(currentState.regions)
      .filter((region) => region.controllerCountryId === countryId)
      .map((region) => region.id);
    const myEconomies = myRegionIds
      .map((regionId) => ({ regionId, economy: currentState.regionEconomies[regionId] }))
      .filter((entry) => entry.economy !== undefined);
    const myUnits = Object.values(currentState.units).filter((unit) => unit.countryId === countryId);
    const pendingBuilds = currentState.economyBuildOrders[countryId] ?? [];

    if (pendingBuilds.length >= maxQueues) {
      break;
    }

    const findBuildRegion = (predicate: (regionId: string) => boolean) =>
      myEconomies
        .filter(({ regionId, economy }) => predicate(regionId) && economy.facilities.length < economy.buildingSlots)
        .sort((left, right) => right.economy.buildingSlots - left.economy.buildingSlots)[0];

    const findRecruitRegion = (facilityType: FacilityType) =>
      myEconomies
        .filter(({ economy }) => economy.facilities.some((facility) => facility.type === facilityType && !facility.damaged))
        .sort((left, right) => {
          const leftLevel = Math.max(
            ...left.economy.facilities.filter((facility) => facility.type === facilityType && !facility.damaged).map((facility) => facility.level),
            0
          );
          const rightLevel = Math.max(
            ...right.economy.facilities.filter((facility) => facility.type === facilityType && !facility.damaged).map((facility) => facility.level),
            0
          );
          return rightLevel - leftLevel || right.economy.facilities.length - left.economy.facilities.length;
        })[0];

    const regionHasDeposit = (regionId: string, resourceType: StockpileKey) =>
      currentState.regionEconomies[regionId].resourceDeposits.some((deposit) => deposit.type === resourceType);

    const countFacilities = (
      facilityType: FacilityType,
      predicate?: (facility: { type: FacilityType; chemicalMode?: "fertilizer" | "explosives" }) => boolean
    ) => {
      const builtCount = myEconomies.reduce((sum, { economy }) => (
        sum + economy.facilities.filter((facility) => facility.type === facilityType && (!predicate || predicate(facility))).length
      ), 0);
      const pendingCount = pendingBuilds.filter((order) => (
        order.type === "buildFacility" &&
        order.facilityType === facilityType &&
        (!predicate || predicate({ type: facilityType, chemicalMode: order.chemicalMode }))
      )).length;
      return builtCount + pendingCount;
    };

    const hasFacility = (
      facilityType: FacilityType,
      predicate?: (facility: { type: FacilityType; chemicalMode?: "fertilizer" | "explosives" }) => boolean
    ) => countFacilities(facilityType, predicate) > 0;

    const foodThreshold = Math.max(8, myUnits.length * 2 + myRegionIds.length);
    const hasPowerPlant = hasFacility("powerPlant");
    const hasBarracks = hasFacility("barracks");
    const hasMine = hasFacility("mine");
    const hasSmelter = hasFacility("smelter");
    const hasOilWell = hasFacility("oilWell");
    const hasRefinery = hasFacility("refinery");
    const hasArmorFactory = hasFacility("armorFactory");
    const hasAirFactory = hasFacility("airFactory");
    const hasExplosivesPlant = hasFacility("chemicalPlant", (facility) => facility.chemicalMode === "explosives");
    const hasFertilizerPlant = hasFacility("chemicalPlant", (facility) => facility.chemicalMode !== "explosives");
    const farmCount = countFacilities("farm");
    const infantryCount = myUnits.filter((unit) => unit.type === "infantry").length;
    const armorCount = myUnits.filter((unit) => unit.type === "armor").length;
    const fighterCount = myUnits.filter((unit) => unit.type === "fighter").length;
    const mlrsCount = myUnits.filter((unit) => unit.type === "mlrs").length;
    const pendingInfantry = pendingBuilds.filter((order) => order.type === "recruitUnit" && order.unitType === "infantry").length;
    const pendingArmor = pendingBuilds.filter((order) => order.type === "recruitUnit" && order.unitType === "armor").length;
    const pendingFighters = pendingBuilds.filter((order) => order.type === "recruitUnit" && order.unitType === "fighter").length;
    const pendingMlrs = pendingBuilds.filter((order) => order.type === "recruitUnit" && order.unitType === "mlrs").length;
    const effectiveInfantryCount = infantryCount + pendingInfantry;
    const effectiveArmorCount = armorCount + pendingArmor;
    const effectiveFighterCount = fighterCount + pendingFighters;
    const effectiveMlrsCount = mlrsCount + pendingMlrs;
    const frontlineRegionIds = myRegionIds.filter((regionId) =>
      currentState.regions[regionId].adjacentRegionIds.some((adjacentId) => {
        const adjacent = currentState.regions[adjacentId];
        return adjacent.controllerBlocId !== undefined
          && adjacent.controllerBlocId !== country.blocId
          && currentState.countryStates[adjacent.controllerCountryId].atWar;
      })
    );
    const frontlinePressure = frontlineRegionIds.reduce((sum, regionId) => {
      const hostileAdjacency = currentState.regions[regionId].adjacentRegionIds.filter((adjacentId) => {
        const adjacent = currentState.regions[adjacentId];
        return adjacent.controllerBlocId !== undefined
          && adjacent.controllerBlocId !== country.blocId
          && currentState.countryStates[adjacent.controllerCountryId].atWar;
      }).length;
      return sum + hostileAdjacency;
    }, 0);
    const threatenedCoreRegions = frontlineRegionIds.filter((regionId) => {
      const region = currentState.regions[regionId];
      return region.isCapital || region.isKeyCity;
    }).length;
    const baseInfantryTarget = !militaryPreparationAllowed
      ? 0
      : country.tier === "major"
        ? 6
        : country.tier === "middle"
          ? 4
          : 2;
    const infantryTargetBonus = profile?.infantryTargetBonus ?? 0;
    const armorTargetBonus = profile?.armorTargetBonus ?? 0;
    const desiredInfantry = Math.max(
      baseInfantryTarget + infantryTargetBonus,
      baseInfantryTarget + infantryTargetBonus + frontlineRegionIds.length + threatenedCoreRegions
    );
    const desiredArmor = militaryPreparationAllowed && country.tier === "major"
      ? (frontlinePressure >= 4 ? 2 : 1) + armorTargetBonus
      : militaryPreparationAllowed && country.tier === "middle"
        ? (frontlinePressure >= 3 ? 1 : 0)
        : 0;
    const desiredFighters = country.tier === "major" && atWar ? (frontlinePressure >= 5 ? 2 : 1) : 0;
    const desiredMlrs = militaryPreparationAllowed && atWar
      ? (country.tier === "major" ? Math.min(3, 1 + Math.floor(frontlinePressure / 3)) : frontlinePressure >= 4 ? 1 : 0)
      : 0;
    const wantsHeavyIndustry = country.tier !== "minor" && militaryPreparationAllowed;
    const needsSteel = stockpile.steel < 8 || (!hasSmelter && myRegionIds.some((regionId) => regionHasDeposit(regionId, "iron")));
    const needsFuel = wantsHeavyIndustry && (stockpile.fuel < 4 || (!hasRefinery && myRegionIds.some((regionId) => regionHasDeposit(regionId, "oil"))));
    const needsMunitions = stockpile.munitions < 6;
    const foodDepositCount = myRegionIds.filter((regionId) => regionHasDeposit(regionId, "food")).length;
    const desiredFarmCount = Math.max(1, Math.min(country.tier === "major" ? 3 : 2, foodDepositCount || 1));
    const totalSlotsRemaining = myEconomies.reduce(
      (sum, { economy }) => sum + Math.max(0, economy.buildingSlots - economy.facilities.length),
      0
    );
    const needsImmediateFrontlineReinforcement = atWar && militaryPreparationAllowed && effectiveInfantryCount < Math.max(3, frontlineRegionIds.length + threatenedCoreRegions + 1);
    const pendingRepairIds = new Set(
      pendingBuilds
        .filter((order) => order.type === "repairFacility" && order.facilityId)
        .map((order) => order.facilityId!)
    );
    const pendingFortOrderTypes = new Set(
      pendingBuilds
        .filter((order) => order.type === "buildFortification" || order.type === "upgradeFortification" || order.type === "repairFortification")
        .map((order) => `${order.regionId}:${order.type}`)
    );
    const damagedFacilities = myEconomies.flatMap(({ regionId, economy }) =>
      economy.facilities
        .filter((facility) => facility.damaged && !pendingRepairIds.has(facility.id))
        .map((facility) => ({ regionId, facility }))
    );
    const frontlineFortNeeds = frontlineRegionIds
      .map((regionId) => ({ regionId, economy: currentState.regionEconomies[regionId], region: currentState.regions[regionId] }))
      .filter((entry) => entry.economy !== undefined)
      .sort((left, right) => {
        const leftThreat = left.region.adjacentRegionIds.filter((adjacentId) => {
          const adjacent = currentState.regions[adjacentId];
          return adjacent.controllerBlocId !== undefined && adjacent.controllerBlocId !== country.blocId && currentState.countryStates[adjacent.controllerCountryId].atWar;
        }).length + (left.region.isCapital || left.region.isKeyCity ? 1 : 0);
        const rightThreat = right.region.adjacentRegionIds.filter((adjacentId) => {
          const adjacent = currentState.regions[adjacentId];
          return adjacent.controllerBlocId !== undefined && adjacent.controllerBlocId !== country.blocId && currentState.countryStates[adjacent.controllerCountryId].atWar;
        }).length + (right.region.isCapital || right.region.isKeyCity ? 1 : 0);
        return rightThreat - leftThreat;
      });

    const buildFacility = (
      facilityType: NonNullable<GameState["economyBuildOrders"][CountryId][number]["facilityType"]>,
      regionId: string,
      chemicalMode?: GameState["economyBuildOrders"][CountryId][number]["chemicalMode"]
    ) => {
      const recipe = getFacilityRecipe(facilityType);
      if (!recipe || !canAffordWithReserve(currentState, countryId, recipe.cost)) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(countryId, regionId, recipe.turns, { ...recipe.cost }, { type: "buildFacility", facilityType, chemicalMode })
      );
    };

    const recruitUnit = (unitType: NonNullable<GameState["economyBuildOrders"][CountryId][number]["unitType"]>, regionId: string) => {
      const recipe = getUnitRecipe(unitType);
      if (!recipe || !canAffordWithReserve(currentState, countryId, recipe.cost)) return null;
      const sourceFacility = currentState.regionEconomies[regionId]?.facilities
        .filter((facility) => facility.type === recipe.requiredFacility && !facility.damaged)
        .sort((left, right) => right.level - left.level)[0];
      if (!sourceFacility) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(
          countryId,
          regionId,
          getMilitaryProductionTurns(recipe.turns, sourceFacility.level),
          { ...recipe.cost },
          { type: "recruitUnit", unitType }
        )
      );
    };

    const repairFacility = (regionId: string, facilityId: string, facilityType: FacilityType, facilityLevel: number) => {
      const repairProfile = getFacilityRepairProfile(facilityType, facilityLevel);
      if (!repairProfile || !canAffordWithReserve(currentState, countryId, repairProfile.cost)) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(countryId, regionId, repairProfile.turns, { ...repairProfile.cost }, { type: "repairFacility", facilityId })
      );
    };

    const buildFortification = (regionId: string) => {
      const buildProfile = getFortificationBuildProfile(1);
      if (!buildProfile || !canAffordWithReserve(currentState, countryId, buildProfile.cost)) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(countryId, regionId, buildProfile.turns, { ...buildProfile.cost }, { type: "buildFortification" })
      );
    };

    const upgradeFortification = (regionId: string, level: number) => {
      const buildProfile = getFortificationBuildProfile(level + 1);
      if (!buildProfile || !canAffordWithReserve(currentState, countryId, buildProfile.cost)) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(countryId, regionId, buildProfile.turns, { ...buildProfile.cost }, { type: "upgradeFortification" })
      );
    };

    const repairFortification = (regionId: string, level: number, health: number, maxHealth: number) => {
      const repairProfile = getFortificationRepairProfile(level, health, maxHealth);
      if (!repairProfile || !canAffordWithReserve(currentState, countryId, repairProfile.cost)) return null;
      return queueEconomyOrder(
        currentState,
        countryId,
        createEconomyOrder(countryId, regionId, repairProfile.turns, { ...repairProfile.cost }, { type: "repairFortification" })
      );
    };

    // Priority-ordered build decisions — try each in order, take the first that succeeds
    let nextState: GameState | null = null;

    if (!nextState && !hasPowerPlant) {
      const powerRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "coal"))
        ?? findBuildRegion(() => true);
      if (powerRegion) nextState = buildFacility("powerPlant", powerRegion.regionId);
    }

    if (!nextState) {
      const damagedMilitaryFacility = damagedFacilities.find(({ facility }) =>
        facility.type === "barracks" ||
        facility.type === "armorFactory" ||
        facility.type === "airFactory" ||
        facility.type === "munitionsPlant"
      );
      if (damagedMilitaryFacility) {
        nextState = repairFacility(
          damagedMilitaryFacility.regionId,
          damagedMilitaryFacility.facility.id,
          damagedMilitaryFacility.facility.type,
          damagedMilitaryFacility.facility.level
        );
      }
    }

    if (!nextState && (!hasFacility("farm") || (stockpile.food < foodThreshold && farmCount < desiredFarmCount))) {
      const farmRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "food"));
      if (farmRegion) nextState = buildFacility("farm", farmRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && !hasBarracks) {
      nextState = buildFacility("barracks", country.capitalRegionId);
    }

    if (!nextState && atWar) {
      const damagedFrontFort = frontlineFortNeeds.find(({ regionId, economy }) =>
        economy.fortification &&
        economy.fortification.health < economy.fortification.maxHealth &&
        !pendingFortOrderTypes.has(`${regionId}:repairFortification`)
      );
      if (damagedFrontFort) {
        nextState = repairFortification(
          damagedFrontFort.regionId,
          damagedFrontFort.economy.fortification!.level,
          damagedFrontFort.economy.fortification!.health,
          damagedFrontFort.economy.fortification!.maxHealth
        );
      }
    }

    if (!nextState && atWar) {
      const unfortifiedFront = frontlineFortNeeds.find(({ regionId, economy }) =>
        !economy.fortification && !pendingFortOrderTypes.has(`${regionId}:buildFortification`)
      );
      if (unfortifiedFront) {
        nextState = buildFortification(unfortifiedFront.regionId);
      }
    }

    if (!nextState && atWar) {
      const upgradeableFrontFort = frontlineFortNeeds.find(({ regionId, economy }) =>
        economy.fortification &&
        economy.fortification.level < FORTIFICATION_MAX_LEVEL &&
        !pendingFortOrderTypes.has(`${regionId}:upgradeFortification`)
      );
      if (upgradeableFrontFort) {
        nextState = upgradeFortification(
          upgradeableFrontFort.regionId,
          upgradeableFrontFort.economy.fortification!.level
        );
      }
    }

    if (!nextState && needsImmediateFrontlineReinforcement && stockpile.munitions >= 1) {
      const barracksRegion = findRecruitRegion("barracks");
      if (barracksRegion) nextState = recruitUnit("infantry", barracksRegion.regionId);
    }

    if (!nextState && needsSteel && !hasMine) {
      const mineRegion = findBuildRegion((regionId) => (
        regionHasDeposit(regionId, "iron") || regionHasDeposit(regionId, "coal") || regionHasDeposit(regionId, "tungsten")
      ));
      if (mineRegion) nextState = buildFacility("mine", mineRegion.regionId);
    }

    if (!nextState && needsSteel && !hasSmelter) {
      const smelterRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "iron")) ?? findBuildRegion(() => true);
      if (smelterRegion) nextState = buildFacility("smelter", smelterRegion.regionId);
    }

    if (!nextState && needsFuel && !hasOilWell) {
      const oilRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "oil"));
      if (oilRegion) nextState = buildFacility("oilWell", oilRegion.regionId);
    }

    if (!nextState && needsFuel && !hasRefinery && (hasOilWell || stockpile.oil >= 2)) {
      const refineryRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "oil")) ?? findBuildRegion(() => true);
      if (refineryRegion) nextState = buildFacility("refinery", refineryRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && (needsMunitions || stockpile.explosives < 3) && !hasExplosivesPlant) {
      const chemicalRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "chemicals"));
      if (chemicalRegion) nextState = buildFacility("chemicalPlant", chemicalRegion.regionId, "explosives");
    }

    if (!nextState && stockpile.fertilizer < 2 && stockpile.food < foodThreshold + 4 && !hasFertilizerPlant) {
      const fertilizerRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "chemicals")) ?? findBuildRegion(() => true);
      if (fertilizerRegion) nextState = buildFacility("chemicalPlant", fertilizerRegion.regionId, "fertilizer");
    }

    if (!nextState && militaryPreparationAllowed && needsMunitions && !hasFacility("munitionsPlant") && hasExplosivesPlant && hasMine) {
      const munitionsRegion = findBuildRegion((regionId) => regionHasDeposit(regionId, "tungsten")) ?? findBuildRegion(() => true);
      if (munitionsRegion) nextState = buildFacility("munitionsPlant", munitionsRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && wantsHeavyIndustry && !hasArmorFactory && stockpile.steel >= 6 && (hasSmelter || stockpile.iron >= 2)) {
      const armorRegion = findBuildRegion((regionId) => currentState.regions[regionId].isCapital || currentState.regions[regionId].isKeyCity) ?? findBuildRegion(() => true);
      if (armorRegion) nextState = buildFacility("armorFactory", armorRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && country.tier === "major" && !hasAirFactory && stockpile.steel >= 8 && (hasRefinery || stockpile.fuel >= 3)) {
      const airRegion = findBuildRegion((regionId) => currentState.regions[regionId].isCapital || currentState.regions[regionId].isKeyCity) ?? findBuildRegion(() => true);
      if (airRegion) nextState = buildFacility("airFactory", airRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && effectiveInfantryCount < desiredInfantry) {
      const barracksRegion = findRecruitRegion("barracks");
      if (barracksRegion) nextState = recruitUnit("infantry", barracksRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && desiredArmor > 0 && effectiveArmorCount < desiredArmor) {
      const armorFactoryRegion = findRecruitRegion("armorFactory");
      if (armorFactoryRegion) nextState = recruitUnit("armor", armorFactoryRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && desiredMlrs > 0 && effectiveMlrsCount < desiredMlrs) {
      const munitionsRegion = findRecruitRegion("munitionsPlant");
      if (munitionsRegion) nextState = recruitUnit("mlrs", munitionsRegion.regionId);
    }

    if (!nextState && militaryPreparationAllowed && desiredFighters > 0 && effectiveFighterCount < desiredFighters) {
      const airFactoryRegion = findRecruitRegion("airFactory");
      if (airFactoryRegion) nextState = recruitUnit("fighter", airFactoryRegion.regionId);
    }

    if (!nextState && stockpile.tradePoints > 12 && totalSlotsRemaining > 0) {
      const civilianRegion = findBuildRegion((regionId) => currentState.regions[regionId].isCapital) ?? findBuildRegion(() => true);
      if (civilianRegion) nextState = buildFacility("civilianFactory", civilianRegion.regionId);
    }

    // If no action was possible this iteration, stop
    if (!nextState) break;

    currentState = nextState;
  }

  return currentState;
}

function getEnemyAdjacencyCounts(state: GameState, regionId: string, blocId: BlocId | undefined) {
  let friendly = 0;
  let hostile = 0;

  for (const adjacentId of state.regions[regionId].adjacentRegionIds) {
    const adjacent = state.regions[adjacentId];
    if (adjacent.controllerBlocId === blocId) {
      friendly += 1;
    } else if (adjacent.controllerBlocId !== undefined) {
      hostile += 1;
    }
  }

  return { friendly, hostile };
}

function getFortPressure(state: GameState, regionId: string) {
  const fortification = state.regionEconomies[regionId]?.fortification;
  if (!fortification || fortification.health <= 0) {
    return { fortification: undefined, level: 0, normalizedHealth: 0, pressure: 0 };
  }

  const normalizedHealth = Math.max(0, fortification.health / Math.max(1, fortification.maxHealth));
  const pressure = fortification.level * 8 * normalizedHealth;
  return { fortification, level: fortification.level, normalizedHealth, pressure };
}

function getAdjacentFriendlySupport(state: GameState, blocId: BlocId | undefined, targetRegionId: string) {
  let localSupport = 0;
  let armorSupport = 0;
  let mlrsSupport = 0;

  for (const adjacentId of state.regions[targetRegionId].adjacentRegionIds) {
    const adjacentRegion = state.regions[adjacentId];
    if (adjacentRegion.controllerBlocId !== blocId) continue;

    for (const unit of Object.values(state.units)) {
      if (unit.regionId !== adjacentId || unit.blocId !== blocId) continue;
      if (unit.type === "infantry" || unit.type === "armor") {
        localSupport += 1;
      }
      if (unit.type === "armor") {
        armorSupport += 1;
      }
      if (unit.type === "mlrs") {
        mlrsSupport += 1;
      }
    }
  }

  return { localSupport, armorSupport, mlrsSupport };
}

function scoreBombardTarget(state: GameState, blocId: BlocId | undefined, targetRegionId: string, unitType: UnitType) {
  const target = state.regions[targetRegionId];
  const enemyStrength = Object.values(state.units)
    .filter((unit) => unit.regionId === targetRegionId && unit.blocId !== blocId)
    .reduce((sum, unit) => sum + unit.strength, 0);
  const fortPressure = getFortPressure(state, targetRegionId);
  const strategicValue = target.points * 2 + (target.isCapital ? 14 : 0) + (target.isKeyCity ? 8 : 0);
  const antiFortBias = unitType === "mlrs" ? 9 : 5;
  const score = strategicValue + enemyStrength * 1.4 + fortPressure.pressure * antiFortBias;

  const reasons = [
    `${unitType === "mlrs" ? "MLRS" : "Bomber"} pressure on ${target.name}.`,
    `Enemy field strength ${enemyStrength.toFixed(0)}.`,
  ];

  if (fortPressure.level > 0) {
    reasons.push(`Fortification level ${fortPressure.level} raises bombard priority.`);
  }

  return { score, reasons };
}

function scoreTarget(state: GameState, blocId: BlocId | undefined, fromRegionId: string, targetRegionId: string) {
  const target = state.regions[targetRegionId];
  const homeCountry = state.countries[target.homeCountryId];
  const { friendly, hostile } = getEnemyAdjacencyCounts(state, targetRegionId, blocId);
  const fortPressure = getFortPressure(state, targetRegionId);
  const reasons: string[] = [];

  let score = target.points * 3;
  reasons.push(`Region value ${target.points} contributes ${target.points * 3} score.`);

  if (target.isCapital) {
    score += 40;
    reasons.push("Capital capture priority +40.");
  } else if (target.isKeyCity) {
    score += 24;
    reasons.push("Key city pressure +24.");
  }

  if (homeCountry.tier === "major") {
    score += 14;
    reasons.push("Major-power pressure +14.");
  } else if (homeCountry.tier === "middle") {
    score += 8;
    reasons.push("Middle-power pressure +8.");
  }

  const infrastructureBonus = target.infrastructure.reduce((sum, item) => {
    if (item.type === "airport") {
      return sum + 5 * item.level;
    }
    if (item.type === "militaryFactory") {
      return sum + 6 * item.level;
    }
    if (item.type === "supplyHub") {
      return sum + 4 * item.level;
    }
    return sum + 3 * item.level;
  }, 0);

  if (infrastructureBonus > 0) {
    score += infrastructureBonus;
    reasons.push(`Infrastructure leverage +${infrastructureBonus}.`);
  }

  const exposurePenalty = Math.max(0, hostile - friendly) * 6;
  const supportBonus = friendly * 4;

  score += supportBonus;
  if (supportBonus > 0) {
    reasons.push(`Friendly adjacency support +${supportBonus}.`);
  }

  score -= exposurePenalty;
  if (exposurePenalty > 0) {
    reasons.push(`Frontline exposure penalty -${exposurePenalty}.`);
  }

  if (fortPressure.level > 0) {
    score -= fortPressure.pressure;
    reasons.push(`Fortification level ${fortPressure.level} resistance -${fortPressure.pressure.toFixed(0)}.`);
  }

  const fromRegion = state.regions[fromRegionId];
  if (fromRegion.isCapital || fromRegion.isKeyCity) {
    score -= 6;
    reasons.push("Avoid stripping a key homeland region -6.");
  }

  return { score, reasons };
}

function getCountryFrontlineData(state: GameState, countryId: CountryId) {
  const blocId = state.countries[countryId].blocId;
  const reserveFlex = AI_COUNTRY_PROFILES[countryId]?.attackReserveFlex ?? 0;
  const myRegionIds = Object.values(state.regions)
    .filter((region) => region.controllerCountryId === countryId)
    .map((region) => region.id);

  return myRegionIds.map((regionId) => {
    const region = state.regions[regionId];
    const hostileAdjacents = region.adjacentRegionIds.filter((adjacentId) => {
      const adjacent = state.regions[adjacentId];
      return adjacent.controllerBlocId !== undefined
        && adjacent.controllerBlocId !== blocId
        && state.countryStates[adjacent.controllerCountryId].atWar;
    });

    const defendingUnits = Object.values(state.units).filter((unit) =>
      unit.countryId === countryId &&
      (unit.type === "infantry" || unit.type === "armor") &&
      unit.regionId === regionId
    );
    const fortification = state.regionEconomies[regionId]?.fortification;
    const fortDefenderEquivalent = fortification && fortification.health > 0
      ? Math.min(2, fortification.level)
      : 0;

    const baseDesiredDefenders = hostileAdjacents.length > 0
      ? Math.min(3, 1 + hostileAdjacents.length + (region.isCapital || region.isKeyCity ? 1 : 0))
      : (region.isCapital || region.isKeyCity ? 1 : 0);
    const desiredDefenders = Math.max(region.isCapital || region.isKeyCity ? 1 : 0, baseDesiredDefenders - reserveFlex);
    const effectiveDefenders = defendingUnits.length + fortDefenderEquivalent;

    return {
      regionId,
      hostileAdjacents,
      defendingUnits,
      desiredDefenders,
      isThreatened: hostileAdjacents.length > 0,
      isCritical: region.isCapital || region.isKeyCity,
      deficit: Math.max(0, desiredDefenders - effectiveDefenders),
      surplus: Math.max(0, effectiveDefenders - desiredDefenders),
    };
  });
}

/**
 * Pick the single most strategically valuable enemy target the country
 * should focus on this turn. Returns the target region ID or null.
 * "Best" = highest-value region that's already weakly defended.
 */
function getPrimaryObjective(
  state: GameState,
  countryId: CountryId,
  unresolvedNationalGoals: Set<string>,
  nationalGoalPriorityMap: Map<string, number>
): string | null {
  const blocId = state.countries[countryId].blocId;
  const allyDefenseGoals = new Set((AI_COUNTRY_PROFILES[countryId]?.allyDefenseGoals ?? []).filter((regionId) => state.regions[regionId] !== undefined));
  const myRegionIds = new Set(
    Object.values(state.regions).filter(r => r.controllerCountryId === countryId).map(r => r.id)
  );

  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const myRegionId of myRegionIds) {
    const myRegion = state.regions[myRegionId];
    for (const adjId of myRegion.adjacentRegionIds) {
      const adj = state.regions[adjId];
      if (!adj || adj.controllerBlocId === blocId) continue;
      if (!state.countryStates[adj.controllerCountryId]?.atWar) continue;

      const defenders = Object.values(state.units).filter(
        u => u.regionId === adjId && u.blocId !== blocId
      ).reduce((sum, u) => sum + u.strength, 0);
      const fortPressure = getFortPressure(state, adjId);

      const attackers = Object.values(state.units).filter(
        u => state.regions[u.regionId].adjacentRegionIds.includes(adjId) &&
          u.blocId === blocId
      ).reduce((sum, u) => sum + u.strength * (u.countryId === countryId ? 1 : 0.6), 0);

      const ratio = defenders + fortPressure.pressure > 0 ? attackers / (defenders + fortPressure.pressure) : 10;
      const value = (adj.isCapital ? 50 : adj.isKeyCity ? 30 : adj.points * 3);
      const goalPriority = unresolvedNationalGoals.has(adjId) ? (nationalGoalPriorityMap.get(adjId) ?? 55) : 0;
      const keyNodePressure = adj.isCapital ? 20 : adj.isKeyCity ? 12 : 0;
      const allyShieldPressure = adj.adjacentRegionIds.some((regionId) => allyDefenseGoals.has(regionId)) ? 28 : 0;
      const randomTiebreak = deterministicNoise(`${state.turn}|primary|${countryId}|${myRegionId}|${adjId}`) * 8;
      // prefer targets we can actually win + high-value targets
      const score = value * 2 + ratio * 15 - defenders * 3 - fortPressure.pressure + goalPriority + keyNodePressure + allyShieldPressure + randomTiebreak;

      if (score > bestScore) {
        bestScore = score;
        bestId = adjId;
      }
    }
  }

  return bestId;
}

export function planCountryTurn(state: GameState, countryId: CountryId): BotDecision {
  const blocId = state.countries[countryId].blocId;
  const profile = AI_COUNTRY_PROFILES[countryId];
  const suppliedRegionIds = getSuppliedRegionIds(state, countryId);
  const nationalGoalPriorityMap = buildNationalGoalPriorityMap(state, countryId);
  const nationalGoalSet = buildNationalGoalSet(state, countryId);
  const unresolvedNationalGoals = getUnresolvedNationalGoals(state, countryId, nationalGoalSet);
  const allyDefenseGoalSet = new Set(
    (profile?.allyDefenseGoals ?? []).filter((regionId) => state.regions[regionId] !== undefined)
  );
  const lostHomelandRegions = new Set(
    state.countries[countryId].startingRegionIds.filter((regionId) => {
      const region = state.regions[regionId];
      return region !== undefined && region.controllerCountryId !== countryId;
    })
  );
  const routeDistances: StrategicRouteDistances = {
    nationalGoals: buildRouteDistances(state, countryId, unresolvedNationalGoals),
    allyGoals: buildRouteDistances(state, countryId, allyDefenseGoalSet),
    homeland: buildRouteDistances(state, countryId, lostHomelandRegions),
  };
  const countryUnits = Object.values(state.units).filter((unit) => unit.countryId === countryId);
  const frontlineData = getCountryFrontlineData(state, countryId);
  const frontlineByRegionId = new Map(frontlineData.map((entry) => [entry.regionId, entry]));
  const primaryObjective = getPrimaryObjective(state, countryId, unresolvedNationalGoals, nationalGoalPriorityMap);
  const primaryObjectiveBonus = profile?.primaryObjectiveBonus ?? 40;
  const primaryObjectiveAttackCap = Math.max(3, profile?.primaryObjectiveAttackCap ?? 3);
  const reinforcementTargets = frontlineData
    .filter((entry) => entry.deficit > 0)
    .sort((left, right) => {
      const leftPriority = (left.isCritical ? 20 : 0) + left.hostileAdjacents.length * 5 + left.deficit * 4;
      const rightPriority = (right.isCritical ? 20 : 0) + right.hostileAdjacents.length * 5 + right.deficit * 4;
      return rightPriority - leftPriority;
    });

  const actions: BotAction[] = [];
  const claimedTargetCounts = new Map<string, number>();
  const reservedUnits = new Set<string>();
  const allySkippedTargets: string[] = [];

  interface CandidateAction {
    unitId: string;
    fromRegionId: string;
    targetRegionId: string;
    orderType: "move" | "attack" | "airSupport" | "bombard" | "missileStrike";
    score: number;
    reasons: string[];
  }

  const allCandidates: CandidateAction[] = [];
  const attackTargetCaps = new Map<string, number>();

  for (const entry of frontlineData) {
    if (entry.desiredDefenders <= 0) continue;
    const defendersByValue = [...entry.defendingUnits].sort((left, right) => {
      const leftScore = left.type === "armor" ? 2 : 1;
      const rightScore = right.type === "armor" ? 2 : 1;
      return leftScore - rightScore;
    });

    for (const unit of defendersByValue.slice(0, Math.min(entry.desiredDefenders, defendersByValue.length))) {
      reservedUnits.add(unit.id);
    }
  }

  for (const unit of countryUnits) {
    const { moves, attacks, airTargets, bombardTargets, missileTargets } = getValidTargets(state, unit.id);

    // Handle air units: fighters provide air support to the most contested battle
    if (unit.type === "fighter" && airTargets.length > 0) {
      // Pick the target with the most enemy units
      const bestAirTarget = airTargets.reduce((best, tid) => {
        const enemyCount = Object.values(state.units).filter(
          (u) => u.regionId === tid && u.blocId !== unit.blocId
        ).length;
        const bestEnemyCount = Object.values(state.units).filter(
          (u) => u.regionId === best && u.blocId !== unit.blocId
        ).length;
        return enemyCount > bestEnemyCount ? tid : best;
      });

      const strategic = buildStrategicAdjustment(
        state,
        countryId,
        unit.id,
        unit.regionId,
        bestAirTarget,
        "airSupport",
        unresolvedNationalGoals,
        suppliedRegionIds,
        nationalGoalPriorityMap,
        routeDistances
      );
      allCandidates.push({
        unitId: unit.id,
        fromRegionId: unit.regionId,
        targetRegionId: bestAirTarget,
        orderType: "airSupport",
        score: 50 + strategic.adjustment,
        reasons: [
          `Fighter providing air support to combat over ${state.regions[bestAirTarget]?.name ?? "?"}.`,
          ...strategic.reasons,
        ],
      });
      continue;
    }

    // Handle bombers and MLRS: prioritize forts and dense enemy stacks
    if ((unit.type === "bomber" || unit.type === "mlrs") && bombardTargets.length > 0) {
      const bestBombTarget = bombardTargets.reduce((best, tid) => {
        const targetScore = scoreBombardTarget(state, unit.blocId, tid, unit.type).score;
        const bestScore = scoreBombardTarget(state, unit.blocId, best, unit.type).score;
        return targetScore > bestScore ? tid : best;
      });
      const bombardScore = scoreBombardTarget(state, unit.blocId, bestBombTarget, unit.type);

      const strategic = buildStrategicAdjustment(
        state,
        countryId,
        unit.id,
        unit.regionId,
        bestBombTarget,
        "bombard",
        unresolvedNationalGoals,
        suppliedRegionIds,
        nationalGoalPriorityMap,
        routeDistances
      );
      allCandidates.push({
        unitId: unit.id,
        fromRegionId: unit.regionId,
        targetRegionId: bestBombTarget,
        orderType: "bombard",
        score: (unit.type === "mlrs" ? 60 : 55) + bombardScore.score + strategic.adjustment,
        reasons: [
          `${unit.type === "mlrs" ? "MLRS" : "Bomber"} targeting ${state.regions[bestBombTarget]?.name ?? "?"} for pre-combat damage.`,
          ...bombardScore.reasons,
          ...strategic.reasons,
        ],
      });
      continue;
    }

    // Handle missiles: strike the highest-value target
    if ((unit.type === "tacticalMissile" || unit.type === "strategicMissile") && missileTargets.length > 0) {
      const bestMissileTarget = missileTargets.reduce((best, tid) => {
        const tRegion = state.regions[tid];
        const bRegion = state.regions[best];
        const tScore = (tRegion?.isCapital ? 30 : 0) + (tRegion?.isKeyCity ? 20 : 0);
        const bScore = (bRegion?.isCapital ? 30 : 0) + (bRegion?.isKeyCity ? 20 : 0);
        return tScore > bScore ? tid : best;
      });

      const strategic = buildStrategicAdjustment(
        state,
        countryId,
        unit.id,
        unit.regionId,
        bestMissileTarget,
        "missileStrike",
        unresolvedNationalGoals,
        suppliedRegionIds,
        nationalGoalPriorityMap,
        routeDistances
      );
      allCandidates.push({
        unitId: unit.id,
        fromRegionId: unit.regionId,
        targetRegionId: bestMissileTarget,
        orderType: "missileStrike",
        score: 60 + strategic.adjustment,
        reasons: [
          `Missile strike targeting ${state.regions[bestMissileTarget]?.name ?? "?"}.`,
          ...strategic.reasons,
        ],
      });
      continue;
    }

    // Land units: original logic below
    const sourceFront = frontlineByRegionId.get(unit.regionId);
    const sourceDeficit = sourceFront ? sourceFront.desiredDefenders - sourceFront.defendingUnits.length : 0;
    const canLeaveRegion = !reservedUnits.has(unit.id) || (sourceFront?.surplus ?? 0) > 0;
    const sourceSupplied = suppliedRegionIds.has(unit.regionId) && state.regions[unit.regionId].controllerBlocId === unit.blocId;
    const criticallyUnsupplied = unit.supplyTurnsRemaining <= 1;

    if (canLeaveRegion) {
      for (const targetId of moves) {
        const targetFront = frontlineByRegionId.get(targetId);
        if (!targetFront || targetFront.deficit <= 0) continue;
        const targetSupplied = suppliedRegionIds.has(targetId) && state.regions[targetId].controllerBlocId === unit.blocId;
        const supplyAdjustment =
          !sourceSupplied && targetSupplied ? 24 :
          sourceSupplied && !targetSupplied ? -18 :
          !sourceSupplied && !targetSupplied ? -8 :
          0;
        if (criticallyUnsupplied && !targetSupplied) continue;

        const reinforcementScore =
          40 +
          targetFront.deficit * 12 +
          targetFront.hostileAdjacents.length * 7 +
          (targetFront.isCritical ? 18 : 0) -
          Math.max(0, sourceDeficit) * 20 +
          supplyAdjustment;

        const strategic = buildStrategicAdjustment(
          state,
          countryId,
          unit.id,
          unit.regionId,
          targetId,
          "move",
          unresolvedNationalGoals,
          suppliedRegionIds,
          nationalGoalPriorityMap,
          routeDistances
        );
        allCandidates.push({
          unitId: unit.id,
          fromRegionId: unit.regionId,
          targetRegionId: targetId,
          orderType: "move",
          score: reinforcementScore + strategic.adjustment,
          reasons: [
            `Reinforce ${state.regions[targetId].name} due to defender deficit ${targetFront.deficit}.`,
            `Threat pressure ${targetFront.hostileAdjacents.length} hostile adjacencies.`,
            !sourceSupplied && targetSupplied
              ? "Move restores connection to the capital supply network."
              : !targetSupplied
                ? "Move risks operating outside the capital supply network."
                : "Move remains inside the capital supply network.",
            targetFront.isCritical ? "Critical region reinforcement priority." : "Frontline reinforcement priority.",
            ...strategic.reasons,
          ],
        });
      }
    }

    for (const targetId of attacks) {
      const { score, reasons } = scoreTarget(state, blocId, unit.regionId, targetId);
      const targetRegion = state.regions[targetId];
      const { localSupport, armorSupport, mlrsSupport } = getAdjacentFriendlySupport(state, blocId, targetId);
      const targetDefenders = Object.values(state.units).filter((candidate) =>
        candidate.regionId === targetId && candidate.blocId !== blocId
      ).length;
      const fortPressure = getFortPressure(state, targetId);
      const fortPenalty = fortPressure.pressure * (unit.type === "armor" ? 0.5 : 1.15);
      const antiFortSupportBonus = armorSupport * 6 + mlrsSupport * 10;
      const attackAdjustment =
        localSupport * 6 -
        targetDefenders * 8 -
        fortPenalty +
        antiFortSupportBonus -
        Math.max(0, sourceDeficit) * 25 -
        (!canLeaveRegion ? 30 : 0) -
        (!sourceSupplied ? 28 : 0) -
        (criticallyUnsupplied ? 36 : 0);
      const strategic = buildStrategicAdjustment(
        state,
        countryId,
        unit.id,
        unit.regionId,
        targetId,
        "attack",
        unresolvedNationalGoals,
        suppliedRegionIds,
        nationalGoalPriorityMap,
        routeDistances
      );
      const isDirectNationalGoal = unresolvedNationalGoals.has(targetId);
      const targetCap = Math.max(
        1,
        Math.min(
          primaryObjectiveAttackCap,
          targetDefenders +
            (targetRegion.isCapital || targetRegion.isKeyCity ? 1 : 0) +
            (isDirectNationalGoal ? 1 : 0) +
            (primaryObjective === targetId ? 2 : 0)
        )
      );

      attackTargetCaps.set(targetId, Math.max(attackTargetCaps.get(targetId) ?? 1, targetCap));

      allCandidates.push({
        unitId: unit.id,
        fromRegionId: unit.regionId,
        targetRegionId: targetId,
        orderType: "attack",
        score: score + attackAdjustment + strategic.adjustment + (primaryObjective === targetId ? primaryObjectiveBonus : 0),
        reasons: [
          ...reasons,
          ...(primaryObjective === targetId ? ["PRIMARY OBJECTIVE — concentrated attack priority +40."] : []),
          `Local support ${localSupport} adjacent friendly units.`,
          `Known defenders ${targetDefenders}.`,
          ...(fortPressure.level > 0
            ? [
                `Enemy fortification level ${fortPressure.level} in place.`,
                antiFortSupportBonus > 0
                  ? `Armor/MLRS support offsets fort resistance by +${antiFortSupportBonus.toFixed(0)}.`
                  : "Attack lacks dedicated anti-fort support.",
              ]
            : []),
          sourceSupplied
            ? "Attack launches from a supplied staging region."
            : "Attack launches while cut off from the capital supply network.",
          sourceDeficit > 0 ? "Attack discouraged: source region needs defenders." : "Source region can spare forces.",
          ...strategic.reasons,
        ],
      });
    }

    if (!canLeaveRegion) {
      continue;
    }

    for (const targetId of moves) {
      const targetFront = frontlineByRegionId.get(targetId);
      const targetSupplied = suppliedRegionIds.has(targetId) && state.regions[targetId].controllerBlocId === unit.blocId;
      if (criticallyUnsupplied && !targetSupplied) continue;
      const stagingBonus = targetFront
        ? targetFront.hostileAdjacents.length * 8 + (targetFront.isCritical ? 10 : 0)
        : 0;
      const supplyBonus =
        !sourceSupplied && targetSupplied ? 18 :
        sourceSupplied && !targetSupplied ? -16 :
        !sourceSupplied && !targetSupplied ? -6 :
        0;
      const { score, reasons } = scoreTarget(state, blocId, unit.regionId, targetId);
      const strategic = buildStrategicAdjustment(
        state,
        countryId,
        unit.id,
        unit.regionId,
        targetId,
        "move",
        unresolvedNationalGoals,
        suppliedRegionIds,
        nationalGoalPriorityMap,
        routeDistances
      );
      allCandidates.push({
        unitId: unit.id,
        fromRegionId: unit.regionId,
        targetRegionId: targetId,
        orderType: "move",
        score: score * 0.25 + stagingBonus + supplyBonus + strategic.adjustment,
        reasons: [
          ...reasons,
          !sourceSupplied && targetSupplied
            ? `Move restores supply via ${state.regions[targetId].name}.`
            : !targetSupplied
              ? "Move extends away from the capital supply network."
              : "Move stays within the capital supply network.",
          targetFront
            ? `Staging move toward threatened region ${state.regions[targetId].name}.`
            : "Move (not attack) - low-priority reposition.",
          ...strategic.reasons,
        ],
      });
    }
  }

  allCandidates.sort((left, right) => right.score - left.score);

  const assignedUnits = new Set<string>();
  for (const candidate of allCandidates) {
    if (assignedUnits.has(candidate.unitId)) continue;
    // A negative score means every option for this unit is worse than staying
    // put. Holding preserves the unit instead of feeding it into a lost fight.
    if (candidate.score < 0) continue;
    if (candidate.orderType === "attack") {
      const unit = state.units[candidate.unitId];
      const allyDefer = shouldDeferAttackToAlly(
        state,
        countryId,
        blocId,
        candidate.targetRegionId,
        unit?.strength ?? 0
      );
      if (allyDefer.defer) {
        if (allyDefer.reason && !allySkippedTargets.includes(allyDefer.reason)) {
          allySkippedTargets.push(allyDefer.reason);
        }
        continue;
      }

      const committedCount = claimedTargetCounts.get(candidate.targetRegionId) ?? 0;
      const targetCap = attackTargetCaps.get(candidate.targetRegionId) ?? 1;
      if (committedCount >= targetCap) continue;
    }

    actions.push({
      unitId: candidate.unitId,
      orderType: candidate.orderType,
      fromRegionId: candidate.fromRegionId,
      targetRegionId: candidate.targetRegionId,
      score: candidate.score,
      reasons: candidate.reasons,
    });

    assignedUnits.add(candidate.unitId);
    if (candidate.orderType === "attack") {
      claimedTargetCounts.set(candidate.targetRegionId, (claimedTargetCounts.get(candidate.targetRegionId) ?? 0) + 1);
    }
  }

  for (const unit of countryUnits) {
    if (!assignedUnits.has(unit.id)) {
      actions.push({
        unitId: unit.id,
        orderType: "hold",
        fromRegionId: unit.regionId,
        targetRegionId: unit.regionId,
        score: 0,
        reasons: ["No valid attacks or advantageous moves available."],
      });
    }
  }

  const attackCount = actions.filter((action) => action.orderType === "attack").length;
  const holdCount = actions.filter((action) => action.orderType === "hold").length;

  let type: BotDecision["type"];
  let reasoning: string;

  if (attackCount === 0) {
    type = "hold";
    reasoning = `${state.countries[countryId].name} holds positions while prioritizing key-node security and national-goal posture.`;
  } else if (attackCount > holdCount) {
    type = "aggressive";
    reasoning = `${state.countries[countryId].name} launches ${attackCount} attack${attackCount > 1 ? "s" : ""} using weighted priorities (30% homeland cohesion / 30% national goals / 20% key nodes / 20% random adaptation).`;
  } else {
    type = "cautious";
    reasoning = `${state.countries[countryId].name} makes ${attackCount} focused attack${attackCount > 1 ? "s" : ""} while preserving defensive depth around key nodes.`;
  }

  if (allySkippedTargets.length > 0) {
    reasoning += ` Allied coordination: ${allySkippedTargets.slice(0, 2).join(" ")}`;
  }

  return { type, actions, reasoning };
}

// ---------------------------------------------------------------------------
// AI Diplomacy: influence neutral countries
// ---------------------------------------------------------------------------

function aiDiplomacyTurn(state: GameState, countryId: CountryId): GameState {
  let currentState = state;
  const country = state.countries[countryId];
  const blocId = country.blocId;
  if (!blocId) return state;

  // Only major and middle powers do diplomacy
  if (country.tier === "minor") return state;

  // Find neutral countries that could be influenced
  const neutralCountries = Object.values(state.countries).filter((c) => {
    if (c.id === countryId) return false;
    if (c.alignment !== "neutral") return false;
    if (state.countryStates[c.id].defeatedOnTurn !== undefined) return false;
    if (state.countryStates[c.id].atWar) return false;
    return true;
  });

  if (neutralCountries.length === 0) return state;

  // Pick the best candidate to influence
  const scored = neutralCountries.map((nc) => {
    const diplo = state.diplomacy[nc.id];
    const leanBloc = getCountryLeanBloc(state, nc.id);
    let priority = 0;

    // Prioritize countries that already lean toward us
    if (leanBloc === blocId) priority += 20;
    // Prioritize countries leaning toward the enemy (counter-influence)
    if (leanBloc !== undefined && leanBloc !== blocId) priority += 15;
    // If no lean, moderate priority
    if (leanBloc === undefined) priority += 10;

    // Favor countries adjacent to the frontline (strategic transit)
    const ncRegions = Object.values(state.regions).filter((r) => r.controllerCountryId === nc.id);
    const adjacentToEnemy = ncRegions.some((r) =>
      r.adjacentRegionIds.some((adjId) => {
        const adj = state.regions[adjId];
        return adj && adj.controllerBlocId !== undefined && adj.controllerBlocId !== blocId;
      })
    );
    if (adjacentToEnemy) priority += 25;

    return { country: nc, priority, diplo };
  });

  scored.sort((a, b) => b.priority - a.priority);

  // Attempt more diplomacy actions so influence has real strategic impact.
  const maxActions = country.tier === "major" ? 3 : country.tier === "middle" ? 2 : 1;
  for (let i = 0; i < Math.min(maxActions, scored.length); i++) {
    const target = scored[i];
    const diplo = target.diplo;

    // Choose the best action type based on current support levels
    const actions: DiplomacyActionType[] = ["eliteBribery", "publicCampaign", "economicAid"];
    const isBrics = blocId === "BRICS";

    // If elite support is lagging behind public support, focus on elite
    const eliteValue = isBrics ? -diplo.eliteSupport : diplo.eliteSupport;
    const publicValue = isBrics ? -diplo.publicSupport : diplo.publicSupport;

    let actionType: DiplomacyActionType;
    if (eliteValue < publicValue - 10) {
      actionType = "eliteBribery";
    } else if (publicValue < eliteValue - 10) {
      actionType = "publicCampaign";
    } else {
      actionType = actions[Math.floor(Math.random() * actions.length)];
    }

    const actionIntensity = country.tier === "major"
      ? (target.priority >= 45 ? 3 : target.priority >= 30 ? 2 : 1)
      : (target.priority >= 35 ? 2 : 1);

    try {
      currentState = applyDiplomacyAction(currentState, countryId, target.country.id, actionType, actionIntensity);
    } catch {
      // Diplomacy action failed, skip
    }
  }

  return currentState;
}

export function executeCountryTurn(state: GameState, countryId: CountryId): { state: GameState; decision: BotDecision } {
  // 1. Economy build orders
  let economyState = aiEconomyTurn(state, countryId);
  // 2. Diplomacy influence
  economyState = aiDiplomacyTurn(economyState, countryId);
  // 3. Military orders
  const decision = planCountryTurn(economyState, countryId);
  let nextState = economyState;

  for (const action of decision.actions) {
    const order: Order = {
      unitId: action.unitId,
      type: action.orderType,
      targetRegionId: action.targetRegionId,
    };
    nextState = issueOrder(nextState, order);
  }

  const attackActions = decision.actions
    .filter((action) => action.orderType === "attack")
    .map((action) => ({ unitId: action.unitId, targetRegionId: action.targetRegionId }));
  nextState = recordAllyAttackClaims(nextState, countryId, attackActions);

  return { state: nextState, decision };
}

export function planBlocTurn(state: GameState, blocId: BlocId): BotDecision {
  const countryIds = state.turnOrder.filter((countryId) => state.countries[countryId].blocId === blocId);
  const actions = countryIds.flatMap((countryId) => planCountryTurn(state, countryId).actions);
  const attackCount = actions.filter((action) => action.orderType === "attack").length;
  return {
    type: attackCount > 0 ? "aggressive" : "hold",
    actions,
    reasoning: `${state.blocs[blocId].name} coalition plan aggregated from member countries.`,
  };
}

export function executeBlocTurn(state: GameState, blocId: BlocId): { state: GameState; decision: BotDecision } {
  const decision = planBlocTurn(state, blocId);
  let nextState = state;

  for (const action of decision.actions) {
    const order: Order = {
      unitId: action.unitId,
      type: action.orderType,
      targetRegionId: action.targetRegionId,
    };
    nextState = issueOrder(nextState, order);
  }

  return { state: nextState, decision };
}
