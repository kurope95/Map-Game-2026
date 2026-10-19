import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import { evaluateWarEntryRules } from "./turnEngine";
import { DOCTRINE_DEFINITIONS } from "../content/doctrines";
import {
  FORTIFICATION_MAX_LEVEL,
  MAX_UNIT_STRENGTH,
  UNIT_RECRUITMENT_COSTS,
  getFacilityBuildRecipe,
  getFacilityRepairProfile,
  getFacilityUpgradeCost,
  getFortificationBuildProfile,
  getFortificationRepairProfile,
  getMilitaryProductionTurns,
  getReplenishmentCost,
} from "../content/economyRecipes";
import type { CountryId, CountryStockpile, Facility, GameState, RegionEconomy, RegionFortification } from "../state/types";
import {
  canAfford,
  canReplenishIn,
  cancelBuildOrder,
  demolishFacility,
  getBestOperationalFacility,
  getMissingResources,
  getOperationalFacilities,
  purchaseDoctrine,
  queueFacilityBuild,
  queueFacilityRepair,
  queueFacilityUpgrade,
  queueFortificationBuild,
  queueFortificationRepair,
  queueFortificationUpgrade,
  queueUnitRecruit,
  queueUnitReplenish,
  toggleChemicalMode,
  type ActionResult,
  type IdFactory,
} from "./playerActions";

const RU = "RUSSIA" as const;
const ids: IdFactory = (prefix) => `${prefix}-test`;
const fresh = () => evaluateWarEntryRules(createInitialState(RU)); // Russia acts first

function withStockpile(state: GameState, countryId: CountryId, amount: number): GameState {
  const stockpile = Object.fromEntries(Object.keys(state.countryStockpiles[countryId]).map((key) => [key, amount])) as unknown as CountryStockpile;
  return { ...state, countryStockpiles: { ...state.countryStockpiles, [countryId]: stockpile } };
}

function withEconomy(state: GameState, regionId: string, patch: Partial<RegionEconomy>): GameState {
  return { ...state, regionEconomies: { ...state.regionEconomies, [regionId]: { ...state.regionEconomies[regionId], ...patch } } };
}

function withFacility(state: GameState, regionId: string, facilityId: string, patch: Partial<Facility>): GameState {
  const economy = state.regionEconomies[regionId];
  return withEconomy(state, regionId, { facilities: economy.facilities.map((f) => (f.id === facilityId ? { ...f, ...patch } : f)) });
}

function withFort(state: GameState, regionId: string, fortification: RegionFortification | undefined): GameState {
  return withEconomy(state, regionId, { fortification });
}

function withUnit(state: GameState, unitId: string, patch: Partial<GameState["units"][string]>): GameState {
  return { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ...patch } } };
}

