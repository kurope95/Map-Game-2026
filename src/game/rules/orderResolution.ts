import {
  BlocId,
  CombatResult,
  CountryId,
  DoctrineUpgradeId,
  GameState,
  LandUnitType,
  Order,
  RegionTerrain,
  UnitDefinition,
} from "../state/types";
import { canBlocUseTransit } from "./diplomacy";
import { setRegionController } from "./turnEngine";

// ---------------------------------------------------------------------------
// 1. Terrain defense modifier
// ---------------------------------------------------------------------------

const TERRAIN_DEFENSE: Record<RegionTerrain, number> = {
  urban: 1.4,
  mountain: 1.5,
  forest: 1.25,
  industrial: 1.3,
  coastal: 1.15,
  plains: 1.0,
};

export function getTerrainDefenseModifier(terrain: RegionTerrain): number {
  return TERRAIN_DEFENSE[terrain];
}

// ---------------------------------------------------------------------------
// Combat constants
// ---------------------------------------------------------------------------

const LAND_UNIT_TYPES: readonly string[] = ["infantry", "armor", "mlrs"] satisfies LandUnitType[];
const AIR_UNIT_TYPES: readonly string[] = ["fighter", "bomber"];
const MISSILE_UNIT_TYPES: readonly string[] = ["tacticalMissile", "strategicMissile"];
const ASSAULT_UNIT_TYPES = new Set<LandUnitType>(["infantry", "armor"]);
const UNSUPPLIED_COMBAT_MODIFIER = 0.7;
const COMBAT_RANDOMNESS = 0.15; // ±15% variance on loss percentages
const VETERANCY_BONUS_PER_LEVEL = 0.05; // +5% per vet level
const MAX_VETERANCY_LEVEL = 3;
const ENTRENCHMENT_BONUS_PER_TURN = 0.05; // +5% defense per turn held
const MAX_ENTRENCHMENT_BONUS = 0.25;
export const AIR_SUPPORT_MULTIPLIER = 0.25; // each fighter adds 25% of its strength
export const BOMBER_DAMAGE_FACTOR = 0.4; // each bomber deals 40% of its strength as pre-combat damage
export const TACTICAL_MISSILE_DAMAGE = 3; // flat damage per missile
export const STRATEGIC_MISSILE_DAMAGE = 5;
const FACILITY_DAMAGE_CHANCE = 0.3; // 30% chance per facility during heavy combat
const RETREAT_STRENGTH_LOSS = 0.1; // retreating units lose 10% additional strength
export const MAX_UNITS_PER_REGION = 4; // hard limit on friendly units per region
export const FORT_PROTECTION_BY_LEVEL: Record<number, number> = { 1: 0.2, 2: 0.35, 3: 0.5 };
const FORT_RETALIATION_BY_LEVEL: Record<number, number> = { 1: 1, 2: 2, 3: 3 };
export const FORT_BASE_POWER_BY_LEVEL: Record<number, number> = { 1: 8, 2: 14, 3: 20 };

// ---------------------------------------------------------------------------
// Simple seeded PRNG for deterministic combat
// ---------------------------------------------------------------------------

let combatSeed = Date.now();

export function setCombatSeed(seed: number): void {
  combatSeed = seed >>> 0;
}

function combatRandom(): number {
  combatSeed = (combatSeed * 1664525 + 1013904223) & 0x7fffffff;
  return combatSeed / 0x7fffffff;
}

