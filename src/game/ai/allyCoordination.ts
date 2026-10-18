import type { BlocId, CountryId, GameState } from "../state/types";

export interface AllyTargetClaim {
  countryId: CountryId;
  strength: number;
}

export type AllyTargetClaims = Partial<Record<BlocId, Record<string, AllyTargetClaim>>>;

export function resetAllyTargetClaims(state: GameState): GameState {
  return { ...state, allyTargetClaims: {} };
}

export function getDefenderStrength(state: GameState, regionId: string, attackerBlocId: BlocId): number {
  return Object.values(state.units)
    .filter((unit) => unit.regionId === regionId && unit.blocId !== attackerBlocId)
    .reduce((sum, unit) => sum + unit.strength, 0);
}

export function getAllyTargetClaim(
  state: GameState,
  blocId: BlocId | undefined,
  regionId: string
): AllyTargetClaim | undefined {
  if (!blocId) return undefined;
  return state.allyTargetClaims?.[blocId]?.[regionId];
}

export function shouldDeferAttackToAlly(
  state: GameState,
  countryId: CountryId,
  blocId: BlocId | undefined,
  targetRegionId: string,
  unitStrength: number
): { defer: boolean; reason?: string } {
  if (!blocId) return { defer: false };

  const claim = getAllyTargetClaim(state, blocId, targetRegionId);
  if (!claim || claim.countryId === countryId) return { defer: false };

  const defenderStrength = Math.max(1, getDefenderStrength(state, targetRegionId, blocId));
  const allyOverwhelming = claim.strength >= defenderStrength * 1.5;
  if (!allyOverwhelming) return { defer: false };

  if (unitStrength > claim.strength) return { defer: false };

  const regionName = state.regions[targetRegionId]?.name ?? targetRegionId;
  const allyName = state.countries[claim.countryId]?.name ?? claim.countryId;
  return {
    defer: true,
    reason: `Skipped ${regionName}: ${allyName} already committed ${claim.strength} strength (≥1.5× local defenders).`,
  };
}

export function recordAllyAttackClaims(
  state: GameState,
  countryId: CountryId,
  attackActions: { unitId: string; targetRegionId: string }[]
): GameState {
  const blocId = state.countries[countryId].blocId;
  if (!blocId || attackActions.length === 0) return state;

  const byTarget = new Map<string, number>();
  for (const action of attackActions) {
    const unit = state.units[action.unitId];
    if (!unit) continue;
    byTarget.set(action.targetRegionId, (byTarget.get(action.targetRegionId) ?? 0) + unit.strength);
  }

  const claims: AllyTargetClaims = { ...(state.allyTargetClaims ?? {}) };
  const blocClaims = { ...(claims[blocId] ?? {}) };

  for (const [targetRegionId, strength] of byTarget) {
    const existing = blocClaims[targetRegionId];
    if (!existing) {
      blocClaims[targetRegionId] = { countryId, strength };
      continue;
    }
    if (existing.countryId === countryId) {
      blocClaims[targetRegionId] = { countryId, strength: existing.strength + strength };
      continue;
    }
    if (strength > existing.strength) {
      blocClaims[targetRegionId] = { countryId, strength };
    }
  }

  return { ...state, allyTargetClaims: { ...claims, [blocId]: blocClaims } };
}
