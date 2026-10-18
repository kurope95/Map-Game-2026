import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import type { CountryId, GameState } from "../../game/state/types";
import { parseSaveSlot, sortSaveSlots } from "./saveSlots";
import type { SaveSlotEnvelope } from "./types";

function rawState(playerCountryId: CountryId): GameState {
  return { ...createInitialState(playerCountryId), turn: 7 };
}

describe("parseSaveSlot", () => {
  it("keeps an envelope payload as a current-format slot", () => {
    const envelope: SaveSlotEnvelope = {
      savedAt: "2026-10-18T12:00:00.000Z",
      turn: 12,
      countryId: "ROMANIA",
      state: rawState("ROMANIA"),
    };

    const entry = parseSaveSlot("my-slot", JSON.stringify(envelope), "RUSSIA");

    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("my-slot");
    expect(entry?.isLegacyPayload).toBe(false);
    expect(entry?.envelope.savedAt).toBe("2026-10-18T12:00:00.000Z");
    expect(entry?.envelope.turn).toBe(12);
    expect(entry?.envelope.countryId).toBe("ROMANIA");
    expect(entry?.envelope.state.turn).toBe(7);
  });

  it("wraps a raw GameState as a legacy payload with an epoch-0 savedAt", () => {
    const entry = parseSaveSlot("old-slot", JSON.stringify(rawState("POLAND")), "RUSSIA");

    expect(entry).not.toBeNull();
    expect(entry?.isLegacyPayload).toBe(true);
    expect(entry?.envelope.savedAt).toBe(new Date(0).toISOString());
    expect(entry?.envelope.turn).toBe(7);
    expect(entry?.envelope.countryId).toBe("POLAND");
  });

  it("falls back to the given country when a raw GameState has no playerCountryId", () => {
    const state = rawState("POLAND");
    delete (state as Partial<GameState>).playerCountryId;

    const entry = parseSaveSlot("old-slot", JSON.stringify(state), "RUSSIA");

    expect(entry?.isLegacyPayload).toBe(true);
    expect(entry?.envelope.countryId).toBe("RUSSIA");
  });

  it("returns null for malformed JSON", () => {
    expect(parseSaveSlot("broken", "{not json", "RUSSIA")).toBeNull();
  });
});

describe("sortSaveSlots", () => {
  it("puts the newest slot first and epoch-0 legacy slots last", () => {
    const legacy = parseSaveSlot("legacy", JSON.stringify(rawState("POLAND")), "RUSSIA");
    const older = parseSaveSlot(
      "older",
      JSON.stringify({ savedAt: "2026-01-01T00:00:00.000Z", turn: 3, countryId: "RUSSIA", state: rawState("RUSSIA") }),
      "RUSSIA"
    );
    const newer = parseSaveSlot(
      "newer",
      JSON.stringify({ savedAt: "2026-06-01T00:00:00.000Z", turn: 9, countryId: "RUSSIA", state: rawState("RUSSIA") }),
      "RUSSIA"
    );

    const sorted = sortSaveSlots([legacy!, older!, newer!]);

    expect(sorted.map((slot) => slot.name)).toEqual(["newer", "older", "legacy"]);
  });
});
