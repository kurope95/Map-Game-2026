import type { Point, Ring } from "./polygon";
import { pointInMultiPolygon, ringArea } from "./polygon";
import type { RegionLookup } from "./regionLookup";
import type { RegionShape } from "./regionShapes";

export type EdgeKind = "internal" | "national" | "coast" | "foreign";

export interface BoundaryEdge {
  a: string;
  b: string | null;
  kind: EdgeKind;
  points: Point[];
}

interface Segment {
  p: Point;
  q: Point;
  neighbor: string | null;
  kind: EdgeKind;
}

interface Run {
  neighbor: string | null;
  kind: EdgeKind;
  points: Point[];
}

function classifyOutside(
  region: RegionShape,
  outside: Point,
  regions: Map<string, RegionShape>,
  lookup: RegionLookup
): { neighbor: string | null; kind: EdgeKind } {
  const found = lookup.regionAt(outside[0], outside[1]);
  const neighbor = found === region.id ? null : found;
  if (neighbor !== null) {
    const other = regions.get(neighbor);
    const kind = other && other.clipNumericId === region.clipNumericId ? "internal" : "national";
    return { neighbor, kind };
  }
  const kind = lookup.landAt(outside[0], outside[1]) === "foreign" ? "foreign" : "coast";
  return { neighbor, kind };
}

/**
 * Which side of a ring's directed edge is inside the region: +1 left, -1 right, 0 unknown.
 * Exterior rings enclose on their winding side; hole rings enclose on the opposite side. For a
 * valid polygon this is exactly the even-odd answer, without a point-in-polygon scan per probe.
 */
function insideSideOfRing(ring: Ring, ringIndex: number): 1 | -1 | 0 {
  const sign = Math.sign(ringArea(ring));
  if (sign === 0) return 0;
  const leftIsInside = ringIndex > 0 ? sign < 0 : sign > 0;
  return leftIsInside ? 1 : -1;
}

/** One probe inside / one probe outside the region: the outside probe names what lies beyond. */
function ringSegments(
  region: RegionShape,
  ring: Ring,
  ringIndex: number,
  regions: Map<string, RegionShape>,
  lookup: RegionLookup,
  step: number
): Segment[] {
  const segments: Segment[] = [];
  const insideSide = insideSideOfRing(ring, ringIndex);
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;

    const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const nx = -dy / length;
    const ny = dx / length;
    const left: Point = [mid[0] + nx * step, mid[1] + ny * step];
    const right: Point = [mid[0] - nx * step, mid[1] - ny * step];

    let outside: Point;
    if (insideSide !== 0) {
      outside = insideSide > 0 ? right : left;
    } else {
      // Degenerate ring: fall back to probing the polygon itself.
      const inside1 = pointInMultiPolygon(left[0], left[1], region.polygon);
      const inside2 = pointInMultiPolygon(right[0], right[1], region.polygon);
      if (inside1 === inside2) continue;
      outside = inside1 ? right : left;
    }

    const { neighbor, kind } = classifyOutside(region, outside, regions, lookup);
    segments.push({ p, q, neighbor, kind });
  }
  return segments;
}

function samePoint(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Merge consecutive segments with the same neighbor, joining a run that wraps past the ring start. */
function groupRuns(segments: Segment[]): Run[] {
  if (segments.length === 0) return [];
  const runs: Run[] = [];
  let current: Run = {
    neighbor: segments[0].neighbor,
    kind: segments[0].kind,
    points: [segments[0].p, segments[0].q]
  };
  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i];
    const connects = samePoint(current.points[current.points.length - 1], segment.p);
    if (connects && segment.neighbor === current.neighbor && segment.kind === current.kind) {
      current.points.push(segment.q);
    } else {
      runs.push(current);
      current = { neighbor: segment.neighbor, kind: segment.kind, points: [segment.p, segment.q] };
    }
  }
  runs.push(current);

  if (runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    const wraps =
      last.neighbor === first.neighbor &&
      last.kind === first.kind &&
      samePoint(last.points[last.points.length - 1], first.points[0]);
    if (wraps) {
      const merged: Run = {
        neighbor: first.neighbor,
        kind: first.kind,
        points: [...last.points, ...first.points.slice(1)]
      };
      runs.splice(0, 1);
      runs[runs.length - 1] = merged;
    }
  }
  return runs;
}

