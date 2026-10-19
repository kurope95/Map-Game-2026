import type { CountryId, FacilityType } from "../../game/state/types";

/** The last facility build the player queued this session, for the Repeat button. */
export interface LastFacilityBuild {
  regionId: string;
  facilityType: FacilityType;
}

/**
 * The Repeat affordance is enabled only when the remembered build can still be queued:
 * something was built, it is the player's turn, and the region is still player-controlled.
 * Slot and resource legality stays with `queueFacilityBuild`.
 */
export function canRepeatFacilityBuild(
  last: LastFacilityBuild | null,
  region: { controllerCountryId: CountryId } | undefined,
  playerCountryId: CountryId,
  playerTurnActive: boolean
): boolean {
  return last !== null && playerTurnActive && region?.controllerCountryId === playerCountryId;
}
