import { geoGraticule10, geoPath } from "d3-geo";
import type { CountryId, RegionDefinition } from "../../../game/state/types";
import { computeShadeVariants, buildBoundaryEdges, neighborsFromEdges, type BoundaryEdge } from "./boundaries";
import { loadCountryShapes, type CountryShape } from "./countryShapes";
import { computeNationLabelPoints } from "./labelPoints";
import type { BBox, Point } from "./polygon";
import { createProjection, WORLD_CLIP } from "./projection";
import { createRegionLookup, type RegionLookup } from "./regionLookup";
import { buildRegionShapes, getRegionInputs, type RegionShape } from "./regionShapes";

export interface MapGeometry {
  regions: Map<string, RegionShape>;
  edges: BoundaryEdge[];
  neighbors: Map<string, Set<string>>;
  background: CountryShape[];
  scenarioShapes: CountryShape[];
  lookup: RegionLookup;
  shadeVariant: Map<string, 0 | 1 | 2 | 3>;
  nationLabels: Map<CountryId, { point: Point; area: number }>;
  graticule: Point[][];
  regionBounds: BBox;
  buildMs: number;
}

function buildGraticule(): Point[][] {
  const projection = createProjection().clipExtent(WORLD_CLIP);
  const lines: Point[][] = [];
  let current: Point[] = [];
  const collector = {
    beginPath() {},
    moveTo(x: number, y: number) {
      current = [[x, y]];
      lines.push(current);
    },
    lineTo(x: number, y: number) {
      current.push([x, y]);
    },
    closePath() {},
    arc(_x: number, _y: number, _r: number, _a0: number, _a1: number, _ccw?: boolean) {}
  };
  geoPath(projection, collector)(
    geoGraticule10() as unknown as GeoJSON.Feature
  );
  return lines.filter((line) => line.length >= 2);
}

/** Bounds of the region POINTS (spec 11.3: the default view fits all region points); the polygons run far beyond them. */
function regionBoundsOf(regions: Map<string, RegionShape>): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const region of regions.values()) {
    const [x, y] = region.point;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX, minY, maxX, maxY];
}

function expandBox(box: BBox, fraction: number): BBox {
  const padX = (box[2] - box[0]) * fraction;
  const padY = (box[3] - box[1]) * fraction;
  return [box[0] - padX, box[1] - padY, box[2] + padX, box[3] + padY];
}

let cachedKey: string | null = null;
let cachedGeometry: MapGeometry | null = null;

/** Builds the whole draw-ready geometry once per region set and caches it at module level. */
export function buildMapGeometry(
  regions: Record<string, RegionDefinition>,
  startingControllers: Record<string, CountryId>
): MapGeometry {
  const regionIds = Object.keys(regions).sort();
  const key = regionIds.join(",");
  if (cachedGeometry !== null && cachedKey === key) return cachedGeometry;

  const started = performance.now();
  const inputs = getRegionInputs(regions);
  const shapes = loadCountryShapes();
  const built = buildRegionShapes(inputs, shapes);
  const scenarioShapes = shapes.filter((shape) => shape.countryId !== null);
  const background = shapes.filter((shape) => shape.countryId === null);

  const lookup = createRegionLookup(built, background);
  const edges = buildBoundaryEdges(built, lookup);
  const neighbors = neighborsFromEdges(built.keys(), edges);
  const shadeVariant = computeShadeVariants(regionIds, neighbors);
  const regionBounds = regionBoundsOf(built);
  // Nation names are anchored in the default view (the region points plus a margin): Russia's polygons run far beyond it.
  const nationLabels = computeNationLabelPoints(built, startingControllers, expandBox(regionBounds, 0.06));
  const graticule = buildGraticule();

  const geometry: MapGeometry = {
    regions: built,
    edges,
    neighbors,
    background,
    scenarioShapes,
    lookup,
    shadeVariant,
    nationLabels,
    graticule,
    regionBounds,
    buildMs: performance.now() - started
  };

  cachedKey = key;
  cachedGeometry = geometry;
  return geometry;
}
