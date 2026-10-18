import type { CountryId } from "../../../game/state/types";
import type { MultiPolygon, Point } from "./polygon";
import { bboxOf, pointInPolygon, ringArea } from "./polygon";
import type { RegionShape } from "./regionShapes";

function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
}

/**
 * The point of the largest polygon part that is farthest from every ring edge, found by sampling a
 * `grid x grid` lattice of cell centres. Falls back to `fallback` when no sample is inside.
 */
export function interiorPoint(mp: MultiPolygon, grid = 24, fallback: Point = [0, 0]): Point {
  let polygon = mp[0];
  let polygonArea = -1;
  for (const part of mp) {
    const area = Math.abs(ringArea(part[0]));
    if (area > polygonArea) {
      polygonArea = area;
      polygon = part;
    }
  }
  if (!polygon) return fallback;

  const [minX, minY, maxX, maxY] = bboxOf([polygon]);
  const stepX = (maxX - minX) / grid;
  const stepY = (maxY - minY) / grid;

  const segments: number[] = [];
  for (const ring of polygon) {
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      segments.push(a[0], a[1], b[0], b[1]);
    }
  }

  let best: Point | null = null;
  let bestScore = -1;
  for (let i = 0; i < grid; i += 1) {
    const x = minX + (i + 0.5) * stepX;
    for (let j = 0; j < grid; j += 1) {
      const y = minY + (j + 0.5) * stepY;
      if (!pointInPolygon(x, y, polygon)) continue;
      let score = Number.POSITIVE_INFINITY;
      for (let k = 0; k < segments.length; k += 4) {
        const distance = segmentDistance(x, y, segments[k], segments[k + 1], segments[k + 2], segments[k + 3]);
        if (distance < score) score = distance;
      }
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best ?? fallback;
}

/** One label anchor per starting controller: the interior point of its largest starting region. */
export function computeNationLabelPoints(
  regions: Map<string, RegionShape>,
  startingControllers: Record<string, CountryId>
): Map<CountryId, { point: Point; area: number }> {
  const byNation = new Map<CountryId, RegionShape[]>();
  for (const [id, countryId] of Object.entries(startingControllers)) {
    const region = regions.get(id);
    if (!region) continue;
    const list = byNation.get(countryId);
    if (list) list.push(region);
    else byNation.set(countryId, [region]);
  }

  const labels = new Map<CountryId, { point: Point; area: number }>();
  for (const [countryId, list] of byNation) {
    let largest = list[0];
    let area = 0;
    for (const region of list) {
      area += region.area;
      if (region.area > largest.area) largest = region;
    }
    labels.set(countryId, { point: interiorPoint(largest.polygon, 24, largest.point), area });
  }
  return labels;
}
