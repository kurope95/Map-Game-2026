import { describe, expect, it } from "vitest";
import type {
  CountryId,
  DoctrineUpgradeId,
  GameState,
  Order,
  RegionDefinition,
  RegionFortification,
  RegionTerrain,
  UnitDefinition
} from "../state/types";
import { estimateAttack, type AttackEstimate } from "./combatEstimate";

function makeRegion(id: string, overrides: Partial<RegionDefinition> = {}): RegionDefinition {
  return {
    id,
    name: id,
    homeCountryId: "UKRAINE",
    controllerCountryId: "UKRAINE",
    controllerBlocId: "EU_NATO",
    terrain: "plains",
    points: 1,
    populationWeight: 1,
    industryWeight: 1,
    isCapital: false,
    isKeyCity: false,
    adjacentRegionIds: [],
    infrastructure: [],
    ...overrides
  };
}

function unit(overrides: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id: "atk",
    type: "infantry",
    blocId: "BRICS",
    countryId: "RUSSIA",
    regionId: "source",
    strength: 8,
    supplyTurnsRemaining: 2,
    ...overrides
  };
}

const defender = (overrides: Partial<UnitDefinition> = {}): UnitDefinition =>
  unit({ id: "def", blocId: "EU_NATO", countryId: "UKRAINE", regionId: "target", ...overrides });

interface Fixture {
  attackers?: UnitDefinition[];
  defenders?: UnitDefinition[];
  extraUnits?: UnitDefinition[];
  terrain?: RegionTerrain;
  fort?: RegionFortification;
  doctrines?: Partial<Record<CountryId, DoctrineUpgradeId[]>>;
  pendingOrders?: Partial<Record<CountryId, Order[]>>;
}

function makeState(fixture: Fixture = {}): GameState {
  const attackers = fixture.attackers ?? [unit()];
  const defenders = fixture.defenders ?? [defender()];
  const units = [...attackers, ...defenders, ...(fixture.extraUnits ?? [])];
  return {
    playerCountryId: "RUSSIA",
    regions: {
      source: makeRegion("source", {
        name: "Source",
        homeCountryId: "RUSSIA",
        controllerCountryId: "RUSSIA",
        controllerBlocId: "BRICS"
      }),
      target: makeRegion("target", { name: "Target", terrain: fixture.terrain ?? "plains" })
    },
    units: Object.fromEntries(units.map((u) => [u.id, u])),
    regionEconomies: {
      target: {
        population: 100,
        stability: 50,
        recruitablePool: 0,
        buildingSlots: 2,
        facilities: [],
        fortification: fixture.fort,
        resourceDeposits: []
      }
    },
    doctrineUpgrades: fixture.doctrines ?? {},
    pendingOrders: { RUSSIA: [], UKRAINE: [], ...fixture.pendingOrders }
  } as unknown as GameState;
}

function estimate(fixture: Fixture = {}, attackerUnitIds: readonly string[] = ["atk"]): AttackEstimate {
  const result = estimateAttack(makeState(fixture), attackerUnitIds, "target");
  if (!result) throw new Error("expected an estimate");
  return result;
}

const ratioOf = (fixture: Fixture): number => estimate(fixture).ratio;

describe("estimateAttack bands", () => {
  it("bands exactly at the resolver's 1.5, 1.0 and 0.7 thresholds", () => {
    expect(estimate({ attackers: [unit({ strength: 12 })], defenders: [defender({ strength: 8 })] })).toMatchObject({
      band: "decisive",
      ratio: 1.5
    });
    expect(estimate({ attackers: [unit({ strength: 8 })], defenders: [defender({ strength: 8 })] })).toMatchObject({
      band: "likely",
      ratio: 1
    });
    expect(estimate({ attackers: [unit({ strength: 7 })], defenders: [defender({ strength: 10 })] })).toMatchObject({
      band: "marginal",
      ratio: 0.7
    });
    expect(estimate({ attackers: [unit({ strength: 6 })], defenders: [defender({ strength: 10 })] }).band).toBe("unlikely");
  });

  it("returns decisive and an infinite ratio when nothing defends the region", () => {
    const result = estimate({ defenders: [] });
    expect(result.defenderStrength).toBe(0);
    expect(result.ratio).toBe(Infinity);
    expect(result.band).toBe("decisive");
  });
});

