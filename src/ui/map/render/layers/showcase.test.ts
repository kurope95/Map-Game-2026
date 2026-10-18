import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../../game/state/createInitialState";
import { getShowcaseHighlight } from "./showcase";

const state = createInitialState("RUSSIA");

describe("getShowcaseHighlight", () => {
  it("highlights the nation's starting regions and dims every other region", () => {
    const { highlightedRegionIds, dimmedRegionIds } = getShowcaseHighlight(state, "RUSSIA");

    expect(highlightedRegionIds.has("moscow")).toBe(true);
    expect(highlightedRegionIds.size).toBe(state.countries.RUSSIA.startingRegionIds.length);
    expect(dimmedRegionIds.has("moscow")).toBe(false);
    expect(dimmedRegionIds.has("vienna")).toBe(true);
    expect(highlightedRegionIds.size + dimmedRegionIds.size).toBe(Object.keys(state.regions).length);
  });

  it("uses the starting controller, not the region's current controller", () => {
    const occupied = {
      ...state,
      regions: {
        ...state.regions,
        moscow: { ...state.regions.moscow, controllerCountryId: "GERMANY" as const }
      }
    };

    const { highlightedRegionIds, dimmedRegionIds } = getShowcaseHighlight(occupied, "RUSSIA");

    expect(highlightedRegionIds.has("moscow")).toBe(true);
    expect(dimmedRegionIds.has("moscow")).toBe(false);
  });
});
