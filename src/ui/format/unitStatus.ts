import type { UnitDefinition } from "../../game/state/types";

export function getSupplyStatus(unit: UnitDefinition) {
  if (unit.type !== "infantry" && unit.type !== "armor") {
    return { tone: "air", label: "Not affected" };
  }
  if (unit.supplyTurnsRemaining <= 0) {
    return { tone: "cutoff", label: "Cut off" };
  }
  if (unit.supplyTurnsRemaining === 1) {
    return { tone: "critical", label: "Critical" };
  }
  if (unit.supplyTurnsRemaining === 2) {
    return { tone: "low", label: "Low" };
  }
  return { tone: "good", label: "Supplied" };
}

export function getVeterancyLevel(unit: UnitDefinition) {
  return Math.min(unit.battlesWon ?? 0, 3);
}

export function getEntrenchmentBonus(unit: UnitDefinition) {
  return Math.min((unit.entrenchmentTurns ?? 0) * 5, 25);
}