describe("estimateAttack modifiers", () => {
  it("raises the defender's effective strength with terrain, entrenchment, veterancy and trench networks", () => {
    const base = ratioOf({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 5 })] });
    expect(base).toBeCloseTo(2);

    const urban = ratioOf({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 5 })], terrain: "urban" });
    expect(urban).toBeCloseTo(base / 1.4);

    const entrenched = ratioOf({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 5, entrenchmentTurns: 4 })]
    });
    expect(entrenched).toBeCloseTo(base / 1.2);

    const veteranDefender = ratioOf({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 5, battlesWon: 2 })]
    });
    expect(veteranDefender).toBeCloseTo(base / 1.1);

    const trenches = ratioOf({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 5 })],
      doctrines: { UKRAINE: ["trench_networks"] }
    });
    expect(trenches).toBeCloseTo(base / 1.18);
  });

  it("raises the attacker's effective strength with veterancy and infantry drill", () => {
    const base = ratioOf({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 5 })] });
    expect(ratioOf({ attackers: [unit({ strength: 10, battlesWon: 3 })], defenders: [defender({ strength: 5 })] })).toBeCloseTo(base * 1.15);
    expect(
      ratioOf({
        attackers: [unit({ strength: 10 })],
        defenders: [defender({ strength: 5 })],
        doctrines: { RUSSIA: ["infantry_drill"] }
      })
    ).toBeCloseTo(base * 1.1);
  });

  it("adds the combined-arms bonus only for infantry and armor attacking together", () => {
    const doctrine = { RUSSIA: ["combined_arms" as const] };
    const infantryOnly = ratioOf({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 5 })],
      doctrines: doctrine
    });
    expect(infantryOnly).toBeCloseTo(2);

    const mixed = estimate(
      {
        attackers: [unit({ strength: 10 }), unit({ id: "arm", type: "armor", strength: 10 })],
        defenders: [defender({ strength: 5 })],
        doctrines: doctrine
      },
      ["atk", "arm"]
    ).ratio;
    expect(mixed).toBeCloseTo((20 * 1.15) / 5);
  });

  it("lets armored spearhead ignore the terrain modifier", () => {
    const attacker = [unit({ id: "arm", type: "armor", strength: 10 })];
    const defenders = [defender({ strength: 5 })];
    const ids = ["arm"];
    expect(estimate({ attackers: attacker, defenders, terrain: "mountain" }, ids).ratio).toBeCloseTo(10 / (5 * 1.5));
    expect(
      estimate(
        { attackers: attacker, defenders, terrain: "mountain", doctrines: { RUSSIA: ["armored_spearhead"] } },
        ids
      ).ratio
    ).toBeCloseTo(2);
  });

  it("applies the unsupplied penalty to land units on both sides", () => {
    const base = ratioOf({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 5 })] });
    expect(
      ratioOf({
        attackers: [unit({ strength: 10, supplyTurnsRemaining: 0 })],
        defenders: [defender({ strength: 5 })]
      })
    ).toBeCloseTo(base * 0.7);
    expect(
      ratioOf({
        attackers: [unit({ strength: 10 })],
        defenders: [defender({ strength: 5, supplyTurnsRemaining: 0 })]
      })
    ).toBeCloseTo(base / 0.7);
  });

  it("uses only assault units as attackers and only enemy-bloc units as defenders", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 }), unit({ id: "arty", type: "mlrs", strength: 10 })],
      defenders: [defender({ strength: 5 }), unit({ id: "ally", blocId: "BRICS", countryId: "BELARUS", regionId: "target", strength: 10 })]
    });
    expect(result.attackerStrength).toBe(10);
    expect(result.defenderStrength).toBe(5);
  });
});

