import type { CountryId, GameState } from "../state/types";
import { isRegionOpenForCountryTransit } from "../rules/orderResolution";

export interface RouteDistances {
  /** Region id -> hops to the nearest destination; absent means unreachable. */
  readonly distances: ReadonlyMap<string, number>;
  /** Region id -> the destination that produced its distance, for reasons and scoring. */
  readonly sources: ReadonlyMap<string, string>;
}

/**
 * Multi-source BFS over the legal land-transit graph.
 *
 * Destinations are seeded at distance 0. An enemy-held destination is a
 * terminal: it still gives its friendly neighbours distance 1 (the final step
 * into it is an attack), but no route may pass through it. Every other region
 * on a route must pass the country-level transit rule.
 */
export function buildRouteDistances(
  state: GameState,
  countryId: CountryId,
  destinations: ReadonlySet<string>
): RouteDistances {
  const blocId = state.countries[countryId]?.blocId;
  const distances = new Map<string, number>();
  const sources = new Map<string, string>();
  const queue: string[] = [];

  for (const destination of [...destinations].filter((id) => state.regions[id] !== undefined).sort()) {
    distances.set(destination, 0);
    sources.set(destination, destination);
    queue.push(destination);
  }

  let head = 0;
  while (head < queue.length) {
    const regionId = queue[head++];
    const distance = distances.get(regionId)!;
    const region = state.regions[regionId];

    // A destination is always expanded one step, so an enemy-held goal still
    // gives its friendly neighbours distance 1. Reached regions are route
    // nodes and must be legal transit, which is what stops a path from
    // passing through an enemy-held destination.
    if (
      distance > 0 &&
      !isRegionOpenForCountryTransit(state, countryId, blocId, regionId, { ignoreStacking: true })
    ) {
      continue;
    }

    for (const neighbourId of region.adjacentRegionIds) {
      if (distances.has(neighbourId)) continue;
      if (
        !isRegionOpenForCountryTransit(state, countryId, blocId, neighbourId, { ignoreStacking: true })
      ) {
        continue;
      }

      distances.set(neighbourId, distance + 1);
      sources.set(neighbourId, sources.get(regionId)!);
      queue.push(neighbourId);
    }
  }

  return { distances, sources };
}

export function getRouteDistance(map: RouteDistances, regionId: string): number {
  return map.distances.get(regionId) ?? Number.POSITIVE_INFINITY;
}

/** Positive = the move gets closer, 0 = sideways or unknown, negative = away. */
export function getRouteProgress(
  map: RouteDistances,
  fromRegionId: string,
  toRegionId: string
): number {
  const from = map.distances.get(fromRegionId);
  const to = map.distances.get(toRegionId);
  if (from === undefined || to === undefined) return 0;
  return from - to;
}
