import type { GameState } from "../../../../game/state/types";
import type { Viewport } from "../../camera";
import type { Point } from "../../geometry/types";
import type { Box } from "../../layout/labels";
import { edgePillAnchor, MAP_INSETS, type Insets } from "../../layout/pills";
import { linkNetworkAlpha } from "../lod";
import { font, roundedRect, textWidth } from "../text";

export const PILL_HEIGHT = 22;
/** Left padding 10 + gap 6 + arrow 10 + right padding 6. */
const PILL_EXTRA_WIDTH = 32;
const GOLD = "#d4a537";
const HOVER_LINK_ALPHA = 0.35;

export type PillHit = Box & { regionId: string };

const pairCache = new WeakMap<object, [string, string][]>();

/** Every adjacency link once (a < b, sorted); cached per regions object, which changes only with the game state. */
export function linkPairs(regions: Record<string, { adjacentRegionIds: readonly string[] }>): [string, string][] {
  const cached = pairCache.get(regions);
  if (cached) return cached;
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const [id, region] of Object.entries(regions)) {
    for (const other of region.adjacentRegionIds) {
      if (other === id || !regions[other]) continue;
      const [a, b] = id < other ? [id, other] : [other, id];
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b]);
    }
  }
  pairs.sort((x, y) => (x[0] === y[0] ? (x[1] < y[1] ? -1 : 1) : x[0] < y[0] ? -1 : 1));
  pairCache.set(regions, pairs);
  return pairs;
}

/** Spec 11.4 layer 10: the faint adjacency network at low zoom (1 px, alpha .16, gone by z 1.6). */
export function drawLinkNetwork(ctx: CanvasRenderingContext2D, pairs: readonly [string, string][], cities: Map<string, Point>, z: number): void {
  const alpha = linkNetworkAlpha(z);
  if (alpha <= 0) return;
  ctx.beginPath();
  for (const [a, b] of pairs) {
    const from = cities.get(a);
    const to = cities.get(b);
    if (!from || !to) continue;
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(200, 215, 235, ${alpha})`;
  ctx.stroke();
}

/** A pill sits just inside the inset area, centered on its anchor where there is room. */
export function pillBox(anchor: { x: number; y: number }, labelWidth: number, viewport: Viewport, insets: Insets): Box {
  const width = Math.ceil(labelWidth) + PILL_EXTRA_WIDTH;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    x: clamp(anchor.x - width / 2, insets.left, viewport.width - insets.right - width),
    y: clamp(anchor.y - PILL_HEIGHT / 2, insets.top, viewport.height - insets.bottom - PILL_HEIGHT),
    width,
    height: PILL_HEIGHT
  };
}

function drawPill(ctx: CanvasRenderingContext2D, box: Box, text: string, angle: number): void {
  roundedRect(ctx, box.x, box.y, box.width, box.height, 4);
  ctx.fillStyle = "rgba(14, 18, 22, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = GOLD;
  ctx.stroke();

  ctx.font = font(500, 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f3efe2";
  ctx.fillText(text, box.x + 10, box.y + box.height / 2 + 0.5);

  ctx.save();
  ctx.translate(box.x + box.width - 11, box.y + box.height / 2);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-3.5, -4);
  ctx.lineTo(4, 0);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.restore();
}

function strokeLinks(ctx: CanvasRenderingContext2D, from: Point, ends: Point[], alpha: number): void {
  if (ends.length === 0) return;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const end of ends) {
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(end[0], end[1]);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(10, 12, 14, 0.55)";
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineCap = "butt";
}

export interface SelectionLinksInput {
  state: GameState;
  cities: Map<string, Point>;
  viewport: Viewport;
  selectedRegionId: string | null;
  hoverRegionId: string | null;
  /** Pill text needs the display font; without it only the lines are drawn. */
  fontsReady: boolean;
}

/**
 * Spec 11.4 layer 11: gold links from the selected city to its linked cities (4 px dark underlay, 1.8 px gold),
 * a faint preview of the hovered region's links, and a clickable pill at the screen edge for every linked city
 * that is outside the visible area. Returns the pills for hit testing.
 */
export function drawSelectionLinks(ctx: CanvasRenderingContext2D, input: SelectionLinksInput, insets: Insets = MAP_INSETS): PillHit[] {
  const { state, cities, viewport } = input;
  const pills: PillHit[] = [];

  const hover = input.hoverRegionId;
  if (hover && hover !== input.selectedRegionId) {
    const from = cities.get(hover);
    const ends: Point[] = [];
    for (const id of state.regions[hover]?.adjacentRegionIds ?? []) {
      const to = cities.get(id);
      if (to) ends.push(to);
    }
    if (from) strokeLinks(ctx, from, ends, HOVER_LINK_ALPHA);
  }

  const selected = input.selectedRegionId;
  const from = selected ? cities.get(selected) : undefined;
  if (!selected || !from) return pills;

  const fromVisible = from[0] >= insets.left && from[0] <= viewport.width - insets.right && from[1] >= insets.top && from[1] <= viewport.height - insets.bottom;
  const ends: Point[] = [];
  const pending: { regionId: string; anchor: { x: number; y: number; angle: number } }[] = [];
  for (const id of state.regions[selected]?.adjacentRegionIds ?? []) {
    const to = cities.get(id);
    if (!to) continue;
    const anchor = edgePillAnchor(from, to, viewport, insets);
    if (anchor === null) {
      ends.push(to);
      continue;
    }
    if (fromVisible) ends.push([anchor.x, anchor.y]);
    pending.push({ regionId: id, anchor });
  }
  strokeLinks(ctx, from, ends, 1);

  if (!input.fontsReady) return pills;
  for (const { regionId, anchor } of pending) {
    const name = state.regions[regionId]?.name ?? regionId;
    const box = pillBox(anchor, textWidth(ctx, font(500, 12), name), viewport, insets);
    drawPill(ctx, box, name, anchor.angle);
    pills.push({ ...box, regionId });
  }
  return pills;
}
