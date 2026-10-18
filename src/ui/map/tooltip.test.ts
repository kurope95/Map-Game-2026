import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import type { GameState } from "../../game/state/types";
import { tooltipHtml, tooltipModel, type TooltipModel } from "./tooltip";

const state = createInitialState("RUSSIA");

describe("tooltipModel", () => {
  it("names the region and tags capitals and key cities", () => {
    const warsaw = tooltipModel(state, "warsaw")!;
    expect(warsaw.name).toBe(state.regions.warsaw.name);
    expect(warsaw.tags.includes("Capital")).toBe(state.regions.warsaw.isCapital);
    const capital = Object.values(state.regions).find((region) => region.isCapital)!;
    expect(tooltipModel(state, capital.id)!.tags).toContain("Capital");
    const key = Object.values(state.regions).find((region) => region.isKeyCity && !region.isCapital)!;
    expect(tooltipModel(state, key.id)!.tags).toEqual(["Key city"]);
    const plain = Object.values(state.regions).find((region) => !region.isKeyCity && !region.isCapital)!;
    expect(tooltipModel(state, plain.id)!.tags).toEqual([]);
  });

  it("names the controller and its bloc", () => {
    const warsaw = tooltipModel(state, "warsaw")!;
    expect(warsaw.controller).toEqual({ countryId: "POLAND", name: state.countries.POLAND.name, blocId: "EU_NATO" });
    expect(warsaw.occupiedFrom).toBeNull();
  });

  it("says who a captured region originally belonged to", () => {
    const captured: GameState = {
      ...state,
      regions: { ...state.regions, lublin: { ...state.regions.lublin, controllerCountryId: "RUSSIA", controllerBlocId: "BRICS" } }
    };
    const lublin = tooltipModel(captured, "lublin")!;
    expect(lublin.controller.countryId).toBe("RUSSIA");
    expect(lublin.occupiedFrom).toBe(state.countries.POLAND.name);
  });

  it("splits the units into own, allied and enemy for the player", () => {
    expect(tooltipModel(state, "moscow")!.units).toEqual({ total: 2, own: 2, allied: 0, enemy: 0 });
    expect(tooltipModel(state, "warsaw")!.units).toEqual({ total: 3, own: 0, allied: 0, enemy: 3 });
    const emptyRegion = Object.values(state.regions).find((region) => !Object.values(state.units).some((unit) => unit.regionId === region.id))!;
    expect(tooltipModel(state, emptyRegion.id)!.units.total).toBe(0);
  });

  it("counts a bloc mate as allied and a neutral nation's unit as neither allied nor enemy", () => {
    const base = state.units["ru-inf-2"];
    const mixed: GameState = {
      ...state,
      units: {
        ...state.units,
        ally: { ...base, id: "ally", countryId: "BELARUS", blocId: "BRICS", regionId: "moscow" },
        neutral: { ...base, id: "neutral", countryId: "SWITZERLAND", blocId: "NEUTRAL", regionId: "moscow" }
      }
    };
    expect(tooltipModel(mixed, "moscow")!.units).toEqual({ total: 4, own: 2, allied: 1, enemy: 0 });
  });

  it("reports the fortification and the stability", () => {
    const fortified: GameState = {
      ...state,
      regionEconomies: {
        ...state.regionEconomies,
        warsaw: { ...state.regionEconomies.warsaw, stability: 83, fortification: { level: 2, health: 12, maxHealth: 16, damaged: false } }
      }
    };
    const model = tooltipModel(fortified, "warsaw")!;
    expect(model.fort).toEqual({ level: 2, health: 12, maxHealth: 16 });
    expect(model.stability).toBe(83);
    expect(tooltipModel(state, "moscow")!.fort).toBeNull();
  });

  it("returns null for an unknown region", () => {
    expect(tooltipModel(state, "atlantis")).toBeNull();
  });
});

describe("tooltipHtml", () => {
  const model: TooltipModel = {
    name: "Warsaw",
    tags: ["Capital"],
    controller: { countryId: "POLAND", name: "Poland", blocId: "EU_NATO" },
    occupiedFrom: null,
    units: { total: 3, own: 0, allied: 1, enemy: 2 },
    fort: { level: 2, health: 12, maxHealth: 16 },
    stability: 83
  };

  it("shows every line of the model", () => {
    const html = tooltipHtml(model);
    expect(html).toContain("Warsaw");
    expect(html).toContain("Capital");
    expect(html).toContain("Poland");
    expect(html).toContain("EU NATO");
    expect(html).toContain("3 units · 1 allied · 2 enemy");
    expect(html).toContain("Fort Lv.2 12/16");
    expect(html).toContain("Stability 83%");
    expect(html).toContain("<svg");
    expect(html).not.toContain("Occupied");
  });

  it("adds the occupation line and drops the lines it has nothing for", () => {
    const html = tooltipHtml({ ...model, occupiedFrom: "Poland", units: { total: 0, own: 0, allied: 0, enemy: 0 }, fort: null, stability: null });
    expect(html).toContain("Occupied, originally Poland");
    expect(html).not.toContain("unit");
    expect(html).not.toContain("Fort");
    expect(html).not.toContain("Stability");
  });

  it("uses the singular for one unit", () => {
    expect(tooltipHtml({ ...model, units: { total: 1, own: 1, allied: 0, enemy: 0 } })).toContain("1 unit · 1 own");
  });

  it("escapes text that came from game data", () => {
    const html = tooltipHtml({ ...model, name: '<img src=x onerror="a">&', controller: { ...model.controller, name: "<b>P</b>" } });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;");
  });
});
