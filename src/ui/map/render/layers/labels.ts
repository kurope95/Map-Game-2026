import type { GameState } from "../../../../game/state/types";
import type { Camera, Viewport } from "../../camera";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { Point } from "../../geometry/types";
import { placeLabels, type Box, type LabelCandidate } from "../../layout/labels";
import { cityLabelVisible, nationLabelFade, type CityKind } from "../lod";
import { font, haloText, textWidth } from "../text";
import { markerRadius } from "./cities";

const CITY_FONT = font(500, 12);
const CITY_LABEL_HEIGHT = 14;
const NATION_ALPHA = 0.55;
const NATION_DEFEATED_ALPHA = 0.25;
const GOLD_TEXT = "#f6e7b0";

/** Nation name size: 6 + 2.2·ln(area), clamped to 14-26 px (the larger the nation, the larger the name). */
export function nationLabelSize(area: number): number {
  if (!(area > 0)) return 14;
  return Math.max(14, Math.min(26, 6 + 2.2 * Math.log(area)));
}

export interface NationLabelItem {
  countryId: string;
  text: string;
  /** Center, in screen pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const centeredBox = (item: NationLabelItem): Box => ({ x: item.x - item.width / 2 - 2, y: item.y - item.height / 2 - 2, width: item.width + 4, height: item.height + 4 });

/** Largest nations first; a name that would overlap one already kept is dropped (it comes back when zooming in). */
export function selectNationLabels<T extends NationLabelItem>(items: readonly T[]): T[] {
  const kept: T[] = [];
  const keptBoxes: Box[] = [];
  for (const item of [...items].sort((a, b) => b.area - a.area)) {
    const box = centeredBox(item);
    if (keptBoxes.some((other) => overlaps(box, other))) continue;
    kept.push(item);
    keptBoxes.push(box);
  }
  return kept;
}

export interface NationLabelInput {
  state: GameState;
  geometry: MapGeometry;
  camera: Camera;
  viewport: Viewport;
  z: number;
  /** Showcase mode (spec 11.8): names stay on at every zoom level. */
  alwaysVisible?: boolean;
}

/**
 * Spec 11.4 layer 16, nation names (z < 1.6): uppercase, letter-spaced, translucent (.55, defeated .25), fading out
 * between z 1.3 and 1.6. Drawn beneath the link network and the counters so those stay crisp.
 */
export function drawNationLabels(ctx: CanvasRenderingContext2D, input: NationLabelInput): void {
  const { state, geometry, camera, viewport } = input;
  const fade = input.alwaysVisible ? 1 : nationLabelFade(input.z);
  if (fade <= 0) return;

  const items: (NationLabelItem & { size: number; spacing: number })[] = [];
  for (const [countryId, { point, area }] of geometry.nationLabels) {
    const country = state.countries[countryId];
    if (!country) continue;
    const x = point[0] * camera.scale + camera.offsetX;
    const y = point[1] * camera.scale + camera.offsetY;
    if (x < -200 || x > viewport.width + 200 || y < -40 || y > viewport.height + 40) continue;
    const size = nationLabelSize(area);
    const spacing = size * 0.12;
    const text = country.name.toUpperCase();
    items.push({ countryId, text, x, y, width: textWidth(ctx, font(500, size), text, spacing) - spacing, height: size, area, size, spacing });
  }

  const defeated = new Set<string>(state.history.defeatedCountries);
  const canSpace = "letterSpacing" in ctx;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const item of selectNationLabels(items)) {
    ctx.globalAlpha = (defeated.has(item.countryId) ? NATION_DEFEATED_ALPHA : NATION_ALPHA) * fade;
    ctx.font = font(500, item.size);
    if (canSpace) ctx.letterSpacing = `${item.spacing}px`;
    haloText(ctx, item.text, item.x + (canSpace ? item.spacing / 2 : 0), item.y, "#ffffff");
  }
  ctx.globalAlpha = 1;
  if (canSpace) ctx.letterSpacing = "0px";
}

export interface CityLabelInput {
  state: GameState;
  /** Screen position of every city. */
  cities: Map<string, Point>;
  viewport: Viewport;
  z: number;
  selectedRegionId: string | null;
  linkedIds: ReadonlySet<string>;
  /** Text width in px at the city label font. */
  measure: (text: string) => number;
}

/**
 * City label candidates by priority (spec 11.4 layer 16): the selection (1) and its links (2) are forced; then
 * capitals (3), key cities from z 1.3 (4) and all other cities from z 2.2 (5).
 */
export function cityLabelCandidates(input: CityLabelInput): LabelCandidate[] {
  const { state, cities, viewport, z, selectedRegionId, linkedIds, measure } = input;
  const candidates: LabelCandidate[] = [];
  for (const [regionId, [x, y]] of cities) {
    if (x < -80 || x > viewport.width + 80 || y < -24 || y > viewport.height + 24) continue;
    const region = state.regions[regionId];
    if (!region) continue;
    const kind: CityKind = region.isCapital ? "capital" : region.isKeyCity ? "key" : "other";
    let priority: number;
    let forced = false;
    if (regionId === selectedRegionId) {
      priority = 1;
      forced = true;
    } else if (linkedIds.has(regionId)) {
      priority = 2;
      forced = true;
    } else if (!cityLabelVisible(z, kind)) {
      continue;
    } else {
      priority = kind === "capital" ? 3 : kind === "key" ? 4 : 5;
    }
    candidates.push({
      id: regionId,
      text: region.name,
      x,
      y,
      width: measure(region.name) + 2,
      height: CITY_LABEL_HEIGHT,
      priority,
      forced,
      markerRadius: markerRadius(kind === "capital", kind === "key", z)
    });
  }
  return candidates;
}

export interface CityLabelDrawInput {
  state: GameState;
  cities: Map<string, Point>;
  viewport: Viewport;
  z: number;
  selectedRegionId: string | null;
  linkedIds: ReadonlySet<string>;
  /** Counters, deposit chips, the depot badge and pills: boxes a label must not cover. */
  obstacles: readonly Box[];
}

/** Places and draws the city labels; every other city's marker counts as an obstacle too. */
export function drawCityLabels(ctx: CanvasRenderingContext2D, input: CityLabelDrawInput): void {
  const { state, cities, viewport, z, selectedRegionId, linkedIds } = input;
  const candidates = cityLabelCandidates({
    state,
    cities,
    viewport,
    z,
    selectedRegionId,
    linkedIds,
    measure: (text) => textWidth(ctx, CITY_FONT, text)
  });
  if (candidates.length === 0) return;

  const obstacles: Box[] = [...input.obstacles];
  for (const [regionId, [x, y]] of cities) {
    if (x < -20 || x > viewport.width + 20 || y < -20 || y > viewport.height + 20) continue;
    const region = state.regions[regionId];
    const r = markerRadius(Boolean(region?.isCapital), Boolean(region?.isKeyCity), z) + 1;
    obstacles.push({ x: x - r, y: y - r, width: r * 2, height: r * 2 });
  }

  ctx.font = CITY_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const label of placeLabels(candidates, obstacles)) {
    const region = state.regions[label.id];
    const color = label.id === selectedRegionId || linkedIds.has(label.id) ? GOLD_TEXT : region?.isCapital ? "#ffffff" : "rgba(255, 255, 255, 0.9)";
    haloText(ctx, label.text, label.x + 1, label.y + label.height / 2 + 0.5, color);
  }
}
