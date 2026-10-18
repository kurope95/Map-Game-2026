
import { useCallback, useEffect, useMemo, useState } from "react";
import { createInitialState } from "../../game/state/createInitialState";
import { advanceTurn, evaluateWarEntryRules } from "../../game/rules/turnEngine";
import { getPridnestrovieDepotStatus } from "../../game/rules/strategicDepot";
import { canAfford as stockpileCanAfford, cancelBuildOrder, demolishFacility, getBestOperationalFacility as findBestOperationalFacility, getMissingResources as getStockpileShortfall, getOperationalFacilities as findOperationalFacilities, purchaseDoctrine, queueFacilityBuild, queueFacilityRepair, queueFacilityUpgrade, queueFortificationBuild, queueFortificationRepair, queueFortificationUpgrade, queueUnitRecruit, queueUnitReplenish, toggleChemicalMode, type ActionResult } from "../../game/rules/playerActions";
import { CountryId, GameState, GameToast, UnitDefinition, VictoryStatus } from "../../game/state/types";
import type { FacilityType, StockpileKey, UnitType } from "../../game/state/types";
import { BotDecision, executeCountryTurn, planCountryTurn } from "../../game/ai/heuristicBot";
import { isPlayerEliminated, runUntilPlayerTurn } from "../../game/sim/autoPlay";
import { issueOrder, getValidTargets, clearOrders } from "../../game/rules/orderResolution";
import { applyDiplomacyAction, canBlocUseTransit, getCountryLeanBloc } from "../../game/rules/diplomacy";
import type { DiplomacyActionType, DoctrineUpgradeId } from "../../game/state/types";

function createSessionState(playerCountryId: CountryId = "RUSSIA") {
  return evaluateWarEntryRules(createInitialState(playerCountryId));
}

const SAVE_SLOT_PREFIX = "mapgame_slot_";

interface SaveSlotEnvelope {
  savedAt: string;
  turn: number;
  countryId: CountryId;
  state: GameState;
}
interface SaveSlotEntry {
  name: string;
  envelope: SaveSlotEnvelope;
  isLegacyPayload: boolean;
}

type BottomTab = "region" | "stockpile" | "economy" | "military" | "orders" | "ai" | "war" | "log";
type DiplomacyTab = "allies" | "enemies" | "neutral";

