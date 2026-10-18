import type { GameState } from "../../../../game/state/types";
import type { Camera, Viewport } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { Point } from "../../geometry/types";

const GOLD = "#d4a537";
const GOLD_BRIGHT = "#f0c75e";
const OUTLINE = "rgba(10, 12, 14, 0.9)";

/** Screen position of every city point, in CSS pixels. */
export function cityScreenPoints(geometry: MapGeometry, camera: Camera): Map<string, Point> {
  const points = new Map<string, Point>();
  for (const [regionId, shape] of geometry.regions) {
    points.set(regionId, [shape.point[0] * camera.scale + camera.offsetX, shape.point[1] * camera.scale + camera.offsetY]);
  }
  return points;
}

/** The marker radius the label placer keeps clear (spec 11.4 layer 12). */
export function markerRadius(isCapital: boolean, isKeyCity: boolean, z: number): number {
  if (isCapital) return z < 1 ? 4.5 : 5.5;
  return isKeyCity ? 3.2 : 2.4;
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number): void {
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Spec 11.4 layer 12: every one of the 103 cities, always. Capital: gold star; key city: white dot with a dark
 * outline; other: small white dot. The selected city gets a gold ring at 9 px, linked cities a thin one at 7 px.
 */
export function drawCityMarkers(
  ctx: CanvasRenderingContext2D,
  cities: Map<string, Point>,
  state: GameState,
  opts: { z: number; viewport: Viewport; selectedRegionId: string | null; linkedIds: ReadonlySet<string> }
): void {
  const { z, viewport } = opts;
  ctx.lineJoin = "round";
  for (const [regionId, [x, y]] of cities) {
    if (x < -12 || y < -12 || x > viewport.width + 12 || y > viewport.height + 12) continue;
    const region = state.regions[regionId];

    if (regionId === opts.selectedRegionId) {
      ctx.strokeStyle = GOLD_BRIGHT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (opts.linkedIds.has(regionId)) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (region?.isCapital) {
      starPath(ctx, x, y, markerRadius(true, false, z));
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    } else {
      const key = Boolean(region?.isKeyCity);
      ctx.beginPath();
      ctx.arc(x, y, markerRadius(false, key, z), 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = key ? 1.2 : 0.9;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }
}
