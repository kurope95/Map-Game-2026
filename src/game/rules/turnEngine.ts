import {
  BlocId,
  CountryDefinition,
  CountryId,
  CountryStockpile,
  GameState,
  RegionDefinition,
  ThresholdCondition,
  ThresholdEventRule
} from "../state/types";
import { resetAllyTargetClaims } from "../ai/allyCoordination";
import { resolveOrders } from "./orderResolution";
import { processEconomy } from "./economyEngine";
import { hasBlocPathToRegion } from "./strategicDepot";

function getControllerBlocId(state: GameState, controllerCountryId: CountryId): BlocId | undefined {
  return state.countries[controllerCountryId].blocId;
}

function appendUnique<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items : [...items, value];
}

function getCountryKeyCitiesEverLost(state: GameState, countryId: CountryId): number {
  return state.history.capturedMajorKeyCities.filter((regionId) =>
    state.countries[countryId].keyRegionIds.includes(regionId)
  ).length;
}

function hasCountryCapitalEverLost(state: GameState, countryId: CountryId): boolean {
  return state.history.capturedMajorCapitals.includes(state.countries[countryId].capitalRegionId);
}

function isCountryDefeated(state: GameState, countryId: CountryId): boolean {
  const country = state.countries[countryId];
  if (country.tier === "major" || country.tier === "middle") {
    const controlsCapital = state.regions[country.capitalRegionId]?.controllerCountryId === countryId;
    const controlledKeyCities = country.keyRegionIds.filter(
      (regionId) => state.regions[regionId]?.controllerCountryId === countryId
    ).length;
    return !controlsCapital && controlledKeyCities === 0;
  }

  return country.startingRegionIds.every((regionId) => state.regions[regionId]?.controllerCountryId !== countryId);
}

function updateWarHistoryForRegion(state: GameState, region: RegionDefinition): GameState {
  const homeCountry = state.countries[region.homeCountryId];
  const controllerBlocId = getControllerBlocId(state, region.controllerCountryId);
  const hasEnemyControl =
    Boolean(homeCountry.blocId) &&
    Boolean(controllerBlocId) &&
    homeCountry.blocId !== controllerBlocId;

  if (!hasEnemyControl) {
    return state;
  }

  let history = state.history;

  if (homeCountry.tier === "major" && region.isCapital) {
    history = {
      ...history,
      capturedMajorCapitals: appendUnique(history.capturedMajorCapitals, region.id)
    };
  }

  if (homeCountry.tier === "major" && region.isKeyCity) {
    history = {
      ...history,
      capturedMajorKeyCities: appendUnique(history.capturedMajorKeyCities, region.id)
    };
  }

  const countryStartingRegions = homeCountry.startingRegionIds;
  const countryEliminated = countryStartingRegions.every((regionId) => {
    const currentRegion = state.regions[regionId];
    return currentRegion.controllerCountryId !== homeCountry.id;
  });

  if (homeCountry.tier === "minor" && countryEliminated) {
    history = {
      ...history,
      eliminatedMinorPowers: appendUnique(history.eliminatedMinorPowers, homeCountry.id)
    };
  }

  return history === state.history ? state : { ...state, history };
}

function evaluateCondition(state: GameState, condition: ThresholdCondition): boolean {
  switch (condition.metric) {
    case "minor_powers_eliminated":
      return state.history.eliminatedMinorPowers.length >= condition.value;
    case "major_power_key_cities_captured":
      return state.history.capturedMajorKeyCities.length >= condition.value;
    case "major_power_capitals_captured":
      return state.history.capturedMajorCapitals.length >= condition.value;
    case "different_major_powers_key_cities_captured":
      return new Set(
        state.history.capturedMajorKeyCities.map((regionId) => state.regions[regionId]?.homeCountryId).filter(Boolean)
      ).size >= condition.value;
    case "country_key_cities_lost":
      return condition.countryId !== undefined
        ? state.countries[condition.countryId].tier === "major"
          ? getCountryKeyCitiesEverLost(state, condition.countryId) >= condition.value
          : state.countries[condition.countryId].keyRegionIds.filter((regionId) => {
              const region = state.regions[regionId];
              return region.controllerCountryId !== condition.countryId;
            }).length >= condition.value
        : false;
    case "country_capitals_lost":
      return condition.countryId !== undefined
        ? state.countries[condition.countryId].tier === "major"
          ? hasCountryCapitalEverLost(state, condition.countryId)
          : state.regions[state.countries[condition.countryId].capitalRegionId].controllerCountryId !==
              condition.countryId
        : false;
    case "country_regions_lost":
      return condition.countryId !== undefined
        ? state.countries[condition.countryId].startingRegionIds.filter((regionId) => {
            const region = state.regions[regionId];
            return region.controllerCountryId !== condition.countryId;
          }).length >= condition.value
        : false;
    case "country_defeated":
      return condition.countryId !== undefined
        ? state.history.defeatedCountries.includes(condition.countryId)
        : false;
  }
}

