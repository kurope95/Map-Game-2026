import type { GameState, UnitDefinition } from "../state/types";
import {
  AIR_SUPPORT_MULTIPLIER,
  BOMBER_DAMAGE_FACTOR,
  FORT_BASE_POWER_BY_LEVEL,
  FORT_PROTECTION_BY_LEVEL,
  STRATEGIC_MISSILE_DAMAGE,
  TACTICAL_MISSILE_DAMAGE,
  countryHasDoctrine,
  getAntiFortModifier,
  getEntrenchmentModifier,
  getFortBombardDamage,
  getSupplyCombatModifier,
  getTerrainDefenseModifier,
  getVeterancyModifier,
  isAssaultUnit,
  isEnemyBloc,
  isMissileUnit
} from "./orderResolution";

export type AttackBand = "decisive" | "likely" | "marginal" | "unlikely";

export interface AttackEstimate {
  band: AttackBand;
  /** Attacker/defender effective strength; Infinity when nothing defends the region. */
  ratio: number;
  /** Fractions of current unit strength (0–1): the resolver's base ±15%, clamped and fort-adjusted. */
  attackerLossPct: { min: number; max: number };
  defenderLossPct: { min: number; max: number };
  attackerStrength: number;
  defenderStrength: number;
  airSupportBonus: number;
  support: { fighters: number; bombardments: number; missiles: number };
  /** `attackerLossPenaltyPct` is a fraction (0.12 = +12 percentage points of losses). */
  fort: { level: number; health: number; maxHealth: number; attackerLossPenaltyPct: number } | null;
  /** Caveats worth showing next to the numbers; the UI renders them as-is. */
  notes: string[];
}

// Mirrors the resolver's loss table in `resolveOrders`; the characterization and loss tests pin it.
const LOSS_BASE: Record<AttackBand, { attacker: number; defender: number }> = {
  decisive: { attacker: 0.1, defender: 0.6 },
  likely: { attacker: 0.25, defender: 0.45 },
  marginal: { attacker: 0.4, defender: 0.35 },
  unlikely: { attacker: 0.5, defender: 0.15 }
};
const VARIANCE = 0.15; // COMBAT_RANDOMNESS in the resolver
const MIN_LOSS = 0.05;
const MAX_LOSS = 0.8;
const MAX_FORT_ATTACKER_LOSS = 0.85;
const MIN_FORT_DEFENDER_LOSS = 0.03;
const FORT_DEFENDER_LOSS_FACTOR = 0.65;
const MLRS_BOMBARD_FACTOR = 0.55;

function bandFor(ratio: number): AttackBand {
  if (ratio >= 1.5) return "decisive";
  if (ratio >= 1.0) return "likely";
  if (ratio >= 0.7) return "marginal";
  return "unlikely";
}

function lossRange(base: number): { min: number; max: number } {
  return {
    min: Math.max(MIN_LOSS, Math.min(MAX_LOSS, base * (1 - VARIANCE))),
    max: Math.max(MIN_LOSS, Math.min(MAX_LOSS, base * (1 + VARIANCE)))
  };
}

/** The fort's attrition penalty from the resolver's anti-fort / fort-power ratio. */
function fortPenaltyFor(fortStrengthRatio: number): number {
  if (fortStrengthRatio < 0.8) return 0.18;
  if (fortStrengthRatio < 1.2) return 0.12;
  if (fortStrengthRatio < 1.8) return 0.08;
  if (fortStrengthRatio < 2.5) return 0.04;
  return 0.02;
}

interface LivingDefender {
  unit: UnitDefinition;
  strength: number;
}

function damageShare(damage: number, defenderCount: number): number {
  return Math.ceil(damage / Math.max(defenderCount, 1));
}

/**
 * A deterministic mirror of the land-battle calculation in `resolveOrders`, used by the hover
 * tooltip. It includes the player's pending air support, bombardment and missile orders, never
 * calls the seeded RNG, and does not mutate the state. The resolver stays the source of truth.
 */
