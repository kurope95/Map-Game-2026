import { clampCamera, easeOutCubic, screenToWorld, zoomScaleAtProgress, type Camera, type Viewport } from "./camera";
import { WORLD } from "./geometry/projection";

export const TWEEN_MS = 140;

/** Zoom anchored on a screen point (wheel, + and -), or a move between two cameras (reset, focus on a region). */
export type Tween =
  | { kind: "anchor"; start: number; fromScale: number; toScale: number; ax: number; ay: number; worldX: number; worldY: number }
  | { kind: "camera"; start: number; fromScale: number; toScale: number; fromCenter: [number, number]; toCenter: [number, number] };

/** A zoom to `toScale` that keeps the world point under the screen point (anchorX, anchorY) fixed. */
export function anchorTween(camera: Camera, toScale: number, anchorX: number, anchorY: number, now: number): Tween {
  const [worldX, worldY] = screenToWorld(camera, anchorX, anchorY);
  return { kind: "anchor", start: now, fromScale: camera.scale, toScale, ax: anchorX, ay: anchorY, worldX, worldY };
}

/** A move from `camera` to `target` that glides the viewport center and the scale. */
export function cameraTween(camera: Camera, target: Camera, viewport: Viewport, now: number): Tween {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return {
    kind: "camera",
    start: now,
    fromScale: camera.scale,
    toScale: target.scale,
    fromCenter: screenToWorld(camera, cx, cy),
    toCenter: screenToWorld(target, cx, cy)
  };
}

/** Where a running zoom is heading, so repeated wheel ticks multiply the target rather than the current scale. */
export function tweenTargetScale(tween: Tween | null, camera: Camera): number {
  return tween?.kind === "anchor" ? tween.toScale : camera.scale;
}

/** The camera at time `now` and whether the tween has finished. */
export function stepTween(tween: Tween, now: number, viewport: Viewport): { camera: Camera; done: boolean } {
  const t = Math.max(0, Math.min(1, (now - tween.start) / TWEEN_MS));
  if (tween.kind === "anchor") {
    const scale = zoomScaleAtProgress(tween.fromScale, tween.toScale, t);
    return {
      camera: clampCamera({ scale, offsetX: tween.ax - tween.worldX * scale, offsetY: tween.ay - tween.worldY * scale }, viewport, WORLD),
      done: t >= 1
    };
  }
  const p = easeOutCubic(t);
  const scale = tween.fromScale * (tween.toScale / tween.fromScale) ** p;
  const centerX = tween.fromCenter[0] + (tween.toCenter[0] - tween.fromCenter[0]) * p;
  const centerY = tween.fromCenter[1] + (tween.toCenter[1] - tween.fromCenter[1]) * p;
  return {
    camera: clampCamera({ scale, offsetX: viewport.width / 2 - centerX * scale, offsetY: viewport.height / 2 - centerY * scale }, viewport, WORLD),
    done: t >= 1
  };
}
