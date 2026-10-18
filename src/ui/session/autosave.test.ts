import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import type { GameState } from "../../game/state/types";
import { AUTOSAVE_KEY, parseAutosave } from "./autosave";

describe("parseAutosave", () => {
  it("returns the state, country and turn of a saved game", () => {
    const state = { ...createInitialState("SLOVAKIA"), turn: 4 };

    const parsed = parseAutosave(JSON.stringify(state));

    expect(parsed).not.toBeNull();
    expect(parsed?.countryId).toBe("SLOVAKIA");
    expect(parsed?.turn).toBe(4);
    expect(parsed?.state.playerCountryId).toBe("SLOVAKIA");
  });

  it("rejects null, malformed JSON and payloads without a game state", () => {
    expect(parseAutosave(null)).toBeNull();
    expect(parseAutosave("{bad")).toBeNull();
    expect(parseAutosave('{"turn":3}')).toBeNull();
  });

  it("rejects a payload missing regions or units", () => {
    const state = createInitialState("RUSSIA") as Partial<GameState>;

    delete state.units;
    expect(parseAutosave(JSON.stringify(state))).toBeNull();

    const withoutRegions = createInitialState("RUSSIA") as Partial<GameState>;
    delete withoutRegions.regions;
    expect(parseAutosave(JSON.stringify(withoutRegions))).toBeNull();
  });

  it("keeps the shared autosave key", () => {
    expect(AUTOSAVE_KEY).toBe("mapgame_autosave");
  });
});
