import type { CountryId, GameState } from "../../game/state/types";

/** The pre-war controller of every region, taken from the untouched scenario data. */
export function getStartingControllers(state: GameState): Record<string, CountryId> {
  const controllers: Record<string, CountryId> = {};
  for (const region of state.scenario.regions) {
    controllers[region.id] = region.controllerCountryId;
  }
  return controllers;
}
