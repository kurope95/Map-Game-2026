import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { getScenarioOverview } from "./scenarioOverview";

const state = createInitialState();

describe("getScenarioOverview", () => {
  it("counts the 24 nations across the three blocs", () => {
    const overview = getScenarioOverview(state);
    expect(overview.nationCount).toBe(24);
    expect(overview.blocs.map((entry) => [entry.blocId, entry.nationCount])).toEqual([
      ["BRICS", 6],
      ["NEUTRAL", 11],
      ["EU_NATO", 7]
    ]);
  });

  it("counts every region exactly once, by its starting controller's bloc", () => {
    const overview = getScenarioOverview(state);
    expect(overview.regionCount).toBe(Object.keys(state.regions).length);
    expect(overview.blocs.reduce((sum, entry) => sum + entry.regionCount, 0)).toBe(overview.regionCount);
    for (const entry of overview.blocs) {
      const expected = state.scenario.regions.filter(
        (region) => state.countries[region.controllerCountryId]?.blocId === entry.blocId
      ).length;
      expect(entry.regionCount).toBe(expected);
    }
  });

  it("counts the nations at war in each bloc", () => {
    const overview = getScenarioOverview(state);
    expect(overview.blocs.map((entry) => entry.atWarCount)).toEqual([3, 0, 5]);
    expect(overview.atWarCount).toBe(8);
  });
});
