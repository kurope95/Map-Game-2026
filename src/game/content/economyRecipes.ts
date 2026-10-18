import type {
  FacilityType,
  StockpileKey,
  UnitType,
  CivilianGoodType,
  WeedEffect,
} from "../state/types";

/* ═══════════════════════════════════
   EXTRACTION YIELDS — per turn per facility level
   Each level multiplies base richness yield
   ═══════════════════════════════════ */

/** yield = richness × levelMultiplier[level] */
export const EXTRACTION_LEVEL_MULTIPLIER: Record<number, number> = {
  1: 1,
  2: 1.6,
  3: 2.4,
};

/**
 * Which resource types each extraction facility can extract.
 * A mine at a region with iron(3) + coal(2) extracts both.
 */
export const EXTRACTION_FACILITY_RESOURCES: Record<string, string[]> = {
  mine: ["coal", "iron", "tungsten"],
  oilWell: ["oil"],
  farm: ["food"],
  chemicalPlant: ["chemicals"],
};

/* ═══════════════════════════════════
   PROCESSING RECIPES — intermediate goods
   Inputs consumed from bloc stockpile per turn per facility
   Output added to bloc stockpile per turn
   Energy cost = energy consumed per turn to operate
   ═══════════════════════════════════ */

export interface ProcessingRecipe {
  facilityType: FacilityType;
  inputs: Partial<Record<StockpileKey, number>>;
  outputs: Partial<Record<StockpileKey, number>>;
  energyCost: number;
  levelMultiplier: boolean; // if true, output × level
}

export const PROCESSING_RECIPES: ProcessingRecipe[] = [
  // Power Plant: 2 coal → 5 energy (no energy cost — it PRODUCES energy)
  {
    facilityType: "powerPlant",
    inputs: { coal: 2 },
    outputs: { energy: 5 },
    energyCost: 0,
    levelMultiplier: true,
  },
  // Smelter: 2 iron + 1 coal → 3 steel
  {
    facilityType: "smelter",
    inputs: { iron: 2, coal: 1 },
    outputs: { steel: 3 },
    energyCost: 1,
    levelMultiplier: true,
  },
  // Refinery: 2 oil → 3 fuel
  {
    facilityType: "refinery",
    inputs: { oil: 2 },
    outputs: { fuel: 3 },
    energyCost: 1,
    levelMultiplier: true,
  },
  // Synthetic Refinery: 3 coal → 1 fuel + 1 chemicals
  {
    facilityType: "syntheticRefinery",
    inputs: { coal: 3 },
    outputs: { fuel: 1, chemicals: 1 },
    energyCost: 1,
    levelMultiplier: true,
  },
  // Chemical Plant (fertilizer mode): 1 chemicals → 2 fertilizer
  // Chemical Plant (explosives mode): 1 chemicals → 1 explosives
  // Handled specially in the engine based on chemicalMode
];

export const CHEMICAL_PLANT_RECIPES = {
  fertilizer: {
    inputs: { chemicals: 1 } as Partial<Record<StockpileKey, number>>,
    outputs: { fertilizer: 2 } as Partial<Record<StockpileKey, number>>,
    energyCost: 1,
  },
  explosives: {
    inputs: { chemicals: 1 } as Partial<Record<StockpileKey, number>>,
    outputs: { explosives: 1 } as Partial<Record<StockpileKey, number>>,
    energyCost: 1,
  },
};

/* ═══════════════════════════════════
   MUNITIONS RECIPE — munitions plant continuous output
   ═══════════════════════════════════ */

export const MUNITIONS_PLANT_RECIPE: ProcessingRecipe = {
  facilityType: "munitionsPlant",
  inputs: { explosives: 1, tungsten: 1 },
  outputs: { munitions: 3 },
  energyCost: 1,
  levelMultiplier: true,
};

/* ═══════════════════════════════════
   MILITARY UNIT RECRUITMENT COSTS
   Resources committed upfront, unit appears after N turns
   ═══════════════════════════════════ */

export interface UnitRecruitmentCost {
  unitType: UnitType;
  cost: Partial<Record<StockpileKey, number>>;
  turns: number;
  requiredFacility: FacilityType;
  energyPerTurn: number;
}

