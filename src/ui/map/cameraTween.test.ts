import { describe, expect, it } from "vitest";
import { screenToWorld, type Camera, type Viewport } from "./camera";
import { anchorTween, cameraTween, stepTween, tweenTargetScale, TWEEN_MS } from "./cameraTween";

const viewport: Viewport = { width: 1000, height: 700 };
// WORLD is 1600x980; this camera keeps most of it on screen so the clamp never interferes
const camera: Camera = { scale: 0.6, offsetX: 20, offsetY: 30 };

describe("anchor tween (wheel and +/- zoom)", () => {
  const anchorX = 400;
  const anchorY = 250;
  const tween = anchorTween(camera, 1.2, anchorX, anchorY, 1000);

  it("starts at the current scale and ends at the target scale", () => {
    expect(stepTween(tween, 1000, viewport).camera.scale).toBeCloseTo(0.6, 10);
    const end = stepTween(tween, 1000 + TWEEN_MS, viewport);
    expect(end.camera.scale).toBeCloseTo(1.2, 10);
    expect(end.done).toBe(true);
  });

  it("keeps the world point under the anchor fixed all the way", () => {
    const [worldX, worldY] = screenToWorld(camera, anchorX, anchorY);
    for (const offset of [0, 30, 70, 110, TWEEN_MS]) {
      const { camera: next } = stepTween(tween, 1000 + offset, viewport);
      const [x, y] = screenToWorld(next, anchorX, anchorY);
      expect(x).toBeCloseTo(worldX, 6);
      expect(y).toBeCloseTo(worldY, 6);
    }
  });

  it("eases out: more than half of the zoom (in log scale) is done at half the time", () => {
    const mid = stepTween(tween, 1000 + TWEEN_MS / 2, viewport).camera.scale;
    expect(Math.log(mid / 0.6) / Math.log(1.2 / 0.6)).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1.2);
  });

  it("is not done before the duration has passed", () => {
    expect(stepTween(tween, 1000 + TWEEN_MS - 1, viewport).done).toBe(false);
  });

  it("reports the target scale while running and the camera scale otherwise", () => {
    expect(tweenTargetScale(tween, camera)).toBe(1.2);
    expect(tweenTargetScale(null, camera)).toBe(0.6);
  });
});

describe("camera tween (reset and focus)", () => {
  const target: Camera = { scale: 0.9, offsetX: -100, offsetY: -40 };
  const tween = cameraTween(camera, target, viewport, 500);

  it("ends on the target camera", () => {
    const end = stepTween(tween, 500 + TWEEN_MS, viewport);
    expect(end.done).toBe(true);
    expect(end.camera.scale).toBeCloseTo(0.9, 10);
    expect(end.camera.offsetX).toBeCloseTo(-100, 6);
    expect(end.camera.offsetY).toBeCloseTo(-40, 6);
  });

  it("moves the viewport center along a straight line from the old to the new center", () => {
    const from = screenToWorld(camera, viewport.width / 2, viewport.height / 2);
    const to = screenToWorld(target, viewport.width / 2, viewport.height / 2);
    const mid = stepTween(tween, 500 + TWEEN_MS / 2, viewport).camera;
    const [x, y] = screenToWorld(mid, viewport.width / 2, viewport.height / 2);
    // the point lies on the segment between from and to
    const cross = (x - from[0]) * (to[1] - from[1]) - (y - from[1]) * (to[0] - from[0]);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
    expect(x).toBeGreaterThan(Math.min(from[0], to[0]) - 1e-9);
    expect(x).toBeLessThan(Math.max(from[0], to[0]) + 1e-9);
  });

  it("does not change the target scale reported for non-anchor tweens", () => {
    expect(tweenTargetScale(tween, camera)).toBe(0.6);
  });
});
