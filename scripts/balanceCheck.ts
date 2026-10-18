import { countryDefinitions } from "../src/game/content/countries";
import { FACILITY_BUILD_COSTS } from "../src/game/content/economyRecipes";
import type { CountryId, GameState, StockpileKey } from "../src/game/state/types";
import { advanceTurn } from "../src/game/rules/turnEngine";
import { setCombatSeed } from "../src/game/rules/orderResolution";
import { executeCountryTurn } from "../src/game/ai/heuristicBot";
import { createSession, isPlayerEliminated, runUntilPlayerTurn } from "./lib/autoPlay";

const TURN_COUNT = 10;
const EARLY_BUILD_WINDOW = 3;

function hashCountryId(countryId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < countryId.length; index++) {
    hash ^= countryId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface NationBalanceResult {
  countryId: CountryId;
  survived: boolean;
  lowestFood: number;
  minUnits: number;
  finalTurn: number;
  notes: string[];
}

function canAffordAnyBuild(state: GameState, countryId: CountryId): boolean {
  const stockpile = state.countryStockpiles[countryId];
  if (!stockpile) return false;

  return FACILITY_BUILD_COSTS.some((recipe) =>
    Object.entries(recipe.cost).every(([key, amount]) => (stockpile[key as StockpileKey] ?? 0) >= (amount ?? 0))
  );
}

function countUnits(state: GameState, countryId: CountryId): number {
  return Object.values(state.units).filter((unit) => unit.countryId === countryId).length;
}

function countRegions(state: GameState, countryId: CountryId): number {
  return Object.values(state.regions).filter((region) => region.controllerCountryId === countryId).length;
}

function playOneCycle(state: GameState, countryId: CountryId): GameState {
  let next = runUntilPlayerTurn(state, countryId);
  if (isPlayerEliminated(next, countryId)) {
    return next;
  }

  const playerSide = executeCountryTurn(next, countryId);
  next = advanceTurn(playerSide.state);

  if (isPlayerEliminated(next, countryId)) {
    return next;
  }

  return runUntilPlayerTurn(next, countryId);
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function simulateNation(countryId: CountryId): NationBalanceResult {
  setCombatSeed(hashCountryId(countryId));
  const deterministicRandom = createDeterministicRandom(hashCountryId(`${countryId}-ai`));
  const nativeRandom = Math.random;
  Math.random = deterministicRandom;

  try {
    return simulateNationInternal(countryId);
  } finally {
    Math.random = nativeRandom;
  }
}

function simulateNationInternal(countryId: CountryId): NationBalanceResult {
  let state = createSession(countryId);
  const notes: string[] = [];
  let lowestFood = state.countryStockpiles[countryId]?.food ?? 0;
  let minUnits = countUnits(state, countryId);
  let consecutiveStarvation = 0;
  let maxStarvation = 0;
  let earlyBuildAffordable = false;

  for (let cycle = 0; cycle < TURN_COUNT; cycle++) {
    const food = state.countryStockpiles[countryId]?.food ?? 0;
    lowestFood = Math.min(lowestFood, food);
    minUnits = Math.min(minUnits, countUnits(state, countryId));

    if (food <= 0) {
      consecutiveStarvation += 1;
      maxStarvation = Math.max(maxStarvation, consecutiveStarvation);
    } else {
      consecutiveStarvation = 0;
    }

    if (cycle < EARLY_BUILD_WINDOW && canAffordAnyBuild(state, countryId)) {
      earlyBuildAffordable = true;
    }

    const defeated = state.countryStates[countryId].defeatedOnTurn;
    if (defeated !== undefined) {
      notes.push(`Eliminated on turn ${defeated}`);
      break;
    }

    if (countRegions(state, countryId) === 0) {
      notes.push("Lost all controlled regions");
      break;
    }

    state = playOneCycle(state, countryId);

    if (isPlayerEliminated(state, countryId)) {
      const defeatedTurn = state.countryStates[countryId].defeatedOnTurn;
      if (defeatedTurn !== undefined && !notes.some((note) => note.startsWith("Eliminated"))) {
        notes.push(`Eliminated on turn ${defeatedTurn}`);
      }
      break;
    }
  }

  if (!earlyBuildAffordable && state.countryStates[countryId].atWar) {
    notes.push(`No affordable facility build in first ${EARLY_BUILD_WINDOW} cycles`);
  }
  if (maxStarvation > 2) {
    notes.push(`Food at or below zero for ${maxStarvation} consecutive cycles`);
  }
  if (minUnits === 0 && state.countryStates[countryId].atWar) {
    notes.push("Unit count reached zero while at war");
  }

  const survived = notes.length === 0;

  return {
    countryId,
    survived,
    lowestFood,
    minUnits,
    finalTurn: state.turn,
    notes,
  };
}

function printTable(results: NationBalanceResult[]) {
  console.log("\nBalance check results (10-turn AI auto-play per nation):\n");
  console.log("Nation".padEnd(24), "Survived".padEnd(10), "LowFood".padEnd(10), "MinUnits".padEnd(10), "Notes");
  console.log("-".repeat(90));

  for (const result of results) {
    console.log(
      result.countryId.padEnd(24),
      (result.survived ? "yes" : "NO").padEnd(10),
      String(result.lowestFood).padEnd(10),
      String(result.minUnits).padEnd(10),
      result.notes.join("; ") || "ok"
    );
  }
}

function main() {
  const playableIds = countryDefinitions.map((country) => country.id);
  const results: NationBalanceResult[] = [];
  for (const countryId of playableIds) {
    console.error(`[balance-check] Simulating ${countryId}...`);
    results.push(simulateNation(countryId));
  }

  printTable(results);

  const failures = results.filter((result) => !result.survived);
  if (failures.length > 0) {
    console.error(`\nBalance check failed for ${failures.length} nation(s).`);
    throw new Error(`Balance check failed for ${failures.length} nation(s).`);
  }

  console.log("\nBalance check passed for all playable nations.");
}

main();

export { TURN_COUNT };
