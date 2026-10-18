import { geoMercator, type GeoProjection } from "d3-geo";
import { theaterMapSize, type GeoPoint } from "../../../game/content/regionGeo";
import type { Point } from "./types";

export const WORLD = { width: theaterMapSize.width, height: theaterMapSize.height } as const;
export const WORLD_CLIP: [[number, number], [number, number]] = [[-200, -200], [1800, 1180]];

// Same projection and fitting as the legacy TheaterMap so the new canvas map keeps the exact
// geography and city positions.
export function createProjection(): GeoProjection {
  const projection = geoMercator();
  const boundsFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [5.0, 41.0],
        [51.0, 41.0],
        [51.0, 62.5],
        [5.0, 62.5],
        [5.0, 41.0]
      ]]
    }
  };

  projection.fitExtent(
    [
      [40, 30],
      [theaterMapSize.width - 40, theaterMapSize.height - 30]
    ],
    boundsFeature
  );

  return projection;
}

const worldProjection = createProjection();

export function projectGeoPoint(point: GeoPoint): Point {
  const projected = worldProjection([point.lon, point.lat]);
  return projected ? [projected[0], projected[1]] : [Number.NaN, Number.NaN];
}
