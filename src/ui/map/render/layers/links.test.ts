import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../../game/state/createInitialState";
import { MAP_INSETS } from "../../layout/pills";
import { linkPairs, pillBox, PILL_HEIGHT, spreadPills } from "./links";

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

describe("spreadPills", () => {
  const bounds = { x: 12, y: 48, width: 1000, height: 700 };
  const pill = (x: number, y: number, width = 60) => ({ x, y, width, height: 22 });
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  it("leaves pills that already have room where they are", () => {
    const boxes = [pill(100, 48), pill(300, 48)];
    expect(spreadPills(boxes, "x", bounds)).toEqual(boxes);
  });

  it("slides overlapping pills apart along the edge and keeps their order", () => {
    const boxes = [pill(200, 48), pill(210, 48), pill(220, 48)];
    const spread = spreadPills(boxes, "x", bounds);
    expect(spread[0].x).toBeLessThan(spread[1].x);
    expect(spread[1].x).toBeLessThan(spread[2].x);
    for (let i = 0; i < spread.length; i += 1) {
      for (let j = i + 1; j < spread.length; j += 1) expect(overlap(spread[i], spread[j])).toBe(false);
      expect(spread[i].y).toBe(48);
    }
  });

  it("keeps the input order of the result even when the pills were given unsorted", () => {
    const boxes = [pill(500, 48), pill(100, 48)];
    const spread = spreadPills(boxes, "x", bounds);
    expect(spread[0].x).toBe(500);
    expect(spread[1].x).toBe(100);
  });

  it("pulls a row back inside the bounds when its last pill would stick out", () => {
    const boxes = [pill(930, 48), pill(940, 48), pill(950, 48)];
    const spread = spreadPills(boxes, "x", bounds);
    for (const box of spread) expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    for (let i = 0; i < spread.length; i += 1) {
      for (let j = i + 1; j < spread.length; j += 1) expect(overlap(spread[i], spread[j])).toBe(false);
    }
  });

  it("works along the y axis for pills on a side edge", () => {
    const boxes = [pill(940, 300, 70), pill(940, 305, 70)];
    const spread = spreadPills(boxes, "y", bounds);
    expect(overlap(spread[0], spread[1])).toBe(false);
    expect(spread[0].x).toBe(940);
  });
});
