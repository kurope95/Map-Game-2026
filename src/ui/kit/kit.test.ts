import { describe, expect, it } from "vitest";
import { FACILITY_BUILD_COSTS, MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import { createInitialState } from "../../game/state/createInitialState";
import type { CountryId, StockpileKey, UnitType } from "../../game/state/types";
import { flagSvgMarkup } from "./flags";
import { FACILITY_META, RESOURCE_META } from "./resources";
import { unitSymbolPaths } from "./unitSymbols";

describe("kit data", () => {
  it("draws a flag for every nation", () => {
    const state = createInitialState();
    for (const countryId of Object.keys(state.countries) as CountryId[]) {
      const markup = flagSvgMarkup(countryId, 30, 20);
      expect(markup).toMatch(/^<svg/);
      expect(markup).toContain("</svg>");
    }
  });

  it("covers every stockpiled resource", () => {
    const stockpile = createInitialState("RUSSIA").countryStockpiles.RUSSIA;
    for (const key of Object.keys(stockpile) as StockpileKey[]) {
      expect(RESOURCE_META[key]).toBeDefined();
      expect(RESOURCE_META[key].Icon).toBeDefined();
    }
  });

  it("covers every buildable facility", () => {
    for (const { facilityType } of FACILITY_BUILD_COSTS) {
      expect(FACILITY_META[facilityType]).toBeDefined();
      expect(FACILITY_META[facilityType].Icon).toBeDefined();
    }
  });

  it("draws a symbol for every unit type", () => {
    for (const type of Object.keys(MAX_UNIT_STRENGTH) as UnitType[]) {
      const symbol = unitSymbolPaths(type);
      expect(symbol.frame).toBe(true);
      expect(symbol.strokes[0]).toBe("M1 1 H23 V15 H1 Z");
    }
  });
});