describe("estimateAttack fortifications", () => {
  it("adds fort protection and base power to the defence and reports the attrition penalty", () => {
    const result = estimate({
      attackers: [unit({ strength: 14 })],
      defenders: [defender({ strength: 8 })],
      fort: { level: 2, health: 16, maxHealth: 16, damaged: false }
    });
    expect(result.defenderStrength).toBeCloseTo(8 * 1.35 + 14);
    expect(result.fort).toMatchObject({ level: 2, health: 16, maxHealth: 16, attackerLossPenaltyPct: 0.12 });
  });

  it("scales fort base power with its remaining health", () => {
    const result = estimate({
      attackers: [unit({ strength: 14 })],
      defenders: [defender({ strength: 8 })],
      fort: { level: 2, health: 8, maxHealth: 16, damaged: true }
    });
    expect(result.defenderStrength).toBeCloseTo(8 * 1.35 + 7);
  });

  it("charges a heavier attacker penalty when the attackers cannot crack the fort", () => {
    const result = estimate({
      attackers: [unit({ strength: 8 })],
      defenders: [defender({ strength: 8 })],
      fort: { level: 3, health: 24, maxHealth: 24, damaged: false }
    });
    expect(result.fort?.attackerLossPenaltyPct).toBe(0.18);
    // base 0.5 ±15% plus the 0.18 penalty gives 0.605-0.755; the resolver rounds each unit's remaining strength:
    // 8 × (1 - 0.605) = 3.16 -> 3 left (5 lost = 62.5%), 8 × (1 - 0.755) = 1.96 -> 2 left (6 lost = 75%)
    expect(result.attackerLossPct.min).toBeCloseTo(0.625);
    expect(result.attackerLossPct.max).toBeCloseTo(0.75);
    // defenders: 0.15 ±15% times 0.65 is 0.083-0.112, which rounds to one point of an 8 either way (12.5%)
    expect(result.defenderLossPct.min).toBeCloseTo(0.125);
    expect(result.defenderLossPct.max).toBeCloseTo(0.125);
  });

  it("treats a fort at zero health as inactive", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 5 })],
      fort: { level: 2, health: 0, maxHealth: 16, damaged: true }
    });
    expect(result.fort).toBeNull();
    expect(result.defenderStrength).toBeCloseTo(5);
  });
});

