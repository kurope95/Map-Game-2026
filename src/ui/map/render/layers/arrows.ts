import type { OrderType } from "../../../../game/state/types";
import type { Viewport } from "../../camera";
import type { OrderArrow } from "../../derive";
import type { Point } from "../../geometry/types";
import { font, roundedRect, textWidth } from "../text";

export type ArrowType = Exclude<OrderType, "hold">;

export interface ArrowStyle {
  color: string;
  pattern: "solid" | "dashed" | "dotted";
  /** A small burst at the target (bombard). */
  burst: boolean;
}

/** Spec 11.4 layer 13. */
export const ARROW_STYLES: Record<ArrowType, ArrowStyle> = {
  attack: { color: "#e0605a", pattern: "solid", burst: false },
  move: { color: "#7cc47c", pattern: "dashed", burst: false },
  airSupport: { color: "#e0b04a", pattern: "dotted", burst: false },
  bombard: { color: "#e0b04a", pattern: "dotted", burst: true },
  missileStrike: { color: "#d06bd6", pattern: "dotted", burst: false }
};

const BULGE = 18;
const LINE_WIDTH = 2.2;
const UNDERLAY_WIDTH = 5;
const UNDERLAY = "rgba(10, 12, 14, 0.6)";
const HEAD_LENGTH = 9;
const HEAD_HALF_WIDTH = 4.5;
/** Gaps that keep the arrow clear of the city markers at both ends. */
const START_GAP = 6;
const TIP_GAP = 8;
const DASHES: Record<ArrowStyle["pattern"], number[]> = {
  solid: [],
  dashed: [6, 4],
  // zero-length dashes with round caps draw dots
  dotted: [0.01, 5]
};

/**
 * The quadratic curve of an arrow in screen space. The control point sits `2 × bulge` off the chord's middle,
 * which puts the curve itself `bulge` px off it at the midpoint, always to the left of the direction of travel
 * (so arrows in opposite directions between two cities do not overlap).
 */
export function arrowGeometry(from: Point, to: Point, bulge = BULGE): { control: Point; mid: Point; endAngle: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  const chordMid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  if (length < 1e-6) return { control: chordMid, mid: chordMid, endAngle: 0 };
  const nx = -dy / length;
  const ny = dx / length;
  const control: Point = [chordMid[0] + nx * bulge * 2, chordMid[1] + ny * bulge * 2];
  const mid: Point = [0.25 * from[0] + 0.5 * control[0] + 0.25 * to[0], 0.25 * from[1] + 0.5 * control[1] + 0.25 * to[1]];
  return { control, mid, endAngle: Math.atan2(to[1] - control[1], to[0] - control[0]) };
}

/** "×N" for merged identical orders, nothing for a single one. */
export function arrowBadgeText(count: number): string | null {
  return count > 1 ? `×${count}` : null;
}

/** Cheap culling: the control polygon's box must touch the screen (with a margin for the head and badge). */
export function arrowIsVisible(from: Point, to: Point, control: Point, viewport: Viewport, margin = 24): boolean {
  const minX = Math.min(from[0], to[0], control[0]);
  const maxX = Math.max(from[0], to[0], control[0]);
  const minY = Math.min(from[1], to[1], control[1]);
  const maxY = Math.max(from[1], to[1], control[1]);
  return maxX >= -margin && minX <= viewport.width + margin && maxY >= -margin && minY <= viewport.height + margin;
}

function drawBurst(ctx: CanvasRenderingContext2D, at: Point, color: string): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    ctx.moveTo(at[0] + Math.cos(angle) * 6, at[1] + Math.sin(angle) * 6);
    ctx.lineTo(at[0] + Math.cos(angle) * 11, at[1] + Math.sin(angle) * 11);
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = UNDERLAY;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawBadge(ctx: CanvasRenderingContext2D, at: Point, text: string, color: string): void {
  const width = textWidth(ctx, font(600, 11), text) + 8;
  roundedRect(ctx, at[0] - width / 2, at[1] - 7, width, 14, 4);
  ctx.fillStyle = "rgba(14, 18, 22, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = font(600, 11);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, at[0], at[1] + 0.5);
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, style: ArrowStyle, count: number): void {
  const { control, mid, endAngle } = arrowGeometry(from, to);
  const startAngle = Math.atan2(control[1] - from[1], control[0] - from[0]);
  const start: Point = [from[0] + Math.cos(startAngle) * START_GAP, from[1] + Math.sin(startAngle) * START_GAP];
  const cos = Math.cos(endAngle);
  const sin = Math.sin(endAngle);
  const tip: Point = [to[0] - cos * TIP_GAP, to[1] - sin * TIP_GAP];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  ctx.quadraticCurveTo(control[0], control[1], tip[0], tip[1]);
  ctx.setLineDash([]);
  ctx.lineWidth = UNDERLAY_WIDTH;
  ctx.strokeStyle = UNDERLAY;
  ctx.stroke();
  ctx.setLineDash(DASHES[style.pattern]);
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = style.color;
  ctx.stroke();
  ctx.setLineDash([]);

  const baseX = tip[0] - cos * HEAD_LENGTH;
  const baseY = tip[1] - sin * HEAD_LENGTH;
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(baseX - sin * HEAD_HALF_WIDTH, baseY + cos * HEAD_HALF_WIDTH);
  ctx.lineTo(baseX + sin * HEAD_HALF_WIDTH, baseY - cos * HEAD_HALF_WIDTH);
  ctx.closePath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = UNDERLAY;
  ctx.stroke();
  ctx.fillStyle = style.color;
  ctx.fill();

  if (style.burst) drawBurst(ctx, to, style.color);
  const badge = arrowBadgeText(count);
  if (badge) drawBadge(ctx, mid, badge, style.color);
}

/** Spec 11.4 layer 13: the player's pending orders (hold has no arrow; see the counters). */
export function drawOrderArrows(ctx: CanvasRenderingContext2D, arrows: readonly OrderArrow[], cities: Map<string, Point>, viewport: Viewport): void {
  for (const arrow of arrows) {
    const from = cities.get(arrow.fromRegionId);
    const to = cities.get(arrow.toRegionId);
    if (!from || !to) continue;
    const { control } = arrowGeometry(from, to);
    if (!arrowIsVisible(from, to, control, viewport)) continue;
    drawArrow(ctx, from, to, ARROW_STYLES[arrow.type], arrow.count);
  }
}