export const UNIT_RECRUITMENT_COSTS: UnitRecruitmentCost[] = [
  {
    unitType: "infantry",
    cost: { steel: 2, munitions: 1 },
    turns: 2,
    requiredFacility: "barracks",
    energyPerTurn: 1,
  },
  {
    unitType: "armor",
    cost: { steel: 5, fuel: 2, munitions: 2 },
    turns: 4,
    requiredFacility: "armorFactory",
    energyPerTurn: 2,
  },
  {
    unitType: "mlrs",
    cost: { steel: 4, fuel: 1, munitions: 3, explosives: 2 },
    turns: 4,
    requiredFacility: "munitionsPlant",
    energyPerTurn: 2,
  },
  {
    unitType: "fighter",
    cost: { steel: 4, fuel: 3, tungsten: 1 },
    turns: 4,
    requiredFacility: "airFactory",
    energyPerTurn: 2,
  },
  {
    unitType: "bomber",
    cost: { steel: 5, fuel: 4, tungsten: 1 },
    turns: 5,
    requiredFacility: "airFactory",
    energyPerTurn: 2,
  },
  {
    unitType: "tacticalMissile",
    cost: { steel: 3, fuel: 2, explosives: 3 },
    turns: 3,
    requiredFacility: "munitionsPlant",
    energyPerTurn: 2,
  },
  {
    unitType: "strategicMissile",
    cost: { steel: 5, fuel: 4, explosives: 5, tungsten: 2 },
    turns: 6,
    requiredFacility: "munitionsPlant",
    energyPerTurn: 3,
  },
];

/* ═══════════════════════════════════
   UNIT REPLENISHMENT
   Cost = baseCost × missingStrength% × REPLENISH_COST_FACTOR
   e.g. armor at 30% STR (max 9): missing 70% → cost = baseCost × 0.7 × 0.6
   ═══════════════════════════════════ */

export const REPLENISH_COST_FACTOR = 0.6;
export const FACILITY_REPAIR_COST_MULTIPLIER = 0.5;

export const MAX_UNIT_STRENGTH: Record<UnitType, number> = {
  infantry: 8,
  armor: 9,
  mlrs: 7,
  fighter: 8,
  bomber: 8,
  tacticalMissile: 8,
  strategicMissile: 8,
};

export const FORTIFICATION_MAX_LEVEL = 3;

export const FORTIFICATION_MAX_HEALTH_BY_LEVEL: Record<number, number> = {
  1: 10,
  2: 16,
  3: 24,
};

export const FORTIFICATION_BUILD_COSTS: Array<{
  level: number;
  turns: number;
  cost: Partial<Record<StockpileKey, number>>;
}> = [
  { level: 1, turns: 2, cost: { steel: 4, munitions: 2 } },
  { level: 2, turns: 3, cost: { steel: 6, munitions: 3, explosives: 1 } },
  { level: 3, turns: 4, cost: { steel: 8, munitions: 4, explosives: 2 } },
];

export function getUnitRecruitmentRecipe(unitType: UnitType): UnitRecruitmentCost | null {
  return UNIT_RECRUITMENT_COSTS.find((recipe) => recipe.unitType === unitType) ?? null;
}

export function getMilitaryProductionTurns(baseTurns: number, facilityLevel = 1): number {
  return Math.max(1, baseTurns - Math.max(0, facilityLevel - 1));
}

export function getFortificationBuildProfile(level: number) {
  return FORTIFICATION_BUILD_COSTS.find((entry) => entry.level === level) ?? null;
}

export function getFortificationRepairProfile(level: number, currentHealth: number, maxHealth: number) {
  const buildProfile = getFortificationBuildProfile(level);
  if (!buildProfile) return null;
  if (currentHealth >= maxHealth) return null;

  const missingPct = (maxHealth - currentHealth) / Math.max(maxHealth, 1);
  const cost: Partial<Record<StockpileKey, number>> = {};
  for (const [key, amount] of Object.entries(buildProfile.cost)) {
    cost[key as StockpileKey] = Math.max(1, Math.ceil((amount ?? 0) * missingPct * FACILITY_REPAIR_COST_MULTIPLIER));
  }

  return {
    turns: Math.max(1, Math.ceil(buildProfile.turns * Math.max(0.5, missingPct))),
    cost,
  };
}

