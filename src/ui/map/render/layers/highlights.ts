import type { Camera } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { BBox } from "../../geometry/types";
import { getPaths, intersects } from "../paths";

export interface HighlightInput {
  hoverRegionId: string | null;
  selectedRegionId: string | null;
  /** The selected region's direct links (adjacentRegionIds). */
  linkedRegionIds: readonly string[];
  moveTargets: ReadonlySet<string>;
  attackTargets: ReadonlySet<string>;
}

/**
 * Spec 11.4 layer 8, drawn in this order so later rules win: hover, links of the selection, the selection,
 * valid move targets, valid attack-type targets.
 */
export function drawHighlights(
  ctx: CanvasRenderingContext2D,
  geometry: MapGeometry,
  input: HighlightInput,
  camera: Camera,
  visible: BBox
): void {
  const paths = getPaths(geometry).region;
  const scale = camera.scale;
  const usable = (id: string): Path2D | null => {
    const shape = geometry.regions.get(id);
    if (!shape || !intersects(shape.bbox, visible)) return null;
    return paths.get(id) ?? null;
  };
  const outline = (id: string, width: number, color: string, dash?: [number, number]) => {
    const path = usable(id);
    if (!path) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width / scale;
    ctx.setLineDash(dash ? [dash[0] / scale, dash[1] / scale] : []);
    ctx.stroke(path);
  };
  const wash = (id: string, color: string) => {
    const path = usable(id);
    if (!path) return;
    ctx.fillStyle = color;
    ctx.fill(path, "evenodd");
  };

  ctx.lineJoin = "round";
  if (input.hoverRegionId) outline(input.hoverRegionId, 1.2, "rgba(255, 255, 255, 0.6)");
  for (const id of input.linkedRegionIds) outline(id, 1.6, "#d4a537");
  if (input.selectedRegionId) {
    wash(input.selectedRegionId, "rgba(255, 255, 255, 0.12)");
    outline(input.selectedRegionId, 2.5, "#f6e7b0");
  }
  for (const id of input.moveTargets) {
    wash(id, "rgba(124, 196, 124, 0.22)");
    outline(id, 1.6, "#7cc47c", [5, 4]);
  }
  for (const id of input.attackTargets) {
    wash(id, "rgba(224, 96, 90, 0.26)");
    outline(id, 1.8, "#e0605a");
  }
  ctx.setLineDash([]);
}
