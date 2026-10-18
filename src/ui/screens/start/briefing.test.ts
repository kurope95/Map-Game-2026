import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { getNationBriefing } from "./briefing";

const state = createInitialState("RUSSIA");

function summaryTotal(summary: string): number {
  return [...summary.matchAll(/\d+/g)].reduce((total, match) => total + Number(match[0]), 0);
}

describe("getNationBriefing", () => {
  it("describes Russia as an easy major power at war", () => {
    const briefing = getNationBriefing(state, "RUSSIA");

    expect(briefing.name).toBe("Russia");
    expect(briefing.status).toBe("At war");
    expect(briefing.difficulty).toBe("Easy");
    expect(briefing.difficultyPips).toBe(1);
    expect(briefing.capitalName).toBe("Moscow");
    expect(briefing.warEntryText).toBe("At war from turn 1.");
  });

  it("counts every Russian unit in the summary", () => {
    const briefing = getNationBriefing(state, "RUSSIA");
    const russianUnits = Object.values(state.units).filter((unit) => unit.countryId === "RUSSIA");

    expect(summaryTotal(briefing.unitSummary)).toBe(russianUnits.length);
  });

  it("describes Slovakia's scripted war entry", () => {
    const briefing = getNationBriefing(state, "SLOVAKIA");

    expect(briefing.blocLabel).toBe("BRICS");
    expect(briefing.warEntryText).toContain("turn 5");
  });

  it("marks Austria as a very hard neutral nation", () => {
    const briefing = getNationBriefing(state, "AUSTRIA");

    expect(briefing.blocLabel).toBe("Neutral");
    expect(briefing.difficulty).toBe("Very hard");
    expect(briefing.difficultyPips).toBe(4);
    expect(briefing.warEntryText).toBe("Neutral at the start.");
  });

  it("names the enemy bloc, its belligerents and its majors from the BRICS side", () => {
    const briefing = getNationBriefing(state, "RUSSIA");

    expect(briefing.enemyBlocLabel).toBe("EU NATO");
    expect(briefing.enemyBelligerentCount).toBe(5);
    expect(briefing.enemyMajorLabels).toEqual(["Germany (Berlin)", "Poland (Warsaw)"]);
  });

  it("counts the BRICS belligerents from the EU NATO side", () => {
    const briefing = getNationBriefing(state, "GERMANY");

    expect(briefing.enemyBlocLabel).toBe("BRICS");
    expect(briefing.enemyBelligerentCount).toBe(3);
    expect(briefing.enemyMajorLabels).toEqual(["Russia (Moscow)"]);
  });

  it("leaves the enemy fields empty for a neutral nation", () => {
    const briefing = getNationBriefing(state, "AUSTRIA");

    expect(briefing.enemyBlocLabel).toBeNull();
    expect(briefing.enemyBelligerentCount).toBe(0);
    expect(briefing.enemyMajorLabels).toEqual([]);
  });
});