function expectOk(result: ActionResult): Extract<ActionResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected an ok result, got ${JSON.stringify(result)}`);
  return result;
}

const ordersOf = (state: GameState) => state.economyBuildOrders[RU] ?? [];

describe("canAfford and getMissingResources", () => {
  it("canAfford compares every cost key and is false without a stockpile", () => {
    const state = withStockpile(fresh(), RU, 5);
    expect(canAfford(state.countryStockpiles[RU], { steel: 5, iron: 2 })).toBe(true);
    expect(canAfford(state.countryStockpiles[RU], { steel: 6 })).toBe(false);
    expect(canAfford(state.countryStockpiles[RU], {})).toBe(true);
    expect(canAfford(undefined, {})).toBe(false);
  });

  it("getMissingResources lists the shortfall per resource", () => {
    const state = withStockpile(fresh(), RU, 3);
    expect(getMissingResources(state.countryStockpiles[RU], { steel: 5, iron: 2, coal: 10 })).toEqual(["2 steel", "7 coal"]);
    expect(getMissingResources(undefined, { steel: 5, iron: 2 })).toEqual(["steel", "iron"]);
  });
});

describe("getOperationalFacilities", () => {
  it("returns undamaged facilities of one type, highest level first", () => {
    let state = fresh();
    const extra: Facility[] = [
      { id: "b-low", type: "barracks", level: 1, regionId: "moscow", damaged: false },
      { id: "b-broken", type: "barracks", level: 3, regionId: "moscow", damaged: true },
    ];
    state = withEconomy(state, "moscow", { facilities: [...state.regionEconomies.moscow.facilities, ...extra] });
    expect(getOperationalFacilities(state, "moscow", "barracks").map((f) => f.id)).toEqual(["fac-moscow-barracks", "b-low"]);
    expect(getBestOperationalFacility(state, "moscow", "barracks")?.id).toBe("fac-moscow-barracks");
    expect(getBestOperationalFacility(state, "moscow", "airFactory")).toBeNull();
    expect(getOperationalFacilities(state, "atlantis", "barracks")).toEqual([]);
  });
});

describe("queueFacilityBuild", () => {
  it("queues a farm in Moscow and deducts nothing beyond the recipe cost", () => {
    const recipe = getFacilityBuildRecipe("farm")!;
    const state = withStockpile(fresh(), RU, 999);
    const result = expectOk(queueFacilityBuild(state, RU, "moscow", "farm", ids));
    expect(ordersOf(result.state)).toHaveLength(1);
    expect(ordersOf(result.state)[0]).toEqual({
      id: "build-test",
      countryId: RU,
      regionId: "moscow",
      type: "buildFacility",
      facilityType: "farm",
      turnsRemaining: recipe.turns,
      totalTurns: recipe.turns,
      committed: recipe.cost,
    });
    for (const [key, cost] of Object.entries(recipe.cost)) {
      expect(result.state.countryStockpiles[RU][key as keyof CountryStockpile]).toBe(999 - (cost ?? 0));
    }
    expect(result.toast).toBeUndefined();
  });

  it("deducts the full cost of a facility that is not free (smelter)", () => {
    const recipe = getFacilityBuildRecipe("smelter")!;
    const state = withStockpile(fresh(), RU, 999);
    const result = expectOk(queueFacilityBuild(state, RU, "moscow", "smelter", ids));
    expect(recipe.cost).toEqual({ iron: 2, coal: 2 });
    expect(result.state.countryStockpiles[RU].iron).toBe(997);
    expect(result.state.countryStockpiles[RU].coal).toBe(997);
    expect(result.state.countryStockpiles[RU].steel).toBe(999);
    expect(ordersOf(result.state)[0].committed).toEqual({ iron: 2, coal: 2 });
  });

  it("does not mutate the state it was given", () => {
    const state = withStockpile(fresh(), RU, 999);
    const snapshot = structuredClone(state);
    queueFacilityBuild(state, RU, "moscow", "smelter", ids);
    expect(state).toEqual(snapshot);
  });

  it("uses the old order id format by default", () => {
    const state = withStockpile(fresh(), RU, 999);
    const order = ordersOf(expectOk(queueFacilityBuild(state, RU, "moscow", "farm")).state)[0];
    expect(order.id).toMatch(/^build-\d+-[a-z0-9]{1,4}$/);
  });

  it("fails silently when it is not the country's turn", () => {
    const state = withStockpile({ ...fresh(), currentActorId: "GERMANY" }, RU, 999);
    expect(queueFacilityBuild(state, RU, "moscow", "farm", ids)).toEqual({ ok: false });
  });

  it("fails silently for a region the country does not control", () => {
    const state = withStockpile(fresh(), RU, 999);
    expect(queueFacilityBuild(state, RU, "berlin", "farm", ids)).toEqual({ ok: false });
  });

  it("fails silently when every building slot is used", () => {
    const base = withStockpile(fresh(), RU, 999);
    const state = withEconomy(base, "moscow", { buildingSlots: base.regionEconomies.moscow.facilities.length });
    expect(queueFacilityBuild(state, RU, "moscow", "farm", ids)).toEqual({ ok: false });
  });

  it("counts queued builds against the building slots", () => {
    const base = withStockpile(fresh(), RU, 999);
    const state = withEconomy(base, "moscow", { buildingSlots: base.regionEconomies.moscow.facilities.length + 1 });
    const first = expectOk(queueFacilityBuild(state, RU, "moscow", "farm", ids));
    expect(queueFacilityBuild(first.state, RU, "moscow", "mine", ids)).toEqual({ ok: false });
  });

  it("fails silently when the stockpile cannot pay", () => {
    const state = withStockpile(fresh(), RU, 0);
    expect(queueFacilityBuild(state, RU, "moscow", "smelter", ids)).toEqual({ ok: false });
  });
});

describe("queueFacilityUpgrade", () => {
  it("queues an upgrade of the Moscow barracks at its upgrade cost", () => {
    const barracks = fresh().regionEconomies.moscow.facilities.find((f) => f.id === "fac-moscow-barracks")!;
    const cost = getFacilityUpgradeCost("barracks", barracks.level)!;
    const recipe = getFacilityBuildRecipe("barracks")!;
    const state = withStockpile(fresh(), RU, 999);
    const result = expectOk(queueFacilityUpgrade(state, RU, "moscow", "fac-moscow-barracks", ids));
    expect(ordersOf(result.state)[0]).toEqual({
      id: "upgrade-test",
      countryId: RU,
      regionId: "moscow",
      type: "upgradeFacility",
      facilityId: "fac-moscow-barracks",
      turnsRemaining: recipe.turns,
      totalTurns: recipe.turns,
      committed: cost,
    });
    expect(result.state.countryStockpiles[RU].steel).toBe(999 - (cost.steel ?? 0));
  });

  it("queues a free upgrade of Moscow's farm", () => {
    const state = withStockpile(fresh(), RU, 999);
    const result = expectOk(queueFacilityUpgrade(state, RU, "moscow", "seed-russia-farm", ids));
    expect(ordersOf(result.state)[0].facilityId).toBe("seed-russia-farm");
  });

  it("fails silently when the facility is damaged, maxed, unknown, already queued or unaffordable", () => {
    const rich = withStockpile(fresh(), RU, 999);
    expect(queueFacilityUpgrade(withFacility(rich, "moscow", "seed-russia-farm", { damaged: true }), RU, "moscow", "seed-russia-farm", ids)).toEqual({ ok: false });
    expect(queueFacilityUpgrade(withFacility(rich, "moscow", "fac-moscow-barracks", { level: 3 }), RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
    expect(queueFacilityUpgrade(rich, RU, "moscow", "no-such-facility", ids)).toEqual({ ok: false });
    const queued = expectOk(queueFacilityUpgrade(rich, RU, "moscow", "fac-moscow-barracks", ids));
    expect(queueFacilityUpgrade(queued.state, RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
    expect(queueFacilityUpgrade(withStockpile(fresh(), RU, 0), RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
  });

  it("fails silently when it is not the country's turn or the region is not its own", () => {
    const rich = withStockpile(fresh(), RU, 999);
    expect(queueFacilityUpgrade({ ...rich, currentActorId: "GERMANY" }, RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
    expect(queueFacilityUpgrade(rich, RU, "berlin", "fac-moscow-barracks", ids)).toEqual({ ok: false });
  });
});

describe("queueFacilityRepair", () => {
  it("fails silently when the facility is not damaged", () => {
    const state = withStockpile(fresh(), RU, 999);
    expect(queueFacilityRepair(state, RU, "moscow", "seed-russia-farm", ids)).toEqual({ ok: false });
  });

  it("queues a repair of a damaged barracks at its repair cost", () => {
    const base = withStockpile(fresh(), RU, 999);
    const state = withFacility(base, "moscow", "fac-moscow-barracks", { damaged: true });
    const profile = getFacilityRepairProfile("barracks", 2)!;
    const result = expectOk(queueFacilityRepair(state, RU, "moscow", "fac-moscow-barracks", ids));
    expect(ordersOf(result.state)[0]).toEqual({
      id: "repair-test",
      countryId: RU,
      regionId: "moscow",
      type: "repairFacility",
      facilityId: "fac-moscow-barracks",
      turnsRemaining: profile.turns,
      totalTurns: profile.turns,
      committed: profile.cost,
    });
    expect(result.state.countryStockpiles[RU].steel).toBe(999 - (profile.cost.steel ?? 0));
    expect(queueFacilityRepair(result.state, RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
  });

  it("fails silently when the repair cannot be paid", () => {
    const state = withFacility(withStockpile(fresh(), RU, 0), "moscow", "fac-moscow-barracks", { damaged: true });
    expect(queueFacilityRepair(state, RU, "moscow", "fac-moscow-barracks", ids)).toEqual({ ok: false });
  });
});

describe("fortifications", () => {
  const fort = (level: number, health: number): RegionFortification => ({ level, health, maxHealth: 10, damaged: health < 10 });

  it("queues a level 1 fortification when the region has none", () => {
    const profile = getFortificationBuildProfile(1)!;
    const state = withFort(withStockpile(fresh(), RU, 999), "moscow", undefined);
    const result = expectOk(queueFortificationBuild(state, RU, "moscow", ids));
    expect(ordersOf(result.state)[0]).toEqual({
      id: "fort-build-test",
      countryId: RU,
      regionId: "moscow",
      type: "buildFortification",
      turnsRemaining: profile.turns,
      totalTurns: profile.turns,
      committed: profile.cost,
    });
    expect(result.state.countryStockpiles[RU].steel).toBe(999 - (profile.cost.steel ?? 0));
    expect(queueFortificationBuild(result.state, RU, "moscow", ids)).toEqual({ ok: false });
  });

  it("does not queue a build where a fortification already stands", () => {
    const state = withFort(withStockpile(fresh(), RU, 999), "moscow", fort(1, 10));
    expect(queueFortificationBuild(state, RU, "moscow", ids)).toEqual({ ok: false });
  });

  it("upgrades a level 1 fortification at the level 2 cost but not past the maximum", () => {
    const profile = getFortificationBuildProfile(2)!;
    const state = withFort(withStockpile(fresh(), RU, 999), "moscow", fort(1, 10));
    const result = expectOk(queueFortificationUpgrade(state, RU, "moscow", ids));
    expect(ordersOf(result.state)[0]).toMatchObject({ id: "fort-upgrade-test", type: "upgradeFortification", turnsRemaining: profile.turns, committed: profile.cost });
    const maxed = withFort(withStockpile(fresh(), RU, 999), "moscow", fort(FORTIFICATION_MAX_LEVEL, 10));
    expect(queueFortificationUpgrade(maxed, RU, "moscow", ids)).toEqual({ ok: false });
    expect(queueFortificationUpgrade(withFort(withStockpile(fresh(), RU, 999), "moscow", undefined), RU, "moscow", ids)).toEqual({ ok: false });
  });

  it("repairs a damaged fortification and refuses a healthy one", () => {
    const profile = getFortificationRepairProfile(1, 4, 10)!;
    const state = withFort(withStockpile(fresh(), RU, 999), "moscow", fort(1, 4));
    const result = expectOk(queueFortificationRepair(state, RU, "moscow", ids));
    expect(ordersOf(result.state)[0]).toMatchObject({ id: "fort-repair-test", type: "repairFortification", turnsRemaining: profile.turns, committed: profile.cost });
    expect(queueFortificationRepair(withFort(withStockpile(fresh(), RU, 999), "moscow", fort(1, 10)), RU, "moscow", ids)).toEqual({ ok: false });
    expect(queueFortificationRepair({ ...state, currentActorId: "GERMANY" }, RU, "moscow", ids)).toEqual({ ok: false });
  });
});

describe("demolishFacility", () => {
  it("removes the facility from the region", () => {
    const result = expectOk(demolishFacility(fresh(), RU, "moscow", "seed-russia-farm"));
    expect(result.state.regionEconomies.moscow.facilities.map((f) => f.id)).not.toContain("seed-russia-farm");
    expect(result.state.regionEconomies.moscow.facilities).toHaveLength(fresh().regionEconomies.moscow.facilities.length - 1);
  });

  it("fails silently when it is not the country's turn, the region is foreign or the facility is unknown", () => {
    expect(demolishFacility({ ...fresh(), currentActorId: "GERMANY" }, RU, "moscow", "seed-russia-farm")).toEqual({ ok: false });
    expect(demolishFacility(fresh(), RU, "berlin", "seed-russia-farm")).toEqual({ ok: false });
    expect(demolishFacility(fresh(), RU, "moscow", "no-such-facility")).toEqual({ ok: false });
  });
});

describe("queueUnitRecruit", () => {
  it("queues infantry at the barracks with production time reduced by its level", () => {
    const recipe = UNIT_RECRUITMENT_COSTS.find((r) => r.unitType === "infantry")!;
    const barracks = fresh().regionEconomies.moscow.facilities.find((f) => f.type === "barracks")!;
    const turns = getMilitaryProductionTurns(recipe.turns, barracks.level);
    const state = withStockpile(fresh(), RU, 999);
    const result = expectOk(queueUnitRecruit(state, RU, "moscow", "infantry", ids));
    expect(ordersOf(result.state)[0]).toEqual({
      id: "recruit-test",
      countryId: RU,
      regionId: "moscow",
      type: "recruitUnit",
      unitType: "infantry",
      turnsRemaining: turns,
      totalTurns: turns,
      committed: recipe.cost,
    });
    expect(result.state.countryStockpiles[RU].steel).toBe(999 - (recipe.cost.steel ?? 0));
  });

  it("fails silently without the required facility, funds, turn or ownership", () => {
    const rich = withStockpile(fresh(), RU, 999);
    expect(queueUnitRecruit(rich, RU, "moscow", "bomber", ids)).toEqual({ ok: false }); // Moscow has no air factory
    expect(queueUnitRecruit(withStockpile(fresh(), RU, 0), RU, "moscow", "infantry", ids)).toEqual({ ok: false });
    expect(queueUnitRecruit({ ...rich, currentActorId: "GERMANY" }, RU, "moscow", "infantry", ids)).toEqual({ ok: false });
    expect(queueUnitRecruit(rich, RU, "berlin", "infantry", ids)).toEqual({ ok: false });
  });
});

describe("queueUnitReplenish", () => {
  const INFANTRY = "ru-inf-2"; // Russian infantry in Moscow
  const weak = (state: GameState) => withUnit(state, INFANTRY, { strength: 3 });

  it("tells the player a full-strength unit needs nothing", () => {
    const state = withUnit(fresh(), INFANTRY, { strength: MAX_UNIT_STRENGTH.infantry });
    expect(queueUnitReplenish(state, RU, INFANTRY, ids)).toEqual({ ok: false, toast: { message: "Unit is already at full strength", tone: "info" } });
  });

  /** The unit stands in `regionId`, which has a working barracks, so only the region's holder can be the problem. */
  const stationedIn = (state: GameState, regionId: string): GameState => {
    const barracks: Facility = { id: `${regionId}-test-barracks`, type: "barracks", level: 1, regionId, damaged: false };
    const economy = state.regionEconomies[regionId];
    return withUnit(withEconomy(state, regionId, { facilities: [...economy.facilities, barracks] }), INFANTRY, { regionId });
  };

  it("refuses a unit standing in an enemy-held region, even beside a working barracks", () => {
    const state = withStockpile(stationedIn(weak(fresh()), "berlin"), RU, 999);
    expect(state.regions.berlin.controllerBlocId).not.toBe(state.countries[RU].blocId);
    expect(queueUnitReplenish(state, RU, INFANTRY, ids)).toEqual({
      ok: false,
      toast: { message: "Replenishing needs a region held by your country or your bloc (Berlin)", tone: "warning" },
    });
  });

  it("refuses a unit standing in a neutral-held region", () => {
    const base = fresh();
    const neutralRegion = Object.values(base.regions).find((region) => base.countries[region.controllerCountryId].blocId === "NEUTRAL")!;
    const state = withStockpile(stationedIn(weak(base), neutralRegion.id), RU, 999);
    expect(queueUnitReplenish(state, RU, INFANTRY, ids)).toEqual({
      ok: false,
      toast: { message: `Replenishing needs a region held by your country or your bloc (${neutralRegion.name})`, tone: "warning" },
    });
  });

  it("allows a region held by an ally of the same bloc, like Tiraspol for Russia", () => {
    const state = withStockpile(stationedIn(weak(fresh()), "chisinau-pridnestrovie"), RU, 999);
    expect(state.regions["chisinau-pridnestrovie"].controllerCountryId).toBe("PRIDNESTROVIE");
    const result = expectOk(queueUnitReplenish(state, RU, INFANTRY, ids));
    expect(ordersOf(result.state)[0]).toMatchObject({ type: "replenishUnit", unitId: INFANTRY, regionId: "chisinau-pridnestrovie" });
  });

  it("gives a neutral country only the regions it holds itself, since a neutral bloc is not an alliance", () => {
    const base = fresh();
    const neutral = Object.values(base.countries).find((country) => country.blocId === "NEUTRAL")!;
    const otherNeutralRegion = Object.values(base.regions).find(
      (region) => region.controllerCountryId !== neutral.id && base.countries[region.controllerCountryId].blocId === "NEUTRAL"
    )!;
    expect(canReplenishIn(base, neutral.id, otherNeutralRegion.id)).toBe(false);
    expect(canReplenishIn(base, neutral.id, neutral.capitalRegionId)).toBe(true);
  });

  it("asks for the required facility in the unit's region", () => {
    const state = withEconomy(weak(fresh()), "moscow", { facilities: [] });
    expect(queueUnitReplenish(state, RU, INFANTRY, ids)).toEqual({ ok: false, toast: { message: "Requires a barracks in Moscow", tone: "warning" } });
  });

  it("names the first resource the stockpile is short of", () => {
    const state = withStockpile(weak(fresh()), RU, 0);
    const replenish = getReplenishmentCost("infantry", 3, 2)!;
    const [firstKey, firstAmount] = Object.entries(replenish.cost)[0];
    expect(queueUnitReplenish(state, RU, INFANTRY, ids)).toEqual({
      ok: false,
      toast: { message: `Not enough ${firstKey} (need ${firstAmount}, have 0)`, tone: "warning" },
    });
  });

  it("queues the replenish order, takes its cost and reports it", () => {
    const state = withStockpile(weak(fresh()), RU, 999);
    const replenish = getReplenishmentCost("infantry", 3, 2)!;
    const costText = Object.entries(replenish.cost).map(([k, v]) => `${v} ${k}`).join(", ");
    const result = expectOk(queueUnitReplenish(state, RU, INFANTRY, ids));
    expect(ordersOf(result.state)[0]).toEqual({
      id: "replenish-test",
      countryId: RU,
      regionId: "moscow",
      type: "replenishUnit",
      unitId: INFANTRY,
      unitType: "infantry",
      turnsRemaining: replenish.turns,
      totalTurns: replenish.turns,
      committed: replenish.cost,
    });
    expect(result.toast).toEqual({ message: `Replenishing infantry (${replenish.turns} turns, cost: ${costText})`, tone: "success" });
    expect(result.state.countryStockpiles[RU].steel).toBe(999 - (replenish.cost.steel ?? 0));
  });

  it("refuses to queue the same unit twice", () => {
    const state = withStockpile(weak(fresh()), RU, 999);
    const first = expectOk(queueUnitReplenish(state, RU, INFANTRY, ids));
    expect(queueUnitReplenish(first.state, RU, INFANTRY, ids)).toEqual({ ok: false, toast: { message: "This unit is already being replenished", tone: "info" } });
  });

  it("stays silent for another country's unit or an unknown unit and does not need the country's turn", () => {
    const state = withStockpile(weak({ ...fresh(), currentActorId: "GERMANY" }), RU, 999);
    expect(queueUnitReplenish(state, "GERMANY", INFANTRY, ids)).toEqual({ ok: false });
    expect(queueUnitReplenish(state, RU, "no-such-unit", ids)).toEqual({ ok: false });
    expect(queueUnitReplenish(state, RU, INFANTRY, ids).ok).toBe(true); // replenish ignores whose turn it is
  });
});

describe("cancelBuildOrder", () => {
  it("removes the order and refunds exactly what was committed", () => {
    const before = withStockpile(fresh(), RU, 999);
    const built = expectOk(queueFacilityBuild(before, RU, "moscow", "smelter", ids));
    expect(built.state.countryStockpiles[RU].iron).toBe(997);
    const cancelled = expectOk(cancelBuildOrder(built.state, RU, "build-test"));
    expect(cancelled.state.countryStockpiles[RU]).toEqual(before.countryStockpiles[RU]);
    expect(ordersOf(cancelled.state)).toEqual([]);
  });

  it("fails silently for an unknown order id", () => {
    expect(cancelBuildOrder(fresh(), RU, "nope")).toEqual({ ok: false });
  });
});

describe("purchaseDoctrine", () => {
  const free = DOCTRINE_DEFINITIONS.find((d) => !d.requires?.length)!;
  const withReq = DOCTRINE_DEFINITIONS.find((d) => d.requires?.length)!;

  it("asks for a missing prerequisite by name", () => {
    const state = withStockpile(fresh(), RU, 999);
    const prerequisite = DOCTRINE_DEFINITIONS.find((d) => d.id === withReq.requires![0])!;
    expect(purchaseDoctrine(state, RU, withReq.id)).toEqual({ ok: false, toast: { message: `Requires: ${prerequisite.name}`, tone: "warning" } });
  });

  it("reports missing trade points", () => {
    const state = { ...fresh(), countryStockpiles: { ...fresh().countryStockpiles, [RU]: { ...fresh().countryStockpiles[RU], tradePoints: 0 } } };
    expect(purchaseDoctrine(state, RU, free.id)).toEqual({
      ok: false,
      toast: { message: `Insufficient trade points (need ${free.cost}, have 0)`, tone: "warning" },
    });
  });

  it("buys a doctrine, deducts its cost and refuses a second purchase", () => {
    const state = withStockpile(fresh(), RU, 999);
    const bought = expectOk(purchaseDoctrine(state, RU, free.id));
    expect(bought.toast).toEqual({ message: `Doctrine unlocked: ${free.name}`, tone: "success" });
    expect(bought.state.countryStockpiles[RU].tradePoints).toBe(999 - free.cost);
    expect(bought.state.doctrineUpgrades[RU]).toContain(free.id);
    expect(purchaseDoctrine(bought.state, RU, free.id)).toEqual({ ok: false, toast: { message: "Doctrine already unlocked", tone: "info" } });
  });

  it("unlocks a doctrine once its prerequisite is owned, and ignores an unknown doctrine silently", () => {
    let state = withStockpile(fresh(), RU, 999);
    state = expectOk(purchaseDoctrine(state, RU, withReq.requires![0])).state;
    expect(expectOk(purchaseDoctrine(state, RU, withReq.id)).state.doctrineUpgrades[RU]).toContain(withReq.id);
    expect(purchaseDoctrine(state, RU, "not_a_doctrine" as never)).toEqual({ ok: false });
  });
});

describe("toggleChemicalMode", () => {
  const plant: Facility = { id: "chem-test", type: "chemicalPlant", level: 1, regionId: "moscow", damaged: false };
  const withPlant = () => {
    const state = fresh();
    return withEconomy(state, "moscow", { facilities: [...state.regionEconomies.moscow.facilities, plant] });
  };

  it("switches an unset mode to explosives and then to fertilizer", () => {
    const first = expectOk(toggleChemicalMode(withPlant(), "moscow", "chem-test"));
    expect(first.state.regionEconomies.moscow.facilities.find((f) => f.id === "chem-test")?.chemicalMode).toBe("explosives");
    const second = expectOk(toggleChemicalMode(first.state, "moscow", "chem-test"));
    expect(second.state.regionEconomies.moscow.facilities.find((f) => f.id === "chem-test")?.chemicalMode).toBe("fertilizer");
  });

  it("fails silently for an unknown facility or region", () => {
    expect(toggleChemicalMode(withPlant(), "moscow", "no-such-facility")).toEqual({ ok: false });
    expect(toggleChemicalMode(withPlant(), "atlantis", "chem-test")).toEqual({ ok: false });
  });
});
