// The player's economy and doctrine actions as pure functions: each takes a GameState and returns
// the next one. Guards, resource arithmetic, order shapes and toast texts are moved verbatim from
// the handlers that lived in App.tsx; silent failures stay silent.
import {
  FORTIFICATION_MAX_LEVEL,
  getFacilityBuildRecipe,
  getFacilityRepairProfile,
  getFacilityUpgradeCost,
  getFortificationBuildProfile,
  getFortificationRepairProfile,
  getMilitaryProductionTurns,
  getReplenishmentCost,
  getUnitRecruitmentRecipe,
} from "../content/economyRecipes";
import { DOCTRINE_DEFINITIONS } from "../content/doctrines";
import type {
  CountryId,
  CountryStockpile,
  DoctrineUpgradeId,
  EconomyBuildOrder,
  Facility,
  FacilityType,
  GameState,
  StockpileKey,
  UnitType,
} from "../state/types";

export type ToastTone = "info" | "success" | "warning" | "danger";
export interface ActionToast { message: string; tone: ToastTone }
export type ActionResult = { ok: true; state: GameState; toast?: ActionToast } | { ok: false; toast?: ActionToast };
export type IdFactory = (prefix: string) => string;

type Cost = Partial<Record<StockpileKey, number>>;

const defaultMakeId: IdFactory = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function fail(toast?: ActionToast): ActionResult {
  return toast ? { ok: false, toast } : { ok: false };
}

function succeed(state: GameState, toast?: ActionToast): ActionResult {
  return toast ? { ok: true, state, toast } : { ok: true, state };
}

const isCountryTurn = (state: GameState, countryId: CountryId) => state.currentActorId === countryId;
const controlsRegion = (state: GameState, countryId: CountryId, regionId: string) =>
  state.regions[regionId]?.controllerCountryId === countryId;
const pendingOrders = (state: GameState, countryId: CountryId) => state.economyBuildOrders[countryId] ?? [];

/**
 * Replenishing restores troops that are already in the field, so it follows the supply rule (a region
 * held by the unit's own bloc) rather than the ownership rule of construction: the region must be held
 * by the unit's country or by another country of its BRICS / EU NATO bloc. Enemy- and neutral-held
 * regions never qualify.
 */
export function canReplenishIn(state: GameState, countryId: CountryId, regionId: string): boolean {
  const region = state.regions[regionId];
  if (!region) return false;
  if (region.controllerCountryId === countryId) return true;
  const blocId = state.countries[countryId]?.blocId;
  return blocId !== undefined && blocId !== "NEUTRAL" && region.controllerBlocId === blocId;
}

