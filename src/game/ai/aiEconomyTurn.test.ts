import { describe, expect, it } from "vitest";
import { MAX_UNIT_STRENGTH } from "../content/economyRecipes";
import { DOCTRINE_DEFINITIONS } from "../content/doctrines";
import { createInitialState } from "../state/createInitialState";
import type { CountryId, EconomyBuildOrder, Facility, FacilityType, GameState } from "../state/types";
import { aiEconomyTurn } from "./heuristicBot";

const COUNTRY = "ROMANIA" as const;
const REGION = "bucharest";
const QUIET_CONTROLLER = "MOLDOVA" as const;

function facility(
  id: string,
  type: FacilityType,
  level = 1,
  damaged = false,
  chemicalMode?: Facility["chemicalMode"]
): Facility {
  return { id, type, level, regionId: REGION, damaged, chemicalMode };
}

function pendingFacilityUpgrade(id = "seed-upgrade-pending"): EconomyBuildOrder {
  return {
    id,
    countryId: COUNTRY,
    regionId: REGION,
    type: "upgradeFacility",
    facilityId: id,
    turnsRemaining: 5,
    totalTurns: 5,
    committed: {},
  };
}

function pendingReplenish(unitId: string, unitType: "infantry" = "infantry"): EconomyBuildOrder {
  return {
    id: `seed-replenish-${unitId}`,
    countryId: COUNTRY,
    regionId: REGION,
    type: "replenishUnit",
    unitId,
    unitType,
    turnsRemaining: 2,
    totalTurns: 2,
    committed: {},
  };
}

interface FixtureOptions {
  facilities: Facility[];
  /** Unit strengths in REGION; defaults to three full-strength infantry so no replenishment wins. */
  unitStrengths?: number[];
  pendingOrders?: EconomyBuildOrder[];
  tradePoints?: number;
  buildingSlots?: number;
}

/**
 * Romania holds only Bucharest; every other region is quiet neutral ground, so the country has
 * no front line and no hostile border. The one pending order (unless a test replaces the list)
 * fills the second of Romania's two minor-tier queue slots, so each call adds at most one order.
 */
function fixture({
  facilities,
  unitStrengths = [MAX_UNIT_STRENGTH.infantry, MAX_UNIT_STRENGTH.infantry, MAX_UNIT_STRENGTH.infantry],
  pendingOrders = [pendingFacilityUpgrade()],
  tradePoints = 0,
  buildingSlots = 8,
}: FixtureOptions): GameState {
  const fresh = createInitialState("RUSSIA");
  const regions = Object.fromEntries(
    Object.values(fresh.regions).map((region) => {
      const romania = region.id === REGION;
      return [
        region.id,
        {
          ...region,
          controllerCountryId: romania ? COUNTRY : QUIET_CONTROLLER,
          controllerBlocId: romania ? fresh.countries[COUNTRY].blocId : fresh.countries[QUIET_CONTROLLER].blocId,
        },
      ];
    })
  );
  const units = Object.fromEntries(
    unitStrengths.map((strength, index) => [
      `test-inf-${index}`,
      {
        id: `test-inf-${index}`,
        type: "infantry" as const,
        blocId: fresh.countries[COUNTRY].blocId!,
        countryId: COUNTRY,
        regionId: REGION,
        strength,
        supplyTurnsRemaining: 10,
      },
    ])
  );
  const countryStates = Object.fromEntries(
    Object.entries(fresh.countryStates).map(([countryId, countryState]) => [
      countryId,
      { ...countryState, atWar: countryId === COUNTRY },
    ])
  ) as GameState["countryStates"];

  return {
    ...fresh,
    regions,
    units,
    countryStates,
    regionEconomies: {
      ...fresh.regionEconomies,
      [REGION]: {
        population: 1000,
        stability: 100,
        recruitablePool: 1000,
        buildingSlots,
        facilities,
        fortification: undefined,
        resourceDeposits: [],
      },
    },
    countryStockpiles: {
      ...fresh.countryStockpiles,
      [COUNTRY]: {
        ...fresh.countryStockpiles[COUNTRY],
        oil: 100,
        coal: 100,
        iron: 100,
        tungsten: 100,
        food: 1000,
        chemicals: 100,
        steel: 100,
        fuel: 100,
        explosives: 100,
        fertilizer: 100,
        munitions: 100,
        energy: 100,
        tradePoints,
      },
    },
    economyBuildOrders: { ...fresh.economyBuildOrders, [COUNTRY]: pendingOrders },
    doctrineUpgrades: { ...fresh.doctrineUpgrades },
  };
}

function orders(state: GameState): EconomyBuildOrder[] {
  return state.economyBuildOrders[COUNTRY] ?? [];
}

