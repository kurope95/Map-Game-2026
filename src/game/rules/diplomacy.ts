import type {
  BlocId,
  CountryDefinition,
  CountryDiplomacyState,
  CountryId,
  CountryStockpile,
  DiplomacyActionType,
  GameState,
  StockpileKey,
} from "../state/types";

type DiplomacyCost = Partial<Record<StockpileKey, number>>;

type DiplomacyActionDefinition = {
  label: string;
  cost: DiplomacyCost;
  eliteDelta: number;
  publicDelta: number;
  description: string;
};

export const TRANSIT_SUPPORT_THRESHOLD = 28;
export const TRANSIT_BALANCE_THRESHOLD = 12;
export const LEANING_THRESHOLD = 20;

const ACTIONS: Record<DiplomacyActionType, DiplomacyActionDefinition> = {
  eliteBribery: {
    label: "Elite Bribery",
    cost: { luxuryGoods: 1, tradePoints: 3 },
    eliteDelta: 22,
    publicDelta: 6,
    description: "Targets ministries, commanders, and business elites.",
  },
  publicCampaign: {
    label: "Public Campaign",
    cost: { textiles: 2, electronics: 1, tradePoints: 2 },
    eliteDelta: 6,
    publicDelta: 20,
    description: "Moves public opinion through messaging and media reach.",
  },
  economicAid: {
    label: "Economic Aid",
    cost: { textiles: 1, electronics: 1, tradePoints: 3 },
    eliteDelta: 14,
    publicDelta: 14,
    description: "Builds broad goodwill across both elites and the street.",
  },
  weedSmuggling: {
    label: "Weed Smuggling",
    cost: { weed: 4, tradePoints: 1 },
    eliteDelta: -5,
    publicDelta: 22,
    description: "Shifts popular sentiment hard, but barely helps elites.",
  },
  securityPressure: {
    label: "Security Pressure",
    cost: { fuel: 2, munitions: 2, tradePoints: 2 },
    eliteDelta: 16,
    publicDelta: -8,
    description: "Speaks to security circles, but can sour the public.",
  },
};

