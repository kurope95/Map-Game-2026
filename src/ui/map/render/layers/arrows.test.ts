import { describe, expect, it } from "vitest";
import type { OrderType } from "../../../../game/state/types";
import { ARROW_STYLES, arrowBadgeText, arrowGeometry, arrowIsVisible } from "./arrows";

const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("arrowGeometry", () => {
  it("bulges the curve 18 px sideways at its midpoint", () => {
    const { mid } = arrowGeometry([0, 0], [100, 0], 18);
    expect(mid[0]).toBeCloseTo(50, 8);
    expect(Math.abs(mid[1])).toBeCloseTo(18, 8);
  });

  it("is 18 px off the chord whatever the direction", () => {
    for (const to of [[40, 90], [-70, 30], [0, -120], [55, 55]] as [number, number][]) {
      const from: [number, number] = [10, 20];
      const chordMid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      expect(distance(arrowGeometry(from, to).mid, chordMid)).toBeCloseTo(18, 8);
    }
  });

  it("bulges to opposite sides for opposite directions, so two armies attacking each other do not overlap", () => {
    const forward = arrowGeometry([0, 0], [100, 0]).mid;
    const backward = arrowGeometry([100, 0], [0, 0]).mid;
    expect(forward[1]).toBeCloseTo(-backward[1], 8);
    expect(forward[1]).not.toBe(0);
  });

  it("ends pointing along the last stretch of the curve, from the control point to the target", () => {
    const { control, endAngle } = arrowGeometry([0, 0], [100, 0]);
    expect(endAngle).toBeCloseTo(Math.atan2(0 - control[1], 100 - control[0]), 10);
    // bulging up (negative y) the curve comes down onto the target
    expect(Math.sin(endAngle) * Math.sign(-control[1])).toBeGreaterThan(0);
  });

  it("copes with a zero-length arrow", () => {
    const geometry = arrowGeometry([5, 5], [5, 5]);
    expect(geometry.mid).toEqual([5, 5]);
    expect(Number.isFinite(geometry.endAngle)).toBe(true);
  });
});

describe("ARROW_STYLES (spec 11.4 layer 13)", () => {
  it("has a style for every order type except hold", () => {
    const types: Exclude<OrderType, "hold">[] = ["move", "attack", "airSupport", "bombard", "missileStrike"];
    expect(Object.keys(ARROW_STYLES).sort()).toEqual([...types].sort());
  });

  it("uses the spec colors and line patterns", () => {
    expect(ARROW_STYLES.attack).toMatchObject({ color: "#e0605a", pattern: "solid", burst: false });
    expect(ARROW_STYLES.move).toMatchObject({ color: "#7cc47c", pattern: "dashed", burst: false });
    expect(ARROW_STYLES.airSupport).toMatchObject({ color: "#e0b04a", pattern: "dotted", burst: false });
    expect(ARROW_STYLES.bombard).toMatchObject({ color: "#e0b04a", pattern: "dotted", burst: true });
    expect(ARROW_STYLES.missileStrike).toMatchObject({ color: "#d06bd6", pattern: "dotted", burst: false });
  });
});

describe("arrowBadgeText", () => {
  it("shows no badge for a single order and ×N for merged ones", () => {
    expect(arrowBadgeText(1)).toBeNull();
    expect(arrowBadgeText(3)).toBe("×3");
  });
});

describe("arrowIsVisible", () => {
  const viewport = { width: 1000, height: 600 };
  it("keeps arrows that touch the screen and drops those far outside it", () => {
    expect(arrowIsVisible([100, 100], [300, 200], [200, 120], viewport)).toBe(true);
    expect(arrowIsVisible([-500, 100], [1500, 200], [500, 120], viewport)).toBe(true);
    expect(arrowIsVisible([-500, -500], [-300, -400], [-400, -480], viewport)).toBe(false);
    expect(arrowIsVisible([1200, 100], [1400, 300], [1300, 150], viewport)).toBe(false);
  });
});