/** Calculate replenishment cost & required facility for a unit at a given strength */
export function getReplenishmentCost(unitType: UnitType, currentStrength: number, facilityLevel = 1): {
  cost: Partial<Record<StockpileKey, number>>;
  requiredFacility: FacilityType;
  turns: number;
} | null {
  const recipe = getUnitRecruitmentRecipe(unitType);
  if (!recipe) return null;

  const maxStr = MAX_UNIT_STRENGTH[unitType];
  if (currentStrength >= maxStr) return null; // already full

  const missingPct = (maxStr - currentStrength) / maxStr;
  const cost: Partial<Record<StockpileKey, number>> = {};
  for (const [key, amount] of Object.entries(recipe.cost)) {
    cost[key as StockpileKey] = Math.max(1, Math.ceil((amount ?? 0) * missingPct * REPLENISH_COST_FACTOR));
  }

  // Replenishment takes half the recruitment time (min 1 turn)
  const baseTurns = Math.max(1, Math.ceil(recipe.turns * missingPct * 0.5));
  const turns = getMilitaryProductionTurns(baseTurns, facilityLevel);

  return { cost, requiredFacility: recipe.requiredFacility, turns };
}

/* ═══════════════════════════════════
   CIVILIAN GOODS RECIPES
   Produced at civilianFactory, unlocked by factory level
   ═══════════════════════════════════ */

export interface CivilianGoodRecipe {
  good: CivilianGoodType;
  inputs: Partial<Record<StockpileKey, number>>;
  outputAmount: number;
  tradeValue: number; // trade points earned when produced
  requiredLevel: number; // civilian factory level needed
  energyCost: number;
}

export const CIVILIAN_GOOD_RECIPES: CivilianGoodRecipe[] = [
  {
    good: "textiles",
    inputs: { food: 1 },
    outputAmount: 2,
    tradeValue: 2,
    requiredLevel: 1,
    energyCost: 0,
  },
  {
    good: "electronics",
    inputs: { steel: 1 },
    outputAmount: 2,
    tradeValue: 5,
    requiredLevel: 1,
    energyCost: 1,
  },
  {
    good: "vehicles",
    inputs: { steel: 2, fuel: 1 },
    outputAmount: 1,
    tradeValue: 8,
    requiredLevel: 2,
    energyCost: 1,
  },
  {
    good: "pharmaceuticals",
    inputs: { chemicals: 1 },
    outputAmount: 2,
    tradeValue: 10,
    requiredLevel: 2,
    energyCost: 1,
  },
  {
    good: "luxuryGoods",
    inputs: { textiles: 1, electronics: 1 },
    outputAmount: 1,
    tradeValue: 15,
    requiredLevel: 3,
    energyCost: 1,
  },
];

/** Weed is special — produced at farms, not civilian factories */
export const WEED_RECIPE = {
  inputs: { food: 1, fertilizer: 1 } as Partial<Record<StockpileKey, number>>,
  outputAmount: 3,
  tradeValue: 6,
  requiredFarmLevel: 2,
  energyCost: 0,
};

/* ═══════════════════════════════════
   FOOD CONSUMPTION
   ═══════════════════════════════════ */

/** Food consumed per unit per turn */
export const FOOD_PER_UNIT = 1;

/** Food consumed per region = population / FOOD_POP_DIVISOR */
export const FOOD_POP_DIVISOR = 3000;

/** Fertilizer applied to farms boosts output by this factor */
export const FERTILIZER_FOOD_BOOST = 0.5; // +50%

/* ═══════════════════════════════════
   WEED SATURATION EFFECTS
   saturation = weed produced last turn / total bloc population (thousands)
   ═══════════════════════════════════ */

export const WEED_SATURATION_BRACKETS: { maxSaturation: number; effect: WeedEffect }[] = [
  { maxSaturation: 0,    effect: { moraleBonus: 0, foodMultiplier: 1.0 } },
  { maxSaturation: 0.10, effect: { moraleBonus: 1, foodMultiplier: 1.05 } },
  { maxSaturation: 0.25, effect: { moraleBonus: 3, foodMultiplier: 1.15 } },
  { maxSaturation: 1.0,  effect: { moraleBonus: 5, foodMultiplier: 1.30 } },
];