function randomVariance(): number {
  return 1 + (combatRandom() - 0.5) * 2 * COMBAT_RANDOMNESS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isLandUnit(unit: UnitDefinition): boolean {
  return LAND_UNIT_TYPES.includes(unit.type);
}

export function isAssaultUnit(unit: UnitDefinition): boolean {
  return ASSAULT_UNIT_TYPES.has(unit.type as LandUnitType);
}

function isAirUnit(unit: UnitDefinition): boolean {
  return AIR_UNIT_TYPES.includes(unit.type);
}

export function isMissileUnit(unit: UnitDefinition): boolean {
  return MISSILE_UNIT_TYPES.includes(unit.type);
}

function isCombatCapableUnit(unit: UnitDefinition): boolean {
  return isLandUnit(unit) || isAirUnit(unit) || isMissileUnit(unit);
}

export function getSupplyCombatModifier(unit: UnitDefinition): number {
  return isLandUnit(unit) && unit.supplyTurnsRemaining <= 0 ? UNSUPPLIED_COMBAT_MODIFIER : 1;
}

function getVeterancyLevel(unit: UnitDefinition): number {
  return Math.min(unit.battlesWon ?? 0, MAX_VETERANCY_LEVEL);
}

export function getVeterancyModifier(unit: UnitDefinition): number {
  return 1 + getVeterancyLevel(unit) * VETERANCY_BONUS_PER_LEVEL;
}

export function getEntrenchmentModifier(unit: UnitDefinition): number {
  const turns = unit.entrenchmentTurns ?? 0;
  return 1 + Math.min(turns * ENTRENCHMENT_BONUS_PER_TURN, MAX_ENTRENCHMENT_BONUS);
}

function getAssaultBounceChance(strengthRatio: number): number {
  if (strengthRatio >= 5) return 0;
  if (strengthRatio >= 4) return 0.05;
  if (strengthRatio >= 3) return 0.12;
  if (strengthRatio >= 2) return 0.22;
  if (strengthRatio >= 1.5) return 0.35;
  if (strengthRatio >= 1.0) return 0.5;
  if (strengthRatio >= 0.7) return 0.65;
  return 0.85;
}

export function getAntiFortModifier(unit: UnitDefinition): number {
  switch (unit.type) {
    case "armor":
      return 1.75;
    case "mlrs":
      return 2.2;
    case "bomber":
      return 1.25;
    case "tacticalMissile":
    case "strategicMissile":
      return 2.4;
    default:
      return 1;
  }
}

export function getFortBombardDamage(unit: UnitDefinition): number {
  switch (unit.type) {
    case "mlrs":
      return Math.max(2, Math.round(unit.strength * 0.8));
    case "bomber":
      return Math.max(1, Math.round(unit.strength * 0.45));
    case "tacticalMissile":
      return 5;
    case "strategicMissile":
      return 8;
    default:
      return 0;
  }
}

function isCountryAtWar(state: GameState, countryId: string): boolean {
  const cs = state.countryStates[countryId as keyof typeof state.countryStates];
  return cs ? cs.atWar : false;
}

export function isEnemyBloc(state: GameState, blocA: BlocId | undefined, blocB: BlocId | undefined): boolean {
  if (blocA === undefined || blocB === undefined) return false;
  return blocA !== blocB;
}

function isNeutralMoldovaClosed(state: GameState, regionId: string): boolean {
  const region = state.regions[regionId];
  if (!region) return false;
  return region.homeCountryId === "MOLDOVA" && region.controllerCountryId === "MOLDOVA" && !isCountryAtWar(state, "MOLDOVA");
}

export function countryHasDoctrine(state: GameState, countryId: CountryId, doctrineId: DoctrineUpgradeId): boolean {
  return state.doctrineUpgrades?.[countryId]?.includes(doctrineId) ?? false;
}

function countBlocUnitsInRegion(state: GameState, regionId: string, blocId: BlocId | undefined): number {
  return Object.values(state.units).filter(
    (unit) => unit.regionId === regionId && unit.blocId === blocId
  ).length;
}

/**
 * Country-level transit rule. `ignoreStacking` lets the AI pathfinder treat a
 * full region as a temporary local obstacle instead of a permanent wall.
 */
export function isRegionOpenForCountryTransit(
  state: GameState,
  countryId: CountryId,
  blocId: BlocId | undefined,
  regionId: string,
  options?: { ignoreStacking?: boolean }
): boolean {
  const targetRegion = state.regions[regionId];
  if (!targetRegion) return false;
  if (isNeutralMoldovaClosed(state, regionId)) return false;

  if (targetRegion.controllerCountryId === countryId) {
    // Check stacking limit for own regions
    if (!options?.ignoreStacking && countBlocUnitsInRegion(state, regionId, blocId) >= MAX_UNITS_PER_REGION) {
      return false;
    }
    return true;
  }

  if (targetRegion.controllerBlocId !== blocId) {
    return false;
  }

  const targetCountry = state.countries[targetRegion.controllerCountryId];
  if (!targetCountry) return false;

  // Check stacking limit for allied regions
  if (!options?.ignoreStacking && countBlocUnitsInRegion(state, regionId, blocId) >= MAX_UNITS_PER_REGION) {
    return false;
  }

  if (targetCountry.alignment === "neutral") {
    return canBlocUseTransit(state, blocId, targetCountry.id);
  }

  return true;
}

function isRegionOpenForTransit(state: GameState, unit: UnitDefinition, targetRegionId: string): boolean {
  return isRegionOpenForCountryTransit(state, unit.countryId, unit.blocId, targetRegionId);
}

function canLaunchAttackFrom(state: GameState, unit: UnitDefinition): boolean {
  const sourceRegion = state.regions[unit.regionId];
  if (!sourceRegion) return false;
  if (sourceRegion.controllerCountryId === unit.countryId) return true;

  const hostCountry = state.countries[sourceRegion.controllerCountryId];
  if (!hostCountry) return false;

  if (hostCountry.blocId !== unit.blocId) {
    return false;
  }

  return isCountryAtWar(state, hostCountry.id);
}

function isAttackableEnemyRegion(state: GameState, unit: UnitDefinition, targetRegionId: string): boolean {
  const targetRegion = state.regions[targetRegionId];
  if (!targetRegion) return false;

  if (!isCountryAtWar(state, unit.countryId)) {
    return false;
  }

  if (!canLaunchAttackFrom(state, unit)) {
    return false;
  }

  if (!isEnemyBloc(state, unit.blocId, targetRegion.controllerBlocId)) {
    return false;
  }

  return isCountryAtWar(state, targetRegion.controllerCountryId);
}

/** Check if a region is reachable for air/missile (within range = 2 regions) */
function isWithinAirRange(state: GameState, unit: UnitDefinition, targetRegionId: string): boolean {
  const unitRegion = state.regions[unit.regionId];
  if (!unitRegion) return false;

  // Range 1: directly adjacent
  if (unitRegion.adjacentRegionIds.includes(targetRegionId)) return true;

  // Range 2: adjacent of adjacent
  for (const adjId of unitRegion.adjacentRegionIds) {
    const adjRegion = state.regions[adjId];
    if (adjRegion && adjRegion.adjacentRegionIds.includes(targetRegionId)) return true;
  }

  return false;
}

/** Find an adjacent friendly region for a unit to retreat to */
function findRetreatRegion(state: GameState, unit: UnitDefinition): string | null {
  const unitRegion = state.regions[unit.regionId];
  if (!unitRegion) return null;

  for (const adjId of unitRegion.adjacentRegionIds) {
    const adjRegion = state.regions[adjId];
    if (!adjRegion) continue;
    // Must be controlled by same bloc and not the region being attacked
    if (adjRegion.controllerBlocId === unit.blocId) {
      return adjId;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. Validate an order
// ---------------------------------------------------------------------------

export function validateOrder(state: GameState, order: Order): boolean {
  const unit = state.units[order.unitId];
  if (!unit) return false;

  // Unit must belong to the current acting country
  if (unit.countryId !== state.currentActorId) return false;

  if (order.type === "hold") return true;

  // Land unit orders: move and attack
  if (order.type === "move" || order.type === "attack") {
    if (order.type === "move" && !isLandUnit(unit)) return false;
    if (order.type === "attack" && !isAssaultUnit(unit)) return false;

    const unitRegion = state.regions[unit.regionId];
    if (!unitRegion) return false;

    // Target must be adjacent
    if (!unitRegion.adjacentRegionIds.includes(order.targetRegionId)) return false;

    const targetRegion = state.regions[order.targetRegionId];
    if (!targetRegion) return false;

    if (order.type === "move") {
      return isRegionOpenForTransit(state, unit, order.targetRegionId);
    }

    if (order.type === "attack") {
      return isAttackableEnemyRegion(state, unit, order.targetRegionId);
    }
  }

  // Air support: fighters boost land attacks
  if (order.type === "airSupport") {
    if (unit.type !== "fighter") return false;
    return isWithinAirRange(state, unit, order.targetRegionId) &&
      isCountryAtWar(state, unit.countryId);
  }

  // Bombardment: bombers attack defenders/facilities
  if (order.type === "bombard") {
    if (unit.type !== "bomber" && unit.type !== "mlrs") return false;
    return isWithinAirRange(state, unit, order.targetRegionId) &&
      isCountryAtWar(state, unit.countryId);
  }

  // Missile strike: one-shot attack
  if (order.type === "missileStrike") {
    if (!isMissileUnit(unit)) return false;
    return isWithinAirRange(state, unit, order.targetRegionId) &&
      isCountryAtWar(state, unit.countryId);
  }

  return false;
}

// ---------------------------------------------------------------------------
// 3. Resolve all orders for a country
// ---------------------------------------------------------------------------

export function resolveOrders(state: GameState, countryId: CountryId): GameState {
  const orders = state.pendingOrders[countryId] ?? [];
  if (orders.length === 0) {
    return {
      ...state,
      combatLog: [],
      pendingOrders: { ...state.pendingOrders, [countryId]: [] },
    };
  }

  // Fresh combat log
  let nextState: GameState = { ...state, combatLog: [] };
  const countryName = state.countries[countryId].name;

  const holdOrders = orders.filter((o) => o.type === "hold");
  const moveOrders = orders.filter((o) => o.type === "move");
  const attackOrders = orders.filter((o) => o.type === "attack");
  const airSupportOrders = orders.filter((o) => o.type === "airSupport");
  const bombardOrders = orders.filter((o) => o.type === "bombard");
  const missileStrikeOrders = orders.filter((o) => o.type === "missileStrike");

  // ── Hold orders: update entrenchment ──
  let updatedUnits = { ...nextState.units };
  for (const order of holdOrders) {
    const unit = updatedUnits[order.unitId];
    if (!unit || !isLandUnit(unit)) continue;
    updatedUnits = {
      ...updatedUnits,
      [order.unitId]: {
        ...unit,
        entrenchmentTurns: (unit.entrenchmentTurns ?? 0) + 1,
      },
    };
  }

  // ── Move orders: relocate units (resets entrenchment) ──
  let eventLog: string[] = [...nextState.eventLog];

  for (const order of moveOrders) {
    const unit = updatedUnits[order.unitId];
    if (!unit) continue;
    const fromRegion = nextState.regions[unit.regionId];
    const toRegion = nextState.regions[order.targetRegionId];
    updatedUnits = {
      ...updatedUnits,
      [order.unitId]: { ...unit, regionId: order.targetRegionId, entrenchmentTurns: 0 },
    };
    if (fromRegion && toRegion) {
      eventLog = [
        ...eventLog,
        `[${countryName}] ${unit.type} moved from ${fromRegion.name} to ${toRegion.name}.`,
      ];
    }
  }

  nextState = { ...nextState, units: updatedUnits, eventLog };

  // ── Pre-combat: Missile strikes (one-shot, consumed after use) ──
  let combatLog: CombatResult[] = [...nextState.combatLog];
  eventLog = [...nextState.eventLog];

  for (const order of missileStrikeOrders) {
    const missile = nextState.units[order.unitId];
    if (!missile) continue;

    const targetRegion = nextState.regions[order.targetRegionId];
    if (!targetRegion) continue;

    const missileBaseDamage = missile.type === "strategicMissile" ? STRATEGIC_MISSILE_DAMAGE : TACTICAL_MISSILE_DAMAGE;
    const hasMissileCorps = countryHasDoctrine(nextState, missile.countryId, "missile_corps");
    const damage = Math.round(missileBaseDamage * (hasMissileCorps ? 1.2 : 1));

    // Damage all enemy units in target region
    let currentUnits = { ...nextState.units };
    const targetUnits = Object.values(currentUnits).filter(
      (u) => u.regionId === order.targetRegionId && isEnemyBloc(nextState, u.blocId, missile.blocId)
    );

    let totalDamageDealt = 0;
    for (const target of targetUnits) {
      const damageShare = Math.ceil(damage / Math.max(targetUnits.length, 1));
      const newStrength = Math.max(0, target.strength - damageShare);
      totalDamageDealt += target.strength - newStrength;
      if (newStrength <= 0) {
        const { [target.id]: _removed, ...remaining } = currentUnits;
        currentUnits = remaining;
      } else {
        currentUnits = { ...currentUnits, [target.id]: { ...target, strength: newStrength } };
      }
    }

    // Strategic missiles can damage facilities
    let facilitiesDamaged: string[] = [];
    let fortDamageDealt = 0;
    if (missile.type === "strategicMissile") {
      const economy = nextState.regionEconomies[order.targetRegionId];
      if (economy) {
        const fort = economy.fortification;
        const nextFortHealth = fort ? Math.max(0, fort.health - getFortBombardDamage(missile)) : 0;
        fortDamageDealt = fort ? fort.health - nextFortHealth : 0;
        const updatedFacilities = economy.facilities.map((f) => {
          if (!f.damaged && combatRandom() < FACILITY_DAMAGE_CHANCE) {
            facilitiesDamaged.push(f.type);
            return { ...f, damaged: true };
          }
          return f;
        });
        nextState = {
          ...nextState,
          regionEconomies: {
            ...nextState.regionEconomies,
            [order.targetRegionId]: {
              ...economy,
              facilities: updatedFacilities,
              fortification: fort
                ? {
                    ...fort,
                    health: nextFortHealth,
                    damaged: nextFortHealth < fort.maxHealth,
                  }
                : undefined,
            },
          },
        };
      }
    }

    // Consume the missile (remove from game)
    const { [missile.id]: _removedMissile, ...remainingUnits } = currentUnits;
    currentUnits = remainingUnits;

    nextState = { ...nextState, units: currentUnits };

    eventLog = [
      ...eventLog,
      `[${countryName}] ${missile.type} struck ${targetRegion.name}! ${totalDamageDealt} unit damage dealt.${fortDamageDealt > 0 ? ` Fort hit for ${fortDamageDealt}.` : ""}${facilitiesDamaged.length > 0 ? ` Facilities damaged: ${facilitiesDamaged.join(", ")}` : ""}`,
    ];
  }

  // ── Pre-combat: Bombardment (bombers weaken defenders) ──
  for (const order of bombardOrders) {
    const artillery = nextState.units[order.unitId];
    if (!artillery) continue;

    const targetRegion = nextState.regions[order.targetRegionId];
    if (!targetRegion) continue;

    let currentUnits = { ...nextState.units };
    const targetUnits = Object.values(currentUnits).filter(
      (u) => u.regionId === order.targetRegionId && isEnemyBloc(nextState, u.blocId, artillery.blocId)
    );
    const defenderHasCounterbattery = targetUnits.some((u) => countryHasDoctrine(nextState, u.countryId, "counterbattery_radar"));
    const damage = Math.round(
      artillery.strength
      * (artillery.type === "mlrs" ? 0.55 : BOMBER_DAMAGE_FACTOR)
      * (countryHasDoctrine(nextState, artillery.countryId, "artillery_doctrine") ? 1.25 : 1)
      * (defenderHasCounterbattery ? 0.8 : 1)
    );

    let totalDamageDealt = 0;
    for (const target of targetUnits) {
      const damageShare = Math.ceil(damage / Math.max(targetUnits.length, 1));
      const newStrength = Math.max(1, target.strength - damageShare); // bombers can't eliminate, min 1
      totalDamageDealt += target.strength - newStrength;
      currentUnits = { ...currentUnits, [target.id]: { ...target, strength: newStrength } };
    }

    // Bomber takes a bit of damage from AA fire (simulated)
    const bombardLossFactor = artillery.type === "mlrs" ? 0.05 : 0.1;
    const aaLoss = Math.round(artillery.strength * bombardLossFactor * randomVariance());
    const artilleryAfter = artillery.strength - aaLoss;
    if (artilleryAfter <= 0) {
      const { [artillery.id]: _removed, ...remaining } = currentUnits;
      currentUnits = remaining;
    } else {
      currentUnits = { ...currentUnits, [artillery.id]: { ...artillery, strength: artilleryAfter } };
    }

    // Chance of facility damage from bombing
    let facilitiesDamaged: string[] = [];
    let fortDamageDealt = 0;
    const economy = nextState.regionEconomies[order.targetRegionId];
    if (economy) {
      const fort = economy.fortification;
      const nextFortHealth = fort ? Math.max(0, fort.health - getFortBombardDamage(artillery)) : 0;
      fortDamageDealt = fort ? fort.health - nextFortHealth : 0;
      const updatedFacilities = economy.facilities.map((f) => {
        if (!f.damaged && combatRandom() < FACILITY_DAMAGE_CHANCE * 0.5) {
          facilitiesDamaged.push(f.type);
          return { ...f, damaged: true };
        }
        return f;
      });
      nextState = {
        ...nextState,
        regionEconomies: {
          ...nextState.regionEconomies,
          [order.targetRegionId]: {
            ...economy,
            facilities: updatedFacilities,
            fortification: fort
              ? {
                  ...fort,
                  health: nextFortHealth,
                  damaged: nextFortHealth < fort.maxHealth,
                }
              : undefined,
          },
        },
      };
    }

    nextState = { ...nextState, units: currentUnits };

    eventLog = [
      ...eventLog,
      `[${countryName}] ${artillery.type === "mlrs" ? "MLRS bombardment" : "Bomber sortie"} on ${targetRegion.name}: ${totalDamageDealt} unit damage dealt.${fortDamageDealt > 0 ? ` Fort hit for ${fortDamageDealt}.` : ""}${facilitiesDamaged.length > 0 ? ` Facilities hit: ${facilitiesDamaged.join(", ")}` : ""}`,
    ];
  }

  // ── Land combat: Group attacks by target region for coordinated assault ──
  const attacksByTarget = new Map<string, Order[]>();
  for (const order of attackOrders) {
    const existing = attacksByTarget.get(order.targetRegionId) ?? [];
    existing.push(order);
    attacksByTarget.set(order.targetRegionId, existing);
  }

  // Calculate air support for each target region
  const airSupportByTarget = new Map<string, number>();
  for (const order of airSupportOrders) {
    const fighter = nextState.units[order.unitId];
    if (!fighter) continue;
    const hasCloseAirSupport = countryHasDoctrine(nextState, fighter.countryId, "close_air_support");
    const currentSupport = airSupportByTarget.get(order.targetRegionId) ?? 0;
    airSupportByTarget.set(
      order.targetRegionId,
      currentSupport + Math.round(fighter.strength * AIR_SUPPORT_MULTIPLIER * (hasCloseAirSupport ? 1.25 : 1))
    );
  }

  for (const [targetRegionId, regionAttackOrders] of attacksByTarget) {
    const targetRegion = nextState.regions[targetRegionId];
    if (!targetRegion) continue;

    // Gather all attacking units
    const attackerUnits = regionAttackOrders
      .map((o) => nextState.units[o.unitId])
      .filter((u): u is UnitDefinition => u !== undefined);

    if (attackerUnits.length === 0) continue;

    // Find defenders
    const defenderUnits = Object.values(nextState.units).filter(
      (u) => u.regionId === targetRegionId && isEnemyBloc(nextState, u.blocId, attackerUnits[0].blocId)
    );

    const defenderUnitIds = defenderUnits.map((u) => u.id);
    const totalDefenderStrengthBefore = defenderUnits.reduce((sum, u) => sum + u.strength, 0);
    const totalAttackerStrengthBefore = attackerUnits.reduce((sum, u) => sum + u.strength, 0);
    const defendingEconomy = nextState.regionEconomies[targetRegionId];
    const defendingFort = defendingEconomy?.fortification;
    const fortIsActive = Boolean(defendingFort && defendingFort.health > 0);
    const fortProtection = fortIsActive ? (FORT_PROTECTION_BY_LEVEL[defendingFort!.level] ?? 0) : 0;
    const fortDefensePower = fortIsActive
      ? (FORT_BASE_POWER_BY_LEVEL[defendingFort!.level] ?? 0) * (defendingFort!.health / Math.max(defendingFort!.maxHealth, 1))
      : 0;

    // Effective attacker strength = sum of (strength × supply × veterancy) + air support
    // Apply doctrine bonuses for attacking country
    const attackerDoctrines = nextState.doctrineUpgrades?.[attackerUnits[0]?.countryId] ?? [];
    const airBonus = airSupportByTarget.get(targetRegionId) ?? 0;
    const hasInfantryDrill = attackerDoctrines.includes("infantry_drill");
    const hasCombinedArms = attackerDoctrines.includes("combined_arms");
    const hasArmoredSpearhead = attackerDoctrines.includes("armored_spearhead");
    const attackingHasInfantry = attackerUnits.some(u => u.type === "infantry");
    const attackingHasArmor = attackerUnits.some(u => u.type === "armor");
    const combinedArmsBonus = hasCombinedArms && attackingHasInfantry && attackingHasArmor ? 1.15 : 1;

    const effectiveAttackerStrength = attackerUnits.reduce(
      (sum, unit) => {
        let unitStr = unit.strength * getSupplyCombatModifier(unit) * getVeterancyModifier(unit);
        if (unit.type === "infantry" && hasInfantryDrill) unitStr *= 1.10;
        if (fortIsActive) {
          unitStr *= getAntiFortModifier(unit);
        }
        return sum + unitStr;
      },
      0
    ) * combinedArmsBonus + airBonus;

    // Effective defender strength = sum of (strength × supply × veterancy × entrenchment) × terrain
    // armored_spearhead: armor ignores terrain modifier
    const effectiveTerrainModifier = getTerrainDefenseModifier(targetRegion.terrain);
    const defenderHasTrenchNetworks = defenderUnits.some((u) => countryHasDoctrine(nextState, u.countryId, "trench_networks"));
    const effectiveDefenderStrength = (
      defenderUnits.reduce(
      (sum, unit) => sum + unit.strength * getSupplyCombatModifier(unit) * getVeterancyModifier(unit) * getEntrenchmentModifier(unit),
      0
      ) * (1 + fortProtection)
    ) * (hasArmoredSpearhead && attackingHasArmor ? 1.0 : effectiveTerrainModifier) * (defenderHasTrenchNetworks ? 1.18 : 1) + fortDefensePower;
    const terrainModifier = effectiveTerrainModifier;  // keep for CombatResult reporting
    const antiFortPower = fortIsActive
      ? attackerUnits.reduce((sum, unit) => sum + unit.strength * getSupplyCombatModifier(unit) * getAntiFortModifier(unit), 0)
      : 0;
    const fortStrengthRatio = fortDefensePower > 0 ? antiFortPower / fortDefensePower : Infinity;

    // Determine outcome by strength ratio with randomness
    const strengthRatio =
      effectiveDefenderStrength > 0 ? effectiveAttackerStrength / effectiveDefenderStrength : Infinity;

    let attackerLossPct: number;
    let defenderLossPct: number;
    let attackerWon: boolean;
    let outcomeLabel: string;

    if (strengthRatio >= 1.5) {
      attackerLossPct = 0.1 * randomVariance();
      defenderLossPct = 0.6 * randomVariance();
      attackerWon = true;
      outcomeLabel = "Decisive attacker victory";
    } else if (strengthRatio >= 1.0) {
      attackerLossPct = 0.25 * randomVariance();
      defenderLossPct = 0.45 * randomVariance();
      attackerWon = true;
      outcomeLabel = "Attacker victory";
    } else if (strengthRatio >= 0.7) {
      attackerLossPct = 0.4 * randomVariance();
      defenderLossPct = 0.35 * randomVariance();
      // With randomness, close battles can swing either way
      attackerWon = combatRandom() < 0.6; // 60% chance attacker wins marginal fights
      outcomeLabel = attackerWon ? "Pyrrhic attacker victory" : "Narrow defender hold";
    } else {
      attackerLossPct = 0.5 * randomVariance();
      defenderLossPct = 0.15 * randomVariance();
      attackerWon = combatRandom() < 0.15; // 15% upset chance
      outcomeLabel = attackerWon ? "Surprising attacker breakthrough" : "Defender holds";
    }

    // Clamp loss percentages
    attackerLossPct = Math.max(0.05, Math.min(0.8, attackerLossPct));
    defenderLossPct = strengthRatio >= 5 ? 1.0 : Math.max(0.05, Math.min(0.8, defenderLossPct));
    if (fortIsActive) {
      const fortPenalty =
        fortStrengthRatio < 0.8 ? 0.18 :
        fortStrengthRatio < 1.2 ? 0.12 :
        fortStrengthRatio < 1.8 ? 0.08 :
        fortStrengthRatio < 2.5 ? 0.04 :
        0.02;
      attackerLossPct = Math.min(0.85, attackerLossPct + fortPenalty);
      defenderLossPct = Math.max(0.03, defenderLossPct * 0.65);
    }

    // Apply losses to attackers (distributed proportionally)
    let currentUnits = { ...nextState.units };
    let totalAttackerStrengthAfter = 0;
    const attackerUnitIds: string[] = [];

    for (const attacker of attackerUnits) {
      const strengthAfter = Math.round(attacker.strength * (1 - attackerLossPct));
      attackerUnitIds.push(attacker.id);
      if (strengthAfter <= 0) {
        const { [attacker.id]: _removed, ...remaining } = currentUnits;
        currentUnits = remaining;
      } else {
        const newRegionId = attackerWon ? targetRegionId : attacker.regionId;
        currentUnits = {
          ...currentUnits,
          [attacker.id]: {
            ...attacker,
            strength: strengthAfter,
            regionId: newRegionId,
            entrenchmentTurns: 0, // moving resets entrenchment
            battlesWon: (attacker.battlesWon ?? 0) + (attackerWon ? 1 : 0),
          },
        };
        totalAttackerStrengthAfter += strengthAfter;
      }
    }

    // Apply losses to fortification before the defender line can collapse
    let fortDamageDealt = 0;
    let fortDestroyed = !fortIsActive;
    if (defendingEconomy?.fortification && fortIsActive) {
      let fortDamageMultiplier = 0.05;
      if (fortStrengthRatio >= 2.5) fortDamageMultiplier = 0.7;
      else if (fortStrengthRatio >= 1.8) fortDamageMultiplier = 0.5;
      else if (fortStrengthRatio >= 1.2) fortDamageMultiplier = 0.35;
      else if (fortStrengthRatio >= 0.8) fortDamageMultiplier = 0.2;

      const nextFortHealth = Math.max(
        0,
        defendingEconomy.fortification.health - Math.max(1, Math.round(antiFortPower * fortDamageMultiplier))
      );
      fortDamageDealt = defendingEconomy.fortification.health - nextFortHealth;
      fortDestroyed = nextFortHealth <= 0;
      nextState = {
        ...nextState,
        regionEconomies: {
          ...nextState.regionEconomies,
          [targetRegionId]: {
            ...defendingEconomy,
            fortification: {
              ...defendingEconomy.fortification,
              health: nextFortHealth,
              damaged: nextFortHealth < defendingEconomy.fortification.maxHealth,
            },
          },
        },
      };
    }

    // Apply losses to defenders with retreat mechanic
    let totalDefenderStrengthAfter = 0;
    const retreatedUnitIds: string[] = [];

    let retreatChance = 0.20;
    if (strengthRatio >= 5) retreatChance = 0.0;
    else if (strengthRatio >= 4) retreatChance = 0.05;
    else if (strengthRatio >= 3) retreatChance = 0.10;
    else if (strengthRatio >= 2) retreatChance = 0.15;

    for (const defender of defenderUnits) {
      const defStrengthAfter = Math.round(defender.strength * (1 - defenderLossPct));
      if (defStrengthAfter <= 0) {
        // Try to retreat instead of being destroyed
        const retreatTarget = findRetreatRegion(nextState, defender);
        if (retreatTarget && combatRandom() < retreatChance) {
          // Successful retreat: survive with 1 strength + retreat loss
          const retreatStrength = Math.max(1, Math.round(defender.strength * RETREAT_STRENGTH_LOSS));
          currentUnits = {
            ...currentUnits,
            [defender.id]: {
              ...defender,
              strength: retreatStrength,
              regionId: retreatTarget,
              entrenchmentTurns: 0,
            },
          };
          totalDefenderStrengthAfter += retreatStrength;
          retreatedUnitIds.push(defender.id);
        } else {
          const { [defender.id]: _removed, ...remaining } = currentUnits;
          currentUnits = remaining;
        }
      } else {
        currentUnits = {
          ...currentUnits,
          [defender.id]: {
            ...defender,
            strength: defStrengthAfter,
            battlesWon: (defender.battlesWon ?? 0) + (!attackerWon ? 1 : 0),
          },
        };
        totalDefenderStrengthAfter += defStrengthAfter;
      }
    }

    nextState = { ...nextState, units: currentUnits };

    // If attacker won but not all defenders eliminated (some retreated),
    // attackers still occupy only if defenders cleared from this region
    let remainingDefendersInTarget = Object.values(nextState.units).filter(
      (u) => u.regionId === targetRegionId && isEnemyBloc(nextState, u.blocId, attackerUnits[0].blocId)
    );

    let allDefendersCleared = remainingDefendersInTarget.length === 0;
    let assaultBounced = false;

    if (attackerWon && !allDefendersCleared) {
      const bounceChance = getAssaultBounceChance(strengthRatio);
      assaultBounced = combatRandom() < bounceChance;

      if (assaultBounced) {
        let fixedUnits = { ...nextState.units };
        for (const attacker of attackerUnits) {
          const surviving = fixedUnits[attacker.id];
          if (surviving && surviving.regionId === targetRegionId) {
            fixedUnits = {
              ...fixedUnits,
              [attacker.id]: {
                ...surviving,
                regionId: attacker.regionId,
                battlesWon: Math.max(0, (surviving.battlesWon ?? 0) - 1),
              },
            };
          }
        }
        nextState = { ...nextState, units: fixedUnits };
      } else {
        let routedUnits = { ...nextState.units };
        for (const defender of remainingDefendersInTarget) {
          const surviving = routedUnits[defender.id];
          if (!surviving) continue;
          const retreatTarget = findRetreatRegion(nextState, surviving);
          if (retreatTarget) {
            routedUnits = {
              ...routedUnits,
              [defender.id]: {
                ...surviving,
                regionId: retreatTarget,
                entrenchmentTurns: 0,
              },
            };
            if (!retreatedUnitIds.includes(defender.id)) {
              retreatedUnitIds.push(defender.id);
            }
          } else {
            const { [defender.id]: _removed, ...remaining } = routedUnits;
            routedUnits = remaining;
          }
        }
        nextState = { ...nextState, units: routedUnits };
        remainingDefendersInTarget = Object.values(nextState.units).filter(
          (u) => u.regionId === targetRegionId && isEnemyBloc(nextState, u.blocId, attackerUnits[0].blocId)
        );
        allDefendersCleared = remainingDefendersInTarget.length === 0;
      }
    }

    const fortStillHolding = Boolean(nextState.regionEconomies[targetRegionId]?.fortification && (nextState.regionEconomies[targetRegionId].fortification!.health > 0));
    const noDefendingUnitsRemain = allDefendersCleared;
    const fortOnlyStoppedCapture = fortStillHolding && noDefendingUnitsRemain;
    const attackerCaptured = fortDestroyed && noDefendingUnitsRemain
      ? totalAttackerStrengthAfter > 0
      : attackerWon && allDefendersCleared && !fortStillHolding;

    if (fortOnlyStoppedCapture) {
      let fixedUnits = { ...nextState.units };
      for (const attacker of attackerUnits) {
        const surviving = fixedUnits[attacker.id];
        if (surviving && surviving.regionId === targetRegionId) {
          fixedUnits = {
            ...fixedUnits,
            [attacker.id]: {
              ...surviving,
              regionId: attacker.regionId,
              battlesWon: Math.max(0, (surviving.battlesWon ?? 0) - 1),
            },
          };
        }
      }
      nextState = { ...nextState, units: fixedUnits };
      assaultBounced = false;
    }

    if (attackerCaptured && !attackerWon) {
      let occupyingUnits = { ...nextState.units };
      for (const attacker of attackerUnits) {
        const surviving = occupyingUnits[attacker.id];
        if (!surviving) continue;
        occupyingUnits = {
          ...occupyingUnits,
          [attacker.id]: {
            ...surviving,
            regionId: targetRegionId,
            entrenchmentTurns: 0,
          },
        };
      }
      nextState = { ...nextState, units: occupyingUnits };
    }

    if (attackerCaptured) {
      nextState = setRegionController(nextState, targetRegionId, attackerUnits[0].countryId);

      // Facility damage chance from heavy combat
      const economy = nextState.regionEconomies[targetRegionId];
      if (economy && strengthRatio < 1.2) {
        const damagedFacilities: string[] = [];
        const updatedFacilities = economy.facilities.map((f) => {
          if (!f.damaged && combatRandom() < FACILITY_DAMAGE_CHANCE * 0.3) {
            damagedFacilities.push(f.type);
            return { ...f, damaged: true };
          }
          return f;
        });
        if (damagedFacilities.length > 0) {
          nextState = {
            ...nextState,
            regionEconomies: {
              ...nextState.regionEconomies,
              [targetRegionId]: { ...economy, facilities: updatedFacilities },
            },
          };
          eventLog = [...eventLog, `Facilities damaged in ${targetRegion.name}: ${damagedFacilities.join(", ")}`];
        }
      }
    }

    // Combat result
    const result: CombatResult = {
      attackerUnitId: attackerUnits[0].id,
      attackerUnitIds,
      defenderUnitIds,
      regionId: targetRegionId,
      attackerStrengthBefore: totalAttackerStrengthBefore,
      defenderStrengthBefore: totalDefenderStrengthBefore,
      attackerStrengthAfter: totalAttackerStrengthAfter,
      defenderStrengthAfter: totalDefenderStrengthAfter,
      attackerWon: attackerCaptured,
      terrainModifier,
      airSupportBonus: airBonus > 0 ? airBonus : undefined,
      facilitiesDamaged: fortDamageDealt > 0 ? [`fort:${fortDamageDealt}`] : undefined,
      retreatedUnitIds: retreatedUnitIds.length > 0 ? retreatedUnitIds : undefined,
    };

    combatLog = [...combatLog, result];

    const ratioDisplay = effectiveDefenderStrength > 0
      ? (effectiveAttackerStrength / effectiveDefenderStrength).toFixed(2)
      : "INF";

    const coordinatedLabel = attackerUnits.length > 1 ? ` (${attackerUnits.length} units coordinated)` : "";
    const airLabel = airBonus > 0 ? ` [Air +${airBonus}]` : "";
    const retreatLabel = retreatedUnitIds.length > 0 ? ` [${retreatedUnitIds.length} retreated]` : "";
    const fortLabel = fortDamageDealt > 0 ? ` [fort -${fortDamageDealt}${fortDestroyed ? ", broken" : ""}]` : "";
    const bounceLabel = fortOnlyStoppedCapture
      ? " [fort held]"
      : assaultBounced
        ? " [assault bounced]"
        : attackerWon && !assaultBounced && retreatedUnitIds.length > 0
          ? " [defenders routed]"
          : "";

    eventLog = [
      ...eventLog,
      `Battle of ${targetRegion.name}: ${coordinatedLabel}${airLabel} Ratio ${ratioDisplay}. ${outcomeLabel}.${retreatLabel}${fortLabel}${bounceLabel}`,
    ];
  }

  // ── Air-to-air combat: check for enemy fighters contesting air support ──
  // (Fighters in defended regions can intercept attacking air support)
  for (const order of airSupportOrders) {
    const fighter = nextState.units[order.unitId];
    if (!fighter) continue;

    const enemyFighters = Object.values(nextState.units).filter(
      (u) => u.type === "fighter" &&
        u.regionId === order.targetRegionId &&
        isEnemyBloc(nextState, u.blocId, fighter.blocId)
    );

    if (enemyFighters.length > 0) {
      // Air superiority combat
      const hasAirSuperiorityDoctrine = nextState.doctrineUpgrades?.[fighter.countryId]?.includes("air_superiority") ?? false;
      const enemyStr = enemyFighters.reduce((sum, f) => sum + f.strength, 0);
      const myStr = hasAirSuperiorityDoctrine ? fighter.strength * 1.3 : fighter.strength;
      const ratio = myStr / Math.max(enemyStr, 1);

      let myLoss = ratio >= 1 ? 0.15 : 0.35;
      let enemyLoss = ratio >= 1 ? 0.35 : 0.15;
      if (hasAirSuperiorityDoctrine) { myLoss *= 0.7; enemyLoss *= 1.3; }
      myLoss *= randomVariance();
      enemyLoss *= randomVariance();

      let currentUnits = { ...nextState.units };
      const fighterAfter = Math.round(fighter.strength * (1 - myLoss));
      if (fighterAfter <= 0) {
        const { [fighter.id]: _removed, ...remaining } = currentUnits;
        currentUnits = remaining;
      } else {
        currentUnits = { ...currentUnits, [fighter.id]: { ...fighter, strength: fighterAfter } };
      }

      for (const eF of enemyFighters) {
        const eFAfter = Math.round(eF.strength * (1 - enemyLoss));
        if (eFAfter <= 0) {
          const { [eF.id]: _removed, ...remaining } = currentUnits;
          currentUnits = remaining;
        } else {
          currentUnits = { ...currentUnits, [eF.id]: { ...eF, strength: eFAfter } };
        }
      }

      nextState = { ...nextState, units: currentUnits };

      const targetRegion = nextState.regions[order.targetRegionId];
      eventLog = [
        ...eventLog,
        `Air combat over ${targetRegion?.name ?? "?"}: ${countryName} fighter vs ${enemyFighters.length} enemy interceptor(s).`,
      ];
    }
  }

  // ── Clear pending orders ──
  nextState = {
    ...nextState,
    combatLog,
    eventLog,
    pendingOrders: { ...nextState.pendingOrders, [countryId]: [] },
  };

  return nextState;
}

// ---------------------------------------------------------------------------
// 4. Issue an order
// ---------------------------------------------------------------------------

export function issueOrder(state: GameState, order: Order): GameState {
  const unit = state.units[order.unitId];
  if (!unit) return state;
  if (!validateOrder(state, order)) return state;

  const countryId = unit.countryId;
  const existing = state.pendingOrders[countryId] ?? [];

  // Replace any existing order for the same unitId
  const filtered = existing.filter((o) => o.unitId !== order.unitId);

  return {
    ...state,
    pendingOrders: {
      ...state.pendingOrders,
      [countryId]: [...filtered, order],
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Clear orders for a bloc
// ---------------------------------------------------------------------------

export function clearOrders(state: GameState, countryId: CountryId): GameState {
  return {
    ...state,
    pendingOrders: { ...state.pendingOrders, [countryId]: [] },
  };
}

// ---------------------------------------------------------------------------
// 6. Get valid targets for a unit
// ---------------------------------------------------------------------------

export function getValidTargets(
  state: GameState,
  unitId: string
): { moves: string[]; attacks: string[]; airTargets: string[]; bombardTargets: string[]; missileTargets: string[] } {
  const unit = state.units[unitId];
  if (!unit || !isCombatCapableUnit(unit)) {
    return { moves: [], attacks: [], airTargets: [], bombardTargets: [], missileTargets: [] };
  }

  const unitRegion = state.regions[unit.regionId];
  if (!unitRegion) {
    return { moves: [], attacks: [], airTargets: [], bombardTargets: [], missileTargets: [] };
  }

  const moves: string[] = [];
  const attacks: string[] = [];
  const airTargets: string[] = [];
  const bombardTargets: string[] = [];
  const missileTargets: string[] = [];

  if (isLandUnit(unit)) {
    for (const adjId of unitRegion.adjacentRegionIds) {
      if (isAssaultUnit(unit) && isAttackableEnemyRegion(state, unit, adjId)) {
        attacks.push(adjId);
        continue;
      }
      if (isRegionOpenForTransit(state, unit, adjId)) {
        moves.push(adjId);
      }
    }
  }

  if (unit.type === "fighter" && isCountryAtWar(state, unit.countryId)) {
    // Fighter can provide air support or move to adjacent friendly region
    for (const adjId of unitRegion.adjacentRegionIds) {
      if (isRegionOpenForTransit(state, unit, adjId)) {
        moves.push(adjId);
      }
    }
    // Air support: all enemy regions in range
    const allInRange = new Set<string>();
    for (const adjId of unitRegion.adjacentRegionIds) {
      allInRange.add(adjId);
      const adj = state.regions[adjId];
      if (adj) {
        for (const adj2 of adj.adjacentRegionIds) {
          allInRange.add(adj2);
        }
      }
    }
    for (const rid of allInRange) {
      if (isAttackableEnemyRegion(state, unit, rid)) {
        airTargets.push(rid);
      }
    }
  }

  if (unit.type === "bomber" && isCountryAtWar(state, unit.countryId)) {
    // Bomber can move or bombard
    for (const adjId of unitRegion.adjacentRegionIds) {
      if (isRegionOpenForTransit(state, unit, adjId)) {
        moves.push(adjId);
      }
    }
    const allInRange = new Set<string>();
    for (const adjId of unitRegion.adjacentRegionIds) {
      allInRange.add(adjId);
      const adj = state.regions[adjId];
      if (adj) {
        for (const adj2 of adj.adjacentRegionIds) {
          allInRange.add(adj2);
        }
      }
    }
    for (const rid of allInRange) {
      const tRegion = state.regions[rid];
      if (tRegion && isEnemyBloc(state, unit.blocId, tRegion.controllerBlocId) && isCountryAtWar(state, tRegion.controllerCountryId)) {
        bombardTargets.push(rid);
      }
    }
  }

  if (unit.type === "mlrs" && isCountryAtWar(state, unit.countryId)) {
    for (const adjId of unitRegion.adjacentRegionIds) {
      const tRegion = state.regions[adjId];
      if (tRegion && isEnemyBloc(state, unit.blocId, tRegion.controllerBlocId) && isCountryAtWar(state, tRegion.controllerCountryId)) {
        bombardTargets.push(adjId);
      }
    }
  }

  if (isMissileUnit(unit) && isCountryAtWar(state, unit.countryId)) {
    const allInRange = new Set<string>();
    for (const adjId of unitRegion.adjacentRegionIds) {
      allInRange.add(adjId);
      const adj = state.regions[adjId];
      if (adj) {
        for (const adj2 of adj.adjacentRegionIds) {
          allInRange.add(adj2);
        }
      }
    }
    for (const rid of allInRange) {
      const tRegion = state.regions[rid];
      if (tRegion && isEnemyBloc(state, unit.blocId, tRegion.controllerBlocId) && isCountryAtWar(state, tRegion.controllerCountryId)) {
        missileTargets.push(rid);
      }
    }
  }

  return { moves, attacks, airTargets, bombardTargets, missileTargets };
}