describe("estimateAttack pending support", () => {
  const fighter = unit({ id: "ftr", type: "fighter", strength: 8 });

  it("adds pending fighter air support to the attacker strength", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 10 })],
      extraUnits: [fighter],
      pendingOrders: { RUSSIA: [{ unitId: "ftr", type: "airSupport", targetRegionId: "target" }] }
    });
    expect(result.airSupportBonus).toBe(2);
    expect(result.attackerStrength).toBe(12);
    expect(result.support).toEqual({ fighters: 1, bombardments: 0, missiles: 0 });
  });

  it("boosts air support by 25% with close air support", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 10 })],
      extraUnits: [fighter],
      doctrines: { RUSSIA: ["close_air_support"] },
      pendingOrders: { RUSSIA: [{ unitId: "ftr", type: "airSupport", targetRegionId: "target" }] }
    });
    expect(result.airSupportBonus).toBe(3);
  });

  it("applies pending bombardment damage and fort damage before the land ratio", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [unit({ id: "arty", type: "mlrs", strength: 10 })],
      fort: { level: 2, health: 16, maxHealth: 16, damaged: false },
      pendingOrders: { RUSSIA: [{ unitId: "arty", type: "bombard", targetRegionId: "target" }] }
    });
    // 10 × 0.55 = 5.5 → 6 damage; fort takes max(2, round(10 × 0.8)) = 8
    expect(result.defenderStrength).toBeCloseTo(2 * 1.35 + 14 * (8 / 16));
    expect(result.fort).toMatchObject({ health: 8, maxHealth: 16 });
    expect(result.support).toEqual({ fighters: 0, bombardments: 1, missiles: 0 });
  });

  it("applies pending missile damage, missile corps and strategic fort damage", () => {
    const tactical = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [unit({ id: "mis", type: "tacticalMissile", strength: 1 })],
      fort: { level: 2, health: 16, maxHealth: 16, damaged: false },
      pendingOrders: { RUSSIA: [{ unitId: "mis", type: "missileStrike", targetRegionId: "target" }] }
    });
    expect(tactical.defenderStrength).toBeCloseTo(5 * 1.35 + 14);
    expect(tactical.fort?.health).toBe(16);

    const strategic = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [unit({ id: "mis", type: "strategicMissile", strength: 1 })],
      fort: { level: 2, health: 16, maxHealth: 16, damaged: false },
      pendingOrders: { RUSSIA: [{ unitId: "mis", type: "missileStrike", targetRegionId: "target" }] }
    });
    expect(strategic.defenderStrength).toBeCloseTo(3 * 1.35 + 7);
    expect(strategic.fort?.health).toBe(8);

    const corps = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [unit({ id: "mis", type: "tacticalMissile", strength: 1 })],
      doctrines: { RUSSIA: ["missile_corps"] },
      pendingOrders: { RUSSIA: [{ unitId: "mis", type: "missileStrike", targetRegionId: "target" }] }
    });
    expect(corps.defenderStrength).toBeCloseTo(4);
  });

  it("boosts bombardment with artillery doctrine and reduces it with counterbattery radar", () => {
    const artillery = unit({ id: "arty", type: "mlrs", strength: 10 });
    const order: Order = { unitId: "arty", type: "bombard", targetRegionId: "target" };
    const base = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [artillery],
      pendingOrders: { RUSSIA: [order] }
    });
    // round(10 × 0.55) = 6 → defender 8 - 6 = 2
    expect(base.defenderStrength).toBeCloseTo(2);

    const doctrine = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [artillery],
      doctrines: { RUSSIA: ["artillery_doctrine"] },
      pendingOrders: { RUSSIA: [order] }
    });
    // round(10 × 0.55 × 1.25) = 7 → defender 8 - 7 = 1
    expect(doctrine.defenderStrength).toBeCloseTo(1);

    const counterbattery = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 8 })],
      extraUnits: [artillery],
      doctrines: { UKRAINE: ["counterbattery_radar"] },
      pendingOrders: { RUSSIA: [order] }
    });
    // round(10 × 0.55 × 0.8) = 4 → defender 8 - 4 = 4
    expect(counterbattery.defenderStrength).toBeCloseTo(4);
  });

  it("splits support damage across defenders and never lets bombardment destroy the last strength", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ id: "def-a", strength: 8 }), defender({ id: "def-b", strength: 8 })],
      extraUnits: [unit({ id: "mis", type: "tacticalMissile", strength: 1 })],
      pendingOrders: { RUSSIA: [{ unitId: "mis", type: "missileStrike", targetRegionId: "target" }] }
    });
    // 3 damage split over two defenders → ceil(3 / 2) = 2 each
    expect(result.defenderStrength).toBe(12);

    const bombarded = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ id: "def-a", strength: 1 }), defender({ id: "def-b", strength: 1 })],
      extraUnits: [unit({ id: "arty", type: "mlrs", strength: 10 })],
      pendingOrders: { RUSSIA: [{ unitId: "arty", type: "bombard", targetRegionId: "target" }] }
    });
    expect(bombarded.defenderStrength).toBe(2);
  });

  it("ignores pending orders from countries other than the player and for other regions", () => {
    const result = estimate({
      attackers: [unit({ strength: 10 })],
      defenders: [defender({ strength: 10 })],
      extraUnits: [fighter],
      pendingOrders: {
        BELARUS: [{ unitId: "ftr", type: "airSupport", targetRegionId: "target" }],
        RUSSIA: [{ unitId: "ftr", type: "airSupport", targetRegionId: "elsewhere" }]
      }
    });
    expect(result.airSupportBonus).toBe(0);
    expect(result.support).toEqual({ fighters: 0, bombardments: 0, missiles: 0 });
  });
});