export function canAfford(stockpile: CountryStockpile | undefined, cost: Cost): boolean {
  if (!stockpile) return false;
  for (const [key, amount] of Object.entries(cost)) {
    if ((stockpile[key as StockpileKey] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

export function getMissingResources(stockpile: CountryStockpile | undefined, cost: Cost): string[] {
  if (!stockpile) return Object.keys(cost);
  const missing: string[] = [];
  for (const [key, amount] of Object.entries(cost)) {
    const have = stockpile[key as StockpileKey] ?? 0;
    const need = amount ?? 0;
    if (have < need) {
      missing.push(`${need - have} ${key}`);
    }
  }
  return missing;
}

export function getOperationalFacilities(state: GameState, regionId: string, type: FacilityType): Facility[] {
  return (state.regionEconomies[regionId]?.facilities ?? [])
    .filter((facility) => facility.type === type && !facility.damaged)
    .sort((left, right) => right.level - left.level);
}

export function getBestOperationalFacility(state: GameState, regionId: string, type: FacilityType): Facility | null {
  return getOperationalFacilities(state, regionId, type)[0] ?? null;
}

/** Pays `cost` from the country's stockpile and queues `order`. */
function queueOrder(state: GameState, countryId: CountryId, order: EconomyBuildOrder, cost: Cost): GameState {
  const stockpile = { ...state.countryStockpiles[countryId] };
  for (const [key, amount] of Object.entries(cost)) {
    stockpile[key as StockpileKey] -= amount ?? 0;
  }
  return {
    ...state,
    countryStockpiles: { ...state.countryStockpiles, [countryId]: stockpile },
    economyBuildOrders: { ...state.economyBuildOrders, [countryId]: [...pendingOrders(state, countryId), order] },
  };
}

export function queueFacilityBuild(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  facilityType: FacilityType,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const recipe = getFacilityBuildRecipe(facilityType);
  if (!recipe) return fail();
  const economy = state.regionEconomies[regionId];
  if (!economy) return fail();
  // Check building slot availability
  const usedSlots = economy.facilities.length;
  const pendingSlots = pendingOrders(state, countryId).filter((o) => o.regionId === regionId && o.type === "buildFacility").length;
  if (usedSlots + pendingSlots >= economy.buildingSlots) return fail();
  // Check we can afford it
  if (!canAfford(state.countryStockpiles[countryId], recipe.cost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("build"),
    countryId,
    regionId,
    type: "buildFacility",
    facilityType,
    turnsRemaining: recipe.turns,
    totalTurns: recipe.turns,
    committed: { ...recipe.cost },
  };
  return succeed(queueOrder(state, countryId, order, recipe.cost));
}

export function queueFacilityUpgrade(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  facilityId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const economy = state.regionEconomies[regionId];
  if (!economy) return fail();
  const facility = economy.facilities.find((f) => f.id === facilityId);
  if (!facility || facility.damaged || facility.level >= 3) return fail();
  const recipe = getFacilityBuildRecipe(facility.type);
  const upgradeCost = getFacilityUpgradeCost(facility.type, facility.level);
  if (!recipe || !upgradeCost) return fail();
  if (pendingOrders(state, countryId).some((o) => o.type === "upgradeFacility" && o.facilityId === facilityId)) return fail();
  if (!canAfford(state.countryStockpiles[countryId], upgradeCost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("upgrade"),
    countryId,
    regionId,
    type: "upgradeFacility",
    facilityId,
    turnsRemaining: recipe.turns,
    totalTurns: recipe.turns,
    committed: { ...upgradeCost },
  };
  return succeed(queueOrder(state, countryId, order, upgradeCost));
}

export function queueFacilityRepair(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  facilityId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const economy = state.regionEconomies[regionId];
  if (!economy) return fail();
  const facility = economy.facilities.find((f) => f.id === facilityId);
  if (!facility || !facility.damaged) return fail();
  if (pendingOrders(state, countryId).some((o) => o.type === "repairFacility" && o.facilityId === facilityId)) return fail();

  const repairProfile = getFacilityRepairProfile(facility.type, facility.level);
  if (!repairProfile) return fail();
  if (!canAfford(state.countryStockpiles[countryId], repairProfile.cost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("repair"),
    countryId,
    regionId,
    type: "repairFacility",
    facilityId,
    turnsRemaining: repairProfile.turns,
    totalTurns: repairProfile.turns,
    committed: { ...repairProfile.cost },
  };
  return succeed(queueOrder(state, countryId, order, repairProfile.cost));
}

export function queueFortificationBuild(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const economy = state.regionEconomies[regionId];
  if (!economy || economy.fortification) return fail();
  if (pendingOrders(state, countryId).some((o) => o.regionId === regionId && o.type === "buildFortification")) return fail();
  const buildProfile = getFortificationBuildProfile(1);
  if (!buildProfile || !canAfford(state.countryStockpiles[countryId], buildProfile.cost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("fort-build"),
    countryId,
    regionId,
    type: "buildFortification",
    turnsRemaining: buildProfile.turns,
    totalTurns: buildProfile.turns,
    committed: { ...buildProfile.cost },
  };
  return succeed(queueOrder(state, countryId, order, buildProfile.cost));
}

export function queueFortificationUpgrade(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const economy = state.regionEconomies[regionId];
  const fort = economy?.fortification;
  if (!economy || !fort || fort.level >= FORTIFICATION_MAX_LEVEL) return fail();
  if (pendingOrders(state, countryId).some((o) => o.regionId === regionId && o.type === "upgradeFortification")) return fail();
  const buildProfile = getFortificationBuildProfile(fort.level + 1);
  if (!buildProfile || !canAfford(state.countryStockpiles[countryId], buildProfile.cost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("fort-upgrade"),
    countryId,
    regionId,
    type: "upgradeFortification",
    turnsRemaining: buildProfile.turns,
    totalTurns: buildProfile.turns,
    committed: { ...buildProfile.cost },
  };
  return succeed(queueOrder(state, countryId, order, buildProfile.cost));
}

export function queueFortificationRepair(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const economy = state.regionEconomies[regionId];
  const fort = economy?.fortification;
  if (!economy || !fort || fort.health >= fort.maxHealth) return fail();
  if (pendingOrders(state, countryId).some((o) => o.regionId === regionId && o.type === "repairFortification")) return fail();
  const repairProfile = getFortificationRepairProfile(fort.level, fort.health, fort.maxHealth);
  if (!repairProfile || !canAfford(state.countryStockpiles[countryId], repairProfile.cost)) return fail();

  const order: EconomyBuildOrder = {
    id: makeId("fort-repair"),
    countryId,
    regionId,
    type: "repairFortification",
    turnsRemaining: repairProfile.turns,
    totalTurns: repairProfile.turns,
    committed: { ...repairProfile.cost },
  };
  return succeed(queueOrder(state, countryId, order, repairProfile.cost));
}

export function demolishFacility(state: GameState, countryId: CountryId, regionId: string, facilityId: string): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();

  const regionEcon = state.regionEconomies[regionId];
  if (!regionEcon) return fail();
  const facilityIndex = regionEcon.facilities.findIndex((f) => f.id === facilityId);
  if (facilityIndex === -1) return fail();

  const newFacilities = [...regionEcon.facilities];
  newFacilities.splice(facilityIndex, 1);
  return succeed({
    ...state,
    regionEconomies: {
      ...state.regionEconomies,
      [regionId]: {
        ...regionEcon,
        facilities: newFacilities,
      },
    },
  });
}

export function queueUnitRecruit(
  state: GameState,
  countryId: CountryId,
  regionId: string,
  unitType: UnitType,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  if (!isCountryTurn(state, countryId)) return fail();
  if (!controlsRegion(state, countryId, regionId)) return fail();
  const recipe = getUnitRecruitmentRecipe(unitType);
  if (!recipe) return fail();
  const sourceFacility = getBestOperationalFacility(state, regionId, recipe.requiredFacility);
  if (!sourceFacility) return fail();
  if (!canAfford(state.countryStockpiles[countryId], recipe.cost)) return fail();

  const turns = getMilitaryProductionTurns(recipe.turns, sourceFacility.level);
  const order: EconomyBuildOrder = {
    id: makeId("recruit"),
    countryId,
    regionId,
    type: "recruitUnit",
    unitType,
    turnsRemaining: turns,
    totalTurns: turns,
    committed: { ...recipe.cost },
  };
  return succeed(queueOrder(state, countryId, order, recipe.cost));
}

export function queueUnitReplenish(
  state: GameState,
  countryId: CountryId,
  unitId: string,
  makeId: IdFactory = defaultMakeId
): ActionResult {
  const unit = state.units[unitId];
  if (!unit || unit.countryId !== countryId) return fail();
  const recruitRecipe = getUnitRecruitmentRecipe(unit.type);
  if (!recruitRecipe) return fail();
  const sourceFacility = getBestOperationalFacility(state, unit.regionId, recruitRecipe.requiredFacility);
  const replenish = getReplenishmentCost(unit.type, unit.strength, sourceFacility?.level ?? 1);
  if (!replenish) return fail({ message: "Unit is already at full strength", tone: "info" });

  if (!canReplenishIn(state, countryId, unit.regionId)) {
    return fail({
      message: `Replenishing needs a region held by your country or your bloc (${state.regions[unit.regionId]?.name})`,
      tone: "warning",
    });
  }

  // Check required facility in the unit's current region
  if (!sourceFacility) {
    return fail({ message: `Requires a ${replenish.requiredFacility} in ${state.regions[unit.regionId]?.name}`, tone: "warning" });
  }

  // Check affordability
  const stockpile = state.countryStockpiles[countryId];
  for (const [key, amount] of Object.entries(replenish.cost)) {
    if ((stockpile[key as StockpileKey] ?? 0) < (amount ?? 0)) {
      return fail({ message: `Not enough ${key} (need ${amount}, have ${stockpile[key as StockpileKey] ?? 0})`, tone: "warning" });
    }
  }

  // Check not already being replenished
  if (pendingOrders(state, countryId).some((o) => o.type === "replenishUnit" && o.unitId === unitId)) {
    return fail({ message: "This unit is already being replenished", tone: "info" });
  }

  const order: EconomyBuildOrder = {
    id: makeId("replenish"),
    countryId,
    regionId: unit.regionId,
    type: "replenishUnit",
    unitId,
    unitType: unit.type,
    turnsRemaining: replenish.turns,
    totalTurns: replenish.turns,
    committed: { ...replenish.cost },
  };
  const costStr = Object.entries(replenish.cost).map(([k, v]) => `${v} ${k}`).join(", ");
  return succeed(queueOrder(state, countryId, order, replenish.cost), {
    message: `Replenishing ${unit.type} (${replenish.turns} turns, cost: ${costStr})`,
    tone: "success",
  });
}

export function cancelBuildOrder(state: GameState, countryId: CountryId, orderId: string): ActionResult {
  const orders = pendingOrders(state, countryId);
  const order = orders.find((o) => o.id === orderId);
  if (!order) return fail();
  // Refund committed resources
  const stockpile = { ...state.countryStockpiles[order.countryId] };
  for (const [key, amount] of Object.entries(order.committed)) {
    stockpile[key as StockpileKey] += amount ?? 0;
  }
  return succeed({
    ...state,
    countryStockpiles: { ...state.countryStockpiles, [order.countryId]: stockpile },
    economyBuildOrders: { ...state.economyBuildOrders, [countryId]: orders.filter((o) => o.id !== orderId) },
  });
}

export function purchaseDoctrine(state: GameState, countryId: CountryId, doctrineId: DoctrineUpgradeId): ActionResult {
  const def = DOCTRINE_DEFINITIONS.find((d) => d.id === doctrineId);
  if (!def) return fail();

  const owned = state.doctrineUpgrades?.[countryId] ?? [];
  if (owned.includes(doctrineId)) return fail({ message: "Doctrine already unlocked", tone: "info" });

  // Check prerequisites
  for (const req of def.requires ?? []) {
    if (!owned.includes(req)) {
      const reqDef = DOCTRINE_DEFINITIONS.find((d) => d.id === req);
      return fail({ message: `Requires: ${reqDef?.name ?? req}`, tone: "warning" });
    }
  }

  const tradePoints = state.countryStockpiles[countryId].tradePoints;
  if (tradePoints < def.cost) {
    return fail({ message: `Insufficient trade points (need ${def.cost}, have ${Math.floor(tradePoints)})`, tone: "warning" });
  }

  return succeed(
    {
      ...state,
      countryStockpiles: {
        ...state.countryStockpiles,
        [countryId]: { ...state.countryStockpiles[countryId], tradePoints: state.countryStockpiles[countryId].tradePoints - def.cost },
      },
      doctrineUpgrades: {
        ...state.doctrineUpgrades,
        [countryId]: [...(state.doctrineUpgrades?.[countryId] ?? []), doctrineId],
      },
    },
    { message: `Doctrine unlocked: ${def.name}`, tone: "success" }
  );
}

export function toggleChemicalMode(state: GameState, regionId: string, facilityId: string): ActionResult {
  const economy = state.regionEconomies[regionId];
  if (!economy || !economy.facilities.some((f) => f.id === facilityId)) return fail();
  return succeed({
    ...state,
    regionEconomies: {
      ...state.regionEconomies,
      [regionId]: {
        ...economy,
        facilities: economy.facilities.map((f) =>
          f.id === facilityId ? { ...f, chemicalMode: f.chemicalMode === "explosives" ? "fertilizer" : "explosives" } : f
        ),
      },
    },
  });
}