function clampSupport(value: number) {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

export function getBlocDirection(blocId: BlocId | undefined): -1 | 0 | 1 {
  if (blocId === "BRICS") return -1;
  if (blocId === "EU_NATO") return 1;
  return 0;
}

export function createInitialDiplomacyState(country: CountryDefinition): CountryDiplomacyState {
  if (country.alignment === "fixed_member") {
    const direction = getBlocDirection(country.blocId);
    return {
      countryId: country.id,
      eliteSupport: direction * 90,
      publicSupport: direction * 80,
    };
  }

  if (country.alignment === "aligned_non_belligerent") {
    const direction = getBlocDirection(country.blocId);
    return {
      countryId: country.id,
      eliteSupport: direction * 34,
      publicSupport: direction * 22,
    };
  }

  return {
    countryId: country.id,
    eliteSupport: 0,
    publicSupport: 0,
  };
}

export function getCountryTiltLabel(value: number): string {
  if (value >= 60) return "Strong NATO";
  if (value >= 25) return "Leaning NATO";
  if (value <= -60) return "Strong BRICS";
  if (value <= -25) return "Leaning BRICS";
  return "Balanced";
}

export function getCountryDualTiltLabel(eliteSupport: number, publicSupport: number): string {
  if (eliteSupport >= 60 && publicSupport >= 60) return "Firmly NATO";
  if (eliteSupport >= LEANING_THRESHOLD && publicSupport >= LEANING_THRESHOLD) return "Leaning NATO";
  if (eliteSupport <= -60 && publicSupport <= -60) return "Firmly BRICS";
  if (eliteSupport <= -LEANING_THRESHOLD && publicSupport <= -LEANING_THRESHOLD) return "Leaning BRICS";
  if ((eliteSupport >= LEANING_THRESHOLD && publicSupport <= -LEANING_THRESHOLD) || (eliteSupport <= -LEANING_THRESHOLD && publicSupport >= LEANING_THRESHOLD)) {
    return "Split establishment";
  }
  return "Balanced";
}

export function getCountryLeanBloc(state: GameState, countryId: CountryId): BlocId | undefined {
  const country = state.countries[countryId];
  const diplomacy = state.diplomacy[countryId];
  if (!country || !diplomacy) return undefined;

  const elite = diplomacy.eliteSupport;
  const publicSupport = diplomacy.publicSupport;

  if (elite >= LEANING_THRESHOLD && publicSupport >= LEANING_THRESHOLD) {
    return "EU_NATO";
  }

  if (elite <= -LEANING_THRESHOLD && publicSupport <= -LEANING_THRESHOLD) {
    return "BRICS";
  }

  return undefined;
}

export function canBlocUseTransit(state: GameState, blocId: BlocId | undefined, countryId: CountryId): boolean {
  if (!blocId || blocId === "NEUTRAL") return false;

  const country = state.countries[countryId];
  const diplomacy = state.diplomacy[countryId];
  if (!country || !diplomacy) return false;

  if (country.alignment === "aligned_non_belligerent") {
    return country.blocId === blocId;
  }

  if (country.alignment !== "neutral") {
    return false;
  }

  const direction = getBlocDirection(blocId);
  const elite = diplomacy.eliteSupport * direction;
  const publicSupport = diplomacy.publicSupport * direction;

  return elite >= TRANSIT_SUPPORT_THRESHOLD &&
    publicSupport >= TRANSIT_SUPPORT_THRESHOLD &&
    Math.min(elite, publicSupport) >= TRANSIT_BALANCE_THRESHOLD;
}

export function getDiplomacyActionDefinition(actionType: DiplomacyActionType) {
  return ACTIONS[actionType];
}

export function getScaledDiplomacyActionDefinition(actionType: DiplomacyActionType, intensity: number) {
  const scale = Math.max(1, Math.min(3, Math.round(intensity)));
  const action = ACTIONS[actionType];
  return {
    ...action,
    cost: Object.fromEntries(
      Object.entries(action.cost).map(([key, amount]) => [key, (amount ?? 0) * scale])
    ) as DiplomacyCost,
    eliteDelta: action.eliteDelta * scale,
    publicDelta: action.publicDelta * scale,
  };
}

function canAfford(stockpile: CountryStockpile, cost: DiplomacyCost) {
  return Object.entries(cost).every(([key, amount]) => stockpile[key as StockpileKey] >= (amount ?? 0));
}

export function applyDiplomacyAction(
  state: GameState,
  actorCountryId: CountryId,
  targetCountryId: CountryId,
  actionType: DiplomacyActionType,
  intensity = 1
): GameState {
  const actorCountry = state.countries[actorCountryId];
  const targetCountry = state.countries[targetCountryId];
  const action = getScaledDiplomacyActionDefinition(actionType, intensity);
  const direction = getBlocDirection(actorCountry.blocId);

  if (!actorCountry || !targetCountry || direction === 0) return state;
  if (actorCountryId === targetCountryId) return state;
  if (state.countryStates[targetCountryId].defeatedOnTurn !== undefined) return state;
  if (state.countryStates[targetCountryId].atWar) return state;
  if (targetCountry.alignment === "fixed_member") return state;

  const diplomacy = state.diplomacy[targetCountryId];
  if (!diplomacy) return state;
  if (diplomacy.lastActionTurn === state.turn) return state;

  const stockpile = { ...state.countryStockpiles[actorCountryId] };
  if (!canAfford(stockpile, action.cost)) return state;

  for (const [key, amount] of Object.entries(action.cost)) {
    stockpile[key as StockpileKey] -= amount ?? 0;
  }

  const directedElite = diplomacy.eliteSupport * direction;
  const directedPublic = diplomacy.publicSupport * direction;
  const supportMomentum = Math.max(0, Math.floor((directedElite + directedPublic) / 40));
  const splitPenalty = Math.abs(directedElite - directedPublic) >= 35 ? 2 : 0;
  const momentumBonus = Math.max(0, supportMomentum - splitPenalty);

  const nextDiplomacy: CountryDiplomacyState = {
    ...diplomacy,
    eliteSupport: clampSupport(diplomacy.eliteSupport + (action.eliteDelta + momentumBonus) * direction),
    publicSupport: clampSupport(diplomacy.publicSupport + (action.publicDelta + momentumBonus) * direction),
    lastActionTurn: state.turn,
  };

  return {
    ...state,
    countryStockpiles: {
      ...state.countryStockpiles,
      [actorCountryId]: stockpile,
    },
    diplomacy: {
      ...state.diplomacy,
      [targetCountryId]: nextDiplomacy,
    },
    eventLog: [
      ...state.eventLog,
      `${actorCountry.name} used ${action.label} (level ${Math.max(1, Math.min(3, Math.round(intensity)))}) in ${targetCountry.name}. Elite ${nextDiplomacy.eliteSupport > diplomacy.eliteSupport ? "+" : ""}${nextDiplomacy.eliteSupport - diplomacy.eliteSupport}, public ${nextDiplomacy.publicSupport > diplomacy.publicSupport ? "+" : ""}${nextDiplomacy.publicSupport - diplomacy.publicSupport}.`,
    ],
  };
}
