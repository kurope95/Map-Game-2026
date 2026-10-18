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

  it("returns the same cached geometry for the same region set", () => {
    expect(buildMapGeometry(state.regions, getStartingControllers(state))).toBe(geometry);
  });
});
