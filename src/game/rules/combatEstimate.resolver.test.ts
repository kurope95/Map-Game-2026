// The estimator against the real resolver (the source of truth), on the real Odesa scenario at turn 1:
// Russia's units in Tiraspol attack Odesa, which has a level 3 fort (24 health) and no defending units.
// Seeds are spread over the 32-bit range: small consecutive seeds give almost the same "random" numbers.
import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import type { GameState } from "../state/types";
import { estimateAttack } from "./combatEstimate";
import { issueOrder, setCombatSeed } from "./orderResolution";
import { advanceTurn, evaluateWarEntryRules } from "./turnEngine";

const INF = "pmr-ru-inf-1";
const INF2 = "pmr-ru-inf-2";
const ARM = "pmr-ru-arm-1";
const seedFor = (i: number) => ((i + 1) * 2654435761) >>> 0;

const odesaStart = (): GameState => evaluateWarEntryRules(createInitialState("RUSSIA"));

/** One Ukrainian infantry unit defends Odesa. */
function withDefender(state: GameState): GameState {
  const template = Object.values(state.units).find((u) => u.countryId === "UKRAINE" && u.type === "infantry")!;
  return { ...state, units: { ...state.units, "test-defender": { ...template, id: "test-defender", regionId: "odesa" } } };
}

function withoutFort(state: GameState): GameState {
  return { ...state, regionEconomies: { ...state.regionEconomies, odesa: { ...state.regionEconomies.odesa, fortification: undefined } } };
}

function withFortHealth(state: GameState, health: number): GameState {
  const fort = state.regionEconomies.odesa.fortification!;
  return { ...state, regionEconomies: { ...state.regionEconomies, odesa: { ...state.regionEconomies.odesa, fortification: { ...fort, health } } } };
}

function fight(state: GameState, ids: readonly string[], seed: number) {
  setCombatSeed(seed);
  let next = state;
  for (const id of ids) next = issueOrder(next, { unitId: id, type: "attack", targetRegionId: "odesa" });
  next = advanceTurn(next);
  const log = next.combatLog.filter((entry) => entry.regionId === "odesa").pop()!;
  return {
    captured: next.regions.odesa.controllerCountryId === "RUSSIA",
    fortAfter: next.regionEconomies.odesa.fortification?.health ?? 0,
    attackerLoss: (log.attackerStrengthBefore - log.attackerStrengthAfter) / log.attackerStrengthBefore,
    defenderLoss:
      log.defenderStrengthBefore > 0 ? (log.defenderStrengthBefore - log.defenderStrengthAfter) / log.defenderStrengthBefore : 0
  };
}

function runs(state: GameState, ids: readonly string[], count: number) {
  return Array.from({ length: count }, (_, i) => fight(state, ids, seedFor(i)));
}

describe("estimateAttack against the real resolver: forts", () => {
  it("reports the fort health the resolver leaves, and no capture while the fort stands", () => {
    const state = odesaStart();
    const cases: [string[], number][] = [
      [[INF], 23],
      [[INF, ARM], 19],
      [[INF, INF2, ARM], 13]
    ];
    for (const [ids, healthAfter] of cases) {
      const estimate = estimateAttack(state, ids, "odesa")!;
      expect(estimate.fort, ids.join("+")).toMatchObject({ health: 24, healthAfter, holds: true });
      expect(estimate.captureChance, ids.join("+")).toBe(0);
      for (const result of runs(state, ids, 12)) {
        expect(result.fortAfter, ids.join("+")).toBe(healthAfter);
        expect(result.captured, ids.join("+")).toBe(false);
      }
    }
  });

  it("says the region falls when the assault breaks a weak fort and nothing defends", () => {
    const state = withFortHealth(odesaStart(), 3);
    const estimate = estimateAttack(state, [INF, ARM], "odesa")!;
    expect(estimate.fort).toMatchObject({ health: 3, healthAfter: 0, holds: false });
    expect(estimate.defenderCount).toBe(0);
    expect(estimate.captureChance).toBe(1);
    for (const result of runs(state, [INF, ARM], 12)) {
      expect(result.fortAfter).toBe(0);
      expect(result.captured).toBe(true);
    }
  });

  it("gives no capture chance while the fort holds, even when defenders are present and the battle odds look good", () => {
    const state = withDefender(odesaStart());
    const estimate = estimateAttack(state, [INF, INF2, ARM], "odesa")!;
    expect(estimate.defenderCount).toBe(1);
    expect(estimate.fort?.holds).toBe(true);
    expect(estimate.captureChance).toBe(0);
    for (const result of runs(state, [INF, INF2, ARM], 12)) expect(result.captured).toBe(false);
  });
});

