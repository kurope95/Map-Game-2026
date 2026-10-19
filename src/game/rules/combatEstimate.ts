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
  getAssaultBounceChance,
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
  /**
   * Fractions of current unit strength (0–1) the attackers lose: the resolver's base ±15%, clamped and fort-adjusted,
   * after its per-unit rounding (so this is the real spread of outcomes, not the nominal percentages).
   */
  attackerLossPct: { min: number; max: number };
  /** The same for the defenders that are still in the region when the battle starts; 0–0 when there are none. */
  defenderLossPct: { min: number; max: number };
  attackerStrength: number;
  defenderStrength: number;
  /** Units counted as attackers: the selection plus attack orders already queued on this region. */
  attackerCount: number;
  /** How many of those are attack orders already queued (not part of the selection). */
  queuedAttackers: number;
  /** Enemy units in the region when the battle starts (after the player's queued bombardments and missiles). */
  defenderCount: number;
  airSupportBonus: number;
  support: { fighters: number; bombardments: number; missiles: number };
  /**
   * `attackerLossPenaltyPct` is a fraction (0.12 = +12 percentage points of losses). The assault damages the fort by a
   * fixed amount (no dice): `healthAfter` is what is left, and the fort `holds` while that is above zero.
   */
  fort: {
    level: number;
    health: number;
    maxHealth: number;
    attackerLossPenaltyPct: number;
    healthAfter: number;
    holds: boolean;
  } | null;
  /** Chance (0–1) that the region changes hands this turn; 0 while a fort survives the assault. */
  captureChance: number;
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
// The resolver rolls these for marginal (0.7–1.0) and unlikely (< 0.7) battles; 1.0 and above always wins.
const WIN_CHANCE_MARGINAL = 0.6;
const WIN_CHANCE_UNLIKELY = 0.15;

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

/** The share of anti-fort power that becomes fort damage (the resolver's thresholds). */
function fortDamageMultiplierFor(fortStrengthRatio: number): number {
  if (fortStrengthRatio >= 2.5) return 0.7;
  if (fortStrengthRatio >= 1.8) return 0.5;
  if (fortStrengthRatio >= 1.2) return 0.35;
  if (fortStrengthRatio >= 0.8) return 0.2;
  return 0.05;
}

/**
 * The fraction of `strengths` lost when every unit is cut to round(strength × (1 − loss)), as the resolver does
 * (a unit that rounds to zero is gone). More loss never leaves more, so evaluating the two ends of the variance
 * range gives the true minimum and maximum.
 */
