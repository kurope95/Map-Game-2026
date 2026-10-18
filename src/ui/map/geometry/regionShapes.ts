import { Delaunay } from "d3-delaunay";
import { intersection } from "polygon-clipping";
import { getRegionGeoPoint } from "../../../game/content/regionGeo";
import type { CountryId, RegionDefinition } from "../../../game/state/types";
import { getClipNumericId, type CountryShape } from "./countryShapes";
import { bboxOf, multiPolygonArea, type BBox, type MultiPolygon, type Point, type Ring } from "./polygon";
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

function clipCellToCountry(cell: Ring, country: CountryShape): { polygon: MultiPolygon; usedFallback: boolean } {
  const cellPolygon: Ring[] = [cell];
  try {
    return { polygon: intersection(cellPolygon, country.polygon), usedFallback: false };
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
