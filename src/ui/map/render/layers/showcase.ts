import type { CountryId, GameState } from "../../../../game/state/types";
import type { Camera } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { BBox } from "../../geometry/types";
import { getStartingControllers } from "../../startingControllers";
import { getPaths, intersects } from "../paths";

export interface ShowcaseHighlight {
  highlightedRegionIds: ReadonlySet<string>;
  dimmedRegionIds: ReadonlySet<string>;
}

/**
 * Spec 11.8: the start screen highlights the hovered nation's starting territory against
 * everything else. The starting controller comes from the scenario, so later occupations
 * never change the picture.
 */
export function getShowcaseHighlight(state: GameState, highlightCountryId: CountryId): ShowcaseHighlight {
  const controllers = getStartingControllers(state);
  const highlightedRegionIds = new Set<string>();
  const dimmedRegionIds = new Set<string>();
  for (const regionId of Object.keys(state.regions)) {
    if (controllers[regionId] === highlightCountryId) {
      highlightedRegionIds.add(regionId);
    } else {
      dimmedRegionIds.add(regionId);
    }
  }
  return { highlightedRegionIds, dimmedRegionIds };
}

export function drawShowcaseHighlight(
  ctx: CanvasRenderingContext2D,
  geometry: MapGeometry,
  state: GameState,
  highlightCountryId: CountryId,
  camera: Camera,
  visible: BBox
): void {
  const { highlightedRegionIds, dimmedRegionIds } = getShowcaseHighlight(state, highlightCountryId);
  const paths = getPaths(geometry).region;
  const scale = camera.scale;
  const usable = (id: string): Path2D | null => {
    const shape = geometry.regions.get(id);
    if (!shape || !intersects(shape.bbox, visible)) return null;
    return paths.get(id) ?? null;
  };

  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  for (const id of dimmedRegionIds) {
    const path = usable(id);
    if (path) ctx.fill(path, "evenodd");
  }

  ctx.fillStyle = "rgba(246, 231, 176, 0.12)";
  for (const id of highlightedRegionIds) {
    const path = usable(id);
    if (path) ctx.fill(path, "evenodd");
  }

  ctx.lineJoin = "round";
  ctx.strokeStyle = "#f6e7b0";
  ctx.lineWidth = 2.5 / scale;
  ctx.setLineDash([]);
  for (const id of highlightedRegionIds) {
    const path = usable(id);
    if (path) ctx.stroke(path);
  }
}