function evaluateThresholdRule(state: GameState, rule: ThresholdEventRule): boolean {
  return rule.threshold.conditions.some((condition) => evaluateCondition(state, condition));
}

function activateCountry(state: GameState, country: CountryDefinition, reason: string): GameState {
  const existingState = state.countryStates[country.id];
  if (existingState.atWar || existingState.defeatedOnTurn !== undefined) {
    return state;
  }

  const turnOrder = state.turnOrder.includes(country.id) ? state.turnOrder : [...state.turnOrder, country.id];

  return {
    ...state,
    countryStates: {
      ...state.countryStates,
      [country.id]: {
        ...existingState,
        atWar: true,
        activatedOnTurn: state.turn
      }
    },
    turnOrder,
    eventLog: [...state.eventLog, `${country.name} entered the war on turn ${state.turn}: ${reason}`]
  };
}

function defeatCountry(state: GameState, countryId: CountryId, conquerorCountryId: CountryId): GameState {
  if (state.history.defeatedCountries.includes(countryId)) {
    return state;
  }

  const country = state.countries[countryId];
  const conquerorBlocId = getControllerBlocId(state, conquerorCountryId);
  const updatedRegions: Record<string, RegionDefinition> = { ...state.regions };

  for (const region of Object.values(state.regions)) {
    if (region.controllerCountryId !== countryId) continue;
    updatedRegions[region.id] = {
      ...region,
      controllerCountryId: conquerorCountryId,
      controllerBlocId: conquerorBlocId
    };
  }

  const remainingUnits = Object.fromEntries(
    Object.entries(state.units).filter(([, unit]) => unit.countryId !== countryId)
  ) as GameState["units"];

  const updatedCountryStates = {
    ...state.countryStates,
    [countryId]: {
      ...state.countryStates[countryId],
      atWar: false,
      defeatedOnTurn: state.turn
    }
  };

  const updatedHistory = {
    ...state.history,
    defeatedCountries: appendUnique(state.history.defeatedCountries, countryId),
    eliminatedMinorPowers:
      country.tier === "minor"
        ? appendUnique(state.history.eliminatedMinorPowers, countryId)
        : state.history.eliminatedMinorPowers
  };

  const updatedStockpiles = {
    ...state.countryStockpiles,
    [countryId]: {
      ...state.countryStockpiles[countryId],
      oil: 0,
      coal: 0,
      iron: 0,
      tungsten: 0,
      food: 0,
      chemicals: 0,
      steel: 0,
      fuel: 0,
      explosives: 0,
      fertilizer: 0,
      munitions: 0,
      energy: 0,
      textiles: 0,
      electronics: 0,
      vehicles: 0,
      pharmaceuticals: 0,
      luxuryGoods: 0,
      weed: 0,
      tradePoints: 0
    }
  };

  return {
    ...state,
    regions: updatedRegions,
    units: remainingUnits,
    turnOrder: state.turnOrder.filter((id) => id !== countryId),
    countryStates: updatedCountryStates,
    pendingOrders: {
      ...state.pendingOrders,
      [countryId]: []
    },
    economyBuildOrders: {
      ...state.economyBuildOrders,
      [countryId]: []
    },
    countryStockpiles: updatedStockpiles,
    history: updatedHistory,
    eventLog: [
      ...state.eventLog,
      `${country.name} has been defeated. ${state.countries[conquerorCountryId].name} absorbs all remaining ${country.name} holdings.`
    ]
  };
}

function applyCountryDefeatIfNeeded(state: GameState, defeatedCountryId: CountryId, conquerorCountryId: CountryId): GameState {
  if (!isCountryDefeated(state, defeatedCountryId)) {
    return state;
  }

  return defeatCountry(state, defeatedCountryId, conquerorCountryId);
}

