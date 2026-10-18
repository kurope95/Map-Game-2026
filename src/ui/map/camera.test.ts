import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampCamera,
  easeOutCubic,
  fitCamera,
  recenterOnResize,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomScaleAtProgress
} from "./camera";

const viewport = { width: 800, height: 600 };
const camera = { scale: 1.5, offsetX: 30, offsetY: -20 };

describe("camera transforms", () => {
  it("round-trips world to screen and back", () => {
    for (const point of [
      [0, 0],
      [123.456, 789.012],
      [-40, 55]
    ] as const) {
      const screen = worldToScreen(camera, point[0], point[1]);
      const roundTripped = screenToWorld(camera, screen[0], screen[1]);
      expect(Math.abs(roundTripped[0] - point[0])).toBeLessThan(1e-9);
      expect(Math.abs(roundTripped[1] - point[1])).toBeLessThan(1e-9);
    }
  });

  it("keeps the world point under the pointer fixed while zooming", () => {
    const fitted = fitCamera([200, 100, 900, 600], viewport);
    const anchor = [640, 210] as const;
    const worldPoint = screenToWorld(fitted, anchor[0], anchor[1]);
    const zoomed = zoomAt(fitted, fitted.scale * 2.5, anchor[0], anchor[1], 0.1, 100);
    const screen = worldToScreen(zoomed, worldPoint[0], worldPoint[1]);
    expect(Math.abs(screen[0] - anchor[0])).toBeLessThan(1e-6);
    expect(Math.abs(screen[1] - anchor[1])).toBeLessThan(1e-6);
  });

  it("clamps the zoom scale to the given range", () => {
    expect(zoomAt(camera, 1000, 400, 300, 0.5, 8).scale).toBe(8);
    expect(zoomAt(camera, 0.01, 400, 300, 0.5, 8).scale).toBe(0.5);
  });

  it("fits bounds centered with padding", () => {
    const fitted = fitCamera([100, 50, 500, 350], viewport, 40);
    const center = worldToScreen(fitted, 300, 200);
    expect(center[0]).toBeCloseTo(400, 9);
    expect(center[1]).toBeCloseTo(300, 9);
    expect(400 * fitted.scale).toBeLessThanOrEqual(viewport.width - 80 + 1e-9);
    expect(300 * fitted.scale).toBeLessThanOrEqual(viewport.height - 80 + 1e-9);
  });

  it("keeps at least a quarter of the world visible when panning away", () => {
    const world = { width: 1000, height: 700 };
    const right = clampCamera({ scale: 1, offsetX: 5000, offsetY: 0 }, viewport, world);
    const left = clampCamera({ scale: 1, offsetX: -5000, offsetY: 0 }, viewport, world);
    expect(viewport.width - right.offsetX).toBeGreaterThanOrEqual(250 - 1e-9);
    expect(left.offsetX + world.width).toBeGreaterThanOrEqual(250 - 1e-9);
    const down = clampCamera({ scale: 1, offsetX: 0, offsetY: 5000 }, viewport, world);
    const up = clampCamera({ scale: 1, offsetX: 0, offsetY: -5000 }, viewport, world);
    expect(viewport.height - down.offsetY).toBeGreaterThanOrEqual(175 - 1e-9);
    expect(up.offsetY + world.height).toBeGreaterThanOrEqual(175 - 1e-9);
  });

  it("leaves an already visible camera untouched", () => {
    const fitted = fitCamera([0, 0, 1000, 700], viewport);
    expect(clampCamera(fitted, viewport, { width: 1000, height: 700 })).toEqual(fitted);
  });
});

describe("zoom easing", () => {
  it("eases out in cubic with exact endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.25)).toBeLessThan(easeOutCubic(0.5));
    expect(easeOutCubic(1)).toBeGreaterThan(easeOutCubic(0.75));
  });

  it("interpolates the zoom scale geometrically and monotonically", () => {
    expect(zoomScaleAtProgress(1, 4, 0)).toBe(1);
    expect(zoomScaleAtProgress(1, 4, 1)).toBe(4);
    let previous = 0;
    for (let step = 0; step <= 10; step += 1) {
      const scale = zoomScaleAtProgress(1, 4, step / 10);
      expect(scale).toBeGreaterThan(previous);
      previous = scale;
    }
  });

  it("exposes the spec zoom range", () => {
    expect(MIN_ZOOM).toBe(0.6);
    expect(MAX_ZOOM).toBe(24);
  });
});

describe("recenterOnResize", () => {
  const world = { width: 1600, height: 980 };
  const before = { width: 1000, height: 700 };
  const after = { width: 1400, height: 800 };
  const start = { scale: 0.8, offsetX: 40, offsetY: 25 };

  it("keeps the world point at the viewport center at the center", () => {
    const center = screenToWorld(start, before.width / 2, before.height / 2);
    const next = recenterOnResize(start, before, after, 0.5, 0.5, world);
    const [x, y] = screenToWorld(next, after.width / 2, after.height / 2);
    expect(x).toBeCloseTo(center[0], 6);
    expect(y).toBeCloseTo(center[1], 6);
    expect(next.scale).toBeCloseTo(0.8, 10);
  });

  it("keeps the zoom relative to the fit when the fit scale changes", () => {
    const next = recenterOnResize(start, before, after, 0.5, 0.75, world);
    expect(next.scale / 0.75).toBeCloseTo(start.scale / 0.5, 10);
  });

  it("clamps the result so the map cannot be lost", () => {
    const far = { scale: 0.8, offsetX: -5000, offsetY: -5000 };
    const next = recenterOnResize(far, before, after, 0.5, 0.5, world);
    expect(next.offsetX).toBeGreaterThanOrEqual(-world.width * next.scale * 0.75 - 1e-9);
  });
});
