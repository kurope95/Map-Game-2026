import { screenToWorld, type Camera } from "../camera";
import type { RegionLookup } from "../geometry/regionLookup";
import type { Point } from "../geometry/types";
import type { CounterBox } from "./counters";
import type { Box } from "./labels";

export type MapHit =
  | { kind: "unit"; unitId: string; regionId: string }
  | { kind: "stack"; regionId: string }
  | { kind: "city"; regionId: string }
  | { kind: "pill"; regionId: string }
  | { kind: "region"; regionId: string }
  | { kind: "sea" };

export interface FrameHitData {
  counters: CounterBox[];
  cities: { regionId: string; x: number; y: number }[];
  pills: (Box & { regionId: string })[];
}

function contains(box: Box, sx: number, sy: number): boolean {
  return sx >= box.x && sx <= box.x + box.width && sy >= box.y && sy <= box.y + box.height;
}

/**
 * Screen-space click resolution in drawing order: counters (last drawn first), pills, nearest city
 * within the radius, then the region polygon under the pointer, else sea.
 */
export function hitTest(
  sx: number,
  sy: number,
  frame: FrameHitData,
  camera: Camera,
  lookup: Pick<RegionLookup, "regionAt">,
  cityRadius = 9
): MapHit {
  for (let i = frame.counters.length - 1; i >= 0; i -= 1) {
    const counter = frame.counters[i];
    if (!contains(counter, sx, sy)) continue;
    if (counter.kind === "stack") {
      return { kind: "stack", regionId: counter.regionId };
    }
    return { kind: "unit", unitId: counter.unitIds[0], regionId: counter.regionId };
  }

  for (let i = frame.pills.length - 1; i >= 0; i -= 1) {
    const pill = frame.pills[i];
    if (contains(pill, sx, sy)) {
      return { kind: "pill", regionId: pill.regionId };
    }
  }

  let nearest: { regionId: string; x: number; y: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const city of frame.cities) {
    const distance = Math.hypot(sx - city.x, sy - city.y);
    if (distance <= cityRadius && distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }
  if (nearest !== null) {
    return { kind: "city", regionId: nearest.regionId };
  }

  const world: Point = screenToWorld(camera, sx, sy);
  const regionId = lookup.regionAt(world[0], world[1]);
  return regionId === null ? { kind: "sea" } : { kind: "region", regionId };
}

export interface ClickOutcome {
  selectUnit?: string;
  selectRegion?: string;
  /** The stack to expand. Any outcome without it collapses the currently expanded stack. */
  expand?: string;
  /** Pan the camera to this region without changing the selection (an off-screen link pill). */
  focus?: string;
}

/** What a click on `hit` does (spec 11.3 click resolution); the controller applies it. */
export function clickOutcome(hit: MapHit): ClickOutcome {
  switch (hit.kind) {
    case "unit":
      return { selectUnit: hit.unitId };
    case "stack":
      return { selectRegion: hit.regionId, expand: hit.regionId };
    case "city":
    case "region":
      return { selectRegion: hit.regionId };
    case "pill":
      return { focus: hit.regionId };
    case "sea":
      return {};
  }
}
