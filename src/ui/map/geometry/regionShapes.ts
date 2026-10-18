import { Delaunay } from "d3-delaunay";
import { intersection } from "./clipping";
import { getRegionGeoPoint } from "../../../game/content/regionGeo";
import type { CountryId, RegionDefinition } from "../../../game/state/types";
import { getClipNumericId, type CountryShape } from "./countryShapes";
import { bboxOf, multiPolygonArea, type BBox, type MultiPolygon, type Point, type Polygon, type Ring } from "./polygon";
import { projectGeoPoint, WORLD_CLIP } from "./projection";

export interface RegionInput {
  id: string;
  homeCountryId: CountryId;
  point: Point;
}

export interface RegionShape {
  id: string;
  clipNumericId: number;
  polygon: MultiPolygon;
  bbox: BBox;
  point: Point;
  area: number;
  usedFallback: boolean;
}

export function getRegionInputs(regions: Record<string, RegionDefinition>): RegionInput[] {
  return Object.values(regions).map((region) => {
    const geoPoint = getRegionGeoPoint(region.id);
    return {
      id: region.id,
      homeCountryId: region.homeCountryId,
      point: geoPoint ? projectGeoPoint(geoPoint) : ([Number.NaN, Number.NaN] as Point)
    };
  });
}

// Sutherland-Hodgman clip of one ring to an axis-aligned box. For concave rings the result may carry
// zero-width bridges along the box edges; they cancel under the even-odd rule polygon-clipping applies.
function clipRingToBox(ring: Ring, box: BBox): Ring {
  const [minX, minY, maxX, maxY] = box;
  let output: Ring =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice();
  const stages: { inside: (p: Point) => boolean; cross: (a: Point, b: Point) => Point }[] = [
    { inside: (p) => p[0] >= minX, cross: (a, b) => [minX, a[1] + ((minX - a[0]) / (b[0] - a[0])) * (b[1] - a[1])] },
    { inside: (p) => p[0] <= maxX, cross: (a, b) => [maxX, a[1] + ((maxX - a[0]) / (b[0] - a[0])) * (b[1] - a[1])] },
    { inside: (p) => p[1] >= minY, cross: (a, b) => [a[0] + ((minY - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), minY] },
    { inside: (p) => p[1] <= maxY, cross: (a, b) => [a[0] + ((maxY - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), maxY] }
  ];
  for (const stage of stages) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (stage.inside(current)) {
        if (!stage.inside(previous)) output.push(stage.cross(previous, current));
        output.push(current);
      } else if (stage.inside(previous)) {
        output.push(stage.cross(previous, current));
      }
    }
    if (output.length === 0) return [];
  }
  return output;
}

// A country's polygons with their own boxes, so each cell only meets the parts of the country near it.
const polygonBoxes = new WeakMap<CountryShape, { polygon: Polygon; bbox: BBox }[]>();

function polygonsNear(country: CountryShape, cellBox: BBox): MultiPolygon {
  let parts = polygonBoxes.get(country);
  if (!parts) {
    parts = country.polygon.map((polygon) => ({ polygon, bbox: bboxOf([polygon]) }));
    polygonBoxes.set(country, parts);
  }
  const [minX, minY, maxX, maxY] = cellBox;
  const near: MultiPolygon = [];
  for (const { polygon, bbox } of parts) {
    if (bbox[2] < minX || bbox[0] > maxX || bbox[3] < minY || bbox[1] > maxY) continue;
    const inside = bbox[0] >= minX && bbox[2] <= maxX && bbox[1] >= minY && bbox[3] <= maxY;
    if (inside) {
      near.push(polygon);
      continue;
    }
    const exterior = clipRingToBox(polygon[0], cellBox);
    if (exterior.length < 3) continue;
    const holes = polygon.slice(1).map((ring) => clipRingToBox(ring, cellBox)).filter((ring) => ring.length >= 3);
    near.push([exterior, ...holes]);
  }
  return near;
}

function ringBox(ring: Ring): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

const CELL_BOX_MARGIN = 0.5;

function clipCellToCountry(cell: Ring, country: CountryShape): { polygon: MultiPolygon; usedFallback: boolean } {
  const cellPolygon: Ring[] = [cell];
  try {
    const [minX, minY, maxX, maxY] = ringBox(cell);
    const nearCountry = polygonsNear(country, [minX - CELL_BOX_MARGIN, minY - CELL_BOX_MARGIN, maxX + CELL_BOX_MARGIN, maxY + CELL_BOX_MARGIN]);
    if (nearCountry.length === 0) return { polygon: [], usedFallback: false };
    return { polygon: intersection(cellPolygon, nearCountry), usedFallback: false };
  } catch {
    const [minX, minY, maxX, maxY] = country.bbox;
    const bboxRing: Ring = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY]
    ];
    return { polygon: intersection(cellPolygon, [bboxRing]), usedFallback: true };
  }
}

export function buildRegionShapes(
  inputs: RegionInput[],
  shapes: CountryShape[]
): Map<string, RegionShape> {
  const countryByNumericId = new Map<number, CountryShape>();
  for (const shape of shapes) {
    countryByNumericId.set(shape.numericId, shape);
  }

  const groups = new Map<number, RegionInput[]>();
  for (const input of inputs) {
    const numericId = getClipNumericId(input.id, input.homeCountryId);
    if (numericId === undefined) continue;
    const group = groups.get(numericId);
    if (group) group.push(input);
    else groups.set(numericId, [input]);
  }

  const result = new Map<string, RegionShape>();
  for (const [numericId, group] of groups) {
    const country = countryByNumericId.get(numericId);
    if (!country) continue;

    if (group.length === 1) {
      const input = group[0];
      result.set(input.id, {
        id: input.id,
        clipNumericId: numericId,
        polygon: country.polygon,
        bbox: country.bbox,
        point: input.point,
        area: multiPolygonArea(country.polygon),
        usedFallback: false
      });
      continue;
    }

    const delaunay = Delaunay.from(group.map((input) => input.point));
    const voronoi = delaunay.voronoi([
      WORLD_CLIP[0][0],
      WORLD_CLIP[0][1],
      WORLD_CLIP[1][0],
      WORLD_CLIP[1][1]
    ]);

    group.forEach((input, index) => {
      const cell = voronoi.cellPolygon(index);
      const { polygon, usedFallback } = cell
        ? clipCellToCountry(cell as Ring, country)
        : { polygon: [] as MultiPolygon, usedFallback: false };
      result.set(input.id, {
        id: input.id,
        clipNumericId: numericId,
        polygon,
        bbox: bboxOf(polygon),
        point: input.point,
        area: multiPolygonArea(polygon),
        usedFallback
      });
    });
  }

  return result;
}
