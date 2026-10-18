import { describe, expect, it } from "vitest";
import { createInitialState } from "./createInitialState";
import { evaluateWarEntryRules } from "../rules/turnEngine";
import { setCombatSeed } from "../rules/orderResolution";
import { autoPlayTurns } from "../sim/autoPlay";

describe("scenario baseline", () => {
  it("keeps state.scenario.regions at their pre-war controllers while regions change hands", () => {
    setCombatSeed(20261018);
    const initial = evaluateWarEntryRules(createInitialState("RUSSIA"));
    const baseline = Object.fromEntries(initial.scenario.regions.map((r) => [r.id, r.controllerCountryId]));
    const after = autoPlayTurns(initial, "RUSSIA", 10);
    for (const region of after.scenario.regions) {
      expect(region.controllerCountryId).toBe(baseline[region.id]);
    }
    const changed = Object.values(after.regions).filter((r) => r.controllerCountryId !== baseline[r.id]);
    expect(changed.length).toBeGreaterThan(0);
  });
});
