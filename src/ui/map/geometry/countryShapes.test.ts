import { describe, expect, it } from "vitest";
import { europeCountryIds } from "../../../game/content/regionGeo";
import { COUNTRY_ID_BY_NUMERIC, loadCountryShapes } from "./countryShapes";
import { multiPolygonArea, pointInMultiPolygon } from "./polygon";
import { projectGeoPoint, WORLD_CLIP } from "./projection";

const shapes = loadCountryShapes();

describe("loadCountryShapes", () => {
  it("gives every theatre country id a shape with its scenario country", () => {
    for (const numericId of europeCountryIds) {
      const matching = shapes.filter((shape) => shape.numericId === numericId);
      expect(matching.length, `numeric id ${numericId}`).toBeGreaterThan(0);
      expect(matching[0].countryId).toBe(COUNTRY_ID_BY_NUMERIC[numericId]);
    }
  });

  it("keeps Russia's bbox inside WORLD_CLIP", () => {
    const russia = shapes.find((shape) => shape.countryId === "RUSSIA");
    expect(russia).toBeDefined();
    const [minX, minY, maxX, maxY] = russia!.bbox;
    expect(minX).toBeGreaterThanOrEqual(WORLD_CLIP[0][0] - 1e-6);
    expect(minY).toBeGreaterThanOrEqual(WORLD_CLIP[0][1] - 1e-6);
    expect(maxX).toBeLessThanOrEqual(WORLD_CLIP[1][0] + 1e-6);
    expect(maxY).toBeLessThanOrEqual(WORLD_CLIP[1][1] + 1e-6);
  });

  it("has only finite coordinates", () => {
    for (const shape of shapes) {
      for (const polygon of shape.polygon) {
        for (const ring of polygon) {
          for (const [x, y] of ring) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          }
        }
      }
    }
  });

  it("places Warsaw inside Poland", () => {
    const poland = shapes.find((shape) => shape.countryId === "POLAND");
    expect(poland).toBeDefined();
    const [x, y] = projectGeoPoint({ lon: 21.0122, lat: 52.2297 });
    expect(pointInMultiPolygon(x, y, poland!.polygon)).toBe(true);
  });

  it("puts Italy in a background shape with no scenario country", () => {
    const [x, y] = projectGeoPoint({ lon: 12.5, lat: 42.5 });
    const italy = shapes.find((shape) => pointInMultiPolygon(x, y, shape.polygon));
    expect(italy).toBeDefined();
    expect(italy!.countryId).toBeNull();
  });
});

describe("loadCountryShapes window skipping", () => {
  it("returns exactly the shapes (ids and areas) that projecting every feature would", () => {
    const fast = loadCountryShapes();
    const full = loadCountryShapes({ skipOutsideWindow: false });
    expect(fast.map((shape) => shape.numericId)).toEqual(full.map((shape) => shape.numericId));
    fast.forEach((shape, index) => {
      expect(multiPolygonArea(shape.polygon)).toBeCloseTo(multiPolygonArea(full[index].polygon), 6);
    });
  });
});
