import { NON_SCENARIO_LAND } from "../../../theme/palette";
import type { Camera } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { BBox } from "../../geometry/types";
import { getPaths, intersects } from "../paths";

const HALO_OUTER = "rgba(120, 190, 210, 0.2)";
const HALO_INNER = "rgba(120, 190, 210, 0.32)";
const BACKGROUND_BORDER = "rgba(10, 12, 14, 0.6)";

/** Spec 11.4 layers 2-3: the coast halo around all land, then the non-scenario land with thin borders. */
export function drawLand(ctx: CanvasRenderingContext2D, geometry: MapGeometry, camera: Camera, visible: BBox): void {
  const paths = getPaths(geometry);
  const scale = camera.scale;
  const margin = 8 / scale;
  const reach: BBox = [visible[0] - margin, visible[1] - margin, visible[2] + margin, visible[3] + margin];

  ctx.lineJoin = "round";
  ctx.strokeStyle = HALO_OUTER;
  ctx.lineWidth = 8 / scale;
  for (const outline of paths.outlines) if (intersects(outline.bbox, reach)) ctx.stroke(outline.path);
  ctx.strokeStyle = HALO_INNER;
  ctx.lineWidth = 3.5 / scale;
  for (const outline of paths.outlines) if (intersects(outline.bbox, reach)) ctx.stroke(outline.path);

  ctx.fillStyle = NON_SCENARIO_LAND;
  for (const { path, bbox } of paths.background) if (intersects(bbox, visible)) ctx.fill(path, "evenodd");
  ctx.strokeStyle = BACKGROUND_BORDER;
  ctx.lineWidth = 1 / scale;
  for (const { path, bbox } of paths.background) if (intersects(bbox, reach)) ctx.stroke(path);
}
