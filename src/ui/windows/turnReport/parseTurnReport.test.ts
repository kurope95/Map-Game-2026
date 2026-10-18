import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import type { CountryId, GameState } from "../../../game/state/types";
import { TURN1_RUSSIA_EVENTS } from "./fixtures";
import { parseTurnReport, type TurnReport } from "./parseTurnReport";

function parse(events: string[], playerCountryId: CountryId = "RUSSIA"): TurnReport {
  const state: GameState = createInitialState(playerCountryId);
  return parseTurnReport({ turn: 12, events, before: state, after: state, playerCountryId });
}

describe("parseTurnReport", () => {
  const report = parse(TURN1_RUSSIA_EVENTS);

  it("groups sections as world, you, allies, enemies and neutrals in first-appearance order", () => {
    expect(report.sections.map((section) => section.key)).toEqual([
      "RUSSIA",
      "NOVOROSSIA",
      "GERMANY",
      "POLAND",
      "ROMANIA",
      "BALTIC_FEDERATION",
      "UKRAINE",
    ]);
    expect(report.sections.map((section) => section.relation)).toEqual([
      "you",
      "ally",
      "enemy",
      "enemy",
      "enemy",
      "enemy",
      "enemy",
    ]);
    expect(report.sections.some((section) => section.key === "PRIDNESTROVIE")).toBe(false);
  });

  it("merges Russia's supply attrition into one readable row", () => {
    const russia = report.sections.find((section) => section.key === "RUSSIA");
    expect(russia?.rows).toHaveLength(1);
    expect(russia?.rows[0]).toMatchObject({
      category: "supply",
      tone: "warn",
      text: "3 units lose strength in Tiraspol: no supply (−4)",
    });
    expect(russia?.rows[0].lines).toHaveLength(3);
    expect(russia?.rows[0].text).not.toContain("pmr-");
    expect(russia?.rows[0].children).toBeUndefined();
  });

  it("keeps Germany's diplomacy line and collapses its moves", () => {
    const germany = report.sections.find((section) => section.key === "GERMANY");
    const diplomacy = germany?.rows.filter((row) => row.category === "diplomacy") ?? [];
    expect(diplomacy).toHaveLength(1);
    const move = germany?.rows.find((row) => row.category === "move");
    expect(move?.text).toBe("5 units repositioned");
    expect(move?.children).toHaveLength(5);
    expect(move?.children?.[0]).toBe("infantry moved from Berlin to Essen.");
  });

  it("scores battles from the acting nation's point of view", () => {
    const novorossia = report.sections.find((section) => section.key === "NOVOROSSIA");
    expect(novorossia?.rows.filter((row) => row.category === "battle").map((row) => row.tone)).toEqual([
      "good",
      "good",
      "bad",
    ]);
    expect(novorossia?.rows.find((row) => row.category === "move")?.text).toBe("1 unit repositioned");

    const ukraine = report.sections.find((section) => section.key === "UKRAINE");
    const strikes = ukraine?.rows.filter((row) => row.category === "strike") ?? [];
    expect(strikes).toHaveLength(1);
    expect(strikes[0].tone).toBe("warn");
    expect(ukraine?.rows.filter((row) => row.category === "battle").map((row) => row.tone)).toEqual(["good"]);
    expect(ukraine?.rows.find((row) => row.category === "move")?.text).toBe("2 units repositioned");
  });

  it("summarises the turn", () => {
    expect(report.summary).toEqual({ battles: 4, captures: 0, moves: 24, warEntries: 0, defeats: 0 });
  });

  it("never leaks a turn marker", () => {
    for (const section of report.sections) {
      for (const row of section.rows) {
        expect(row.text).not.toContain("Turn advanced");
        for (const child of row.children ?? []) expect(child).not.toContain("Turn advanced");
      }
    }
  });

  it("accounts for every non-marker line exactly once", () => {
    const lineCount = report.sections.reduce(
      (total, section) => total + section.rows.reduce((sum, row) => sum + row.lines.length, 0),
      0
    );
    expect(lineCount).toBe(34);
  });

  it("puts world events first and reads the capture controller", () => {
    const worldReport = parse([
      "Slovakia entered the war on turn 5: scripted.",
      "Turn advanced. Active country: Germany.",
      "Warsaw is now controlled by Russia.",
    ]);
    expect(worldReport.sections[0].key).toBe("WORLD");
    expect(worldReport.sections[0].relation).toBe("world");
    const germany = worldReport.sections.find((section) => section.key === "GERMANY");
    const capture = germany?.rows.find((row) => row.category === "capture");
    expect(capture?.tone).toBe("good");
    expect(worldReport.summary.warEntries).toBe(1);
  });

  it("replaces known unit ids with readable names", () => {
    const nameReport = parse([
      "[RUSSIA] pmr-ru-inf-1 is cut off from the capital supply network in Tiraspol.",
    ]);
    expect(nameReport.sections[0].rows[0].text).toBe(
      "Infantry (Russia) is cut off from the capital supply network in Tiraspol."
    );
  });

  it("parses 2,000 lines over 15 markers quickly and survives an unknown player country", () => {
    const names = [
      "Germany", "Poland", "Romania", "Hungary", "Bulgaria",
      "Greece", "Turkey", "Ukraine", "Lithuania", "Latvia",
      "Estonia", "Finland", "Sweden", "Norway", "Austria",
    ];
    const events: string[] = [];
    for (let index = 0; index < 2_000; index++) {
      if (index % 140 === 0) events.push(`Turn advanced. Active country: ${names[(index / 140) % 15]}.`);
      events.push("[RUSSIA] pmr-ru-inf-1 moved from Tiraspol to Odesa.");
    }

    const state = createInitialState("RUSSIA");
    const start = performance.now();
    const bigReport = parseTurnReport({
      turn: 40,
      events,
      before: state,
      after: state,
      playerCountryId: "BELARUS",
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(bigReport.sections.some((section) => section.relation === "you")).toBe(false);
    const lineCount = bigReport.sections.reduce(
      (total, section) => total + section.rows.reduce((sum, row) => sum + row.lines.length, 0),
      0
    );
    expect(lineCount).toBe(2_000);
  });
});

describe("parseTurnReport relations with neutral nations", () => {
  const relationOf = (report: TurnReport, key: string) => report.sections.find((section) => section.key === key)?.relation;

  it("calls neutral nations neutral for an aligned player, and keeps allies and enemies", () => {
    const report = parse(
      [
        "[Russia] infantry moved from Moscow to Smolensk.",
        "Turn advanced. Active country: Austria.",
        "[Austria] infantry moved from Vienna to Salzburg.",
        "Turn advanced. Active country: Germany.",
        "[Germany] infantry moved from Berlin to Essen.",
        "Turn advanced. Active country: Serbia.",
        "[Serbia] infantry moved from Belgrade to Nis.",
      ],
      "RUSSIA"
    );
    expect(relationOf(report, "RUSSIA")).toBe("you");
    expect(relationOf(report, "GERMANY")).toBe("enemy");
    expect(relationOf(report, "AUSTRIA")).toBe("neutral");
    expect(relationOf(report, "SERBIA")).toBe("neutral");
  });

  it("calls everyone else neutral when the player is neutral", () => {
    const report = parse(
      [
        "[Austria] infantry moved from Vienna to Salzburg.",
        "Turn advanced. Active country: Germany.",
        "[Germany] infantry moved from Berlin to Essen.",
        "Turn advanced. Active country: Serbia.",
        "[Serbia] infantry moved from Belgrade to Nis.",
      ],
      "AUSTRIA"
    );
    expect(relationOf(report, "AUSTRIA")).toBe("you");
    expect(relationOf(report, "GERMANY")).toBe("neutral");
    expect(relationOf(report, "SERBIA")).toBe("neutral");
  });

  it("scores a capture as good only for the player's own nation or its aligned bloc", () => {
    const captureTone = (events: string[], player: CountryId) =>
      parse(events, player).sections.flatMap((section) => section.rows).find((row) => row.category === "capture")?.tone;
    expect(captureTone(["Warsaw is now controlled by Austria."], "AUSTRIA")).toBe("good");
    expect(captureTone(["Warsaw is now controlled by Serbia."], "AUSTRIA")).toBe("bad");
    expect(captureTone(["Warsaw is now controlled by Serbia."], "RUSSIA")).toBe("bad");
    expect(captureTone(["Warsaw is now controlled by Novorossia."], "RUSSIA")).toBe("good");
  });
});
