import type { BBox, MultiPolygon, Point, Polygon, Ring } from "./types";

export type { BBox, MultiPolygon, Point, Polygon, Ring } from "./types";

/** Signed shoelace area. The sign encodes the ring winding. */
export function ringArea(r: Ring): number {
  let sum = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    sum += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  }
  return sum / 2;
}

/** Even-odd point-in-ring test. */
export function pointInRing(x: number, y: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True inside the exterior ring and outside every hole. */
export function pointInPolygon(x: number, y: number, p: Polygon): boolean {
  if (!pointInRing(x, y, p[0])) return false;
  for (let i = 1; i < p.length; i += 1) {
    if (pointInRing(x, y, p[i])) return false;
  }
  return true;
}

export function pointInMultiPolygon(x: number, y: number, mp: MultiPolygon): boolean {
  for (const polygon of mp) {
    if (pointInPolygon(x, y, polygon)) return true;
  }
  return false;
}

/** Sum of |exterior areas| minus |hole areas|. */
export function multiPolygonArea(mp: MultiPolygon): number {
  let area = 0;
  for (const polygon of mp) {
    area += Math.abs(ringArea(polygon[0]));
    for (let i = 1; i < polygon.length; i += 1) {
      area -= Math.abs(ringArea(polygon[i]));
    }
  }
  return area;
}

export function bboxOf(mp: MultiPolygon): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const polygon of mp) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX, minY, maxX, maxY];
}

export function bboxContainsPoint(b: BBox, x: number, y: number): boolean {
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
}

export function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / lengthSquared));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * Groups clipped path rings into polygons: the largest ring defines the exterior winding, rings
 * with the opposite winding are holes and each hole goes to the smallest exterior containing it.
 */
export function nestRings(rings: Ring[]): MultiPolygon {
  const usable: Ring[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const distinct = new Set<string>();
    for (const [x, y] of ring) distinct.add(`${x},${y}`);
    if (distinct.size < 3) continue;
    if (Math.abs(ringArea(ring)) < 0.01) continue;
    usable.push(ring);
  }
  if (usable.length === 0) return [];

  let largest = usable[0];
  for (const ring of usable) {
    if (Math.abs(ringArea(ring)) > Math.abs(ringArea(largest))) largest = ring;
  }
  const exteriorSign = Math.sign(ringArea(largest)) || 1;

  const polygons: { exterior: Ring; area: number; holes: Ring[] }[] = [];
  const holes: Ring[] = [];
  for (const ring of usable) {
    if (Math.sign(ringArea(ring)) === exteriorSign) {
      polygons.push({ exterior: ring, area: Math.abs(ringArea(ring)), holes: [] });
    } else {
      holes.push(ring);
    }
  }

  for (const hole of holes) {
    const [x, y] = hole[0];
    let target: { exterior: Ring; area: number; holes: Ring[] } | null = null;
    for (const polygon of polygons) {
      if (pointInRing(x, y, polygon.exterior) && (target === null || polygon.area < target.area)) {
        target = polygon;
      }
    }
    if (target) target.holes.push(hole);
  }

  return polygons.map((polygon) => [polygon.exterior, ...polygon.holes]);
}
