import { describe, expect, it } from "vitest";
import type { UnitDefinition, UnitType } from "../../../../game/state/types";
import { counterEdges, counterText, STRENGTH_COLORS, strengthTone, supplyDotColor } from "./units";

const unit = (patch: Partial<UnitDefinition>): UnitDefinition => ({
  id: "u1",
  type: "infantry",
  blocId: "BRICS",
  countryId: "RUSSIA",
  regionId: "moscow",
  strength: 8,
  supplyTurnsRemaining: 3,
  ...patch
});

describe("strengthTone (spec 11.4 layer 14)", () => {
  it("is good above 66% of the maximum, warning above 33% and bad below", () => {
    expect(strengthTone(8, 8)).toBe("good");
    expect(strengthTone(6, 8)).toBe("good");
    expect(strengthTone(5, 8)).toBe("warn");
    expect(strengthTone(3, 8)).toBe("warn");
    expect(strengthTone(2, 8)).toBe("bad");
    expect(strengthTone(0, 8)).toBe("bad");
  });

  it("treats the exact thresholds as the lower tone", () => {
    expect(strengthTone(66, 100)).toBe("warn");
    expect(strengthTone(33, 100)).toBe("bad");
  });

  it("has a distinct color per tone", () => {
    expect(new Set(Object.values(STRENGTH_COLORS)).size).toBe(3);
  });
});

describe("supplyDotColor", () => {
  it("uses the legacy colors for low, critical and cut-off ground units", () => {
    expect(supplyDotColor(unit({ supplyTurnsRemaining: 2 }))).toBe("#d5d96b");
    expect(supplyDotColor(unit({ supplyTurnsRemaining: 1 }))).toBe("#f7b955");
    expect(supplyDotColor(unit({ supplyTurnsRemaining: 0 }))).toBe("#ff6b6b");
    expect(supplyDotColor(unit({ type: "armor", supplyTurnsRemaining: -1 }))).toBe("#ff6b6b");
  });

  it("shows nothing for well supplied units and for units supply does not affect", () => {
    expect(supplyDotColor(unit({ supplyTurnsRemaining: 3 }))).toBeNull();
    // only infantry and armor consume supply (getSupplyStatus)
    for (const type of ["fighter", "bomber", "mlrs", "tacticalMissile", "strategicMissile"] as UnitType[]) {
      expect(supplyDotColor(unit({ type, supplyTurnsRemaining: 0 }))).toBeNull();
    }
  });
});

describe("counterText", () => {
  it("shows the strength on a single counter and ×N on a stack", () => {
    expect(counterText("unit", ["u1"], 7)).toBe("7");
    expect(counterText("stack", ["a", "b", "c"], 0)).toBe("×3");
  });
});

describe("counterEdges", () => {
  const ordered = new Set(["u2"]);
  const selected = new Set(["u3"]);

  it("marks a counter whose unit has a pending order or is selected", () => {
    expect(counterEdges(["u1"], ordered, selected)).toEqual({ ordered: false, selected: false });
    expect(counterEdges(["u2"], ordered, selected)).toEqual({ ordered: true, selected: false });
    expect(counterEdges(["u3"], ordered, selected)).toEqual({ ordered: false, selected: true });
  });

  it("marks a stack when any unit in it matches", () => {
    expect(counterEdges(["u1", "u2", "u3"], ordered, selected)).toEqual({ ordered: true, selected: true });
  });
});
