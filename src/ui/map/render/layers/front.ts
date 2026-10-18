import type { Camera } from "../../camera";
import type { DerivedMapData } from "../../derive";
import type { MapGeometry } from "../../geometry/buildMapGeometry";

const frontPaths = new WeakMap<DerivedMapData, Path2D>();

/** Spec 11.4 layer 7: the gold front line between warring blocs, over a dark underlay. */
export function drawFrontLine(ctx: CanvasRenderingContext2D, geometry: MapGeometry, derived: DerivedMapData, camera: Camera): void {
  if (derived.frontEdgeIndexes.length === 0) return;
  let path = frontPaths.get(derived);
  if (!path) {
    const built = new Path2D();
    for (const index of derived.frontEdgeIndexes) {
      geometry.edges[index].points.forEach(([x, y], i) => (i === 0 ? built.moveTo(x, y) : built.lineTo(x, y)));
    }
    frontPaths.set(derived, built);
    path = built;
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(10, 10, 10, 0.6)";
  ctx.lineWidth = 6 / camera.scale;
  ctx.stroke(path);
  ctx.strokeStyle = "#f2b134";
  ctx.lineWidth = 2.6 / camera.scale;
  ctx.stroke(path);
}
