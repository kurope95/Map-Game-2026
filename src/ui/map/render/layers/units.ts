import { MAX_UNIT_STRENGTH } from "../../../../game/content/economyRecipes";
import type { GameState, UnitDefinition } from "../../../../game/state/types";
import { getSupplyStatus, getVeterancyLevel } from "../../../format/unitStatus";
import { NATION_COLORS } from "../../../theme/palette";
import type { Viewport } from "../../camera";
import type { DerivedMapData, UnitStackInfo } from "../../derive";
import type { CounterBox } from "../../layout/counters";
import { drawUnitSymbol } from "../symbols";
import { font, roundedRect } from "../text";

export type StrengthTone = "good" | "warn" | "bad";

export const STRENGTH_COLORS: Record<StrengthTone, string> = {
  good: "#7cc47c",
  warn: "#e0b04a",
  bad: "#e0605a"
};

const CARD_BORDER = "rgba(10, 12, 14, 0.85)";
const ORDER_EDGE = "#f0c75e";
const SELECTED_EDGE = "#ffffff";
const CHEVRON = "#f0c75e";

/** Strength bar color: green above 66% of the unit type's maximum, amber above 33%, red below. */
export function strengthTone(strength: number, max: number): StrengthTone {
  const ratio = max > 0 ? strength / max : 0;
  if (ratio > 0.66) return "good";
  if (ratio > 0.33) return "warn";
  return "bad";
}

/** Today's supply dot colors (low, critical, cut off); nothing for supplied units and units supply does not affect. */
export function supplyDotColor(unit: UnitDefinition): string | null {
  switch (getSupplyStatus(unit).tone) {
    case "low":
      return "#d5d96b";
    case "critical":
      return "#f7b955";
    case "cutoff":
      return "#ff6b6b";
    default:
      return null;
  }
}

/** The number on a counter: the unit's strength, or ×N for a stack. */
export function counterText(kind: "unit" | "stack", unitIds: readonly string[], strength: number): string {
  return kind === "stack" ? `×${unitIds.length}` : String(strength);
}

/** A counter gets the gold edge when any of its units has a pending order and the white edge when any is selected. */
export function counterEdges(
  unitIds: readonly string[],
  ordered: ReadonlySet<string>,
  selected: ReadonlySet<string>
): { ordered: boolean; selected: boolean } {
  return { ordered: unitIds.some((id) => ordered.has(id)), selected: unitIds.some((id) => selected.has(id)) };
}

type Edges = ReturnType<typeof counterEdges>;

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, f: number, fill: string, shade = 0): void {
  roundedRect(ctx, x, y, width, height, 3 * f);
  ctx.fillStyle = fill;
  ctx.fill();
  if (shade > 0) {
    ctx.fillStyle = `rgba(10, 12, 14, ${shade})`;
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = CARD_BORDER;
  ctx.stroke();
}

function drawEdges(ctx: CanvasRenderingContext2D, box: CounterBox, f: number, edges: Edges): void {
  if (edges.ordered) {
    roundedRect(ctx, box.x - 1, box.y - 1, box.width + 2, box.height + 2, 3 * f + 1);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = ORDER_EDGE;
    ctx.stroke();
  }
  if (edges.selected) {
    const grow = edges.ordered ? 3 : 1.5;
    roundedRect(ctx, box.x - grow, box.y - grow, box.width + grow * 2, box.height + grow * 2, 3 * f + grow);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = SELECTED_EDGE;
    ctx.stroke();
  }
}

function drawNumber(ctx: CanvasRenderingContext2D, text: string, box: CounterBox, f: number): void {
  ctx.font = font(600, Math.round(11 * f * 10) / 10);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(10, 12, 14, 0.6)";
  ctx.strokeText(text, box.x + box.width - 3 * f, box.y + 9 * f);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, box.x + box.width - 3 * f, box.y + 9 * f);
}

