import type { CountryId, GameState } from "../../game/state/types";

export const AUTOSAVE_KEY = "mapgame_autosave";

export interface ParsedAutosave {
  state: GameState;
  countryId: CountryId;
  turn: number;
}

export function parseAutosave(raw: string | null): ParsedAutosave | null {
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<GameState> | null;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.turn !== "number") return null;
    if (typeof parsed.playerCountryId !== "string") return null;
    if (!parsed.regions || typeof parsed.regions !== "object") return null;
    if (!parsed.units || typeof parsed.units !== "object") return null;

    return {
      state: parsed as GameState,
      countryId: parsed.playerCountryId,
      turn: parsed.turn
    };
  } catch {
    return null;
  }
}
