import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { applyDiplomacyAction, canBlocUseTransit, getCountryLeanBloc } from "../../game/rules/diplomacy";
import type { BlocId, CountryId, DiplomacyActionType, GameState } from "../../game/state/types";
import type { DiplomacyTab } from "./types";

interface DiplomacyOptions {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  playerCountryId: CountryId;
  playerBlocId: BlocId | undefined;
  playerTurnActive: boolean;
}

export function useDiplomacy({ gameState, setGameState, playerCountryId, playerBlocId, playerTurnActive }: DiplomacyOptions) {
  const [diplomacyTab, setDiplomacyTab] = useState<DiplomacyTab>("neutral");
  const [selectedDiplomacyCountryId, setSelectedDiplomacyCountryId] = useState<CountryId | null>(null);
  const [diplomacyIntensity, setDiplomacyIntensity] = useState(1);

  const diplomacyTargets = useMemo(
    () =>
      Object.values(gameState.countries)
        .filter((country) => country.id !== playerCountryId)
        .filter((country) => gameState.countryStates[country.id].defeatedOnTurn === undefined)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [gameState.countries, gameState.countryStates, playerCountryId]
  );
  const diplomacyAlliesTargets = useMemo(
    () => diplomacyTargets.filter((country) => country.blocId === playerBlocId),
    [diplomacyTargets, playerBlocId]
  );
  const diplomacyEnemyTargets = useMemo(
    () => diplomacyTargets.filter((country) => country.blocId !== playerBlocId && country.blocId !== "NEUTRAL"),
    [diplomacyTargets, playerBlocId]
  );
  const diplomacyNeutralTargets = useMemo(
    () => diplomacyTargets.filter((country) => country.alignment === "neutral" && !gameState.countryStates[country.id].atWar),
    [diplomacyTargets, gameState.countryStates]
  );
  const visibleDiplomacyTargets = useMemo(() => {
    if (diplomacyTab === "allies") return diplomacyAlliesTargets;
    if (diplomacyTab === "enemies") return diplomacyEnemyTargets;
    return diplomacyNeutralTargets;
  }, [diplomacyAlliesTargets, diplomacyEnemyTargets, diplomacyNeutralTargets, diplomacyTab]);
  const diplomacySnapshot = useMemo(() => {
    return diplomacyTargets.reduce(
      (summary, country) => {
        const leanBloc = getCountryLeanBloc(gameState, country.id);
        if (leanBloc === "EU_NATO") summary.natoLean += 1;
        if (leanBloc === "BRICS") summary.bricsLean += 1;
        if (canBlocUseTransit(gameState, playerBlocId, country.id)) summary.transitOpen += 1;
        return summary;
      },
      { natoLean: 0, bricsLean: 0, transitOpen: 0 }
    );
  }, [diplomacyTargets, gameState, playerBlocId]);
  const selectedDiplomacyCountry = selectedDiplomacyCountryId ? gameState.countries[selectedDiplomacyCountryId] : undefined;
  const selectedDiplomacyState = selectedDiplomacyCountryId ? gameState.diplomacy[selectedDiplomacyCountryId] : undefined;

  useEffect(() => {
    const currentVisible = visibleDiplomacyTargets.find((country) => country.id === selectedDiplomacyCountryId);
    if (!currentVisible) {
      setSelectedDiplomacyCountryId(visibleDiplomacyTargets[0]?.id ?? null);
    }
  }, [visibleDiplomacyTargets, selectedDiplomacyCountryId]);

  function handleDiplomacyAction(targetCountryId: CountryId, actionType: DiplomacyActionType) {
    if (!playerTurnActive) return;
    setGameState((state) => applyDiplomacyAction(state, playerCountryId, targetCountryId, actionType, diplomacyIntensity));
  }

  return {
    diplomacyTab,
    setDiplomacyTab,
    selectedDiplomacyCountryId,
    setSelectedDiplomacyCountryId,
    diplomacyIntensity,
    setDiplomacyIntensity,
    diplomacyTargets,
    diplomacyAlliesTargets,
    diplomacyEnemyTargets,
    diplomacyNeutralTargets,
    visibleDiplomacyTargets,
    diplomacySnapshot,
    selectedDiplomacyCountry,
    selectedDiplomacyState,
    handleDiplomacyAction,
  };
}
