import { getPridnestrovieDepotStatus, type DepotStatus } from "../../../../game/rules/strategicDepot";
import type { GameState, ResourceType } from "../../../../game/state/types";
import { RESOURCE_META } from "../../../kit/resources";
import type { Viewport } from "../../camera";
import type { Point } from "../../geometry/types";
import type { Box } from "../../layout/labels";
import { depositChipsVisible, depotBadgeVisible } from "../lod";
import { font, roundedRect, textWidth } from "../text";

/** Tiraspol's region: the strategic depot. */
export const DEPOT_REGION_ID = "chisinau-pridnestrovie";

export const DEPOT_COLORS: Record<DepotStatus["tone"], string> = {
  claimed: "rgba(96, 198, 124, 0.9)",
  claimable: "rgba(232, 198, 88, 0.92)",
  locked: "rgba(154, 168, 184, 0.86)"
};

export const DEPOSIT_CODES: Record<ResourceType, string> = {
  oil: "O",
  coal: "C",
  iron: "I",
  tungsten: "T",
  food: "F",
  chemicals: "Ch"
};

const CHIP = 14;
const CHIP_GAP = 2;
/** The chips' bottom edge sits this far above the city point, clear of the marker. */
const CHIP_LIFT = 16;
const BADGE_HEIGHT = 16;
const DARK_TEXT = "#10161c";
const LIGHT_TEXT = "#ffffff";

/** The row of 14x14 deposit chips above a city, centered on it. */
export function depositChipBoxes(city: { x: number; y: number }, count: number): Box[] {
  const total = count * CHIP + (count - 1) * CHIP_GAP;
  const left = city.x - total / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: left + index * (CHIP + CHIP_GAP),
    y: city.y - CHIP_LIFT - CHIP,
    width: CHIP,
    height: CHIP
  }));
}

/** The DEPOT badge above the city, or above the deposit chips when those are shown too. */
export function depotBadgeBox(city: { x: number; y: number }, labelWidth: number, hasChips: boolean): Box {
  const width = Math.ceil(labelWidth) + 12;
  const bottom = city.y - (hasChips ? CHIP_LIFT + CHIP + 3 : 10);
  return { x: city.x - width / 2, y: bottom - BADGE_HEIGHT, width, height: BADGE_HEIGHT };
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Dark or white text, whichever contrasts more with a `#rrggbb` fill. */
export function readableTextColor(hex: string): string {
  const fill = luminance(hex) + 0.05;
  const againstWhite = 1.05 / fill;
  const againstDark = fill / (luminance(DARK_TEXT) + 0.05);
  return againstDark >= againstWhite ? DARK_TEXT : LIGHT_TEXT;
}

function drawChips(ctx: CanvasRenderingContext2D, boxes: Box[], deposits: readonly { type: ResourceType; richness: number }[]): void {
  deposits.forEach((deposit, index) => {
    const box = boxes[index];
    const color = RESOURCE_META[deposit.type].color;
    roundedRect(ctx, box.x, box.y, box.width, box.height, 3);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(10, 12, 14, 0.85)";
    ctx.stroke();

    ctx.font = font(600, 9);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = readableTextColor(color);
    ctx.fillText(DEPOSIT_CODES[deposit.type], box.x + box.width / 2, box.y + box.height / 2 + 0.5);

    // richness pips under the chip
    const pips = Math.max(0, Math.min(5, Math.round(deposit.richness)));
    ctx.fillStyle = "#f0c75e";
    for (let pip = 0; pip < pips; pip += 1) {
      ctx.beginPath();
      ctx.arc(box.x + box.width / 2 + (pip - (pips - 1) / 2) * 2.6, box.y + box.height + 3.4, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawBadge(ctx: CanvasRenderingContext2D, box: Box, color: string): void {
  roundedRect(ctx, box.x, box.y, box.width, box.height, 3);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(10, 12, 14, 0.85)";
  ctx.stroke();
  ctx.font = font(600, 11);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = DARK_TEXT;
  ctx.fillText("DEPOT", box.x + box.width / 2, box.y + box.height / 2 + 0.5);
}

export interface ExtrasInput {
  state: GameState;
  cities: Map<string, Point>;
  viewport: Viewport;
  z: number;
  fontsReady: boolean;
}

/**
 * Spec 11.4 layer 15: the DEPOT badge (z ≥ 1.5) and the resource deposit chips (z ≥ 3.5). Returns the boxes the
 * labels must keep clear of.
 */
export function drawExtras(ctx: CanvasRenderingContext2D, input: ExtrasInput): Box[] {
  const { state, cities, viewport, z } = input;
  const obstacles: Box[] = [];
  if (!input.fontsReady) return obstacles;

  const onScreen = (x: number, y: number) => x > -40 && x < viewport.width + 40 && y > -50 && y < viewport.height + 50;
  const chipsShown = depositChipsVisible(z);
  const chipRegions = new Set<string>();
  if (chipsShown) {
    for (const [regionId, [x, y]] of cities) {
      if (!onScreen(x, y)) continue;
      const deposits = state.regionEconomies[regionId]?.resourceDeposits;
      if (!deposits || deposits.length === 0) continue;
      const boxes = depositChipBoxes({ x, y }, deposits.length);
      drawChips(ctx, boxes, deposits);
      chipRegions.add(regionId);
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      obstacles.push({ x: first.x, y: first.y, width: last.x + last.width - first.x, height: CHIP + 7 });
    }
  }

  const depot = cities.get(DEPOT_REGION_ID);
  if (depotBadgeVisible(z) && depot && state.regions[DEPOT_REGION_ID] && onScreen(depot[0], depot[1])) {
    const labelWidth = textWidth(ctx, font(600, 11), "DEPOT");
    const box = depotBadgeBox({ x: depot[0], y: depot[1] }, labelWidth, chipRegions.has(DEPOT_REGION_ID));
    drawBadge(ctx, box, DEPOT_COLORS[getPridnestrovieDepotStatus(state).tone]);
    obstacles.push(box);
  }
  return obstacles;
}