export function getWeedEffect(saturation: number): WeedEffect {
  for (let i = WEED_SATURATION_BRACKETS.length - 1; i >= 0; i--) {
    if (saturation >= WEED_SATURATION_BRACKETS[i].maxSaturation) {
      return WEED_SATURATION_BRACKETS[i].effect;
    }
  }
  return { moraleBonus: 0, foodMultiplier: 1.0 };
}

/* ═══════════════════════════════════
   STABILITY EFFECTS
   ═══════════════════════════════════ */

/** Food shortage: units lose STR, region stability drops */
export const FOOD_SHORTAGE_UNIT_STR_LOSS = 1;    // per turn
export const FOOD_SHORTAGE_STABILITY_LOSS = 5;    // per turn per region

/** Stability thresholds */
export const STABILITY_RECRUIT_HALF = 50;         // below this: recruitable pool halved
export const STABILITY_REVOLT_THRESHOLD = 20;     // below this: region can revolt

/** Stability recovery per turn (if food is OK) */
export const STABILITY_RECOVERY_RATE = 2;

/* ═══════════════════════════════════
   FACILITY CONSTRUCTION COSTS
   ═══════════════════════════════════ */

export interface FacilityBuildCost {
  facilityType: FacilityType;
  cost: Partial<Record<StockpileKey, number>>;
  turns: number;
}

export const FACILITY_BUILD_COSTS: FacilityBuildCost[] = [
  // Extraction (Free to guarantee bootstrapping)
  { facilityType: "mine",          cost: {},                        turns: 2 },
  { facilityType: "oilWell",       cost: {},                        turns: 3 },
  { facilityType: "farm",          cost: {},                        turns: 1 },
  { facilityType: "chemicalPlant", cost: {},                        turns: 2 },
  // Processing (Uses raw materials to bootstrap steel production)
  { facilityType: "powerPlant",    cost: { coal: 4 },               turns: 3 },
  { facilityType: "smelter",       cost: { iron: 2, coal: 2 },      turns: 2 },
  { facilityType: "refinery",      cost: { iron: 1, coal: 1 },      turns: 3 },
  { facilityType: "syntheticRefinery", cost: { iron: 2, coal: 2 },  turns: 3 },
  // Military
  { facilityType: "barracks",      cost: { steel: 2 },              turns: 2 },
  { facilityType: "armorFactory",  cost: { steel: 6, iron: 2 },     turns: 4 },
  { facilityType: "airFactory",    cost: { steel: 8, iron: 3 },     turns: 5 },
  { facilityType: "munitionsPlant",cost: { steel: 4, iron: 1 },     turns: 3 },
  // Civilian
  { facilityType: "civilianFactory", cost: { steel: 3, iron: 1 },   turns: 2 },
];

/** Upgrade cost = build cost × upgrade level, turns = build turns */
export const FACILITY_UPGRADE_COST_MULTIPLIER = 1.5;

export function getFacilityBuildRecipe(facilityType: FacilityType): FacilityBuildCost | null {
  return FACILITY_BUILD_COSTS.find((recipe) => recipe.facilityType === facilityType) ?? null;
}

export function getFacilityUpgradeCost(
  facilityType: FacilityType,
  currentLevel: number
): Partial<Record<StockpileKey, number>> | null {
  const recipe = getFacilityBuildRecipe(facilityType);
  if (!recipe) return null;

  const upgradeCost: Partial<Record<StockpileKey, number>> = {};
  for (const [key, amount] of Object.entries(recipe.cost)) {
    upgradeCost[key as StockpileKey] = Math.ceil(
      (amount ?? 0) * FACILITY_UPGRADE_COST_MULTIPLIER * currentLevel
    );
  }

  return upgradeCost;
}

export function getFacilityRepairProfile(
  facilityType: FacilityType,
  facilityLevel: number
): { cost: Partial<Record<StockpileKey, number>>; turns: number } | null {
  const recipe = getFacilityBuildRecipe(facilityType);
  if (!recipe) return null;

  const cost: Partial<Record<StockpileKey, number>> = {};
  for (const [key, amount] of Object.entries(recipe.cost)) {
    cost[key as StockpileKey] = Math.ceil(
      (amount ?? 0) * FACILITY_REPAIR_COST_MULTIPLIER * Math.max(1, facilityLevel)
    );
  }

  return {
    cost,
    turns: Math.max(1, Math.ceil(recipe.turns / 2)),
  };
}
