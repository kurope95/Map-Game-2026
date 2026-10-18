import { describe, expect, it } from "vitest";
import type { UnitStackInfo } from "../derive";
import { counterSize, layoutCounters, type CounterBox } from "./counters";

function stack(regionId: string, unitIds: string[]): UnitStackInfo {
  return {
    regionId,
    unitIds,
    majorityCountryId: "RUSSIA",
    majorityType: "infantry"
  };
}

function overlaps(a: CounterBox, b: CounterBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const city = new Map([["moscow", [100, 100] as [number, number]]]);

describe("counterSize", () => {
  it("uses the base size at zoom 1 and caps the scale at high zoom", () => {
    expect(counterSize(1)).toEqual({ width: 30, height: 18 });
    const large = counterSize(4);
    expect(large.width).toBeCloseTo(30 * 1.35, 9);
    expect(large.height).toBeCloseTo(18 * 1.35, 9);
    const small = counterSize(0.01);
    expect(small.width).toBeCloseTo(30 * 0.85, 9);
  });
});

describe("layoutCounters", () => {
  it("positions counters in CSS pixels at the city", () => {
    const unitBoxes = layoutCounters(new Map([["moscow", stack("moscow", ["u1"])]]), city, 1, null);
    expect(unitBoxes).toHaveLength(1);
    expect(unitBoxes[0]).toMatchObject({ kind: "unit", x: 85, y: 107, width: 30, height: 18 });

    const stackBoxes = layoutCounters(new Map([["moscow", stack("moscow", ["u1", "u2"])]]), city, 1, null);
    expect(stackBoxes).toHaveLength(1);
    expect(stackBoxes[0]).toMatchObject({ kind: "stack", x: 85, y: 107, width: 30, height: 18 });
  });

  it("shows one stack box for several units unless the region is expanded", () => {
    const boxes = layoutCounters(new Map([["moscow", stack("moscow", ["u1", "u2", "u3"])]]), city, 1, null);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].kind).toBe("stack");
    expect(boxes[0].unitIds).toEqual(["u1", "u2", "u3"]);
  });

  it("lays eight expanded units out in two rows without overlap", () => {
    const unitIds = Array.from({ length: 8 }, (_, index) => `u${index + 1}`);
    const boxes = layoutCounters(new Map([["moscow", stack("moscow", unitIds)]]), city, 1, "moscow");
    expect(boxes).toHaveLength(8);
    expect(new Set(boxes.map((box) => box.y))).toEqual(new Set([107, 127]));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(overlaps(boxes[i], boxes[j]), `${boxes[i].unitIds[0]}/${boxes[j].unitIds[0]}`).toBe(false);
      }
    }
    const firstRow = boxes.filter((box) => box.y === 107);
    expect(firstRow.map((box) => box.x)).toEqual([37, 69, 101, 133]);
  });

  it("expands only the requested region", () => {
    const stacks = new Map([
      ["moscow", stack("moscow", ["u1", "u2"])],
      ["kiev", stack("kiev", ["u3", "u4"])]
    ]);
    const cities = new Map([
      ["moscow", [100, 100] as [number, number]],
      ["kiev", [200, 100] as [number, number]]
    ]);
    const boxes = layoutCounters(stacks, cities, 1, "moscow");
    expect(boxes.filter((box) => box.regionId === "moscow" && box.kind === "unit")).toHaveLength(2);
    expect(boxes.filter((box) => box.regionId === "kiev" && box.kind === "stack")).toHaveLength(1);
  });
});
