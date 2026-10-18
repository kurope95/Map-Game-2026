import { Delaunay } from "d3-delaunay";
import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { getClipNumericId, loadCountryShapes, type CountryShape } from "./countryShapes";
import { intersection } from "./clipping";
import { multiPolygonArea, pointInMultiPolygon, type Ring } from "./polygon";
import { WORLD_CLIP } from "./projection";
import { buildRegionShapes, getRegionInputs } from "./regionShapes";

const state = createInitialState("RUSSIA");
const inputs = getRegionInputs(state.regions);
const shapes = loadCountryShapes();
const built = buildRegionShapes(inputs, shapes);

describe("buildRegionShapes", () => {
  it("builds one positive-area shape per region", () => {
    const ids = Object.keys(state.regions);
    expect(built.size).toBe(ids.length);
    for (const id of ids) {
      const shape = built.get(id);
      expect(shape, id).toBeDefined();
      expect(shape!.area, id).toBeGreaterThan(0);
    }
  });

  it("places every city point inside its own polygon", () => {
    const violations = [...built.values()]
      .filter((shape) => !pointInMultiPolygon(shape.point[0], shape.point[1], shape.polygon))
      .map((shape) => shape.id);
    expect(violations).toEqual([]);
  });

  it("needs no bounding-box fallback", () => {
    expect([...built.values()].filter((shape) => shape.usedFallback).map((shape) => shape.id)).toEqual([]);
  });

  it("partitions each clipped country within 1%", () => {
    const byNumericId = new Map<number, CountryShape>();
    for (const shape of shapes) {
      byNumericId.set(shape.numericId, shape);
    }

    const groups = new Map<number, string[]>();
    for (const input of inputs) {
      const numericId = getClipNumericId(input.id, input.homeCountryId);
      expect(numericId, input.id).toBeDefined();
      const group = groups.get(numericId!) ?? [];
      group.push(input.id);
      groups.set(numericId!, group);
    }

    for (const [numericId, regionIds] of groups) {
      const country = byNumericId.get(numericId);
      expect(country, `numeric id ${numericId}`).toBeDefined();
      const countryArea = multiPolygonArea(country!.polygon);
      const regionArea = regionIds.reduce((sum, id) => sum + built.get(id)!.area, 0);
      expect(Math.abs(regionArea - countryArea) / countryArea).toBeLessThan(0.01);
    }
  });

  it("builds in under 600 ms", () => {
    const started = performance.now();
    buildRegionShapes(inputs, shapes);
    expect(performance.now() - started).toBeLessThan(600);
  });
});

describe("buildRegionShapes clipping shortcut", () => {
  it("gives every Russian region the area of intersecting its cell with the whole country", () => {
    const russia = shapes.find((shape) => shape.numericId === 643)!;
    const group = inputs.filter((input) => getClipNumericId(input.id, input.homeCountryId) === 643);
    const voronoi = Delaunay.from(group.map((input) => input.point)).voronoi([WORLD_CLIP[0][0], WORLD_CLIP[0][1], WORLD_CLIP[1][0], WORLD_CLIP[1][1]]);
    group.forEach((input, index) => {
      const expected = multiPolygonArea(intersection([voronoi.cellPolygon(index) as Ring], russia.polygon));
      const actual = built.get(input.id)!.area;
      expect(Math.abs(actual - expected), input.id).toBeLessThan(Math.max(1e-6, expected * 1e-4));
    });
  });
});
