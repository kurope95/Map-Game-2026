import type { GameState, CountryId, CountryStockpile, StockpileKey, Facility } from "../state/types";
import { canBlocUseTransit } from "./diplomacy";
import {
  EXTRACTION_LEVEL_MULTIPLIER,
  EXTRACTION_FACILITY_RESOURCES,
  PROCESSING_RECIPES,
  CHEMICAL_PLANT_RECIPES,
  MUNITIONS_PLANT_RECIPE,
  CIVILIAN_GOOD_RECIPES,
  WEED_RECIPE,
  FOOD_PER_UNIT,
  FOOD_POP_DIVISOR,
  FERTILIZER_FOOD_BOOST,
  getWeedEffect,
  FOOD_SHORTAGE_UNIT_STR_LOSS,
  FOOD_SHORTAGE_STABILITY_LOSS,
  STABILITY_RECRUIT_HALF,
  STABILITY_REVOLT_THRESHOLD,
  STABILITY_RECOVERY_RATE,
  MAX_UNIT_STRENGTH,
  FORTIFICATION_MAX_HEALTH_BY_LEVEL,
} from "../content/economyRecipes";

function getStockpileValue(stockpile: CountryStockpile, key: StockpileKey): number {
  return stockpile[key];
}

function setStockpileValue(stockpile: CountryStockpile, key: StockpileKey, value: number): void {
  stockpile[key] = value;
}

const MAX_SUPPLY_TURNS = 3;
const UNSUPPLIED_ATTRITION: Record<"infantry" | "armor", number> = {
  infantry: 1,
  armor: 2,
};

/* ═══════════════════════════════════
   ECONOMY ENGINE — processes one bloc's economy per turn
   Call processEconomy(state, blocId) during turn resolution
   ═══════════════════════════════════ */

/** Helper: safely subtract from stockpile, returns false if insufficient */
function tryConsume(stockpile: CountryStockpile, inputs: Partial<Record<StockpileKey, number>>): boolean {
  // Check all inputs available
  for (const [key, amount] of Object.entries(inputs)) {
    if (getStockpileValue(stockpile, key as StockpileKey) < amount!) return false;
  }
  // Consume
  for (const [key, amount] of Object.entries(inputs)) {
    const stockpileKey = key as StockpileKey;
    setStockpileValue(stockpile, stockpileKey, getStockpileValue(stockpile, stockpileKey) - amount!);
  }
  return true;
}

/** Helper: add to stockpile */
function addToStockpile(stockpile: CountryStockpile, outputs: Partial<Record<StockpileKey, number>>, multiplier = 1): void {
  for (const [key, amount] of Object.entries(outputs)) {
    const stockpileKey = key as StockpileKey;
    setStockpileValue(stockpile, stockpileKey, getStockpileValue(stockpile, stockpileKey) + amount! * multiplier);
  }
}

/** Get all region IDs controlled by a country */
function getCountryRegionIds(state: GameState, countryId: CountryId): string[] {
  return Object.values(state.regions)
    .filter((r) => r.controllerCountryId === countryId)
    .map((r) => r.id);
}

/** Get all facilities in country-controlled regions */
function getCountryFacilities(state: GameState, countryId: CountryId): { facility: Facility; regionId: string }[] {
  const regionIds = getCountryRegionIds(state, countryId);
  const results: { facility: Facility; regionId: string }[] = [];
  for (const regionId of regionIds) {
    const economy = state.regionEconomies[regionId];
    if (!economy) continue;
    for (const facility of economy.facilities) {
      if (!facility.damaged) {
        results.push({ facility, regionId });
      }
    }
  }
  return results;
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
    const currentPassable =
      region.controllerBlocId === blocId ||
      canBlocUseTransit(state, blocId, region.controllerCountryId);
    if (!currentPassable) continue;

    supplied.add(regionId);

    for (const adjacentId of region.adjacentRegionIds) {
      const adjacent = state.regions[adjacentId];
      const adjacentPassable =
        adjacent.controllerBlocId === blocId ||
        canBlocUseTransit(state, blocId, adjacent.controllerCountryId);
      if (!supplied.has(adjacentId) && adjacentPassable) {
        queue.push(adjacentId);
      }
    }
  }

  return supplied;
}

