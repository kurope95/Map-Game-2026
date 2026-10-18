import { createContext, useContext, type ReactNode } from "react";
import type { GameState } from "../../game/state/types";
import { createSessionState, useGameSession } from "./useGameSession";
import { useToasts } from "./useToasts";
import { useUiState } from "./useUiState";
import { useSelection } from "./useSelection";
import { useEconomyActions } from "./useEconomyActions";
import { useDiplomacy } from "./useDiplomacy";
import { useSaveSlots } from "./useSaveSlots";

function useGameValue() {
  const { toasts, setToasts, addToast } = useToasts(() => session.gameState.turn);
  const ui = useUiState();
  const session = useGameSession({ activeTab: ui.activeTab, clearSelection });
  const selection = useSelection({
    gameState: session.gameState,
    setGameState: session.setGameState,
    playerCountryId: session.playerCountryId,
    playerTurnActive: session.playerTurnActive,
    currentOrders: session.currentOrders,
    addToast,
    setUnitDrawerOpen: ui.setUnitDrawerOpen,
    setActiveTab: ui.setActiveTab,
    setBottomOpen: ui.setBottomOpen,
    setStockpileOpen: ui.setStockpileOpen,
  });
  const economy = useEconomyActions({
    gameState: session.gameState,
    setGameState: session.setGameState,
    playerCountryId: session.playerCountryId,
    addToast,
  });
  const diplomacy = useDiplomacy({
    gameState: session.gameState,
    setGameState: session.setGameState,
    playerCountryId: session.playerCountryId,
    playerBlocId: session.playerBlocId,
    playerTurnActive: session.playerTurnActive,
  });
  const saveSlots = useSaveSlots({
    gameState: session.gameState,
    playerCountryId: session.playerCountryId,
    addToast,
    onLoad: loadStateFromSave,
  });

  // Turn handlers clear the selection; the function is only called from events, never during render.
  function clearSelection() {
    selection.setSelectedUnitIds(new Set());
  }

  function loadStateFromSave(nextState: GameState, label: string) {
    session.setGameState(nextState);
    const loadedPlayerCountryId = nextState.playerCountryId ?? session.playerCountryId;
    session.setPlayerCountryId(loadedPlayerCountryId);
    const fallbackRegionId =
      nextState.countries[loadedPlayerCountryId]?.capitalRegionId ??
      Object.values(nextState.regions)[0]?.id ??
      selection.selectedRegionId;
    const nextSelectedRegionId = nextState.regions[selection.selectedRegionId] ? selection.selectedRegionId : fallbackRegionId;
    selection.setSelectedRegionId(nextSelectedRegionId);
    selection.setSelectedUnitIds(new Set());
    selection.setSelectedFacilityId(null);
    session.setLastBotDecision(null);
    ui.setBottomOpen(true);
    ui.setActiveTab("region");
    saveSlots.setSaveLoadOpen(false);
    session.setGameStarted(true);
    addToast(label, "success");
  }

  function handleStartGame() {
    const nextState = createSessionState(session.playerCountryId);
    const capitalRegionId = nextState.countries[session.playerCountryId].capitalRegionId;
    session.setGameState(nextState);
    selection.setSelectedRegionId(capitalRegionId);
    selection.setSelectedUnitIds(new Set());
    selection.setSelectedFacilityId(null);
    session.setLastBotDecision(null);
    ui.setBottomOpen(true);
    ui.setActiveTab("region");
    ui.setGlobalUnitsOpen(false);
    ui.setStockpileOpen(false);
    ui.setDiplomacyOpen(false);
    diplomacy.setDiplomacyTab("neutral");
    diplomacy.setSelectedDiplomacyCountryId(null);
    diplomacy.setDiplomacyIntensity(1);
    session.setDismissedDefeatAnnouncement(null);
    session.setGameStarted(true);
  }

  return {
    ...session,
    ...selection,
    ...ui,
    ...economy,
    ...diplomacy,
    ...saveSlots,
    toasts,
    setToasts,
    addToast,
    tabs: ui.tabs(session.currentOrders.length),
    loadStateFromSave,
    handleStartGame,
  };
}

export type GameContextValue = ReturnType<typeof useGameValue>;

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const value = useGameValue();
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
