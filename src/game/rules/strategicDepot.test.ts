import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/createInitialState";
import type { BlocId, CountryId, GameState } from "../state/types";
import { getPridnestrovieDepotStatus, hasBlocPathToRegion } from "./strategicDepot";

const DEPOT_REGION_ID = "chisinau-pridnestrovie";

function withController(state: GameState, regionId: string, countryId: CountryId, blocId: BlocId): GameState {
  return {
    ...state,
    regions: { ...state.regions, [regionId]: { ...state.regions[regionId], controllerCountryId: countryId, controllerBlocId: blocId } },
  };
}

function everyRegionTo(state: GameState, countryId: CountryId, blocId: BlocId): GameState {
  return Object.keys(state.regions).reduce((next, regionId) => withController(next, regionId, countryId, blocId), state);
}

describe("getPridnestrovieDepotStatus", () => {
  it("is locked at the start of the scenario", () => {
    expect(getPridnestrovieDepotStatus(createInitialState("RUSSIA"))).toEqual({
      tone: "locked",
      label: "Locked",
      detail: "One bloc must control both Tiraspol and Odesa.",
    });
  });

  it("is claimed once the depot has been seized", () => {
    const state = createInitialState("RUSSIA");
    const claimed = { ...state, history: { ...state.history, claimedStrategicDepots: [...state.history.claimedStrategicDepots, "pridnestrovie-depot"] } };
    expect(getPridnestrovieDepotStatus(claimed)).toEqual({
      tone: "claimed",
      label: "Claimed",
      detail: "The depot has already been seized.",
    });
  });

  it("needs a bridge when the claimant has no land path to Tiraspol", () => {
    let state = createInitialState("RUSSIA");
    state = withController(state, "odesa", "RUSSIA", "BRICS");
    state = withController(state, "moscow", "GERMANY", "EU_NATO");
    expect(getPridnestrovieDepotStatus(state)).toEqual({
      tone: "locked",
      label: "Bridge Needed",
      detail: "A land path from the claimant capital to Tiraspol is required.",
    });
  });

  it("is claimable when the claimant's bloc holds a land path", () => {
    const state = everyRegionTo(createInitialState("RUSSIA"), "RUSSIA", "BRICS");
    expect(getPridnestrovieDepotStatus(state)).toEqual({
      tone: "claimable",
      label: "Claimable",
      detail: "Russia can now seize the depot.",
    });
  });

  it("is unavailable when the depot or Odesa region does not exist", () => {
    const state = createInitialState("RUSSIA");
    const { odesa: _removed, ...regions } = state.regions;
    expect(getPridnestrovieDepotStatus({ ...state, regions })).toEqual({
      tone: "locked",
      label: "Unavailable",
      detail: "Depot region is not present.",
    });
  });

  it("is locked when the claimant's own bloc differs from the depot bloc", () => {
    let state = createInitialState("RUSSIA");
    state = withController(state, DEPOT_REGION_ID, "RUSSIA", "EU_NATO");
    state = withController(state, "odesa", "RUSSIA", "EU_NATO");
    expect(getPridnestrovieDepotStatus(state)).toEqual({
      tone: "locked",
      label: "Locked",
      detail: "The current claimant does not match the depot bloc.",
    });
  });
});

describe("hasBlocPathToRegion", () => {
  it("finds a path through regions of the country's bloc", () => {
    const state = everyRegionTo(createInitialState("RUSSIA"), "RUSSIA", "BRICS");
    expect(hasBlocPathToRegion(state, "RUSSIA", DEPOT_REGION_ID)).toBe(true);
  });

  it("finds no path when the capital is held by another bloc", () => {
    const state = withController(everyRegionTo(createInitialState("RUSSIA"), "RUSSIA", "BRICS"), "moscow", "GERMANY", "EU_NATO");
    expect(hasBlocPathToRegion(state, "RUSSIA", DEPOT_REGION_ID)).toBe(false);
  });

  it("finds no path to a region that does not exist", () => {
    expect(hasBlocPathToRegion(createInitialState("RUSSIA"), "RUSSIA", "atlantis")).toBe(false);
  });
});