function lossFraction(strengths: readonly number[], loss: number): number {
  const total = strengths.reduce((sum, strength) => sum + strength, 0);
  if (total <= 0) return 0;
  const remaining = strengths.reduce((sum, strength) => sum + Math.max(0, Math.round(strength * (1 - loss))), 0);
  return (total - remaining) / total;
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
 * tooltip. It includes the player's pending air support, bombardment and missile orders and the attack orders
 * already queued on the region (the resolver pools them), never calls the seeded RNG, and does not mutate the
 * state. The resolver stays the source of truth; `combatEstimate.resolver.test.ts` checks the two against each other.
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

  // ── Pending player orders aimed at this region ──
  const pending = state.pendingOrders?.[state.playerCountryId] ?? [];
  const supportOrders = pending.filter((order) => order.targetRegionId === targetRegionId);

  // The resolver groups every attack order on a region into one assault, so attacks the player has already queued
  // here fight together with the selection (a selected unit whose attack is already queued counts once).
  const selectedAssault = selected.filter(isAssaultUnit);
  const selectedIds = new Set(selectedAssault.map((unit) => unit.id));
  const queuedAttackers = [
    ...new Map(
      supportOrders
        .filter((order) => order.type === "attack" && !selectedIds.has(order.unitId))
        .map((order) => state.units[order.unitId])
        .filter((unit): unit is UnitDefinition => unit !== undefined && isAssaultUnit(unit))
        .map((unit) => [unit.id, unit] as const)
    ).values()
  ];
  const attackers = [...selectedAssault, ...queuedAttackers];
  const attackerBlocId = (attackers[0] ?? selected[0]).blocId;

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

  // ── Loss ranges: the variance extremes, cut to whole units the way the resolver does ──
  const attackerBase = lossRange(LOSS_BASE[band].attacker);
  const defenderBase = ratio >= 5 ? { min: 1, max: 1 } : lossRange(LOSS_BASE[band].defender);
  let attackerLow = attackerBase.min;
  let attackerHigh = attackerBase.max;
  let defenderLow = defenderBase.min;
  let defenderHigh = defenderBase.max;
  if (fortIsActive) {
    attackerLow = Math.min(MAX_FORT_ATTACKER_LOSS, attackerLow + fortPenalty);
    attackerHigh = Math.min(MAX_FORT_ATTACKER_LOSS, attackerHigh + fortPenalty);
    defenderLow = Math.max(MIN_FORT_DEFENDER_LOSS, defenderLow * FORT_DEFENDER_LOSS_FACTOR);
    defenderHigh = Math.max(MIN_FORT_DEFENDER_LOSS, defenderHigh * FORT_DEFENDER_LOSS_FACTOR);
  }
  const attackerUnitStrengths = attackers.map((unit) => unit.strength);
  const survivorStrengths = survivors.map((defender) => defender.strength);
  const attackerLossPct = {
    min: lossFraction(attackerUnitStrengths, attackerLow),
    max: lossFraction(attackerUnitStrengths, attackerHigh)
  };
  const defenderLossPct =
    survivors.length > 0
      ? { min: lossFraction(survivorStrengths, defenderLow), max: lossFraction(survivorStrengths, defenderHigh) }
      : { min: 0, max: 0 };

  // ── The fort: damaged by a fixed amount, and while it stands the region cannot be taken ──
  const fortDamage = fortIsActive ? Math.max(1, Math.round(antiFortPower * fortDamageMultiplierFor(fortStrengthRatio))) : 0;
  const fortHealthAfter = fortIsActive ? Math.max(0, fortHealth - fortDamage) : 0;
  const fortHolds = fortIsActive && fortHealthAfter > 0;

  // ── Capture: no fort left standing and no defender left in the region ──
  let captureChance: number;
  if (fortHolds) {
    captureChance = 0;
  } else if (survivors.length === 0) {
    captureChance = 1;
  } else {
    const meanDefenderLoss = (defenderLow + defenderHigh) / 2;
    const someSurvive = survivors.some((defender) => Math.round(defender.strength * (1 - meanDefenderLoss)) >= 1);
    const winChance = ratio >= 1.0 ? 1 : ratio >= 0.7 ? WIN_CHANCE_MARGINAL : WIN_CHANCE_UNLIKELY;
    // surviving defenders only give way if the battle is won and the assault does not bounce back
    captureChance = someSurvive ? winChance * (1 - getAssaultBounceChance(ratio)) : 1;
  }

  const notes: string[] = [];
  if (queuedAttackers.length > 0) {
    const count = queuedAttackers.length;
    notes.push(`Counts ${count} attack${count === 1 ? "" : "s"} already queued on this region.`);
  }
  if (survivors.length === 0) {
    notes.push(
      fortHolds
        ? "No defending units, but the fort survives this assault, so the region cannot be taken this turn."
        : fortIsActive
          ? "No defending units; the assault breaks the fort and takes the region."
          : "No defenders: the region should fall."
    );
  } else if (fortHolds) {
    notes.push("The fort holds this turn: defenders and fort take losses, but the region cannot fall.");
  } else {
    notes.push("Defenders may retreat instead of dying; the capture chance includes the chance that a won assault bounces back.");
  }

  return {
    band,
    ratio,
    attackerLossPct,
    defenderLossPct,
    attackerStrength,
    defenderStrength,
    attackerCount: attackers.length,
    queuedAttackers: queuedAttackers.length,
    defenderCount: survivors.length,
    airSupportBonus,
    support: { fighters, bombardments, missiles },
    fort: fortIsActive
      ? {
          level: fort!.level,
          health: fortHealth,
          maxHealth: fort!.maxHealth,
          attackerLossPenaltyPct: fortPenalty,
          healthAfter: fortHealthAfter,
          holds: fortHolds
        }
      : null,
    captureChance,
    notes
  };
}