/**
 * Process a full economy turn for one country.
 * Order of operations:
 *   1. Energy generation (power plants)
 *   2. Extraction (mines, oil wells, farms, chemical plants)
 *   3. Processing (smelters, refineries, munitions plants)
 *   4. Civilian production
 *   5. Military build orders (tick down timers)
 *   6. Weed saturation calculation
 *   7. Food consumption + attrition
 *   8. Stability updates
 *   9. Weed reset (perishable — clear for next turn)
 */
export function processEconomy(state: GameState, countryId: CountryId): GameState {
  // Deep clone the parts we'll mutate
  const stockpile: CountryStockpile = { ...state.countryStockpiles[countryId] };
  const regionEconomies = { ...state.regionEconomies };
  const units = { ...state.units };
  const eventLog = [...state.eventLog];

  const facilities = getCountryFacilities(state, countryId);
  const regionIds = getCountryRegionIds(state, countryId);
  const countryDoctrines = state.doctrineUpgrades?.[countryId] ?? [];
  const hasIndustrialCapacity = countryDoctrines.includes("industrial_capacity");
  const hasRailLogistics = countryDoctrines.includes("rail_logistics");
  const hasWarBonds = countryDoctrines.includes("war_bonds");
  const hasPartisanSuppression = countryDoctrines.includes("partisan_suppression");
  const hasOccupationAdministration = countryDoctrines.includes("occupation_administration");
  const hasEmergencyConscription = countryDoctrines.includes("emergency_conscription");
  const hasRationingProgram = countryDoctrines.includes("rationing_program");
  const hasLogisticsNetwork = countryDoctrines.includes("logistics_network");
  const hasFieldHospitals = countryDoctrines.includes("field_hospitals");

  // Reset energy each turn (not stored between turns)
  stockpile.energy = 0;

  // ── 1. ENERGY GENERATION ──
  for (const { facility } of facilities) {
    if (facility.type !== "powerPlant") continue;
    const recipe = PROCESSING_RECIPES.find((r) => r.facilityType === "powerPlant")!;
    const levelMult = facility.level;
    const scaledInputs: Partial<Record<StockpileKey, number>> = {};
    for (const [k, v] of Object.entries(recipe.inputs)) {
      scaledInputs[k as StockpileKey] = v! * levelMult;
    }
    if (tryConsume(stockpile, scaledInputs)) {
      addToStockpile(stockpile, recipe.outputs, levelMult);
    }
  }

  // ── 2. EXTRACTION ──
  for (const { facility, regionId } of facilities) {
    const extractableResources = EXTRACTION_FACILITY_RESOURCES[facility.type];
    if (!extractableResources) continue;

    const economy = regionEconomies[regionId];
    if (!economy) continue;

    const levelMult = EXTRACTION_LEVEL_MULTIPLIER[facility.level] ?? 1;

    for (const deposit of economy.resourceDeposits) {
      if (extractableResources.includes(deposit.type)) {
        let yield_: number;

        if (deposit.type === "food") {
          // Food deposits represent Fertility — +15% per star on base farm output of 4
          const baseFarmOutput = 4;
          yield_ = Math.floor(baseFarmOutput * (1 + 0.15 * deposit.richness) * levelMult);
        } else {
          yield_ = Math.floor((2 + deposit.richness) * levelMult);
        }

        // Farm + fertilizer boost
        if (facility.type === "farm" && deposit.type === "food" && stockpile.fertilizer > 0) {
          const boost = Math.floor(yield_ * FERTILIZER_FOOD_BOOST);
          yield_ += boost;
          stockpile.fertilizer = Math.max(0, stockpile.fertilizer - 1);
        }

        setStockpileValue(stockpile, deposit.type, getStockpileValue(stockpile, deposit.type) + yield_);
      }
    }
  }

  // ── 3. PROCESSING (smelters, refineries) ──
  for (const { facility } of facilities) {
    // Skip power plants (already done), extraction, military, civilian
    const recipe = PROCESSING_RECIPES.find((r) => r.facilityType === facility.type);
    if (!recipe || facility.type === "powerPlant") continue;

    // Check energy
    if (recipe.energyCost > 0 && stockpile.energy < recipe.energyCost) continue;

    const levelMult = recipe.levelMultiplier ? facility.level : 1;
    const scaledInputs: Partial<Record<StockpileKey, number>> = {};
    for (const [k, v] of Object.entries(recipe.inputs)) {
      scaledInputs[k as StockpileKey] = v! * levelMult;
    }

    if (tryConsume(stockpile, scaledInputs)) {
      if (recipe.energyCost > 0) stockpile.energy -= recipe.energyCost;
      addToStockpile(stockpile, recipe.outputs, levelMult);
    }
  }

  // Chemical plants (special: mode-dependent)
  for (const { facility } of facilities) {
    if (facility.type !== "chemicalPlant") continue;
    const mode = facility.chemicalMode ?? "fertilizer";
    const recipe = CHEMICAL_PLANT_RECIPES[mode];

    if (recipe.energyCost > 0 && stockpile.energy < recipe.energyCost) continue;

    const levelMult = facility.level;
    const scaledInputs: Partial<Record<StockpileKey, number>> = {};
    for (const [k, v] of Object.entries(recipe.inputs)) {
      scaledInputs[k as StockpileKey] = v! * levelMult;
    }

    if (tryConsume(stockpile, scaledInputs)) {
      if (recipe.energyCost > 0) stockpile.energy -= recipe.energyCost;
      addToStockpile(stockpile, recipe.outputs, levelMult);
    }
  }

  // Munitions plants
  for (const { facility } of facilities) {
    if (facility.type !== "munitionsPlant") continue;
    const recipe = MUNITIONS_PLANT_RECIPE;

    if (recipe.energyCost > 0 && stockpile.energy < recipe.energyCost) continue;

    const levelMult = facility.level;
    const scaledInputs: Partial<Record<StockpileKey, number>> = {};
    for (const [k, v] of Object.entries(recipe.inputs)) {
      scaledInputs[k as StockpileKey] = v! * levelMult;
    }

    if (tryConsume(stockpile, scaledInputs)) {
      if (recipe.energyCost > 0) stockpile.energy -= recipe.energyCost;
      addToStockpile(stockpile, recipe.outputs, levelMult);
    }
  }

  // ── 4. CIVILIAN PRODUCTION ──
  for (const { facility } of facilities) {
    if (facility.type !== "civilianFactory") continue;
    const product = facility.civilianProduct ?? "textiles";
    const recipe = CIVILIAN_GOOD_RECIPES.find((r) => r.good === product);
    if (!recipe) continue;
    if (facility.level < recipe.requiredLevel) continue;
    if (recipe.energyCost > 0 && stockpile.energy < recipe.energyCost) continue;

    if (tryConsume(stockpile, recipe.inputs)) {
      if (recipe.energyCost > 0) stockpile.energy -= recipe.energyCost;
      setStockpileValue(stockpile, product, getStockpileValue(stockpile, product) + recipe.outputAmount);
      stockpile.tradePoints += recipe.tradeValue * (hasWarBonds ? 1.2 : 1);
    }
  }

  // Weed production (at farms level 2+)
  let weedProducedThisTurn = 0;
  for (const { facility } of facilities) {
    if (facility.type !== "farm" || facility.level < WEED_RECIPE.requiredFarmLevel) continue;
    if (tryConsume(stockpile, WEED_RECIPE.inputs)) {
      weedProducedThisTurn += WEED_RECIPE.outputAmount;
      stockpile.tradePoints += WEED_RECIPE.tradeValue;
    }
  }
  stockpile.weed = weedProducedThisTurn; // perishable — only this turn's production counts

  // ── 5. MILITARY BUILD ORDERS ──
  const buildOrders = [...(state.economyBuildOrders[countryId] ?? [])];
  const completedOrders: string[] = [];

  for (const order of buildOrders) {
    // Build orders no longer consume energy per turn to prevent softlocks when energy drops to 0.
    order.turnsRemaining--;
    // industrial_capacity doctrine: build one turn faster (min 1 turn)
    if (
      (
        order.type === "buildFacility" ||
        order.type === "upgradeFacility" ||
        order.type === "repairFacility" ||
        order.type === "buildFortification" ||
        order.type === "upgradeFortification" ||
        order.type === "repairFortification"
      ) &&
      hasIndustrialCapacity &&
      order.turnsRemaining > 1
    ) {
      order.turnsRemaining--;
    }
    if (
      (order.type === "recruitUnit" || order.type === "replenishUnit") &&
      hasRailLogistics &&
      order.turnsRemaining > 1
    ) {
      order.turnsRemaining--;
    }

    if (order.turnsRemaining <= 0) {
      completedOrders.push(order.id);

        if (order.type === "recruitUnit" && order.unitType) {
          // Create new unit
          const blocId = state.countries[countryId].blocId ?? "BRICS";
          // Deterministic ids keep the seeded balance harness stable when build orders change:
          // a random suffix would shift every later Math.random consumer (AI diplomacy).
          const unitId = `${countryId.toLowerCase()}-${order.unitType}-t${state.turn}-${Object.keys(units).length}`;
          const region = state.regions[order.regionId];
          units[unitId] = {
            id: unitId,
            type: order.unitType,
            blocId,
            countryId,
            regionId: order.regionId,
            strength: MAX_UNIT_STRENGTH[order.unitType],
            supplyTurnsRemaining: 3,
          };
          eventLog.push(`[${countryId}] New ${order.unitType} deployed in ${region.name}`);
        }
        if (order.type === "replenishUnit" && order.unitId) {
          const unit = units[order.unitId];
          if (unit) {
            const maxStr = MAX_UNIT_STRENGTH[unit.type];
            const oldStrength = unit.strength;
            units[order.unitId] = { ...unit, strength: maxStr };
            const region = state.regions[unit.regionId];
            eventLog.push(`[${countryId}] ${unit.type} replenished in ${region?.name ?? "unknown"} (${oldStrength} → ${maxStr})`);
          }
        }
        if (order.type === "buildFacility" && order.facilityType) {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon) {
            // Deterministic id, for the same reason as the unit id above.
            const facId = `fac-${order.regionId}-${order.facilityType}-t${state.turn}-${regionEcon.facilities.length}`;
            regionEconomies[order.regionId] = {
              ...regionEcon,
              facilities: [
                ...regionEcon.facilities,
                {
                  id: facId,
                  type: order.facilityType,
                  level: 1,
                  regionId: order.regionId,
                  damaged: false,
                  chemicalMode: order.facilityType === "chemicalPlant" ? order.chemicalMode ?? "fertilizer" : undefined,
                }
              ]
            };
            const region = state.regions[order.regionId];
            eventLog.push(`[${countryId}] New ${order.facilityType} built in ${region.name}`);
          }
        }
        if (order.type === "upgradeFacility" && order.facilityId) {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon) {
            const facIndex = regionEcon.facilities.findIndex((f) => f.id === order.facilityId);
            if (facIndex !== -1 && regionEcon.facilities[facIndex].level < 3) {
              const newFacilities = [...regionEcon.facilities];
              const fac = newFacilities[facIndex];
              newFacilities[facIndex] = { ...fac, level: fac.level + 1 };
              
              regionEconomies[order.regionId] = {
                ...regionEcon,
                facilities: newFacilities
              };
              
              const region = state.regions[order.regionId];
              eventLog.push(`[${countryId}] ${fac.type} upgraded to Lv.${fac.level + 1} in ${region.name}`);
            }
          }
        }
        if (order.type === "repairFacility" && order.facilityId) {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon) {
            const facIndex = regionEcon.facilities.findIndex((f) => f.id === order.facilityId);
            if (facIndex !== -1 && regionEcon.facilities[facIndex].damaged) {
              const newFacilities = [...regionEcon.facilities];
              const fac = newFacilities[facIndex];
              newFacilities[facIndex] = { ...fac, damaged: false };

              regionEconomies[order.regionId] = {
                ...regionEcon,
                facilities: newFacilities
              };

              const region = state.regions[order.regionId];
              eventLog.push(`[${countryId}] ${fac.type} repaired in ${region.name}`);
            }
          }
        }
        if (order.type === "buildFortification") {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon && !regionEcon.fortification) {
            const maxHealth = FORTIFICATION_MAX_HEALTH_BY_LEVEL[1];
            regionEconomies[order.regionId] = {
              ...regionEcon,
              fortification: {
                level: 1,
                health: maxHealth,
                maxHealth,
                damaged: false,
              },
            };
            const region = state.regions[order.regionId];
            eventLog.push(`[${countryId}] Fortification built in ${region.name}`);
          }
        }
        if (order.type === "upgradeFortification") {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon?.fortification && regionEcon.fortification.level < 3) {
            const nextLevel = regionEcon.fortification.level + 1;
            const maxHealth = FORTIFICATION_MAX_HEALTH_BY_LEVEL[nextLevel];
            regionEconomies[order.regionId] = {
              ...regionEcon,
              fortification: {
                level: nextLevel,
                maxHealth,
                health: maxHealth,
                damaged: false,
              },
            };
            const region = state.regions[order.regionId];
            eventLog.push(`[${countryId}] Fortification upgraded to Lv.${nextLevel} in ${region.name}`);
          }
        }
        if (order.type === "repairFortification") {
          const regionEcon = regionEconomies[order.regionId];
          if (regionEcon?.fortification) {
            regionEconomies[order.regionId] = {
              ...regionEcon,
              fortification: {
                ...regionEcon.fortification,
                health: regionEcon.fortification.maxHealth,
                damaged: false,
              },
            };
            const region = state.regions[order.regionId];
            eventLog.push(`[${countryId}] Fortification repaired in ${region.name}`);
          }
        }
      }
    }

  const remainingOrders = buildOrders.filter((o) => !completedOrders.includes(o.id));

  // ── 6. WEED SATURATION ──
  let totalCountryPop = 0;
  for (const regionId of regionIds) {
    totalCountryPop += regionEconomies[regionId]?.population ?? 0;
  }
  const weedSaturation = totalCountryPop > 0 ? weedProducedThisTurn / totalCountryPop : 0;
  const weedEffect = getWeedEffect(weedSaturation);

  // ── 7. FOOD CONSUMPTION ──
  const countryUnits = Object.values(units).filter((u) => u.countryId === countryId);
  const suppliedRegionIds = getSuppliedRegionIds(state, countryId);
  let foodNeeded = countryUnits.length * FOOD_PER_UNIT;

  // Regional population food consumption
  for (const regionId of regionIds) {
    const eco = regionEconomies[regionId];
    if (!eco) continue;
    foodNeeded += Math.ceil(eco.population / FOOD_POP_DIVISOR);
  }

  // Apply weed food multiplier
  foodNeeded = Math.ceil(foodNeeded * weedEffect.foodMultiplier);

  const foodShortage = stockpile.food < foodNeeded;
  stockpile.food = Math.max(0, stockpile.food - foodNeeded);

  // ── 8. STABILITY + ATTRITION ──
  for (const regionId of regionIds) {
    const eco = regionEconomies[regionId];
    if (!eco) continue;
    const updated = { ...eco };

    if (foodShortage) {
      updated.stability = Math.max(0, updated.stability - FOOD_SHORTAGE_STABILITY_LOSS);
    } else {
      // Recover stability when food is OK
      updated.stability = Math.min(100, updated.stability + STABILITY_RECOVERY_RATE);
    }

    // Apply weed morale bonus to stability (capped at 100)
    if (weedEffect.moraleBonus > 0) {
      updated.stability = Math.min(100, updated.stability + weedEffect.moraleBonus);
    }

    // Recruitable pool adjustment
    if (updated.stability < STABILITY_RECRUIT_HALF) {
      updated.recruitablePool = Math.floor(updated.population * 0.05);
    }
    if (hasEmergencyConscription) {
      updated.recruitablePool = Math.max(updated.recruitablePool, Math.floor(updated.population * 0.10));
    }

    // partisan_suppression doctrine: +5 stability in occupied regions
    const regionDef = state.regions[regionId];
    const isOccupied = regionDef && regionDef.homeCountryId !== regionDef.controllerCountryId;
    if (isOccupied && hasPartisanSuppression) {
      updated.stability = Math.min(100, updated.stability + 5);
    }
    if (isOccupied && hasOccupationAdministration) {
      updated.stability = Math.min(100, updated.stability + 5);
    }

    // Revolt check
    if (updated.stability < STABILITY_REVOLT_THRESHOLD) {
      eventLog.push(`[${countryId}] WARNING: ${state.regions[regionId].name} is on the verge of revolt! (stability ${updated.stability}%)`);
    }

    regionEconomies[regionId] = updated;
  }

  // Food shortage: units lose strength
  if (foodShortage) {
    eventLog.push(`[${countryId}] FOOD SHORTAGE! Units losing strength.`);
    const shortageLoss = Math.max(0, FOOD_SHORTAGE_UNIT_STR_LOSS - (hasRationingProgram ? 1 : 0));
    for (const unit of countryUnits) {
      if (unit.strength > 1 && shortageLoss > 0) {
        units[unit.id] = { ...unit, strength: unit.strength - shortageLoss };
      }
    }
  }

  for (const unit of countryUnits) {
    const currentUnit = units[unit.id];
    if (!currentUnit || (currentUnit.type !== "infantry" && currentUnit.type !== "armor")) continue;

    const isSupplied =
      suppliedRegionIds.has(currentUnit.regionId) &&
      state.regions[currentUnit.regionId].controllerBlocId === currentUnit.blocId;

    if (isSupplied) {
      const countryMaxSupplyTurns = hasLogisticsNetwork ? MAX_SUPPLY_TURNS + 1 : MAX_SUPPLY_TURNS;
      if (currentUnit.supplyTurnsRemaining < countryMaxSupplyTurns) {
        eventLog.push(`[${countryId}] ${currentUnit.id} re-established supply in ${state.regions[currentUnit.regionId].name}.`);
      }
      units[currentUnit.id] = { ...currentUnit, supplyTurnsRemaining: countryMaxSupplyTurns };
      continue;
    }

    const nextSupplyTurns = Math.max(0, currentUnit.supplyTurnsRemaining - 1);
    const baseAttritionLoss = nextSupplyTurns === 0 ? UNSUPPLIED_ATTRITION[currentUnit.type] : 0;
    const attritionLoss = Math.max(0, baseAttritionLoss - (hasFieldHospitals ? 1 : 0));
    const nextStrength = currentUnit.strength - attritionLoss;

    if (attritionLoss > 0) {
      eventLog.push(
        `[${countryId}] ${currentUnit.id} suffers supply attrition in ${state.regions[currentUnit.regionId].name} (-${attritionLoss} STR).`
      );
    } else {
      eventLog.push(
        `[${countryId}] ${currentUnit.id} is cut off from the capital supply network in ${state.regions[currentUnit.regionId].name}.`
      );
    }

    if (nextStrength <= 0) {
      delete units[currentUnit.id];
      eventLog.push(`[${countryId}] ${currentUnit.id} was destroyed after running out of supply.`);
      continue;
    }

    units[currentUnit.id] = {
      ...currentUnit,
      supplyTurnsRemaining: nextSupplyTurns,
      strength: nextStrength,
    };
  }

  // ── 9. Return updated state ──
  return {
    ...state,
    countryStockpiles: {
      ...state.countryStockpiles,
      [countryId]: stockpile,
    },
    regionEconomies,
    units,
    economyBuildOrders: {
      ...state.economyBuildOrders,
      [countryId]: remainingOrders,
    },
    weedSaturation: {
      ...state.weedSaturation,
      [countryId]: weedSaturation,
    },
    eventLog,
  };
}
