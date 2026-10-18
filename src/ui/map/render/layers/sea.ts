import type { Camera, Viewport } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import { getNoiseTile } from "../patterns";
import { getPaths } from "../paths";
import { setScreenTransform, setWorldTransform } from "../transforms";

export const SEA_BASE = "#14303f";
const SEA_EDGE = "#0f2531";
const GRATICULE = "rgba(255, 255, 255, 0.06)";
const NOISE_ALPHA = 0.04;

let vignette: { key: string; gradient: CanvasGradient } | null = null;
const noisePatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

/** The plain sea, used while the map geometry is still being prepared. */
export function drawFlatSea(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  ctx.fillStyle = SEA_BASE;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/** The plain sea with "Preparing map…" on it, shown while the geometry is built. */
export function drawPreparingMap(ctx: CanvasRenderingContext2D, viewport: Viewport, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFlatSea(ctx, viewport);
  ctx.fillStyle = "#9db1c5";
  ctx.font = '14px Inter, "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Preparing map…", viewport.width / 2, viewport.height / 2);
}

/** Spec 11.4 layer 1: base color, radial vignette, noise texture and a faint graticule. */
export function drawSea(
  ctx: CanvasRenderingContext2D,
  geometry: MapGeometry,
  camera: Camera,
  viewport: Viewport,
  dpr: number
): void {
  setScreenTransform(ctx, dpr);
  drawFlatSea(ctx, viewport);

  const key = `${viewport.width}x${viewport.height}`;
  if (!vignette || vignette.key !== key) {
    const reach = Math.max(viewport.width, viewport.height);
    const gradient = ctx.createRadialGradient(viewport.width / 2, viewport.height / 2, reach * 0.2, viewport.width / 2, viewport.height / 2, reach * 0.75);
    gradient.addColorStop(0, SEA_BASE);
    gradient.addColorStop(1, SEA_EDGE);
    vignette = { key, gradient };
  }
  ctx.fillStyle = vignette.gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  let noise = noisePatterns.get(ctx);
  if (!noise) {
    const tile = getNoiseTile();
    const created = tile ? ctx.createPattern(tile, "repeat") : null;
    if (created) {
      created.setTransform(new DOMMatrix().scale(1 / dpr));
      noisePatterns.set(ctx, created);
      noise = created;
    }
  }
  if (noise) {
    ctx.globalAlpha = NOISE_ALPHA;
    ctx.fillStyle = noise;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.globalAlpha = 1;
  }

  setWorldTransform(ctx, camera, dpr);
  ctx.strokeStyle = GRATICULE;
  ctx.lineWidth = 1 / camera.scale;
  ctx.stroke(getPaths(geometry).graticule);
}
