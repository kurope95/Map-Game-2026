import { describe, expect, it } from "vitest";
import type { UnitDefinition } from "../../game/state/types";
import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "./unitStatus";

const unit = (patch: Partial<UnitDefinition>) => patch as UnitDefinition;

describe("getSupplyStatus", () => {
  it("does not apply supply to aircraft and missiles", () => {
    expect(getSupplyStatus(unit({ type: "fighter", supplyTurnsRemaining: 0 }))).toEqual({ tone: "air", label: "Not affected" });
    expect(getSupplyStatus(unit({ type: "tacticalMissile", supplyTurnsRemaining: 0 }))).toEqual({ tone: "air", label: "Not affected" });
  });

  it("grades infantry supply from cut off to supplied", () => {
    expect(getSupplyStatus(unit({ type: "infantry", supplyTurnsRemaining: 0 }))).toEqual({ tone: "cutoff", label: "Cut off" });
    expect(getSupplyStatus(unit({ type: "infantry", supplyTurnsRemaining: 1 }))).toEqual({ tone: "critical", label: "Critical" });
    expect(getSupplyStatus(unit({ type: "infantry", supplyTurnsRemaining: 2 }))).toEqual({ tone: "low", label: "Low" });
    expect(getSupplyStatus(unit({ type: "infantry", supplyTurnsRemaining: 3 }))).toEqual({ tone: "good", label: "Supplied" });
  });

  it("treats armor like infantry and negative supply as cut off", () => {
    expect(getSupplyStatus(unit({ type: "armor", supplyTurnsRemaining: 1 }))).toEqual({ tone: "critical", label: "Critical" });
    expect(getSupplyStatus(unit({ type: "armor", supplyTurnsRemaining: -2 }))).toEqual({ tone: "cutoff", label: "Cut off" });
  });
});

describe("getVeterancyLevel", () => {
  it("is the number of battles won, capped at 3", () => {
    expect(getVeterancyLevel(unit({ battlesWon: 5 }))).toBe(3);
    expect(getVeterancyLevel(unit({ battlesWon: 2 }))).toBe(2);
    expect(getVeterancyLevel(unit({}))).toBe(0);
  });
});

describe("getEntrenchmentBonus", () => {
  it("is 5 percent per turn dug in, capped at 25", () => {
    expect(getEntrenchmentBonus(unit({ entrenchmentTurns: 9 }))).toBe(25);
    expect(getEntrenchmentBonus(unit({ entrenchmentTurns: 2 }))).toBe(10);
    expect(getEntrenchmentBonus(unit({}))).toBe(0);
  });
});
