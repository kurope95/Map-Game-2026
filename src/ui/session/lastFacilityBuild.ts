import type { CountryId, FacilityType } from "../../game/state/types";

/** The last facility build the player queued this session, for the Repeat button. */
export interface LastFacilityBuild {
  regionId: string;
  facilityType: FacilityType;
  /** The country that queued it: a remembered build never carries over to another country's game. */
  countryId: CountryId;
}

/**
 * The Repeat affordance is enabled only when the remembered build can still be queued:
 * something was built by this country, it is the player's turn, and the region is still player-controlled.
 * Slot and resource legality stays with `queueFacilityBuild`.
 */
export function canRepeatFacilityBuild(
  last: LastFacilityBuild | null,
  region: { controllerCountryId: CountryId } | undefined,
  playerCountryId: CountryId,
  playerTurnActive: boolean
): boolean {
  return last !== null && last.countryId === playerCountryId && playerTurnActive && region?.controllerCountryId === playerCountryId;
}
