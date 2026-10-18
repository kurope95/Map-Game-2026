import { describe, expect, it } from "vitest";
import type { Camera } from "../camera";
import { hitTest, type FrameHitData } from "./hitTest";

const camera: Camera = { scale: 1, offsetX: 0, offsetY: 0 };
const emptyLookup = { regionAt: () => null };

function frame(overrides: Partial<FrameHitData> = {}): FrameHitData {
  return { counters: [], cities: [], pills: [], ...overrides };
}

describe("hitTest", () => {
  it("prefers counters over cities", () => {
    const hit = hitTest(
      110,
      110,
      frame({
        counters: [
          { kind: "unit", regionId: "moscow", unitIds: ["u1"], x: 100, y: 100, width: 30, height: 18 }
        ],
        cities: [{ regionId: "moscow", x: 112, y: 110 }]
      }),
      camera,
      emptyLookup
    );
    expect(hit).toEqual({ kind: "unit", unitId: "u1", regionId: "moscow" });
  });

  it("hits the last drawn counter first", () => {
    const hit = hitTest(
      110,
      110,
      frame({
        counters: [
          { kind: "stack", regionId: "a", unitIds: ["u1"], x: 100, y: 100, width: 30, height: 18 },
          { kind: "unit", regionId: "b", unitIds: ["u2"], x: 100, y: 100, width: 30, height: 18 }
        ]
      }),
      camera,
      emptyLookup
    );
    expect(hit).toEqual({ kind: "unit", unitId: "u2", regionId: "b" });
  });

  it("hits a city within the radius", () => {
    const hit = hitTest(
      105,
      100,
      frame({ cities: [{ regionId: "kiev", x: 100, y: 100 }] }),
      camera,
      emptyLookup
    );
    expect(hit).toEqual({ kind: "city", regionId: "kiev" });
  });

  it("hits a pill before a region", () => {
    const hit = hitTest(
      20,
      20,
      frame({ pills: [{ regionId: "p1", x: 0, y: 0, width: 100, height: 40 }] }),
      camera,
      { regionAt: () => "kiev" }
    );
    expect(hit).toEqual({ kind: "pill", regionId: "p1" });
  });

  it("resolves a region polygon through the camera", () => {
    const hit = hitTest(50, 60, frame(), { scale: 2, offsetX: 10, offsetY: 20 }, {
      regionAt: (x, y) => (Math.round(x) === 20 && Math.round(y) === 20 ? "kiev" : null)
    });
    expect(hit).toEqual({ kind: "region", regionId: "kiev" });
  });

  it("returns sea when nothing is hit", () => {
    expect(hitTest(500, 500, frame(), camera, emptyLookup)).toEqual({ kind: "sea" });
  });
});
