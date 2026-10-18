// Task 26's frame: sea, background land, region fills and city dots. Task 27 replaces these with the
// full layer stack (spec 11.4) and deletes this file.
import type { GameState } from "../../../../game/state/types";
import { NON_SCENARIO_LAND } from "../../../theme/palette";
import type { Camera, Viewport } from "../../camera";
import type { DerivedMapData } from "../../derive";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { BBox, Point } from "../../geometry/types";
import { getPaths, intersects } from "../paths";

export const SEA_COLOR = "#14303f";

export function drawSea(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  ctx.fillStyle = SEA_COLOR;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

export function visibleWorldRect(camera: Camera, viewport: Viewport): BBox {
  return [
    -camera.offsetX / camera.scale,
    -camera.offsetY / camera.scale,
    (viewport.width - camera.offsetX) / camera.scale,
    (viewport.height - camera.offsetY) / camera.scale
  ];
}

export function drawBackgroundLand(ctx: CanvasRenderingContext2D, geometry: MapGeometry, visible: BBox): void {
  ctx.fillStyle = NON_SCENARIO_LAND;
  for (const { path, bbox } of getPaths(geometry).background) {
    if (intersects(bbox, visible)) ctx.fill(path, "evenodd");
  }
}

export function drawRegionFills(
  ctx: CanvasRenderingContext2D,
  geometry: MapGeometry,
  derived: DerivedMapData,
  visible: BBox
): void {
  const paths = getPaths(geometry).region;
  for (const [regionId, shape] of geometry.regions) {
    if (!intersects(shape.bbox, visible)) continue;
    const path = paths.get(regionId);
    if (!path) continue;
    ctx.fillStyle = derived.fillByRegion.get(regionId) ?? NON_SCENARIO_LAND;
    ctx.fill(path, "evenodd");
  }
}

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