/** The first unit stands in another region that has a working barracks and is held by `holder`. */
function withDamagedUnitAbroad(state: GameState, holder: CountryId): GameState {
  const regionId = Object.keys(state.regions).find((id) => id !== REGION)!;
  return {
    ...state,
    regions: {
      ...state.regions,
      [regionId]: { ...state.regions[regionId], controllerCountryId: holder, controllerBlocId: state.countries[holder].blocId },
    },
    regionEconomies: {
      ...state.regionEconomies,
      [regionId]: { ...state.regionEconomies[regionId], facilities: [{ ...facility("abroad-barracks", "barracks"), regionId }] },
    },
    units: { ...state.units, "test-inf-0": { ...state.units["test-inf-0"], regionId } },
  };
}

describe("aiEconomyTurn slot accounting", () => {
  it("does not choose a region whose only free slot is held by a pending build", () => {
    // No power plant exists; the old lookup would pick Bucharest even though the pending farm
    // build already occupies its single slot.
    const state = fixture({
      // The max-level barracks keeps later branches (barracks build, upgrades) quiet.
      facilities: [facility("barracks-1", "barracks", 3)],
      buildingSlots: 1,
      pendingOrders: [
        {
          id: "seed-farm",
          countryId: COUNTRY,
          regionId: REGION,
          type: "buildFacility",
          facilityType: "farm",
          turnsRemaining: 2,
          totalTurns: 2,
          committed: {},
        },
      ],
    });

    const next = aiEconomyTurn(state, COUNTRY);

    expect(orders(next)).toHaveLength(1);
  });
});

describe("aiEconomyTurn replenishment", () => {
  it("queues one replenish order for a damaged unit with its facility in the region", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks")],
      unitStrengths: [3],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const replenishOrders = orders(next).filter((order) => order.type === "replenishUnit");

    expect(replenishOrders).toHaveLength(1);
    expect(replenishOrders[0].unitId).toBe("test-inf-0");
    expect(replenishOrders[0].unitType).toBe("infantry");
    expect(Object.values(replenishOrders[0].committed).reduce((sum, value) => sum + (value ?? 0), 0)).toBeGreaterThan(0);
    expect(replenishOrders[0].turnsRemaining).toBeGreaterThanOrEqual(1);
  });

  it("does not replenish a unit in a region without the required facility", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm")],
      unitStrengths: [3],
    });

    const next = aiEconomyTurn(state, COUNTRY);

    expect(orders(next).filter((order) => order.type === "replenishUnit")).toHaveLength(0);
  });

  // Bucharest has its own barracks, so the AI has no reason to build one first; only the unit's
  // region (and who holds it) decides whether it gets replenished.
  const abroadFacilities = () => [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks", 3)];

  const replenishOrdersWhenHeldBy = (holder: CountryId) =>
    orders(aiEconomyTurn(withDamagedUnitAbroad(fixture({ facilities: abroadFacilities(), unitStrengths: [3] }), holder), COUNTRY)).filter(
      (order) => order.type === "replenishUnit"
    );

  it("does not replenish a unit standing in a neutral-held region", () => {
    expect(replenishOrdersWhenHeldBy(QUIET_CONTROLLER)).toHaveLength(0);
  });

  it("does not replenish a unit standing in an enemy-bloc region", () => {
    expect(replenishOrdersWhenHeldBy("RUSSIA")).toHaveLength(0);
  });

  it("replenishes that same unit in that same place once its country holds the region", () => {
    const replenishOrders = replenishOrdersWhenHeldBy(COUNTRY);

    expect(replenishOrders).toHaveLength(1);
    expect(replenishOrders[0].unitId).toBe("test-inf-0");
  });

  it("also replenishes it where an ally of the same bloc holds the region", () => {
    const replenishOrders = replenishOrdersWhenHeldBy("POLAND");

    expect(replenishOrders).toHaveLength(1);
    expect(replenishOrders[0].unitId).toBe("test-inf-0");
  });

  it("does not queue a second replenishment for an already pending unit", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks")],
      unitStrengths: [3],
      pendingOrders: [pendingReplenish("test-inf-0")],
    });

    const next = aiEconomyTurn(state, COUNTRY);

    expect(orders(next).filter((order) => order.type === "replenishUnit")).toHaveLength(1);
  });
});