describe("estimateAttack loss ranges", () => {
  // The resolver takes the band base ±15% (clamped), then cuts every unit to round(strength × (1 - loss)),
  // so the range the player sees is what those two extremes leave after rounding.
  it("uses the band base ±15%, the resolver clamps and its per-unit rounding", () => {
    const likely = estimate({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 8 })] });
    // attackers 0.2125-0.2875: 10 -> 8 or 7 left, so 20-30%; defenders 0.3825-0.5175: 8 -> 5 or 4 left, so 37.5-50%
    expect(likely.attackerLossPct.min).toBeCloseTo(0.2);
    expect(likely.attackerLossPct.max).toBeCloseTo(0.3);
    expect(likely.defenderLossPct.min).toBeCloseTo(0.375);
    expect(likely.defenderLossPct.max).toBeCloseTo(0.5);

    const decisive = estimate({ attackers: [unit({ strength: 50 })], defenders: [defender({ strength: 8 })] });
    // 0.085-0.115 of 50 is 46 or 44 left (8-12%); a ratio of 5 or more wipes the defenders out
    expect(decisive.attackerLossPct.min).toBeCloseTo(0.08);
    expect(decisive.attackerLossPct.max).toBeCloseTo(0.12);
    expect(decisive.defenderLossPct).toEqual({ min: 1, max: 1 });

    const unlikely = estimate({ attackers: [unit({ strength: 6 })], defenders: [defender({ strength: 10 })] });
    // attackers 0.425-0.575 of 6 is 3 left either way (50%); defenders 0.1275-0.1725 of 10 is 9 or 8 left (10-20%)
    expect(unlikely.attackerLossPct.min).toBeCloseTo(0.5);
    expect(unlikely.attackerLossPct.max).toBeCloseTo(0.5);
    expect(unlikely.defenderLossPct.min).toBeCloseTo(0.1);
    expect(unlikely.defenderLossPct.max).toBeCloseTo(0.2);
  });

  it("has no defender losses and a zero defender count when nothing defends the region", () => {
    const result = estimate({ defenders: [] });
    expect(result.defenderCount).toBe(0);
    expect(result.defenderLossPct).toEqual({ min: 0, max: 0 });
  });

  it("counts the attackers and the defenders", () => {
    const result = estimate(
      { attackers: [unit({ id: "a1" }), unit({ id: "a2" })], defenders: [defender({ id: "d1" }), defender({ id: "d2" }), defender({ id: "d3" })] },
      ["a1", "a2"]
    );
    expect(result.attackerCount).toBe(2);
    expect(result.defenderCount).toBe(3);
    expect(result.queuedAttackers).toBe(0);
  });
});

describe("estimateAttack capture chance", () => {
  // Mirrors the resolver: a won battle only takes the region if the defenders then give way, and the assault
  // can bounce back (getAssaultBounceChance); the battle itself is won 100% / 60% / 15% by band.
  it("is the bounce-adjusted win chance when defenders survive the battle", () => {
    // ratio 1.25 (likely): wins always, bounce chance 50%
    expect(estimate({ attackers: [unit({ strength: 10 })], defenders: [defender({ strength: 8 })] }).captureChance).toBeCloseTo(0.5);
    // ratio 0.7 (marginal): 60% win, bounce chance 65%
    expect(estimate({ attackers: [unit({ strength: 7 })], defenders: [defender({ strength: 10 })] }).captureChance).toBeCloseTo(0.6 * 0.35);
    // ratio 0.6 (unlikely): 15% win, bounce chance 85%
    expect(estimate({ attackers: [unit({ strength: 6 })], defenders: [defender({ strength: 10 })] }).captureChance).toBeCloseTo(0.15 * 0.15);
  });

  it("is certain when nothing defends the region, or when the battle wipes every defender out", () => {
    expect(estimate({ defenders: [] }).captureChance).toBe(1);
    // ratio 6.25: defenders lose everything
    expect(estimate({ attackers: [unit({ strength: 50 })], defenders: [defender({ strength: 8 })] }).captureChance).toBe(1);
  });

  it("is zero while a fort survives the assault, however good the battle odds are", () => {
    const strongAttack = estimate({
      attackers: [unit({ strength: 40 })],
      defenders: [defender({ strength: 4 })],
      fort: { level: 3, health: 24, maxHealth: 24, damaged: false }
    });
    expect(strongAttack.band).toBe("decisive");
    expect(strongAttack.fort?.holds).toBe(true);
    expect(strongAttack.fort!.healthAfter).toBeGreaterThan(0);
    expect(strongAttack.fort!.healthAfter).toBeLessThan(24);
    expect(strongAttack.captureChance).toBe(0);
  });

  it("is certain when nothing defends and the assault breaks the fort", () => {
    const result = estimate({
      attackers: [unit({ strength: 40 })],
      defenders: [],
      fort: { level: 1, health: 2, maxHealth: 10, damaged: true }
    });
    expect(result.fort).toMatchObject({ health: 2, healthAfter: 0, holds: false });
    expect(result.captureChance).toBe(1);
  });

  it("never reports a fort outcome without a fort", () => {
    const result = estimate();
    expect(result.fort).toBeNull();
  });
});

describe("estimateAttack invalid input", () => {
  it("returns null for an unknown target or no valid attackers", () => {
    const state = makeState();
    expect(estimateAttack(state, ["atk"], "atlantis")).toBeNull();
    expect(estimateAttack(state, ["ghost"], "target")).toBeNull();
    expect(estimateAttack(state, [], "target")).toBeNull();
  });
});
