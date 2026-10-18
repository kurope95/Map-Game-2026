import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../../game/state/createInitialState";
import { MAP_INSETS } from "../../layout/pills";
import { linkPairs, pillBox, PILL_HEIGHT } from "./links";

describe("linkPairs", () => {
  it("lists every undirected adjacency exactly once, sorted", () => {
    const regions = {
      a: { adjacentRegionIds: ["c", "b"] },
      b: { adjacentRegionIds: ["a"] },
      c: { adjacentRegionIds: ["a", "b"] }
    };
    expect(linkPairs(regions)).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"]
    ]);
  });

  it("drops self links and links to unknown regions", () => {
    const regions = { a: { adjacentRegionIds: ["a", "ghost", "b"] }, b: { adjacentRegionIds: ["a"] } };
    expect(linkPairs(regions)).toEqual([["a", "b"]]);
  });

  it("reuses the result for the same regions object", () => {
    const regions = { a: { adjacentRegionIds: ["b"] }, b: { adjacentRegionIds: ["a"] } };
    expect(linkPairs(regions)).toBe(linkPairs(regions));
  });

  it("finds the scenario's link network with no duplicates", () => {
    const state = createInitialState("RUSSIA");
    const pairs = linkPairs(state.regions);
    expect(pairs.length).toBeGreaterThan(100);
    expect(new Set(pairs.map(([a, b]) => `${a}|${b}`)).size).toBe(pairs.length);
    for (const [a, b] of pairs) {
      expect(a < b).toBe(true);
      expect(state.regions[a]).toBeDefined();
      expect(state.regions[b]).toBeDefined();
    }
  });
});

describe("pillBox", () => {
  const viewport = { width: 1200, height: 800 };
  const inside = (box: { x: number; y: number; width: number; height: number }) =>
    box.x >= MAP_INSETS.left &&
    box.y >= MAP_INSETS.top &&
    box.x + box.width <= viewport.width - MAP_INSETS.right &&
    box.y + box.height <= viewport.height - MAP_INSETS.bottom;

  it("is 22 px tall and wider than its text", () => {
    const box = pillBox({ x: 600, y: 400 }, 60, viewport, MAP_INSETS);
    expect(box.height).toBe(PILL_HEIGHT);
    expect(PILL_HEIGHT).toBe(22);
    expect(box.width).toBeGreaterThan(60);
  });

  it.each([
    ["left edge", { x: 12, y: 300 }],
    ["right edge", { x: 1188, y: 500 }],
    ["top edge", { x: 640, y: 48 }],
    ["bottom edge", { x: 300, y: 754 }],
    ["top-left corner", { x: 12, y: 48 }],
    ["bottom-right corner", { x: 1188, y: 754 }]
  ])("keeps the pill inside the inset area at the %s", (_name, anchor) => {
    expect(inside(pillBox(anchor, 80, viewport, MAP_INSETS))).toBe(true);
  });

  it("centers the pill on the anchor when there is room", () => {
    const box = pillBox({ x: 600, y: 400 }, 60, viewport, MAP_INSETS);
    expect(box.x + box.width / 2).toBeCloseTo(600, 5);
    expect(box.y + box.height / 2).toBeCloseTo(400, 5);
  });
});
