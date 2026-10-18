import type { Camera } from "../../camera";
import type { EdgeKind } from "../../geometry/boundaries";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import { getPaths } from "../paths";

// widths in screen pixels, drawn in this order so national borders sit on top of internal ones
const BORDER_STYLES: [EdgeKind, number, string][] = [
  ["internal", 1, "rgba(10, 12, 14, 0.45)"],
  ["foreign", 1.2, "rgba(10, 12, 14, 0.7)"],
  ["national", 1.6, "rgba(10, 12, 14, 0.9)"],
  ["coast", 0.9, "rgba(225, 235, 240, 0.5)"]
];

/** Spec 11.4 layer 6. */
export function drawBorders(ctx: CanvasRenderingContext2D, geometry: MapGeometry, camera: Camera): void {
  const borders = getPaths(geometry).borders;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [kind, width, color] of BORDER_STYLES) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width / camera.scale;
    ctx.stroke(borders[kind]);
  }
}