export function useGameController() {
  const [gameState, setGameState] = useState<GameState>(() => createSessionState());
  const [gameStarted, setGameStarted] = useState(false);
  const [playerCountryId, setPlayerCountryId] = useState<CountryId>("RUSSIA");
  const [selectedRegionId, setSelectedRegionId] = useState<string>(gameState.scenario.regions[0].id);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [combatReportOpen, setCombatReportOpen] = useState(false);
  const [lastEventLogSnapshot, setLastEventLogSnapshot] = useState<string[]>([]);
  const [lastBotDecision, setLastBotDecision] = useState<BotDecision | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<BottomTab>("region");
  const [unitDrawerOpen, setUnitDrawerOpen] = useState(true);
  const [globalUnitsOpen, setGlobalUnitsOpen] = useState(false);
  const [stockpileOpen, setStockpileOpen] = useState(false);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [diplomacyTab, setDiplomacyTab] = useState<DiplomacyTab>("neutral");
  const [selectedDiplomacyCountryId, setSelectedDiplomacyCountryId] = useState<CountryId | null>(null);
  const [diplomacyIntensity, setDiplomacyIntensity] = useState(1);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [dismissedDefeatAnnouncement, setDismissedDefeatAnnouncement] = useState<string | null>(null);
  const [logicMapOpen, setLogicMapOpen] = useState(false);
  const [doctrineOpen, setDoctrineOpen] = useState(false);
  const [showSupplyOverlay, setShowSupplyOverlay] = useState(false);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [saveLoadMode, setSaveLoadMode] = useState<"save" | "load">("save");
  const [saveSlots, setSaveSlots] = useState<SaveSlotEntry[]>([]);
  const [selectedSaveSlotName, setSelectedSaveSlotName] = useState<string | null>(null);
  const [saveSlotInput, setSaveSlotInput] = useState("");

  const playerCountry = gameState.countries[playerCountryId];
  const playerBlocId = playerCountry.blocId;
  const playerTurnActive = gameState.currentActorId === playerCountryId;
  const selectedRegion = gameState.regions[selectedRegionId];
  const selectedCountry = gameState.countries[selectedRegion.homeCountryId];
  const controllerCountry = gameState.countries[selectedRegion.controllerCountryId];
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

  // Units in the selected region
  const unitsInRegion = useMemo(
    () => Object.values(gameState.units).filter((u) => u.regionId === selectedRegionId),
    [gameState.units, selectedRegionId]
  );

  // Valid targets for selected units — intersection of all selected units' targets
  const selectedUnitId = selectedUnitIds.size === 1 ? [...selectedUnitIds][0] : null;
  const validTargets = useMemo(() => {
    const empty = { moves: [] as string[], attacks: [] as string[], airTargets: [] as string[], bombardTargets: [] as string[], missileTargets: [] as string[] };
    if (selectedUnitIds.size === 0) return empty;
    const ids = [...selectedUnitIds];
    // Get targets from first unit, then for multi-select only keep common targets
    const first = getValidTargets(gameState, ids[0]);
    if (ids.length === 1) return first;
    // For multi-unit: only attacks/air/bombard/missile that ALL selected units can reach
    const result = { ...first };
    for (let i = 1; i < ids.length; i++) {
      const t = getValidTargets(gameState, ids[i]);
      result.attacks = result.attacks.filter((r) => t.attacks.includes(r));
      result.airTargets = result.airTargets.filter((r) => t.airTargets.includes(r));
      result.bombardTargets = result.bombardTargets.filter((r) => t.bombardTargets.includes(r));
      result.missileTargets = result.missileTargets.filter((r) => t.missileTargets.includes(r));
      result.moves = result.moves.filter((r) => t.moves.includes(r));
    }
    return result;
  }, [gameState, selectedUnitIds]);

  // Toast notifications
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const addToast = useCallback((message: string, type: GameToast["type"] = "info") => {
    const toast: GameToast = { id: `t${Date.now()}-${Math.random().toString(36).slice(2,5)}`, message, type, turn: gameState.turn };
    setToasts((prev) => [...prev.slice(-4), toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4000);
  }, [gameState.turn]);

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
  const selectedSaveSlot = selectedSaveSlotName ? saveSlots.find((slot) => slot.name === selectedSaveSlotName) : undefined;

  useEffect(() => {
    const currentVisible = visibleDiplomacyTargets.find((country) => country.id === selectedDiplomacyCountryId);
    if (!currentVisible) {
      setSelectedDiplomacyCountryId(visibleDiplomacyTargets[0]?.id ?? null);
    }
  }, [visibleDiplomacyTargets, selectedDiplomacyCountryId]);

  const refreshSaveSlots = useCallback(() => {
    const slots: SaveSlotEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVE_SLOT_PREFIX)) continue;
      const slotName = key.slice(SAVE_SLOT_PREFIX.length);
      if (!slotName) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as SaveSlotEnvelope | GameState;
        if ("state" in parsed && parsed.state && "turn" in parsed) {
          slots.push({ name: slotName, envelope: parsed as SaveSlotEnvelope, isLegacyPayload: false });
        } else {
          const legacyState = parsed as GameState;
          slots.push({
            name: slotName,
            envelope: {
              savedAt: new Date(0).toISOString(),
              turn: legacyState.turn ?? 0,
              countryId: legacyState.playerCountryId ?? playerCountryId,
              state: legacyState,
            },
            isLegacyPayload: true,
          });
        }
      } catch {
        // Ignore malformed slot payloads.
      }
    }
    slots.sort((left, right) => new Date(right.envelope.savedAt).getTime() - new Date(left.envelope.savedAt).getTime());
    setSaveSlots(slots);
    setSelectedSaveSlotName((previous) => {
      if (previous && slots.some((slot) => slot.name === previous)) {
        return previous;
      }
      return slots[0]?.name ?? null;
    });
  }, [playerCountryId]);

  useEffect(() => {
    if (saveLoadOpen) {
      refreshSaveSlots();
    }
  }, [saveLoadOpen, refreshSaveSlots]);

  function openSaveLoadPanel(mode: "save" | "load") {
    setSaveLoadMode(mode);
    setSaveSlotInput(`${playerCountryId.toLowerCase()}-t${gameState.turn}`);
    refreshSaveSlots();
    setSaveLoadOpen(true);
  }

  function saveToSlot(slotNameInput: string) {
    const slotName = slotNameInput.trim();
    if (!slotName) {
      addToast("Enter a slot name first", "warning");
      return;
    }
    try {
      const envelope: SaveSlotEnvelope = {
        savedAt: new Date().toISOString(),
        turn: gameState.turn,
        countryId: playerCountryId,
        state: gameState,
      };
      localStorage.setItem(`${SAVE_SLOT_PREFIX}${slotName}`, JSON.stringify(envelope));
      // Keep legacy quick-save key for backward compatibility.
      localStorage.setItem("mapgame_save", JSON.stringify(gameState));
      setSelectedSaveSlotName(slotName);
      setSaveSlotInput(slotName);
      refreshSaveSlots();
      addToast(`Saved to slot: ${slotName}`, "success");
    } catch {
      addToast("Save failed", "danger");
    }
  }

  function loadStateFromSave(nextState: GameState, label: string) {
    setGameState(nextState);
    const loadedPlayerCountryId = nextState.playerCountryId ?? playerCountryId;
    setPlayerCountryId(loadedPlayerCountryId);
    const fallbackRegionId =
      nextState.countries[loadedPlayerCountryId]?.capitalRegionId ??
      Object.values(nextState.regions)[0]?.id ??
      selectedRegionId;
    const nextSelectedRegionId = nextState.regions[selectedRegionId] ? selectedRegionId : fallbackRegionId;
    setSelectedRegionId(nextSelectedRegionId);
    setSelectedUnitIds(new Set());
    setSelectedFacilityId(null);
    setLastBotDecision(null);
    setBottomOpen(true);
    setActiveTab("region");
    setSaveLoadOpen(false);
    addToast(label, "success");
  }

  function handleSaveGame() {
    openSaveLoadPanel("save");
  }

  function handleLoadGame() {
    openSaveLoadPanel("load");
  }

  function handleLoadSelectedSlot() {
    const selected = saveSlots.find((slot) => slot.name === selectedSaveSlotName);
    if (!selected) {
      addToast("Select a save slot first", "warning");
      return;
    }
    loadStateFromSave(selected.envelope.state, `Loaded slot: ${selected.name}`);
  }

  function handleLoadLegacyQuickSave() {
    try {
      const fallback = localStorage.getItem("mapgame_save") ?? localStorage.getItem("mapgame_autosave");
      if (!fallback) {
        addToast("No legacy save found", "warning");
        return;
      }
      loadStateFromSave(JSON.parse(fallback) as GameState, "Loaded legacy quick save");
    } catch {
      addToast("Load failed", "danger");
    }
  }

  function handleDeleteSelectedSlot() {
    if (!selectedSaveSlotName) {
      addToast("Select a slot to delete", "warning");
      return;
    }
    const confirmed = window.confirm(`Delete save slot "${selectedSaveSlotName}"?`);
    if (!confirmed) return;
    try {
      localStorage.removeItem(`${SAVE_SLOT_PREFIX}${selectedSaveSlotName}`);
      refreshSaveSlots();
      addToast(`Deleted slot: ${selectedSaveSlotName}`, "info");
    } catch {
      addToast("Delete failed", "danger");
    }
  }

  // Handle region selection — also check if clicking a valid target for the selected units
  function handleSelectRegion(regionId: string) {
    if (selectedUnitIds.size > 0 && regionId !== selectedRegionId) {
      const ids = [...selectedUnitIds];
      // Check if this is a valid attack target — issue orders for ALL selected units
      if (validTargets.attacks.includes(regionId)) {
        setGameState((s) => {
          let st = s;
          for (const uid of ids) { st = issueOrder(st, { unitId: uid, type: "attack", targetRegionId: regionId }); }
          return st;
        });
        addToast(`${ids.length} unit(s) ordered to attack ${gameState.regions[regionId]?.name}`, "warning");
        setSelectedUnitIds(new Set());
        return;
      }
      // Air support
      if (validTargets.airTargets.includes(regionId)) {
        setGameState((s) => {
          let st = s;
          for (const uid of ids) { st = issueOrder(st, { unitId: uid, type: "airSupport", targetRegionId: regionId }); }
          return st;
        });
        addToast(`Air support assigned to ${gameState.regions[regionId]?.name}`, "info");
        setSelectedUnitIds(new Set());
        return;
      }
      // Bombardment
      if (validTargets.bombardTargets.includes(regionId)) {
        setGameState((s) => {
          let st = s;
          for (const uid of ids) { st = issueOrder(st, { unitId: uid, type: "bombard", targetRegionId: regionId }); }
          return st;
        });
        addToast(`Bombing run on ${gameState.regions[regionId]?.name}`, "warning");
        setSelectedUnitIds(new Set());
        return;
      }
      // Missile strike
      if (validTargets.missileTargets.includes(regionId)) {
        setGameState((s) => {
          let st = s;
          for (const uid of ids) { st = issueOrder(st, { unitId: uid, type: "missileStrike", targetRegionId: regionId }); }
          return st;
        });
        addToast(`Missile strike on ${gameState.regions[regionId]?.name}`, "danger");
        setSelectedUnitIds(new Set());
        return;
      }
      // Move
      if (validTargets.moves.includes(regionId)) {
        setGameState((s) => {
          let st = s;
          for (const uid of ids) { st = issueOrder(st, { unitId: uid, type: "move", targetRegionId: regionId }); }
          return st;
        });
        addToast(`${ids.length} unit(s) ordered to move to ${gameState.regions[regionId]?.name}`, "success");
        setSelectedUnitIds(new Set());
        return;
      }
    }
    setSelectedRegionId(regionId);
    setSelectedUnitIds(new Set());
    setSelectedFacilityId(null);
  }

  function handleSelectUnit(unit: UnitDefinition) {
    if (!playerTurnActive) return;
    if (unit.countryId !== playerCountryId) return;
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unit.id)) {
        next.delete(unit.id);
      } else {
        next.add(unit.id);
      }
      return next;
    });
  }

  function handleSelectUnitFromMap(unitId: string) {
    const unit = gameState.units[unitId];
    if (!unit) return;
    setSelectedRegionId(unit.regionId);
    setUnitDrawerOpen(true);
    if (unit.countryId === playerCountryId && playerTurnActive) {
      setSelectedUnitIds(new Set([unitId]));
    } else {
      setSelectedUnitIds(new Set());
    }
  }

  function handleSelectFacilityFromMap(regionId: string, facilityId: string) {
    setSelectedRegionId(regionId);
    setSelectedFacilityId(facilityId);
    setActiveTab("economy");
    setBottomOpen(true);
    setStockpileOpen(false);
  }

  function handleHoldUnit(unitId: string) {
    const unit = gameState.units[unitId];
    if (!unit) return;
    setGameState((s) => issueOrder(s, { unitId, type: "hold", targetRegionId: unit.regionId }));
  }

  function handleCancelOrder(unitId: string) {
    setGameState((s) => {
      const unit = s.units[unitId];
      if (!unit || unit.countryId !== playerCountryId) return s;
      const bloc = unit.blocId;
      return {
        ...s,
        pendingOrders: {
          ...s.pendingOrders,
          [playerCountryId]: s.pendingOrders[playerCountryId].filter((o) => o.unitId !== unitId)
        }
      };
    });
  }

  function handleClearAllOrders() {
    setGameState((s) => clearOrders(s, playerCountryId));
  }

  function handleReplenishUnit(unitId: string) {
    applyAction(queueUnitReplenish(gameState, playerCountryId, unitId));
  }

  function handlePurchaseDoctrine(docId: DoctrineUpgradeId) {
    applyAction(purchaseDoctrine(gameState, playerCountryId, docId));
  }

  function handleAdvanceTurn() {
    setSelectedUnitIds(new Set());
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
    setSelectedUnitIds(new Set());
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
    setSelectedUnitIds(new Set());
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

  // ── Economy build handlers ──

  function applyAction(result: ActionResult) {
    if (result.ok) setGameState(result.state);
    if (result.toast) addToast(result.toast.message, result.toast.tone);
  }

  function canAfford(cost: Partial<Record<StockpileKey, number>>): boolean {
    return stockpileCanAfford(gameState.countryStockpiles[playerCountryId], cost);
  }

  function getMissingResources(cost: Partial<Record<StockpileKey, number>>): string[] {
    return getStockpileShortfall(gameState.countryStockpiles[playerCountryId], cost);
  }

  function getOperationalFacilities(regionId: string, facilityType: FacilityType) {
    return findOperationalFacilities(gameState, regionId, facilityType);
  }

  function getBestOperationalFacility(regionId: string, facilityType: FacilityType) {
    return findBestOperationalFacility(gameState, regionId, facilityType);
  }

  function handleDiplomacyAction(targetCountryId: CountryId, actionType: DiplomacyActionType) {
    if (!playerTurnActive) return;
    setGameState((state) => applyDiplomacyAction(state, playerCountryId, targetCountryId, actionType, diplomacyIntensity));
  }

  function handleBuildFacility(regionId: string, facilityType: FacilityType) {
    applyAction(queueFacilityBuild(gameState, playerCountryId, regionId, facilityType));
  }

  function handleUpgradeFacility(facilityId: string, regionId: string) {
    applyAction(queueFacilityUpgrade(gameState, playerCountryId, regionId, facilityId));
  }

  function handleRepairFacility(facilityId: string, regionId: string) {
    applyAction(queueFacilityRepair(gameState, playerCountryId, regionId, facilityId));
  }

  function handleBuildFortification(regionId: string) {
    applyAction(queueFortificationBuild(gameState, playerCountryId, regionId));
  }

  function handleUpgradeFortification(regionId: string) {
    applyAction(queueFortificationUpgrade(gameState, playerCountryId, regionId));
  }

  function handleRepairFortification(regionId: string) {
    applyAction(queueFortificationRepair(gameState, playerCountryId, regionId));
  }

  function handleRemoveFacility(regionId: string, facilityId: string) {
    applyAction(demolishFacility(gameState, playerCountryId, regionId, facilityId));
  }

  function handleRecruitUnit(regionId: string, unitType: string) {
    applyAction(queueUnitRecruit(gameState, playerCountryId, regionId, unitType as UnitType));
  }

  function handleCancelBuildOrder(orderId: string) {
    applyAction(cancelBuildOrder(gameState, playerCountryId, orderId));
  }

  function handleToggleChemicalMode(regionId: string, facilityId: string) {
    applyAction(toggleChemicalMode(gameState, regionId, facilityId));
  }

  // Pending build orders for current region
  const regionBuildOrders = useMemo(
    () => (gameState.economyBuildOrders[playerCountryId] ?? []).filter((o) => o.regionId === selectedRegionId),
    [gameState.economyBuildOrders, selectedRegionId, playerCountryId]
  );

  const tabs: { id: BottomTab; label: string }[] = [
    { id: "region", label: "Region" },
    { id: "stockpile", label: "Stockpile" },
    { id: "economy", label: "Economy" },
    { id: "military", label: "Recruitment 🎖" },
    { id: "orders", label: `Orders (${currentOrders.length})` },
    { id: "ai", label: "AI Intel" },
    { id: "war", label: "War Status" },
    { id: "log", label: "Event Log" },
  ];

  // Get unit order status
  function getUnitOrder(unitId: string) {
    return currentOrders.find((o) => o.unitId === unitId);
  }

  function handleStartGame() {
    const nextState = createSessionState(playerCountryId);
    const capitalRegionId = nextState.countries[playerCountryId].capitalRegionId;
    setGameState(nextState);
    setSelectedRegionId(capitalRegionId);
    setSelectedUnitIds(new Set());
    setSelectedFacilityId(null);
    setLastBotDecision(null);
    setBottomOpen(true);
    setActiveTab("region");
    setGlobalUnitsOpen(false);
    setStockpileOpen(false);
    setDiplomacyOpen(false);
    setDiplomacyTab("neutral");
    setSelectedDiplomacyCountryId(null);
    setDiplomacyIntensity(1);
    setDismissedDefeatAnnouncement(null);
    setGameStarted(true);
  }

  return {
    gameState, setGameState, gameStarted, setGameStarted, playerCountryId, setPlayerCountryId,
    selectedRegionId, setSelectedRegionId, selectedUnitIds, setSelectedUnitIds, combatReportOpen, setCombatReportOpen,
    lastEventLogSnapshot, setLastEventLogSnapshot, lastBotDecision, setLastBotDecision, bottomOpen, setBottomOpen,
    activeTab, setActiveTab, unitDrawerOpen, setUnitDrawerOpen, globalUnitsOpen, setGlobalUnitsOpen,
    stockpileOpen, setStockpileOpen, diplomacyOpen, setDiplomacyOpen, diplomacyTab, setDiplomacyTab,
    selectedDiplomacyCountryId, setSelectedDiplomacyCountryId, diplomacyIntensity, setDiplomacyIntensity, selectedFacilityId, setSelectedFacilityId,
    dismissedDefeatAnnouncement, setDismissedDefeatAnnouncement, logicMapOpen, setLogicMapOpen, doctrineOpen, setDoctrineOpen,
    showSupplyOverlay, setShowSupplyOverlay, saveLoadOpen, setSaveLoadOpen, saveLoadMode, setSaveLoadMode,
    saveSlots, setSaveSlots, selectedSaveSlotName, setSelectedSaveSlotName, saveSlotInput, setSaveSlotInput,
    playerCountry, playerBlocId, playerTurnActive, selectedRegion, selectedCountry, controllerCountry,
    pridnestrovieDepotStatus, playerCountryUnits, landingNations, allPlayerUnits, unitsInRegion, selectedUnitId,
    validTargets, toasts, setToasts, addToast, victoryStatus, currentOrders,
    currentRecommendation, latestDefeatAnnouncement, quickJumpRegions, diplomacyTargets, diplomacyAlliesTargets, diplomacyEnemyTargets,
    diplomacyNeutralTargets, visibleDiplomacyTargets, diplomacySnapshot, selectedDiplomacyCountry, selectedDiplomacyState, selectedSaveSlot,
    refreshSaveSlots, openSaveLoadPanel, saveToSlot, loadStateFromSave, handleSaveGame, handleLoadGame,
    handleLoadSelectedSlot, handleLoadLegacyQuickSave, handleDeleteSelectedSlot, handleSelectRegion, handleSelectUnit, handleSelectUnitFromMap,
    handleSelectFacilityFromMap, handleHoldUnit, handleCancelOrder, handleClearAllOrders, handleReplenishUnit, handlePurchaseDoctrine,
    handleAdvanceTurn, handleRunAiTurn, handleAutoPlay, applyAction, canAfford, getMissingResources,
    getOperationalFacilities, getBestOperationalFacility, handleDiplomacyAction, handleBuildFacility, handleUpgradeFacility, handleRepairFacility,
    handleBuildFortification, handleUpgradeFortification, handleRepairFortification, handleRemoveFacility, handleRecruitUnit, handleCancelBuildOrder,
    handleToggleChemicalMode, regionBuildOrders, tabs, getUnitOrder, handleStartGame,
  };
}
