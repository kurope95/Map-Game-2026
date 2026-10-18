import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import type { CountryId } from "../../game/state/types";
import { GEO_NEIGHBORS, NATION_COLORS, rgbDistance } from "./palette";

function pairKey(a: CountryId, b: CountryId): string {
  return [a, b].sort().join("-");
}

describe("nation palette", () => {
  it("gives every nation a color", () => {
    const state = createInitialState();
    for (const countryId of Object.keys(state.countries)) {
      expect(NATION_COLORS[countryId as CountryId]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps neighboring nations distinct", () => {
    const state = createInitialState("RUSSIA");
    const pairs = new Map<string, [CountryId, CountryId]>();
    for (const [a, b] of GEO_NEIGHBORS) {
      pairs.set(pairKey(a, b), [a, b]);
    }
    for (const region of Object.values(state.regions)) {
      for (const adjacentId of region.adjacentRegionIds) {
        const neighbor = state.regions[adjacentId];
        if (!neighbor) continue;
        const a = region.controllerCountryId;
        const b = neighbor.controllerCountryId;
        if (a !== b) {
          pairs.set(pairKey(a, b), [a, b]);
        }
      }
    }
    for (const [a, b] of pairs.values()) {
      expect(rgbDistance(NATION_COLORS[a], NATION_COLORS[b])).toBeGreaterThanOrEqual(40);
    }
  });
});
