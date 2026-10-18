import type { CountryId, GameState } from "../../game/state/types";

export type BottomTab = "region" | "stockpile" | "economy" | "military" | "orders" | "ai" | "war" | "log";
export type DiplomacyTab = "allies" | "enemies" | "neutral";
export type SaveLoadMode = "save" | "load";

export interface SaveSlotEnvelope {
  savedAt: string;
  turn: number;
  countryId: CountryId;
  state: GameState;
}

export interface SaveSlotEntry {
  name: string;
  envelope: SaveSlotEnvelope;
  isLegacyPayload: boolean;
}

export interface ValidTargets {
  moves: string[];
  attacks: string[];
  airTargets: string[];
  bombardTargets: string[];
  missileTargets: string[];
}
