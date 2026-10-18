import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { getStartingControllers } from "../startingControllers";
import { buildMapGeometry } from "./buildMapGeometry";

const state = createInitialState("RUSSIA");
const geometry = buildMapGeometry(state.regions, getStartingControllers(state));

describe("buildMapGeometry", () => {
  it("fits the default view to the region POINTS, not to the huge country polygons behind them", () => {
    const xs = [...geometry.regions.values()].map((shape) => shape.point[0]);
    const ys = [...geometry.regions.values()].map((shape) => shape.point[1]);
    expect(geometry.regionBounds).toEqual([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    // Russia's polygons run far beyond the theater; the point bounds must stay inside the 1600x980 world.
    const [minX, minY, maxX, maxY] = geometry.regionBounds;
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(1600);
    expect(maxY).toBeLessThanOrEqual(980);
  });

  it("anchors every nation name inside the default view, even for Russia whose polygons run far beyond it", () => {
    const [minX, minY, maxX, maxY] = geometry.regionBounds;
    const padX = (maxX - minX) * 0.06;
    const padY = (maxY - minY) * 0.06;
    expect(geometry.nationLabels.size).toBeGreaterThanOrEqual(24);
    for (const [countryId, { point }] of geometry.nationLabels) {
      expect(point[0], `${countryId} x`).toBeGreaterThanOrEqual(minX - padX);
      expect(point[0], `${countryId} x`).toBeLessThanOrEqual(maxX + padX);
      expect(point[1], `${countryId} y`).toBeGreaterThanOrEqual(minY - padY);
      expect(point[1], `${countryId} y`).toBeLessThanOrEqual(maxY + padY);
    }
  });

  it("returns the same cached geometry for the same region set", () => {
    expect(buildMapGeometry(state.regions, getStartingControllers(state))).toBe(geometry);
  });
});
