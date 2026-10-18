import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/types";
import { edgePillAnchor, type Insets } from "./pills";

const viewport = { width: 1440, height: 900 };
const insets: Insets = { top: 48, right: 12, bottom: 46, left: 12 };
const from: Point = [700, 450];

const targetByDirection: Record<string, Point> = {
  east: [3000, 450],
  west: [-3000, 450],
  north: [700, -2000],
  south: [700, 3000],
  northEast: [3000, -2000],
  northWest: [-3000, -2000],
  southEast: [3000, 3000],
  southWest: [-3000, 3000]
};

describe("edgePillAnchor", () => {
  it("keeps anchors inside the inset rect in all compass directions", () => {
    for (const [direction, to] of Object.entries(targetByDirection)) {
      const anchor = edgePillAnchor(from, to, viewport, insets);
      expect(anchor, direction).not.toBeNull();
      expect(anchor!.x, direction).toBeGreaterThanOrEqual(12);
      expect(anchor!.x, direction).toBeLessThanOrEqual(1428);
      expect(anchor!.y, direction).toBeGreaterThanOrEqual(48);
      expect(anchor!.y, direction).toBeLessThanOrEqual(854);
      expect(Number.isFinite(anchor!.angle), direction).toBe(true);
    }
  });

  it("points east and north correctly", () => {
    expect(edgePillAnchor(from, [3000, 450], viewport, insets)!.angle).toBeCloseTo(0, 9);
    expect(edgePillAnchor(from, [700, -2000], viewport, insets)!.x).toBeCloseTo(700, 9);
    expect(edgePillAnchor(from, [700, -2000], viewport, insets)!.y).toBeCloseTo(48, 9);
  });

  it("returns null when the target is inside the inset rect", () => {
    expect(edgePillAnchor(from, [700, 450], viewport, insets)).toBeNull();
    expect(edgePillAnchor([0, 0], [100, 100], viewport, insets)).toBeNull();
  });

  it("anchors from the viewport center when the source is off-screen", () => {
    const anchor = edgePillAnchor([-5000, -5000], [3000, 450], viewport, insets)!;
    expect(anchor.x).toBeCloseTo(1428, 9);
    expect(anchor.y).toBeCloseTo(450, 9);
  });
});
