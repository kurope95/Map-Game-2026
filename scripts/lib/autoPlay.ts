import type { CountryId } from "../../src/game/state/types";
import { createInitialState } from "../../src/game/state/createInitialState";
import { evaluateWarEntryRules } from "../../src/game/rules/turnEngine";
import { autoPlayTurns } from "../../src/game/sim/autoPlay";

export { autoPlayTurns, isPlayerEliminated, runUntilPlayerTurn } from "../../src/game/sim/autoPlay";

export function createSession(playerCountryId: CountryId) {
  return evaluateWarEntryRules(createInitialState(playerCountryId));
}
