// Temporary: city dots only. The sea, land and region layers moved to their own files in Task 27; part b
// replaces the city dots with the real markers and deletes this file.
import type { GameState } from "../../../../game/state/types";
import type { Camera, Viewport } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { Point } from "../../geometry/types";

/** Screen position of every city point, in CSS pixels. */
export function cityScreenPoints(geometry: MapGeometry, camera: Camera): Map<string, Point> {
  const points = new Map<string, Point>();
  for (const [regionId, shape] of geometry.regions) {
    points.set(regionId, [shape.point[0] * camera.scale + camera.offsetX, shape.point[1] * camera.scale + camera.offsetY]);
  }
  return points;
}

export function drawCityDots(
  ctx: CanvasRenderingContext2D,
  cities: Map<string, Point>,
  state: GameState,
  viewport: Viewport
): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(10, 12, 14, 0.7)";
  ctx.fillStyle = "#ffffff";
  for (const [regionId, [x, y]] of cities) {
    if (x < -8 || y < -8 || x > viewport.width + 8 || y > viewport.height + 8) continue;
    const region = state.regions[regionId];
    const radius = region?.isCapital ? 4 : region?.isKeyCity ? 3.2 : 2.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