describe("aiEconomyTurn civilian repair", () => {
  it("repairs a damaged civilian facility when nothing military is damaged", () => {
    const state = fixture({
      facilities: [
        facility("power-1", "powerPlant"),
        facility("farm-1", "farm", 1, true),
        facility("barracks-1", "barracks"),
      ],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const repairs = orders(next).filter((order) => order.type === "repairFacility");

    expect(repairs).toHaveLength(1);
    expect(repairs[0].facilityId).toBe("farm-1");
  });

  it("repairs a damaged military facility before a damaged civilian one", () => {
    const state = fixture({
      facilities: [
        facility("power-1", "powerPlant"),
        facility("barracks-1", "barracks", 1, true),
        facility("farm-1", "farm", 1, true),
      ],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const repairs = orders(next).filter((order) => order.type === "repairFacility");

    expect(repairs).toHaveLength(1);
    expect(repairs[0].facilityId).toBe("barracks-1");
  });
});

describe("aiEconomyTurn facility upgrades", () => {
  it("upgrades an eligible military facility once the force structure exists", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks")],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const upgrades = orders(next).filter((order) => order.type === "upgradeFacility" && order.id !== "seed-upgrade-pending");

    expect(upgrades).toHaveLength(1);
    expect(upgrades[0].facilityId).toBe("barracks-1");
    expect(Object.values(upgrades[0].committed).reduce((sum, value) => sum + (value ?? 0), 0)).toBeGreaterThan(0);
  });

  it("queues at most one upgrade per economy turn", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks")],
      // No pending order: both minor-tier queue slots are free, so without a per-turn cap the
      // second loop iteration would queue a second upgrade.
      pendingOrders: [],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const upgrades = orders(next).filter((order) => order.type === "upgradeFacility");

    expect(upgrades).toHaveLength(1);
  });

  it("does not upgrade a level-3 or damaged facility", () => {
    const state = fixture({
      facilities: [
        facility("power-1", "powerPlant", 3),
        facility("farm-1", "farm", 3),
        facility("barracks-1", "barracks", 1, true),
      ],
      // Already-pending repair keeps the damaged barracks out of the repair branch, so this case
      // isolates upgrade eligibility. One pending order also leaves one queue slot free.
      pendingOrders: [
        {
          id: "seed-repair-pending",
          countryId: COUNTRY,
          regionId: REGION,
          type: "repairFacility",
          facilityId: "barracks-1",
          turnsRemaining: 1,
          totalTurns: 1,
          committed: {},
        },
      ],
    });

    const next = aiEconomyTurn(state, COUNTRY);
    const upgrades = orders(next).filter(
      (order) => order.type === "upgradeFacility" && order.id !== "seed-upgrade-pending"
    );

    expect(upgrades).toHaveLength(0);
  });
});

describe("aiEconomyTurn doctrines", () => {
  it("buys at most one deterministic doctrine per call and never duplicates", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm")],
      tradePoints: 200,
    });

    const first = aiEconomyTurn(state, COUNTRY);
    expect(first.doctrineUpgrades?.[COUNTRY]).toEqual([DOCTRINE_DEFINITIONS[0].id]);

    const second = aiEconomyTurn(first, COUNTRY);
    const owned = second.doctrineUpgrades?.[COUNTRY] ?? [];
    expect(owned).toHaveLength(2);
    expect(new Set(owned).size).toBe(2);
    expect(owned[0]).toBe(DOCTRINE_DEFINITIONS[0].id);
  });

  it("buys the doctrine before it spends trade points on a civilian factory, on purpose", () => {
    const doctrine = DOCTRINE_DEFINITIONS[0];
    const quietEconomy = {
      facilities: [facility("power-1", "powerPlant", 3), facility("farm-1", "farm", 3), facility("barracks-1", "barracks", 3)],
      pendingOrders: [],
    };
    const isCivilianFactoryBuild = (order: EconomyBuildOrder) => order.facilityType === "civilianFactory";

    // Exactly the doctrine plus the AI's reserve: afterwards 11 trade points remain, too few (<= 12) for a factory.
    const tight = aiEconomyTurn(fixture({ ...quietEconomy, tradePoints: doctrine.cost + 11 }), COUNTRY);
    expect(tight.doctrineUpgrades?.[COUNTRY]).toEqual([doctrine.id]);
    expect(orders(tight).some(isCivilianFactoryBuild)).toBe(false);

    // Control: with trade points to spare the same economy does queue a civilian factory, so the check above can fail.
    const rich = aiEconomyTurn(fixture({ ...quietEconomy, tradePoints: doctrine.cost + 200 }), COUNTRY);
    expect(rich.doctrineUpgrades?.[COUNTRY]).toEqual([doctrine.id]);
    expect(orders(rich).some(isCivilianFactoryBuild)).toBe(true);
  });

  it("does not buy a doctrine whose cost plus the trade reserve is unaffordable", () => {
    const state = fixture({
      facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm")],
      tradePoints: 15,
    });

    const next = aiEconomyTurn(state, COUNTRY);

    expect(next.doctrineUpgrades?.[COUNTRY] ?? []).toHaveLength(0);
  });
});

describe("aiEconomyTurn determinism", () => {
  it("returns the same order shape for identical states", () => {
    const makeState = () =>
      fixture({
        facilities: [facility("power-1", "powerPlant"), facility("farm-1", "farm"), facility("barracks-1", "barracks")],
        unitStrengths: [3],
        tradePoints: 200,
      });

    const shape = (state: GameState) =>
      orders(state).map((order) => ({
        // Ids are included: the AI must not consume Math.random for them, or every added order
        // would shift the seeded balance harness's diplomacy random sequence.
        id: order.id,
        type: order.type,
        regionId: order.regionId,
        facilityType: order.facilityType,
        facilityId: order.facilityId,
        unitId: order.unitId,
      }));

    expect(shape(aiEconomyTurn(makeState(), COUNTRY))).toEqual(shape(aiEconomyTurn(makeState(), COUNTRY)));
  });
});
