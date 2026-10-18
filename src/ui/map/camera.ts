import type { BBox, Point } from "./geometry/types";

/** Screen position = world position × scale + offset, in CSS pixels. */
export interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Zoom range as multiples of the fit scale (spec 11.3). */
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 24;

export function worldToScreen(camera: Camera, x: number, y: number): Point {
  return [x * camera.scale + camera.offsetX, y * camera.scale + camera.offsetY];
}

export function screenToWorld(camera: Camera, sx: number, sy: number): Point {
  return [(sx - camera.offsetX) / camera.scale, (sy - camera.offsetY) / camera.scale];
}

/** Fits `bounds` into the viewport with `padding` px around it, centered. */
export function fitCamera(bounds: BBox, viewport: Viewport, padding = 40): Camera {
  const width = Math.max(bounds[2] - bounds[0], 1e-9);
  const height = Math.max(bounds[3] - bounds[1], 1e-9);
  const scale = Math.max(
    Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height),
    1e-9
  );
  const centerX = (bounds[0] + bounds[2]) / 2;
  const centerY = (bounds[1] + bounds[3]) / 2;
  return {
    scale,
    offsetX: viewport.width / 2 - centerX * scale,
    offsetY: viewport.height / 2 - centerY * scale
  };
}

/** Zooms to `nextScale` (clamped) while keeping the world point under (sx, sy) fixed. */
export function zoomAt(
  camera: Camera,
  nextScale: number,
  sx: number,
  sy: number,
  minScale: number,
  maxScale: number
): Camera {
  const scale = Math.max(minScale, Math.min(maxScale, nextScale));
  const [worldX, worldY] = screenToWorld(camera, sx, sy);
  return { scale, offsetX: sx - worldX * scale, offsetY: sy - worldY * scale };
}

/**
 * Keeps at least `minVisible` of the scaled world on screen on both axes, so the map cannot be
 * dragged into empty space and lost.
 */
export function clampCamera(
  camera: Camera,
  viewport: Viewport,
  world: { width: number; height: number },
  minVisible = 0.25
): Camera {
  const scaledWidth = world.width * camera.scale;
  const scaledHeight = world.height * camera.scale;
  const minOffsetX = -scaledWidth * (1 - minVisible);
  const maxOffsetX = viewport.width - scaledWidth * minVisible;
  const minOffsetY = -scaledHeight * (1 - minVisible);
  const maxOffsetY = viewport.height - scaledHeight * minVisible;
  return {
    scale: camera.scale,
    offsetX: Math.max(minOffsetX, Math.min(maxOffsetX, camera.offsetX)),
    offsetY: Math.max(minOffsetY, Math.min(maxOffsetY, camera.offsetY))
  };
}

export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) ** 3;
}

/** Geometric scale interpolation: equal progress steps multiply the scale by equal factors. */
export function zoomScaleAtProgress(fromScale: number, toScale: number, t: number): number {
  return fromScale * (toScale / fromScale) ** easeOutCubic(t);
}

/**
 * The camera after the viewport changed size: the world point that was at the center stays at the center, and the
 * zoom stays the same multiple of the (new) fit scale.
 */
export function recenterOnResize(
  camera: Camera,
  previous: Viewport,
  next: Viewport,
  fitScale: number,
  nextFitScale: number,
  world: { width: number; height: number }
): Camera {
  const center = screenToWorld(camera, previous.width / 2, previous.height / 2);
  const scale = camera.scale * (nextFitScale / fitScale);
  return clampCamera({ scale, offsetX: next.width / 2 - center[0] * scale, offsetY: next.height / 2 - center[1] * scale }, next, world);
}
