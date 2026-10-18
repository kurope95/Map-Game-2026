import type { GameState } from "../../../game/state/types";
import type { Camera, Viewport } from "../camera";
import type { DerivedMapData } from "../derive";
import type { MapGeometry } from "../geometry/buildMapGeometry";
import type { FrameHitData } from "../layout/hitTest";
import type { MapViewProps } from "../MapView";
import { cityScreenPoints, drawBackgroundLand, drawCityDots, drawRegionFills, drawSea, visibleWorldRect } from "./layers/base";

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

/** Draws one frame and returns what is clickable in it (screen-space, CSS pixels). */
export function renderFrame(input: FrameInput): FrameHitData {
  const { ctx, viewport, dpr, camera, geometry, derived, state } = input;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSea(ctx, viewport);

  // world-space layers
  ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.offsetX, dpr * camera.offsetY);
  const visible = visibleWorldRect(camera, viewport);
  drawBackgroundLand(ctx, geometry, visible);
  drawRegionFills(ctx, geometry, derived, visible);

  // screen-space layers
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cities = cityScreenPoints(geometry, camera);
  drawCityDots(ctx, cities, state, viewport);

  return {
    counters: [],
    cities: [...cities].map(([regionId, [x, y]]) => ({ regionId, x, y })),
    pills: []
  };
}