/** Every boundary polyline, deduplicated so a shared border is kept once (smaller region id side). */
export function buildBoundaryEdges(
  regions: Map<string, RegionShape>,
  lookup: RegionLookup,
  step = 0.6
): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];
  for (const region of regions.values()) {
    for (const polygon of region.polygon) {
      for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
        const ring = polygon[ringIndex];
        for (const run of groupRuns(ringSegments(region, ring, ringIndex, regions, lookup, step))) {
          if (run.points.length < 2) continue;
          if (run.neighbor !== null && !(region.id < run.neighbor)) continue;
          edges.push({ a: region.id, b: run.neighbor, kind: run.kind, points: run.points });
        }
      }
    }
  }
  return edges;
}

/** Symmetric neighbor sets derived from the deduplicated edges. */
export function neighborsFromEdges(
  regionIds: Iterable<string>,
  edges: BoundaryEdge[]
): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const id of regionIds) {
    neighbors.set(id, new Set());
  }
  for (const edge of edges) {
    if (edge.b === null) continue;
    neighbors.get(edge.a)?.add(edge.b);
    neighbors.get(edge.b)?.add(edge.a);
  }
  return neighbors;
}

export function collectRegionNeighbors(
  regions: Map<string, RegionShape>,
  lookup: RegionLookup,
  step = 0.6
): Map<string, Set<string>> {
  return neighborsFromEdges(regions.keys(), buildBoundaryEdges(regions, lookup, step));
}

/** Greedy four-variant coloring over neighboring regions, in sorted id order. */
function greedyVariants(
  regionIds: string[],
  neighbors: Map<string, Set<string>>
): Map<string, 0 | 1 | 2 | 3> {
  const variants: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
  const assigned = new Map<string, 0 | 1 | 2 | 3>();
  for (const id of [...regionIds].sort()) {
    const used = new Set<0 | 1 | 2 | 3>();
    for (const neighbor of neighbors.get(id) ?? []) {
      const variant = assigned.get(neighbor);
      if (variant !== undefined) used.add(variant);
    }
    const variant = variants.find((candidate) => !used.has(candidate)) ?? 0;
    assigned.set(id, variant);
  }
  return assigned;
}

function hasSameVariantNeighbor(
  assigned: Map<string, number>,
  neighbors: Map<string, Set<string>>
): boolean {
  for (const [id, set] of neighbors) {
    for (const neighbor of set) {
      if (id < neighbor && assigned.get(id) === assigned.get(neighbor)) return true;
    }
  }
  return false;
}

/**
 * DSATUR-ordered backtracking for a proper four-coloring. Plain sorted greedy falls back to 0 for
 * a region whose neighbors already use all four variants (Voronezh on the shipped map), which
 * defeats the point of the shades; this finds a conflict-free coloring instead.
 */
function properFourColoring(
  regionIds: string[],
  neighbors: Map<string, Set<string>>
): Map<string, 0 | 1 | 2 | 3> | null {
  const assigned = new Map<string, 0 | 1 | 2 | 3>();
  let steps = 0;

  const pickNext = (): string => {
    let best: string | null = null;
    let bestSaturation = -1;
    let bestDegree = -1;
    for (const id of regionIds) {
      if (assigned.has(id)) continue;
      const used = new Set<number>();
      for (const neighbor of neighbors.get(id) ?? []) {
        const variant = assigned.get(neighbor);
        if (variant !== undefined) used.add(variant);
      }
      const degree = neighbors.get(id)?.size ?? 0;
      if (
        best === null ||
        used.size > bestSaturation ||
        (used.size === bestSaturation && degree > bestDegree) ||
        (used.size === bestSaturation && degree === bestDegree && id < best)
      ) {
        best = id;
        bestSaturation = used.size;
        bestDegree = degree;
      }
    }
    return best!;
  };

  const search = (): boolean => {
    if (assigned.size === regionIds.length) return true;
    steps += 1;
    if (steps > 200_000) return false;
    const id = pickNext();
    const used = new Set<number>();
    for (const neighbor of neighbors.get(id) ?? []) {
      const variant = assigned.get(neighbor);
      if (variant !== undefined) used.add(variant);
    }
    for (let variant = 0; variant < 4; variant += 1) {
      if (used.has(variant)) continue;
      assigned.set(id, variant as 0 | 1 | 2 | 3);
      if (search()) return true;
      assigned.delete(id);
    }
    return false;
  };

  return search() ? assigned : null;
}

export function computeShadeVariants(
  regionIds: string[],
  neighbors: Map<string, Set<string>>
): Map<string, 0 | 1 | 2 | 3> {
  const greedy = greedyVariants(regionIds, neighbors);
  if (!hasSameVariantNeighbor(greedy, neighbors)) return greedy;
  return properFourColoring(regionIds, neighbors) ?? greedy;
}
