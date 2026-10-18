import type { MapGeometry } from "../geometry/buildMapGeometry";
import type { EdgeKind } from "../geometry/boundaries";
import type { BBox, MultiPolygon, Point } from "../geometry/polygon";

export interface BackgroundPath {
  path: Path2D;
  bbox: BBox;
}

export interface PathCache {
  region: Map<string, Path2D>;
  background: BackgroundPath[];
  /** Whole-country outlines (scenario and background) for the coast halo. */
  outlines: BackgroundPath[];
  /** One path per boundary kind: internal, national, foreign, coast. */
  borders: Record<EdgeKind, Path2D>;
  graticule: Path2D;
}

function polylinesPath(lines: Point[][]): Path2D {
  const path = new Path2D();
  for (const line of lines) {
    line.forEach(([x, y], index) => (index === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  }
  return path;
}

/** One Path2D per ring set; holes are cut with the even-odd fill rule. */
export function multiPolygonPath(polygon: MultiPolygon): Path2D {
  const path = new Path2D();
  for (const poly of polygon) {
    for (const ring of poly) {
      ring.forEach(([x, y], index) => (index === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
      path.closePath();
    }
  }
  return path;
}

const caches = new WeakMap<MapGeometry, PathCache>();

/** Path2D objects are built once per geometry and reused by every frame. */
export function getPaths(geometry: MapGeometry): PathCache {
  let cache = caches.get(geometry);
  if (!cache) {
    cache = {
      region: new Map([...geometry.regions].map(([id, shape]) => [id, multiPolygonPath(shape.polygon)])),
      background: geometry.background.map((shape) => ({ path: multiPolygonPath(shape.polygon), bbox: shape.bbox })),
      outlines: [...geometry.scenarioShapes, ...geometry.background].map((shape) => ({ path: multiPolygonPath(shape.polygon), bbox: shape.bbox })),
      borders: {
        internal: polylinesPath(geometry.edges.filter((edge) => edge.kind === "internal").map((edge) => edge.points)),
        national: polylinesPath(geometry.edges.filter((edge) => edge.kind === "national").map((edge) => edge.points)),
        foreign: polylinesPath(geometry.edges.filter((edge) => edge.kind === "foreign").map((edge) => edge.points)),
        coast: polylinesPath(geometry.edges.filter((edge) => edge.kind === "coast").map((edge) => edge.points))
      },
      graticule: polylinesPath(geometry.graticule)
    };
    caches.set(geometry, cache);
  }
  return cache;
}

export function intersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
