import { geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json";
import type { CountryId } from "../../../game/state/types";
import { bboxOf, multiPolygonArea, nestRings, type BBox, type MultiPolygon, type Ring } from "./polygon";
import { createProjection, WORLD_CLIP } from "./projection";

// world-atlas gives the Kosovo feature no numeric id, so the game uses a synthetic one that
// cannot collide with an ISO 3166 numeric code.
export const KOSOVO_SYNTHETIC_NUMERIC_ID = 983;

export const COUNTRY_ID_BY_NUMERIC: Record<number, CountryId> = {
  8: "ALBANIA",
  40: "AUSTRIA",
  70: "BOSNIA_AND_HERZEGOVINA",
  112: "BELARUS",
  191: "CROATIA",
  203: "CZECH_REPUBLIC",
  233: "BALTIC_FEDERATION",
  246: "FINLAND",
  276: "GERMANY",
  348: "HUNGARY",
  428: "BALTIC_FEDERATION",
  440: "BALTIC_FEDERATION",
  498: "MOLDOVA",
  499: "MONTENEGRO",
  616: "POLAND",
  642: "ROMANIA",
  643: "RUSSIA",
  688: "SERBIA",
  703: "SLOVAKIA",
  705: "SLOVENIA",
  756: "SWITZERLAND",
  804: "UKRAINE",
  807: "NORTH_MACEDONIA",
  [KOSOVO_SYNTHETIC_NUMERIC_ID]: "KOSOVO"
};

const NUMERIC_ID_BY_COUNTRY = Object.fromEntries(
  Object.entries(COUNTRY_ID_BY_NUMERIC).map(([numericId, countryId]) => [countryId, Number(numericId)])
) as Partial<Record<CountryId, number>>;

export const CLIP_ID_BY_REGION: Record<string, number> = {
  "tallinn": 233,
  "tallinn-east": 233,
  "riga": 428,
  "riga-north": 428,
  "vilnius": 440,
  "kaunas": 440,
  "donetsk": 804,
  "kharkov": 804,
  "lugansk": 804,
  "mariupol": 804,
  "zaporizhzhia": 804,
  "sevastopol": 643
};

export function getClipNumericId(regionId: string, homeCountryId: CountryId): number | undefined {
  if (homeCountryId === "NOVOROSSIA") {
    return 804;
  }
  return CLIP_ID_BY_REGION[regionId] ?? NUMERIC_ID_BY_COUNTRY[homeCountryId];
}

export interface CountryShape {
  numericId: number;
  countryId: CountryId | null;
  polygon: MultiPolygon;
  bbox: BBox;
}

const atlasCountries = countries50m as unknown as any;
const atlasFeatureCollection = feature(
  atlasCountries,
  atlasCountries.objects.countries
) as unknown as GeoJSON.FeatureCollection;

type LonLatBox = [number, number, number, number];

/** Plain min/max over a feature's coordinates (no trigonometry), in degrees. */
function featureLonLatBox(feature: GeoJSON.Feature): LonLatBox {
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  const visit = (node: unknown): void => {
    const list = node as unknown[];
    if (typeof list[0] === "number") {
      const [lon, lat] = list as number[];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of list) visit(child);
  };
  const geometry = feature.geometry as GeoJSON.Geometry & { coordinates?: unknown };
  if (geometry && "coordinates" in geometry && geometry.coordinates) visit(geometry.coordinates);
  return [minLon, minLat, maxLon, maxLat];
}

const featureBoxes = new Map<GeoJSON.Feature, LonLatBox>();

/**
 * The longitude/latitude window the clip rectangle covers, found by projecting (Mercator is monotonic in both
 * axes) with a small margin so features that only graze the edge are kept.
 */
function clipWindow(projection: ReturnType<typeof createProjection>): LonLatBox {
  const project = (lon: number, lat: number): [number, number] => projection([lon, lat]) as [number, number];
  const originX = project(0, 0)[0];
  const pxPerDegree = project(1, 0)[0] - originX;
  const lonMin = (WORLD_CLIP[0][0] - originX) / pxPerDegree;
  const lonMax = (WORLD_CLIP[1][0] - originX) / pxPerDegree;
  // y falls as latitude rises; bisect the latitude that projects onto a given y
  const latAtY = (y: number): number => {
    let low = -85;
    let high = 85;
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      if (project(0, mid)[1] > y) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };
  const latMax = latAtY(WORLD_CLIP[0][1]);
  const latMin = latAtY(WORLD_CLIP[1][1]);
  return [lonMin - 2, latMin - 2, lonMax + 2, latMax + 2];
}

/**
 * Every world-atlas feature that reaches the clip rectangle, projected and clipped. `skipOutsideWindow`
 * (default) skips features whose longitude/latitude box is clear of the rectangle before the costly
 * projection; the result is identical, which a test checks.
 */
export function loadCountryShapes(options: { skipOutsideWindow?: boolean } = {}): CountryShape[] {
  const { skipOutsideWindow = true } = options;
  const projection = createProjection().clipExtent(WORLD_CLIP);
  const window = clipWindow(projection);
  const shapes: CountryShape[] = [];

  for (const atlasFeature of atlasFeatureCollection.features) {
    if (skipOutsideWindow) {
      let box = featureBoxes.get(atlasFeature);
      if (!box) {
        box = featureLonLatBox(atlasFeature);
        featureBoxes.set(atlasFeature, box);
      }
      if (box[2] < window[0] || box[0] > window[2] || box[3] < window[1] || box[1] > window[3]) continue;
    }
    const atlasId = Number(atlasFeature.id);
    const name = (atlasFeature.properties as { name?: string } | null | undefined)?.name;
    const numericId = Number.isFinite(atlasId)
      ? atlasId
      : name === "Kosovo"
        ? KOSOVO_SYNTHETIC_NUMERIC_ID
        : Number.NaN;
    if (!Number.isFinite(numericId)) continue;

    const rings: Ring[] = [];
    let current: Ring = [];
    let inRing = false;
    const collector = {
      beginPath() {},
      moveTo(x: number, y: number) {
        current = [[x, y]];
        inRing = true;
      },
      lineTo(x: number, y: number) {
        if (inRing) current.push([x, y]);
      },
      closePath() {
        if (inRing && current.length >= 3) rings.push(current);
        inRing = false;
      },
      arc(_x: number, _y: number, _r: number, _a0: number, _a1: number, _ccw?: boolean) {}
    };

    geoPath(projection, collector)(atlasFeature as unknown as GeoJSON.Feature);
    const polygon = nestRings(rings);
    if (multiPolygonArea(polygon) <= 0) continue;

    shapes.push({
      numericId,
      countryId: COUNTRY_ID_BY_NUMERIC[numericId] ?? null,
      polygon,
      bbox: bboxOf(polygon)
    });
  }

  return shapes;
}
