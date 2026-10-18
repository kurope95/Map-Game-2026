import type { CountryShape } from "./countryShapes";
import type { BBox, MultiPolygon } from "./polygon";
import { bboxContainsPoint } from "./polygon";
import type { RegionShape } from "./regionShapes";

export interface RegionLookup {
  regionAt(x: number, y: number): string | null;
  landAt(x: number, y: number): "region" | "foreign" | "sea";
}

const BAND_COUNT = 128;

interface PointIndex {
  bbox: BBox;
  minY: number;
  spanY: number;
  bands: number[][];
}

/**
 * Even-odd ray casting with the edges bucketed by latitude band. Boundary probing asks the same
 * polygons thousands of times, so testing ~1667 edges per query is too slow; a band holds ~1% of
 * them. For disjoint polygon parts the global even-odd result equals `pointInMultiPolygon`.
 */
function buildPointIndex(polygon: MultiPolygon, bbox: BBox): PointIndex {
  const [, minY, , maxY] = bbox;
  const spanY = maxY - minY || 1;
  const bands: number[][] = Array.from({ length: BAND_COUNT }, () => []);

  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const lo = Math.min(ay, by);
    const hi = Math.max(ay, by);
    let start = Math.floor(((lo - minY) / spanY) * BAND_COUNT);
    let end = Math.floor(((hi - minY) / spanY) * BAND_COUNT);
    start = Math.max(0, Math.min(BAND_COUNT - 1, start));
    end = Math.max(0, Math.min(BAND_COUNT - 1, end));
    for (let band = start; band <= end; band += 1) {
      bands[band].push(ax, ay, bx, by);
    }
  };

  for (const part of polygon) {
    for (const ring of part) {
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        addEdge(a[0], a[1], b[0], b[1]);
      }
    }
  }

  return { bbox, minY, spanY, bands };
}

function indexContains(index: PointIndex, x: number, y: number): boolean {
  if (!bboxContainsPoint(index.bbox, x, y)) return false;
  let band = Math.floor(((y - index.minY) / index.spanY) * BAND_COUNT);
  band = Math.max(0, Math.min(BAND_COUNT - 1, band));
  const edges = index.bands[band];
  let inside = false;
  for (let i = 0; i < edges.length; i += 4) {
    const x1 = edges[i];
    const y1 = edges[i + 1];
    const x2 = edges[i + 2];
    const y2 = edges[i + 3];
    const crosses = y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Point queries over the built region polygons and background land. Both queries prefilter by
 * bounding box before the banded ring test, so the 103-region scan stays cheap.
 */
export function createRegionLookup(
  regions: Map<string, RegionShape>,
  background: CountryShape[]
): RegionLookup {
  const regionList = [...regions.values()].map((region) => ({
    id: region.id,
    bbox: region.bbox,
    index: buildPointIndex(region.polygon, region.bbox)
  }));

  // Background countries are disjoint, so one combined even-odd index means "inside any of them".
  let backgroundBox: BBox | null = null;
  for (const shape of background) {
    if (backgroundBox === null) {
      backgroundBox = [...shape.bbox] as BBox;
    } else {
      backgroundBox = [
        Math.min(backgroundBox[0], shape.bbox[0]),
        Math.min(backgroundBox[1], shape.bbox[1]),
        Math.max(backgroundBox[2], shape.bbox[2]),
        Math.max(backgroundBox[3], shape.bbox[3])
      ];
    }
  }
  const backgroundIndex =
    backgroundBox === null
      ? null
      : buildPointIndex(background.flatMap((shape) => shape.polygon), backgroundBox);

  const regionAt = (x: number, y: number): string | null => {
    for (const region of regionList) {
      if (bboxContainsPoint(region.bbox, x, y) && indexContains(region.index, x, y)) {
        return region.id;
      }
    }
    return null;
  };

  const landAt = (x: number, y: number): "region" | "foreign" | "sea" => {
    if (regionAt(x, y) !== null) return "region";
    if (backgroundIndex !== null && indexContains(backgroundIndex, x, y)) return "foreign";
    return "sea";
  };

  return { regionAt, landAt };
}
