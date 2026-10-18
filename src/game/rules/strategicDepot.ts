import type { CountryId, GameState } from "../state/types";

export interface DepotStatus {
  tone: "claimed" | "claimable" | "locked";
  label: string;
  detail: string;
}

// True when `countryId`'s bloc holds an unbroken land path from that country's capital to the target region.
export function hasBlocPathToRegion(state: GameState, countryId: CountryId, targetRegionId: string): boolean {
  const blocId = state.countries[countryId].blocId;
  const capitalRegionId = state.countries[countryId].capitalRegionId;
  if (!blocId || !state.regions[capitalRegionId] || !state.regions[targetRegionId]) {
    return false;
  }

  const visited = new Set<string>();
  const queue = [capitalRegionId];
  while (queue.length > 0) {
    const regionId = queue.shift()!;
    if (visited.has(regionId)) continue;
    const region = state.regions[regionId];
    if (region.controllerBlocId !== blocId) continue;
    if (regionId === targetRegionId) return true;
    visited.add(regionId);
    for (const adjacentId of region.adjacentRegionIds) {
      if (!visited.has(adjacentId)) {
        queue.push(adjacentId);
      }
    }
  }

  return false;
}

export function getPridnestrovieDepotStatus(state: GameState): DepotStatus {
  if (state.history.claimedStrategicDepots.includes("pridnestrovie-depot")) {
    return { tone: "claimed" as const, label: "Claimed", detail: "The depot has already been seized." };
  }

  const depotRegion = state.regions["chisinau-pridnestrovie"];
  const odesaRegion = state.regions["odesa"];
  if (!depotRegion || !odesaRegion) {
    return { tone: "locked" as const, label: "Unavailable", detail: "Depot region is not present." };
  }

  if (!depotRegion.controllerBlocId || depotRegion.controllerBlocId !== odesaRegion.controllerBlocId) {
    return { tone: "locked" as const, label: "Locked", detail: "One bloc must control both Tiraspol and Odesa." };
  }

  const claimantCountryId =
    depotRegion.controllerBlocId === "EU_NATO"
      ? depotRegion.controllerCountryId
      : odesaRegion.controllerCountryId;

  if (state.countries[claimantCountryId].blocId !== depotRegion.controllerBlocId) {
    return { tone: "locked" as const, label: "Locked", detail: "The current claimant does not match the depot bloc." };
  }

  if (!hasBlocPathToRegion(state, claimantCountryId, depotRegion.id)) {
    return { tone: "locked" as const, label: "Bridge Needed", detail: "A land path from the claimant capital to Tiraspol is required." };
  }

  return { tone: "claimable" as const, label: "Claimable", detail: `${state.countries[claimantCountryId].name} can now seize the depot.` };
}
