import type { BotDecision } from "../ai/heuristicBot";
import type { CountryId, GameState } from "../state/types";
import { advanceTurn } from "../rules/turnEngine";
import { executeCountryTurn } from "../ai/heuristicBot";

export function isPlayerEliminated(state: GameState, playerCountryId: CountryId): boolean {
  const countryState = state.countryStates[playerCountryId];
  if (countryState?.defeatedOnTurn !== undefined) return true;
  if (!state.turnOrder.includes(playerCountryId)) return true;
  return false;
}

/** Advance through AI turns until it is the player's turn again, or they are eliminated. */
export function runUntilPlayerTurn(
  state: GameState,
  playerCountryId: CountryId,
  onAiTurn?: (decision: BotDecision) => void
): GameState {
  let next = state;
  let steps = 0;
  const maxSteps = Math.max(next.turnOrder.length + 2, 4);

  while (next.currentActorId !== playerCountryId) {
    if (isPlayerEliminated(next, playerCountryId)) {
      return next;
    }

    if (steps++ >= maxSteps) {
      throw new Error(
        `Turn flow stuck waiting for ${playerCountryId} ` +
          `(current=${next.currentActorId}, turnOrder=${next.turnOrder.join(",")}, turn=${next.turn})`
      );
    }

    const result = executeCountryTurn(next, next.currentActorId);
    onAiTurn?.(result.decision);
    next = advanceTurn(result.state);
  }

  return next;
}

/** Run AI for every country for a number of full player cycles. */
export function autoPlayTurns(state: GameState, playerCountryId: CountryId, turns: number): GameState {
  let next = state;

  for (let i = 0; i < turns; i++) {
    if (isPlayerEliminated(next, playerCountryId)) {
      break;
    }

    next = runUntilPlayerTurn(next, playerCountryId);
    if (isPlayerEliminated(next, playerCountryId)) {
      break;
    }

    const playerSide = executeCountryTurn(next, playerCountryId);
    next = advanceTurn(playerSide.state);

    if (isPlayerEliminated(next, playerCountryId)) {
      break;
    }

    next = runUntilPlayerTurn(next, playerCountryId);
  }

  return next;
}
