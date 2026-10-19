import { describe, expect, it } from "vitest";
import type { AttackEstimate } from "../../game/rules/combatEstimate";
import { createInitialState } from "../../game/state/createInitialState";
import type { GameState } from "../../game/state/types";
import { tooltipHtml, tooltipModel, tooltipPosition, type TooltipModel } from "./tooltip";

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

  // A defended region, no fort: the battle is "likely" but the assault can still bounce back.
  const estimate: AttackEstimate = {
    band: "likely",
    ratio: 1.32,
    attackerLossPct: { min: 0.21, max: 0.29 },
    defenderLossPct: { min: 0.38, max: 0.52 },
    attackerStrength: 14,
    defenderStrength: 10.6,
    attackerCount: 2,
    queuedAttackers: 0,
    defenderCount: 1,
    airSupportBonus: 2,
    support: { fighters: 1, bombardments: 1, missiles: 0 },
    fort: null,
    captureChance: 0.5,
    notes: ["Defenders can retreat <b>and</b> bounce back."]
  };
  // The Odesa case: nothing defends, but a level 3 fort survives the assault.
  const fortHolds: AttackEstimate = {
    ...estimate,
    band: "likely",
    ratio: 1.19,
    attackerLossPct: { min: 0.33, max: 0.41 },
    defenderLossPct: { min: 0, max: 0 },
    defenderCount: 0,
    support: { fighters: 0, bombardments: 0, missiles: 0 },
    airSupportBonus: 0,
    fort: { level: 3, health: 24, maxHealth: 24, attackerLossPenaltyPct: 0.12, healthAfter: 19, holds: true },
    captureChance: 0,
    notes: []
  };

  it("leads with the capture chance and shows the battle, the losses and the support", () => {
    const html = tooltipHtml({ ...model, estimate });
    expect(html).toContain("map-tooltip__estimate");
    expect(html).toContain("Attack estimate: capture about 50%");
    expect(html).toContain("Battle: likely win (ratio 1.32)");
    expect(html).toContain("Losses: attackers 21–29% · defenders 38–52%");
    expect(html).toContain("Support: 1 fighter (+2), 1 bombardment");
    expect(html).not.toContain("<b>");
    expect(html).toContain("Defenders can retreat &lt;b&gt;and&lt;/b&gt; bounce back.");
  });

  it("says no capture and shows the fort before and after when it holds, and hides what does not apply", () => {
    const html = tooltipHtml({ ...model, estimate: fortHolds });
    expect(html).toContain("Attack estimate: no capture this turn, the fort holds");
    expect(html).toContain("Fort Lv.3: 24 → 19/24, holds · +12% attacker losses");
    expect(html).toContain("Losses: attackers 33–41%");
    expect(html).not.toContain("defenders 0");
    expect(html).not.toMatch(/Losses:[^<]*defenders/);
    expect(html).not.toContain("Battle:");
    expect(html).not.toContain("Support:");
    expect(html).not.toContain("victory");
  });

  it("says the fort is broken, and expects capture, when the assault breaks it", () => {
    const html = tooltipHtml({
      ...model,
      estimate: { ...fortHolds, fort: { level: 1, health: 2, maxHealth: 10, attackerLossPenaltyPct: 0.02, healthAfter: 0, holds: false }, captureChance: 1 }
    });
    expect(html).toContain("Attack estimate: capture expected");
    expect(html).toContain("Fort Lv.1: 2 → 0/10, broken · +2% attacker losses");
  });

  it("expects capture without a battle row when nothing defends and there is no fort", () => {
    const html = tooltipHtml({
      ...model,
      estimate: { ...fortHolds, fort: null, captureChance: 1, ratio: Infinity, band: "decisive", attackerLossPct: { min: 0.09, max: 0.12 } }
    });
    expect(html).toContain("Attack estimate: capture expected");
    expect(html).toContain("Losses: attackers 9–12%");
    // the region's own fort row sits above the estimate; the estimate block itself must have none
    const estimateBlock = html.slice(html.indexOf("map-tooltip__estimate"));
    expect(estimateBlock).not.toContain("Battle:");
    expect(estimateBlock).not.toContain("Fort Lv");
    expect(html).not.toContain("∞");
  });

  it("keeps small chances readable", () => {
    expect(tooltipHtml({ ...model, estimate: { ...estimate, captureChance: 0.0225 } })).toContain("capture about 2%");
    expect(tooltipHtml({ ...model, estimate: { ...estimate, captureChance: 0.004 } })).toContain("capture almost impossible");
  });

  it("describes the battle odds with plain words", () => {
    const labelFor = (band: AttackEstimate["band"]) => tooltipHtml({ ...model, estimate: { ...estimate, band } });
    expect(labelFor("decisive")).toContain("Battle: decisive win");
    expect(labelFor("marginal")).toContain("Battle: toss-up (60% win)");
    expect(labelFor("unlikely")).toContain("Battle: unlikely (15% win)");
  });

  it("omits the estimate block when there is no estimate", () => {
    expect(tooltipHtml(model)).not.toContain("map-tooltip__estimate");
    expect(tooltipHtml({ ...model, estimate: null })).not.toContain("Attack estimate");
  });

  it("passes the estimate through tooltipModel", () => {
    expect(tooltipModel(state, "moscow", estimate)!.estimate).toBe(estimate);
    expect(tooltipModel(state, "moscow")!.estimate).toBeNull();
  });
});

describe("tooltipPosition", () => {
  const viewport = { width: 1000, height: 700 };
  const size = { width: 200, height: 100 };

  it("sits 14 px right of and below the pointer", () => {
    expect(tooltipPosition([300, 200], size, viewport)).toEqual({ x: 314, y: 214 });
  });

  it("is pushed back inside the map, 8 px from the edge, near the right and bottom edges", () => {
    expect(tooltipPosition([950, 650], size, viewport)).toEqual({ x: 1000 - 200 - 8, y: 700 - 100 - 8 });
  });

  it("keeps the 8 px margin at the top left", () => {
    expect(tooltipPosition([-20, -30], size, viewport)).toEqual({ x: 8, y: 8 });
  });
});
