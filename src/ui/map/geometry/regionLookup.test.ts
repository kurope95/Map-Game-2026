import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { loadCountryShapes } from "./countryShapes";
import { projectGeoPoint } from "./projection";
import { createRegionLookup } from "./regionLookup";
import { buildRegionShapes, getRegionInputs } from "./regionShapes";

const state = createInitialState("RUSSIA");
const inputs = getRegionInputs(state.regions);
const shapes = loadCountryShapes();
const regions = buildRegionShapes(inputs, shapes);
const background = shapes.filter((shape) => shape.countryId === null);
const lookup = createRegionLookup(regions, background);

describe("createRegionLookup", () => {
  it("finds the region at every city point", () => {
    for (const shape of regions.values()) {
      expect(lookup.regionAt(shape.point[0], shape.point[1]), shape.id).toBe(shape.id);
    }
  });

  it("treats the Baltic Sea as sea", () => {
    const [x, y] = projectGeoPoint({ lon: 19.5, lat: 55.6 });
    expect(lookup.regionAt(x, y)).toBeNull();
    expect(lookup.landAt(x, y)).toBe("sea");
  });

  it("treats non-scenario land as foreign", () => {
    const [x, y] = projectGeoPoint({ lon: 12.5, lat: 42.5 });
    expect(lookup.landAt(x, y)).toBe("foreign");
  });
});
