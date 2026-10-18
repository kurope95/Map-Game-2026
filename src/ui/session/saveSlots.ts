import type { CountryId, GameState } from "../../game/state/types";
import type { SaveSlotEntry, SaveSlotEnvelope } from "./types";

export const SAVE_SLOT_PREFIX = "mapgame_slot_";

export function parseSaveSlot(name: string, raw: string, fallbackCountryId: CountryId): SaveSlotEntry | null {
  try {
    const parsed = JSON.parse(raw) as SaveSlotEnvelope | GameState;
    if ("state" in parsed && parsed.state && "turn" in parsed) {
      return { name, envelope: parsed as SaveSlotEnvelope, isLegacyPayload: false };
    }
    const legacyState = parsed as GameState;
    return {
      name,
      envelope: {
        savedAt: new Date(0).toISOString(),
        turn: legacyState.turn ?? 0,
        countryId: legacyState.playerCountryId ?? fallbackCountryId,
        state: legacyState,
      },
      isLegacyPayload: true,
    };
  } catch {
    return null;
  }
}

export function sortSaveSlots(slots: SaveSlotEntry[]): SaveSlotEntry[] {
  return [...slots].sort(
    (left, right) => new Date(right.envelope.savedAt).getTime() - new Date(left.envelope.savedAt).getTime()
  );
}
