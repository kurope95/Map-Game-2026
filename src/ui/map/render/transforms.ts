import type { Camera } from "../camera";

/** World units to device pixels: dpr × camera. Line widths in world layers are divided by camera.scale. */
export function setWorldTransform(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
  ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.offsetX, dpr * camera.offsetY);
}

/** CSS pixels to device pixels. */
export function setScreenTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