function drawChevrons(ctx: CanvasRenderingContext2D, box: CounterBox, f: number, level: number): void {
  ctx.strokeStyle = CHEVRON;
  ctx.lineWidth = 1.2 * f;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const top = box.y + 2.4 * f;
  for (let i = 0; i < level; i += 1) {
    const cx = box.x + box.width - 4.5 * f - i * 4.4 * f;
    ctx.beginPath();
    ctx.moveTo(cx - 2 * f, top + 2.2 * f);
    ctx.lineTo(cx, top);
    ctx.lineTo(cx + 2 * f, top + 2.2 * f);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** A small shield on the card's bottom-right corner for a unit ordered to hold. */
function drawHoldShield(ctx: CanvasRenderingContext2D, box: CounterBox, f: number): void {
  const cx = box.x + box.width - 1.5 * f;
  const cy = box.y + box.height - 1 * f;
  ctx.beginPath();
  ctx.moveTo(cx - 3 * f, cy - 3.5 * f);
  ctx.lineTo(cx + 3 * f, cy - 3.5 * f);
  ctx.lineTo(cx + 3 * f, cy + 0.5 * f);
  ctx.quadraticCurveTo(cx + 3 * f, cy + 3 * f, cx, cy + 4 * f);
  ctx.quadraticCurveTo(cx - 3 * f, cy + 3 * f, cx - 3 * f, cy + 0.5 * f);
  ctx.closePath();
  ctx.fillStyle = "#1d2733";
  ctx.fill();
  ctx.lineWidth = Math.max(1, f);
  ctx.strokeStyle = "#e8eef5";
  ctx.stroke();
}

function drawUnitCounter(ctx: CanvasRenderingContext2D, box: CounterBox, unit: UnitDefinition, derived: DerivedMapData, edges: Edges): void {
  const f = box.width / 30;
  drawCard(ctx, box.x, box.y, box.width, box.height, f, NATION_COLORS[unit.countryId]);
  drawUnitSymbol(ctx, unit.type, box.x + 3 * f, box.y + 3.5 * f, 15 * f, "#ffffff", { frame: true });
  drawNumber(ctx, counterText("unit", box.unitIds, unit.strength), box, f);

  const max = MAX_UNIT_STRENGTH[unit.type];
  const barX = box.x + 3 * f;
  const barY = box.y + box.height - 3.5 * f;
  const barWidth = box.width - 6 * f;
  ctx.fillStyle = "rgba(10, 12, 14, 0.55)";
  ctx.fillRect(barX, barY, barWidth, 2 * f);
  ctx.fillStyle = STRENGTH_COLORS[strengthTone(unit.strength, max)];
  ctx.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, unit.strength / max)), 2 * f);

  const supply = supplyDotColor(unit);
  if (supply) {
    ctx.beginPath();
    ctx.arc(box.x + 4.2 * f, box.y + 3.2 * f, 1.8 * f, 0, Math.PI * 2);
    ctx.fillStyle = supply;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = CARD_BORDER;
    ctx.stroke();
  }
  drawChevrons(ctx, box, f, getVeterancyLevel(unit));
  if (derived.holdUnitIds.has(unit.id)) drawHoldShield(ctx, box, f);
  drawEdges(ctx, box, f, edges);
}

function drawStackCounter(ctx: CanvasRenderingContext2D, box: CounterBox, stack: UnitStackInfo, edges: Edges): void {
  const f = box.width / 30;
  const color = NATION_COLORS[stack.majorityCountryId];
  // two shadow cards, then the main card
  drawCard(ctx, box.x + 5 * f, box.y + 5 * f, box.width, box.height, f, color, 0.5);
  drawCard(ctx, box.x + 2.5 * f, box.y + 2.5 * f, box.width, box.height, f, color, 0.3);
  drawCard(ctx, box.x, box.y, box.width, box.height, f, color);
  drawUnitSymbol(ctx, stack.majorityType, box.x + 3 * f, box.y + 3.5 * f + 1 * f, 15 * f, "#ffffff", { frame: true });
  drawNumber(ctx, counterText("stack", box.unitIds, 0), box, f);

  if (stack.secondaryCountryId) {
    ctx.beginPath();
    ctx.arc(box.x + box.width - 4 * f, box.y + 3.6 * f, 2.4 * f, 0, Math.PI * 2);
    ctx.fillStyle = NATION_COLORS[stack.secondaryCountryId];
    ctx.fill();
    ctx.lineWidth = Math.max(1, f);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  drawEdges(ctx, box, f, edges);
}

export interface CounterDrawInput {
  state: GameState;
  derived: DerivedMapData;
  selectedUnitIds: ReadonlySet<string>;
  viewport: Viewport;
}

/** Spec 11.4 layer 14: single counters and stacks, in the order layoutCounters returned them. */
export function drawCounters(ctx: CanvasRenderingContext2D, boxes: readonly CounterBox[], input: CounterDrawInput): void {
  const { state, derived, selectedUnitIds, viewport } = input;
  for (const box of boxes) {
    if (box.x + box.width < -12 || box.y + box.height < -12 || box.x > viewport.width + 12 || box.y > viewport.height + 12) continue;
    const edges = counterEdges(box.unitIds, derived.orderedUnitIds, selectedUnitIds);
    if (box.kind === "stack") {
      const stack = derived.stacks.get(box.regionId);
      if (stack) drawStackCounter(ctx, box, stack, edges);
    } else {
      const unit = state.units[box.unitIds[0]];
      if (unit) drawUnitCounter(ctx, box, unit, derived, edges);
    }
  }
}
