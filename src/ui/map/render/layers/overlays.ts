import type { Camera } from "../../camera";
import type { DerivedMapData } from "../../derive";
import type { MapGeometry } from "../../geometry/buildMapGeometry";

function linkPath(geometry: MapGeometry, pairs: [string, string][]): Path2D {
  const path = new Path2D();
  for (const [a, b] of pairs) {
    const from = geometry.regions.get(a)?.point;
    const to = geometry.regions.get(b)?.point;
    if (!from || !to) continue;
    path.moveTo(from[0], from[1]);
    path.lineTo(to[0], to[1]);
  }
  return path;
}

/** Spec 11.4 layer 9 (world space): supply links from the player's capital, green when connected, dashed grey when cut off. */
export function drawSupplyOverlay(ctx: CanvasRenderingContext2D, geometry: MapGeometry, derived: DerivedMapData, camera: Camera): void {
  const supply = derived.supply;
  if (!supply) return;
  const scale = camera.scale;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(124, 196, 124, 0.6)";
  ctx.lineWidth = 2.5 / scale;
  ctx.stroke(linkPath(geometry, supply.supplied));
  ctx.strokeStyle = "rgba(150, 170, 196, 0.5)";
  ctx.lineWidth = 1.5 / scale;
  ctx.setLineDash([4 / scale, 4 / scale]);
  ctx.stroke(linkPath(geometry, supply.unsupplied));
  ctx.setLineDash([]);
}
