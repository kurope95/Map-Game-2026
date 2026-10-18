import type { BlocId, GameState } from "../../../game/state/types";

export interface BlocOverview {
  blocId: BlocId;
  label: string;
  nationCount: number;
  regionCount: number;
  atWarCount: number;
}

export interface ScenarioOverview {
  nationCount: number;
  regionCount: number;
  atWarCount: number;
  blocs: BlocOverview[];
}

const BLOC_ORDER: BlocId[] = ["BRICS", "NEUTRAL", "EU_NATO"];
const BLOC_LABELS: Record<BlocId, string> = {
  BRICS: "BRICS",
  NEUTRAL: "Neutral",
  EU_NATO: "EU NATO"
};

export function getScenarioOverview(state: GameState): ScenarioOverview {
  const blocs = BLOC_ORDER.map((blocId) => {
    const nations = state.scenario.countries.filter((country) => country.blocId === blocId);
    const regions = state.scenario.regions.filter(
      (region) => state.countries[region.controllerCountryId]?.blocId === blocId
    );
    return {
      blocId,
      label: BLOC_LABELS[blocId],
      nationCount: nations.length,
      regionCount: regions.length,
      atWarCount: nations.filter((country) => state.countryStates[country.id]?.atWar).length
    };
  });

  return {
    nationCount: blocs.reduce((sum, bloc) => sum + bloc.nationCount, 0),
    regionCount: blocs.reduce((sum, bloc) => sum + bloc.regionCount, 0),
    atWarCount: blocs.reduce((sum, bloc) => sum + bloc.atWarCount, 0),
    blocs
  };
}
