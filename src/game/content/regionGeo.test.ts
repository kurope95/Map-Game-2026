import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { MAP_POINT_OVERRIDES, getRegionGeoPoint, theaterMapLayout } from "./regionGeo";

describe("regionGeo", () => {
  it("has a map point for every region after createInitialState", () => {
    const state = createInitialState("RUSSIA");
    const missing = Object.keys(state.regions).filter((id) => getRegionGeoPoint(id) === undefined);
    expect(missing).toEqual([]);
  });

  it("prefers MAP_POINT_OVERRIDES", () => {
    for (const [id, point] of Object.entries(MAP_POINT_OVERRIDES)) {
      expect(getRegionGeoPoint(id)).toEqual(point);
    }
  });

  it("lets an override win over the layout point and falls back to the layout point without one", () => {
    const layoutPoint = theaterMapLayout["moscow"];
    expect(getRegionGeoPoint("moscow")).toEqual(layoutPoint);
    MAP_POINT_OVERRIDES["moscow"] = { lon: 1, lat: 2 };
    try {
      expect(getRegionGeoPoint("moscow")).toEqual({ lon: 1, lat: 2 });
    } finally {
      delete MAP_POINT_OVERRIDES["moscow"];
    }
    expect(getRegionGeoPoint("moscow")).toEqual(layoutPoint);
  });

  it("returns undefined for an unknown region", () => {
    expect(getRegionGeoPoint("atlantis")).toBeUndefined();
  });
});
