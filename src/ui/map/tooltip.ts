import type { BlocId, CountryId, GameState } from "../../game/state/types";
import { flagSvgMarkup } from "../kit/flags";

export interface TooltipModel {
  name: string;
  /** "Capital" and/or "Key city". */
  tags: string[];
  controller: { countryId: CountryId; name: string; blocId: BlocId | null };
  /** The pre-war controller's name when the region is occupied. */
  occupiedFrom: string | null;
  units: { total: number; own: number; allied: number; enemy: number };
  fort: { level: number; health: number; maxHealth: number } | null;
  stability: number | null;
}

const ALIGNED: readonly BlocId[] = ["BRICS", "EU_NATO"];
const BLOC_LABELS: Record<BlocId, string> = { BRICS: "BRICS", EU_NATO: "EU NATO", NEUTRAL: "Neutral" };

/** What the hover tooltip says about a region (spec 11.3); sides are relative to the player. */
export function tooltipModel(state: GameState, regionId: string): TooltipModel | null {
  const region = state.regions[regionId];
  if (!region) return null;
  const economy = state.regionEconomies[regionId];
  const controller = state.countries[region.controllerCountryId];
  const originalId = state.scenario.regions.find((scenarioRegion) => scenarioRegion.id === regionId)?.controllerCountryId;

  const playerId = state.playerCountryId;
  const playerBloc = state.countries[playerId]?.blocId;
  const playerAligned = playerBloc !== undefined && ALIGNED.includes(playerBloc);
  const units = { total: 0, own: 0, allied: 0, enemy: 0 };
  for (const unit of Object.values(state.units)) {
    if (unit.regionId !== regionId) continue;
    units.total += 1;
    if (unit.countryId === playerId) units.own += 1;
    else if (playerAligned && unit.blocId === playerBloc) units.allied += 1;
    else if (playerAligned && ALIGNED.includes(unit.blocId)) units.enemy += 1;
  }

  const fort = economy?.fortification;
  return {
    name: region.name,
    // a capital that is also a key city gets only the Capital tag
    tags: region.isCapital ? ["Capital"] : region.isKeyCity ? ["Key city"] : [],
    controller: { countryId: region.controllerCountryId, name: controller?.name ?? region.controllerCountryId, blocId: region.controllerBlocId ?? null },
    occupiedFrom: originalId !== undefined && originalId !== region.controllerCountryId ? state.countries[originalId]?.name ?? originalId : null,
    units,
    fort: fort ? { level: fort.level, health: fort.health, maxHealth: fort.maxHealth } : null,
    stability: economy ? economy.stability : null
  };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** The tooltip body. Every piece of game text is escaped; the only markup is ours and the flag SVG. */
export function tooltipHtml(model: TooltipModel): string {
  const tags = model.tags.map((tag) => `<span class="map-tooltip__tag">${escapeHtml(tag)}</span>`).join("");
  const bloc = model.controller.blocId
    ? `<span class="map-tooltip__bloc map-tooltip__bloc--${model.controller.blocId}">${BLOC_LABELS[model.controller.blocId]}</span>`
    : "";
  const rows = [
    `<div class="map-tooltip__title"><span class="map-tooltip__name">${escapeHtml(model.name)}</span>${tags}</div>`,
    `<div class="map-tooltip__row map-tooltip__controller"><span class="map-tooltip__flag">${flagSvgMarkup(model.controller.countryId, 18, 12)}</span><span>${escapeHtml(model.controller.name)}</span>${bloc}</div>`
  ];
  if (model.occupiedFrom) {
    rows.push(`<div class="map-tooltip__row map-tooltip__row--warn">Occupied, originally ${escapeHtml(model.occupiedFrom)}</div>`);
  }
  const { units } = model;
  if (units.total > 0) {
    const sides = ([["own", units.own], ["allied", units.allied], ["enemy", units.enemy]] as const)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => ` · ${count} ${label}`)
      .join("");
    rows.push(`<div class="map-tooltip__row">${units.total} unit${units.total === 1 ? "" : "s"}${sides}</div>`);
  }
  if (model.fort) {
    rows.push(`<div class="map-tooltip__row">Fort Lv.${model.fort.level} ${model.fort.health}/${model.fort.maxHealth}</div>`);
  }
  if (model.stability !== null) {
    rows.push(`<div class="map-tooltip__row">Stability ${Math.round(model.stability)}%</div>`);
  }
  return rows.join("");
}

/** The tooltip sits this far right of and below the pointer, and never closer than this to the map edges. */
export const TOOLTIP_OFFSET = 14;
export const TOOLTIP_MARGIN = 8;

/** Top-left of the tooltip box for a pointer position, kept inside the map. */
export function tooltipPosition(
  pointer: readonly [number, number],
  size: { width: number; height: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const place = (value: number, extent: number, available: number) =>
    Math.max(TOOLTIP_MARGIN, Math.min(value + TOOLTIP_OFFSET, available - extent - TOOLTIP_MARGIN));
  return { x: place(pointer[0], size.width, viewport.width), y: place(pointer[1], size.height, viewport.height) };
}