export function estimateAttack(
  state: GameState,
  attackerUnitIds: readonly string[],
  targetRegionId: string
): AttackEstimate | null {
  const target = state.regions[targetRegionId];
  if (!target) return null;

  const selected = attackerUnitIds
    .map((unitId) => state.units[unitId])
    .filter((unit): unit is UnitDefinition => unit !== undefined);
  if (selected.length === 0) return null;

  const attackers = selected.filter(isAssaultUnit);
  const attackerBlocId = (attackers[0] ?? selected[0]).blocId;

  // ── Pending player support targeting this region, applied in resolver order ──
  const pending = state.pendingOrders?.[state.playerCountryId] ?? [];
  const supportOrders = pending.filter((order) => order.targetRegionId === targetRegionId);

  const defenderUnits = Object.values(state.units).filter(
    (unit) => unit.regionId === targetRegionId && isEnemyBloc(state, unit.blocId, attackerBlocId)
  );
  const defenderStrengths = new Map(defenderUnits.map((unit) => [unit.id, unit.strength]));
  const livingDefenders = (): LivingDefender[] =>
    defenderUnits
      .map((unit) => ({ unit, strength: defenderStrengths.get(unit.id) ?? 0 }))
      .filter((defender) => defender.strength > 0);

  const applyDamage = (damage: number, floor: number): void => {
    const living = livingDefenders();
    const share = damageShare(damage, living.length);
    for (const defender of living) {
      const next = Math.max(floor, defender.strength - share);
      if (next <= 0) defenderStrengths.delete(defender.unit.id);
      else defenderStrengths.set(defender.unit.id, next);
    }
  };

  const economy = state.regionEconomies[targetRegionId];
  const fort = economy?.fortification;
  let fortHealth = fort?.health ?? 0;

  let missiles = 0;
  for (const order of supportOrders) {
    if (order.type !== "missileStrike") continue;
    const missile = state.units[order.unitId];
    if (!missile || !isMissileUnit(missile)) continue;
    missiles += 1;
    const baseDamage = missile.type === "strategicMissile" ? STRATEGIC_MISSILE_DAMAGE : TACTICAL_MISSILE_DAMAGE;
    const damage = Math.round(
      baseDamage * (countryHasDoctrine(state, missile.countryId, "missile_corps") ? 1.2 : 1)
    );
    applyDamage(damage, 0);
    if (missile.type === "strategicMissile") {
      fortHealth = Math.max(0, fortHealth - getFortBombardDamage(missile));
    }
  }

  let bombardments = 0;
  for (const order of supportOrders) {
    if (order.type !== "bombard") continue;
    const artillery = state.units[order.unitId];
    if (!artillery || (artillery.type !== "bomber" && artillery.type !== "mlrs")) continue;
    bombardments += 1;
    const defenderHasCounterbattery = livingDefenders().some((defender) =>
      countryHasDoctrine(state, defender.unit.countryId, "counterbattery_radar")
    );
    const damage = Math.round(
      artillery.strength
      * (artillery.type === "mlrs" ? MLRS_BOMBARD_FACTOR : BOMBER_DAMAGE_FACTOR)
      * (countryHasDoctrine(state, artillery.countryId, "artillery_doctrine") ? 1.25 : 1)
      * (defenderHasCounterbattery ? 0.8 : 1)
    );
    applyDamage(damage, 1); // bombers and MLRS cannot eliminate the last strength point
    fortHealth = Math.max(0, fortHealth - getFortBombardDamage(artillery));
  }

  let fighters = 0;
  let airSupportBonus = 0;
  for (const order of supportOrders) {
    if (order.type !== "airSupport") continue;
    const fighter = state.units[order.unitId];
    if (!fighter || fighter.type !== "fighter") continue;
    fighters += 1;
    airSupportBonus += Math.round(
      fighter.strength
      * AIR_SUPPORT_MULTIPLIER
      * (countryHasDoctrine(state, fighter.countryId, "close_air_support") ? 1.25 : 1)
    );
  }

  // ── Effective attacker strength (same formula as the resolver) ──
  const fortIsActive = Boolean(fort && fortHealth > 0);
  const fortProtection = fortIsActive ? FORT_PROTECTION_BY_LEVEL[fort!.level] ?? 0 : 0;
  const fortDefensePower = fortIsActive
    ? (FORT_BASE_POWER_BY_LEVEL[fort!.level] ?? 0) * (fortHealth / Math.max(fort!.maxHealth, 1))
    : 0;

  const attackerDoctrines = attackers[0] ? state.doctrineUpgrades?.[attackers[0].countryId] ?? [] : [];
  const hasInfantryDrill = attackerDoctrines.includes("infantry_drill");
  const hasCombinedArms = attackerDoctrines.includes("combined_arms");
  const hasArmoredSpearhead = attackerDoctrines.includes("armored_spearhead");
  const attackingHasInfantry = attackers.some((unit) => unit.type === "infantry");
  const attackingHasArmor = attackers.some((unit) => unit.type === "armor");
  const combinedArmsBonus = hasCombinedArms && attackingHasInfantry && attackingHasArmor ? 1.15 : 1;

  const attackerStrength =
    attackers.reduce((sum, unit) => {
      let strength = unit.strength * getSupplyCombatModifier(unit) * getVeterancyModifier(unit);
      if (unit.type === "infantry" && hasInfantryDrill) strength *= 1.1;
      if (fortIsActive) strength *= getAntiFortModifier(unit);
      return sum + strength;
    }, 0) * combinedArmsBonus + airSupportBonus;

  // ── Effective defender strength ──
  const survivors = livingDefenders();
  const terrainModifier = getTerrainDefenseModifier(target.terrain);
  const defenderHasTrenchNetworks = survivors.some((defender) =>
    countryHasDoctrine(state, defender.unit.countryId, "trench_networks")
  );
  const defenderStrength =
    survivors.reduce(
      (sum, defender) =>
        sum
        + defender.strength
        * getSupplyCombatModifier(defender.unit)
        * getVeterancyModifier(defender.unit)
        * getEntrenchmentModifier(defender.unit),
      0
    ) * (1 + fortProtection)
    * (hasArmoredSpearhead && attackingHasArmor ? 1.0 : terrainModifier)
    * (defenderHasTrenchNetworks ? 1.18 : 1)
    + fortDefensePower;

  const ratio = defenderStrength > 0 ? attackerStrength / defenderStrength : Infinity;
  const band = bandFor(ratio);

  const antiFortPower = fortIsActive
    ? attackers.reduce(
        (sum, unit) => sum + unit.strength * getSupplyCombatModifier(unit) * getAntiFortModifier(unit),
        0
      )
    : 0;
  const fortStrengthRatio = fortDefensePower > 0 ? antiFortPower / fortDefensePower : Infinity;
  const fortPenalty = fortIsActive ? fortPenaltyFor(fortStrengthRatio) : 0;

  let attackerLossPct = lossRange(LOSS_BASE[band].attacker);
  let defenderLossPct = ratio >= 5 ? { min: 1, max: 1 } : lossRange(LOSS_BASE[band].defender);
  if (fortIsActive) {
    attackerLossPct = {
      min: Math.min(MAX_FORT_ATTACKER_LOSS, attackerLossPct.min + fortPenalty),
      max: Math.min(MAX_FORT_ATTACKER_LOSS, attackerLossPct.max + fortPenalty)
    };
    defenderLossPct = {
      min: Math.max(MIN_FORT_DEFENDER_LOSS, defenderLossPct.min * FORT_DEFENDER_LOSS_FACTOR),
      max: Math.max(MIN_FORT_DEFENDER_LOSS, defenderLossPct.max * FORT_DEFENDER_LOSS_FACTOR)
    };
  }

  const notes: string[] = [];
  if (survivors.length === 0) {
    notes.push(
      fortIsActive
        ? "No defending units; the fort must be broken to capture the region."
        : "No defenders: the region should fall."
    );
  } else if (fortIsActive) {
    notes.push("Capture is not guaranteed: defenders can retreat and the fort can hold.");
  } else {
    notes.push("Defenders can retreat, so capture is not guaranteed.");
  }

  return {
    band,
    ratio,
    attackerLossPct,
    defenderLossPct,
    attackerStrength,
    defenderStrength,
    airSupportBonus,
    support: { fighters, bombardments, missiles },
    fort: fortIsActive
      ? {
          level: fort!.level,
          health: fortHealth,
          maxHealth: fort!.maxHealth,
          attackerLossPenaltyPct: fortPenalty
        }
      : null,
    notes
  };
}
