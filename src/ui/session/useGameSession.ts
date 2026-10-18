import { useEffect, useMemo, useState } from "react";
import { createInitialState } from "../../game/state/createInitialState";
import { advanceTurn, evaluateWarEntryRules } from "../../game/rules/turnEngine";
import { getPridnestrovieDepotStatus } from "../../game/rules/strategicDepot";
import type { CountryId, GameState, VictoryStatus } from "../../game/state/types";
import { executeCountryTurn, planCountryTurn, type BotDecision } from "../../game/ai/heuristicBot";
import { isPlayerEliminated, runUntilPlayerTurn } from "../../game/sim/autoPlay";
import type { BottomTab } from "./types";

export function createSessionState(playerCountryId: CountryId = "RUSSIA") {
  return evaluateWarEntryRules(createInitialState(playerCountryId));
}

interface GameSessionOptions {
  activeTab: BottomTab;
  clearSelection: () => void;
}

export function useGameSession({ activeTab, clearSelection }: GameSessionOptions) {
  const [gameState, setGameState] = useState<GameState>(() => createSessionState());
  const [gameStarted, setGameStarted] = useState(false);
  const [playerCountryId, setPlayerCountryId] = useState<CountryId>("RUSSIA");
  const [combatReportOpen, setCombatReportOpen] = useState(false);
  const [lastEventLogSnapshot, setLastEventLogSnapshot] = useState<string[]>([]);
  const [lastBotDecision, setLastBotDecision] = useState<BotDecision | null>(null);
  const [dismissedDefeatAnnouncement, setDismissedDefeatAnnouncement] = useState<string | null>(null);

  const playerCountry = gameState.countries[playerCountryId];
  const playerBlocId = playerCountry.blocId;
  const playerTurnActive = gameState.currentActorId === playerCountryId;

  const pridnestrovieDepotStatus = useMemo(() => getPridnestrovieDepotStatus(gameState), [gameState]);
  const playerCountryUnits = useMemo(
    () => Object.values(gameState.units).filter((unit) => unit.countryId === playerCountryId),
    [gameState.units, playerCountryId]
  );

  const landingNations = useMemo(
    () =>
      Object.values(gameState.countries)
        .map((country) => ({
          country,
          state: gameState.countryStates[country.id],
          startingUnitCount: Object.values(gameState.units).filter((unit) => unit.countryId === country.id).length,
        }))
        .sort((left, right) => left.country.name.localeCompare(right.country.name)),
    [gameState.countries, gameState.countryStates, gameState.units]
  );

  // All units belonging to current bloc (for global overview)
  const allPlayerUnits = useMemo(
    () => Object.values(gameState.units).filter((u) => u.countryId === playerCountryId),
    [gameState.units, playerCountryId]
  );

  // Auto-save to localStorage each turn
  useEffect(() => {
    if (gameStarted) {
      try { localStorage.setItem("mapgame_autosave", JSON.stringify(gameState)); } catch { /* silently fail */ }
    }
  }, [gameState.turn, gameStarted]);

  // Check victory conditions
  const victoryStatus = useMemo((): VictoryStatus => {
    if (!gameStarted) return "ongoing";
    const pBloc = playerBlocId;
    if (!pBloc) return "ongoing";
    const enemyBlocs = pBloc === "BRICS" ? ["EU_NATO"] : ["BRICS"];
    // Check if all enemy major power capitals are captured by player's bloc
    const enemyMajors = Object.values(gameState.countries).filter((c) => enemyBlocs.includes(c.blocId ?? "") && c.tier === "major");
    const allEnemyMajorsDefeated = enemyMajors.every((c) => gameState.countryStates[c.id].defeatedOnTurn !== undefined);
    if (allEnemyMajorsDefeated && enemyMajors.length > 0) return "player_victory";
    // Check if player is defeated
    if (gameState.countryStates[playerCountryId].defeatedOnTurn !== undefined) return "player_defeat";
    return "ongoing";
  }, [gameState, gameStarted, playerBlocId, playerCountryId]);

  // Current country's pending orders
  const currentOrders = useMemo(
    () => gameState.pendingOrders[playerCountryId] ?? [],
    [gameState.pendingOrders, playerCountryId]
  );

  // Lazy AI recommendation — only computed when AI tab is visible (expensive)
  const currentRecommendation = useMemo(
    () => activeTab === "ai" ? planCountryTurn(gameState, gameState.currentActorId) : null,
    [gameState, activeTab]
  );
  const latestDefeatAnnouncement = useMemo(
    () => [...gameState.eventLog].reverse().find((entry) => entry.includes(" has been defeated.")) ?? null,
    [gameState.eventLog]
  );

  useEffect(() => {
    if (latestDefeatAnnouncement && latestDefeatAnnouncement !== dismissedDefeatAnnouncement) {
      setDismissedDefeatAnnouncement(null);
    }
  }, [latestDefeatAnnouncement]);

  const quickJumpRegions = useMemo(
    () =>
      Object.values(gameState.regions)
        .filter((region) => region.isCapital || region.isKeyCity)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [gameState.regions]
  );

  function handleAdvanceTurn() {
    clearSelection();
    const prevLogLength = gameState.eventLog.length;
    setGameState((s) => {
      let next = s;
      let latest: BotDecision | null = null;
      const trackDecision = (decision: BotDecision) => {
        latest = decision;
      };

      next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
      if (!isPlayerEliminated(next, playerCountryId)) {
        next = advanceTurn(next);
        next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
      }

      setLastBotDecision(latest);
      // Save event log diff for the battle report
      const newEvents = next.eventLog.slice(prevLogLength);
      if (newEvents.length > 0) {
        setLastEventLogSnapshot(newEvents);
        setCombatReportOpen(true);
      }
      return next;
    });
  }

  function handleRunAiTurn() {
    clearSelection();
    setGameState((s) => {
      let next = s;
      let latest: BotDecision | null = null;
      const trackDecision = (decision: BotDecision) => {
        latest = decision;
      };

      next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
      if (!isPlayerEliminated(next, playerCountryId)) {
        const playerSide = executeCountryTurn(next, playerCountryId);
        latest = playerSide.decision;
        next = advanceTurn(playerSide.state);
        next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
      }

      setLastBotDecision(latest);
      return next;
    });
  }

  function handleAutoPlay(turns: number) {
    clearSelection();
    setGameState((s) => {
      let next = s;
      let latest: BotDecision | null = null;
      const trackDecision = (decision: BotDecision) => {
        latest = decision;
      };

      for (let i = 0; i < turns; i++) {
        if (isPlayerEliminated(next, playerCountryId)) break;

        next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
        if (isPlayerEliminated(next, playerCountryId)) break;

        const playerSide = executeCountryTurn(next, playerCountryId);
        latest = playerSide.decision;
        next = advanceTurn(playerSide.state);

        if (isPlayerEliminated(next, playerCountryId)) break;

        next = runUntilPlayerTurn(next, playerCountryId, trackDecision);
      }

      setLastBotDecision(latest);
      return next;
    });
  }

  return {
    gameState,
    setGameState,
    gameStarted,
    setGameStarted,
    playerCountryId,
    setPlayerCountryId,
    playerCountry,
    playerBlocId,
    playerTurnActive,
    playerCountryUnits,
    allPlayerUnits,
    landingNations,
    victoryStatus,
    currentOrders,
    currentRecommendation,
    quickJumpRegions,
    pridnestrovieDepotStatus,
    lastBotDecision,
    setLastBotDecision,
    combatReportOpen,
    setCombatReportOpen,
    lastEventLogSnapshot,
    setLastEventLogSnapshot,
    latestDefeatAnnouncement,
    dismissedDefeatAnnouncement,
    setDismissedDefeatAnnouncement,
    handleAdvanceTurn,
    handleRunAiTurn,
    handleAutoPlay,
  };
}