describe("estimateAttack against the real resolver: capture chance without a fort", () => {
  it("matches how often one defender is actually dislodged (bounce chance included)", () => {
    const state = withoutFort(withDefender(odesaStart()));
    const cases: [string[], number][] = [
      [[INF, ARM], 0.65],
      [[INF, INF2, ARM], 0.78]
    ];
    for (const [ids, expected] of cases) {
      const estimate = estimateAttack(state, ids, "odesa")!;
      expect(estimate.captureChance, ids.join("+")).toBeCloseTo(expected, 2);
      const results = runs(state, ids, 300);
      const frequency = results.filter((r) => r.captured).length / results.length;
      expect(Math.abs(frequency - estimate.captureChance), `${ids.join("+")} observed ${frequency}`).toBeLessThan(0.07);
    }
  });
});

describe("estimateAttack against the real resolver: loss ranges", () => {
  it("encloses every battle loss the resolver produces and is not looser than a few points", () => {
    const cases: [string, GameState, string[]][] = [
      ["fort only, 3 units", odesaStart(), [INF, INF2, ARM]],
      ["fort only, 2 units", odesaStart(), [INF, ARM]],
      ["fort + defender", withDefender(odesaStart()), [INF, ARM]],
      ["defender, no fort", withoutFort(withDefender(odesaStart())), [INF, ARM]]
    ];
    for (const [label, state, ids] of cases) {
      const estimate = estimateAttack(state, ids, "odesa")!;
      const results = runs(state, ids, 240);
      const attacker = results.map((r) => r.attackerLoss);
      expect(Math.min(...attacker), label).toBeGreaterThanOrEqual(estimate.attackerLossPct.min - 1e-9);
      expect(Math.max(...attacker), label).toBeLessThanOrEqual(estimate.attackerLossPct.max + 1e-9);
      expect(estimate.attackerLossPct.min, label).toBeLessThanOrEqual(Math.min(...attacker) + 0.05);
      expect(estimate.attackerLossPct.max, label).toBeGreaterThanOrEqual(Math.max(...attacker) - 0.05);
      if (estimate.defenderCount > 0) {
        const defender = results.map((r) => r.defenderLoss);
        expect(Math.min(...defender), label).toBeGreaterThanOrEqual(estimate.defenderLossPct.min - 1e-9);
        expect(Math.max(...defender), label).toBeLessThanOrEqual(estimate.defenderLossPct.max + 1e-9);
      }
    }
  });
});

describe("estimateAttack against the real resolver: queued attacks", () => {
  it("counts attack orders already queued on the same region, because the resolver pools them", () => {
    const state = odesaStart();
    const queued = issueOrder(state, { unitId: INF, type: "attack", targetRegionId: "odesa" });
    const together = estimateAttack(state, [INF, ARM], "odesa")!;
    const sequential = estimateAttack(queued, [ARM], "odesa")!;
    const armorAlone = estimateAttack(state, [ARM], "odesa")!;

    expect(sequential.queuedAttackers).toBe(1);
    expect(sequential.attackerCount).toBe(2);
    expect(sequential.ratio).toBeCloseTo(together.ratio, 10);
    expect(sequential.attackerLossPct).toEqual(together.attackerLossPct);
    expect(sequential.captureChance).toBe(together.captureChance);
    expect(sequential.notes.join(" ")).toMatch(/already queued/i);
    expect(armorAlone.ratio).toBeLessThan(sequential.ratio);
    expect(armorAlone.queuedAttackers).toBe(0);
  });

  it("does not count a selected unit twice when its attack is already queued", () => {
    const state = odesaStart();
    const queued = issueOrder(state, { unitId: INF, type: "attack", targetRegionId: "odesa" });
    const estimate = estimateAttack(queued, [INF, ARM], "odesa")!;
    expect(estimate.attackerCount).toBe(2);
    expect(estimate.queuedAttackers).toBe(0);
  });

  it("ignores queued attacks aimed at other regions", () => {
    const state = odesaStart();
    const elsewhere = issueOrder(state, { unitId: INF, type: "attack", targetRegionId: "bucharest" });
    expect(estimateAttack(elsewhere, [ARM], "odesa")!.queuedAttackers).toBe(0);
  });
});