function claimPridnestrovieDepot(state: GameState): GameState {
  if (state.history.claimedStrategicDepots.includes("pridnestrovie-depot")) {
    return state;
  }

  const depotRegion = state.regions["chisinau-pridnestrovie"];
  const odesaRegion = state.regions["odesa"];
  if (!depotRegion || !odesaRegion) return state;
  if (!depotRegion.controllerBlocId || depotRegion.controllerBlocId !== odesaRegion.controllerBlocId) {
    return state;
  }

  const claimantCountryId =
    depotRegion.controllerBlocId === "EU_NATO"
      ? depotRegion.controllerCountryId
      : odesaRegion.controllerCountryId;

  if (state.countries[claimantCountryId].blocId !== depotRegion.controllerBlocId) {
    return state;
  }

  if (!hasBlocPathToRegion(state, claimantCountryId, depotRegion.id)) {
    return state;
  }

  const claimantStockpile: CountryStockpile = { ...state.countryStockpiles[claimantCountryId] };
  claimantStockpile.munitions += 160;
  claimantStockpile.explosives += 80;
  claimantStockpile.fuel += 24;

  return {
    ...state,
    countryStockpiles: {
      ...state.countryStockpiles,
      [claimantCountryId]: claimantStockpile,
    },
    history: {
      ...state.history,
      claimedStrategicDepots: [...state.history.claimedStrategicDepots, "pridnestrovie-depot"],
    },
    eventLog: [
      ...state.eventLog,
      `${state.countries[claimantCountryId].name} secured the Pridnestrovie depot and seized its munitions reserve.`,
    ],
  };
}

export function setRegionController(
  state: GameState,
  regionId: string,
  controllerCountryId: CountryId
): GameState {
  const currentRegion = state.regions[regionId];
  const controllerBlocId = getControllerBlocId(state, controllerCountryId);

  const updatedRegion: RegionDefinition = {
    ...currentRegion,
    controllerCountryId,
    controllerBlocId
  };

  const nextState: GameState = {
    ...state,
    regions: {
      ...state.regions,
      [regionId]: updatedRegion
    },
    eventLog: [
      ...state.eventLog,
      `${updatedRegion.name} is now controlled by ${state.countries[controllerCountryId].name}.`
    ]
  };

  const postHistoryState = updateWarHistoryForRegion(nextState, updatedRegion);
  const postDefeatState = applyCountryDefeatIfNeeded(postHistoryState, updatedRegion.homeCountryId, controllerCountryId);
  return claimPridnestrovieDepot(postDefeatState);
}

export function evaluateWarEntryRules(state: GameState): GameState {
  let nextState = state;

  for (const country of Object.values(state.countries)) {
    if (nextState.countryStates[country.id].atWar) {
      continue;
    }

    for (const rule of country.warEntryRules) {
      if (rule.type === "scripted_turn" && nextState.turn >= rule.turn) {
        nextState = activateCountry(nextState, country, rule.description);
        break;
      }

      if (rule.type === "threshold_event" && evaluateThresholdRule(nextState, rule)) {
        nextState = activateCountry(nextState, country, rule.description);
        break;
      }
    }
  }

  return nextState;
}

export function advanceTurn(state: GameState): GameState {
  // 1. Resolve pending orders for the current actor before advancing
  const resolvedState = resolveOrders(state, state.currentActorId);

  // 1b. Process economy for the current actor
  const economyState = processEconomy(resolvedState, state.currentActorId);

  // 2. Advance to the next country in turn order
  const currentIndex = economyState.turnOrder.indexOf(economyState.currentActorId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % economyState.turnOrder.length;
  const nextActorId = economyState.turnOrder[nextIndex] ?? economyState.currentActorId;
  const nextBlocId = economyState.countries[nextActorId].blocId ?? economyState.currentBlocId;
  const nextTurn = nextIndex === 0 ? economyState.turn + 1 : economyState.turn;

  let advancedState: GameState = {
    ...economyState,
    turn: nextTurn,
    currentActorId: nextActorId,
    currentBlocId: nextBlocId,
    eventLog: [...economyState.eventLog, `Turn advanced. Active country: ${economyState.countries[nextActorId].name}.`]
  };

  if (nextIndex === 0) {
    advancedState = resetAllyTargetClaims(advancedState);
  }

  // 3. Evaluate war entry rules
  return evaluateWarEntryRules(advancedState);
}
