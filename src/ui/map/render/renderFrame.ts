import type { GameState } from "../../../game/state/types";
import type { Camera, Viewport } from "../camera";
import type { DerivedMapData } from "../derive";
import type { MapGeometry } from "../geometry/buildMapGeometry";
import type { BBox } from "../geometry/types";
import type { FrameHitData } from "../layout/hitTest";
import type { MapViewProps } from "../MapView";
import { drawOrderArrows } from "./layers/arrows";
import { drawBorders } from "./layers/borders";
import { cityScreenPoints, drawCityMarkers } from "./layers/cities";
import { drawFrontLine } from "./layers/front";
import { drawHighlights } from "./layers/highlights";
import { drawLand } from "./layers/land";
import { drawLinkNetwork, drawSelectionLinks, linkPairs } from "./layers/links";
import { drawSupplyOverlay } from "./layers/overlays";
import { drawRegions } from "./layers/regions";
import { drawSea } from "./layers/sea";
import { setScreenTransform, setWorldTransform } from "./transforms";

export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  dpr: number;
  camera: Camera;
  /** Zoom relative to the default fit (spec 11.3). */
  z: number;
  geometry: MapGeometry;
  derived: DerivedMapData;
  state: GameState;
  props: MapViewProps;
  hoverRegionId: string | null;
  expandedRegionId: string | null;
  fontsReady: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const setCache = new WeakMap<readonly string[], ReadonlySet<string>>();

function toSet(values: readonly string[] | undefined): ReadonlySet<string> {
  if (!values || values.length === 0) return EMPTY_SET;
  let set = setCache.get(values);
  if (!set) {
    set = new Set(values);
    setCache.set(values, set);
  }
  return set;
}

function visibleWorldRect(camera: Camera, viewport: Viewport): BBox {
  return [
    -camera.offsetX / camera.scale,
    -camera.offsetY / camera.scale,
    (viewport.width - camera.offsetX) / camera.scale,
    (viewport.height - camera.offsetY) / camera.scale
  ];
}

/** Draws one frame (spec 11.4) and returns what is clickable in it (screen space, CSS pixels). */
export function renderFrame(input: FrameInput): FrameHitData {
  const { ctx, viewport, dpr, camera, geometry, derived, state, props } = input;
  const visible = visibleWorldRect(camera, viewport);

  // layers 1-9, world space
  drawSea(ctx, geometry, camera, viewport, dpr);
  setWorldTransform(ctx, camera, dpr);
  drawLand(ctx, geometry, camera, visible);
  drawRegions(ctx, geometry, derived, camera, visible, dpr);
  drawBorders(ctx, geometry, camera);
  drawFrontLine(ctx, geometry, derived, camera);
  const selectedRegionId = props.selectedRegionId;
  drawHighlights(
    ctx,
    geometry,
    {
      hoverRegionId: input.hoverRegionId,
      selectedRegionId,
      linkedRegionIds: selectedRegionId ? state.regions[selectedRegionId]?.adjacentRegionIds ?? [] : [],
      moveTargets: toSet(props.validMoveTargets),
      attackTargets: toSet(props.validAttackTargets)
    },
    camera,
    visible
  );
  drawSupplyOverlay(ctx, geometry, derived, camera);

  // screen space, layers 10-13 (Task 27 part b3-b4 add counters, depot and deposits, labels)
  setScreenTransform(ctx, dpr);
  const cities = cityScreenPoints(geometry, camera);
  drawLinkNetwork(ctx, linkPairs(state.regions), cities, input.z);
  const pills = drawSelectionLinks(ctx, {
    state,
    cities,
    viewport,
    selectedRegionId,
    hoverRegionId: input.hoverRegionId,
    fontsReady: input.fontsReady
  });
  drawCityMarkers(ctx, cities, state, {
    z: input.z,
    viewport,
    selectedRegionId,
    linkedIds: toSet(selectedRegionId ? state.regions[selectedRegionId]?.adjacentRegionIds : undefined)
  });
  const showcase = props.mode === "showcase";
  if (!showcase) drawOrderArrows(ctx, derived.arrows, cities, viewport);

  return {
    counters: [],
    cities: [...cities].map(([regionId, [x, y]]) => ({ regionId, x, y })),
    pills
  };
}
