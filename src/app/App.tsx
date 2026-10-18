import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInitialState } from "../game/state/createInitialState";
import { advanceTurn, evaluateWarEntryRules } from "../game/rules/turnEngine";
import { getPridnestrovieDepotStatus } from "../game/rules/strategicDepot";
import {
  canAfford as stockpileCanAfford,
  cancelBuildOrder,
  demolishFacility,
  getBestOperationalFacility as findBestOperationalFacility,
  getMissingResources as getStockpileShortfall,
  getOperationalFacilities as findOperationalFacilities,
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
} from "../game/rules/playerActions";
import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "../ui/format/unitStatus";
import { CountryId, GameState, GameToast, UnitDefinition, VictoryStatus } from "../game/state/types";
import type { FacilityType, StockpileKey, UnitType } from "../game/state/types";
import { TheaterMap } from "../ui/TheaterMap";
import { LandingPage } from "../ui/LandingPage";
import { EconomyLogicMap } from "../ui/EconomyLogicMap";
import { BotDecision, executeCountryTurn, planCountryTurn } from "../game/ai/heuristicBot";
import { isPlayerEliminated, runUntilPlayerTurn } from "../game/sim/autoPlay";
import { issueOrder, getValidTargets, clearOrders } from "../game/rules/orderResolution";
import {
  applyDiplomacyAction,
  canBlocUseTransit,
  getCountryDualTiltLabel,
  getCountryLeanBloc,
  getCountryTiltLabel,
  getScaledDiplomacyActionDefinition,
  LEANING_THRESHOLD,
  TRANSIT_SUPPORT_THRESHOLD,
} from "../game/rules/diplomacy";
import {
  FACILITY_BUILD_COSTS,
  UNIT_RECRUITMENT_COSTS,
  PROCESSING_RECIPES,
  CHEMICAL_PLANT_RECIPES,
  MUNITIONS_PLANT_RECIPE,
  EXTRACTION_FACILITY_RESOURCES,
  CIVILIAN_GOOD_RECIPES,
  WEED_RECIPE,
  getFacilityBuildRecipe,
  getFacilityRepairProfile,
  getFacilityUpgradeCost,
  getFortificationBuildProfile,
  getFortificationRepairProfile,
  getMilitaryProductionTurns,
  getReplenishmentCost,
  getUnitRecruitmentRecipe,
  MAX_UNIT_STRENGTH,
  FORTIFICATION_MAX_LEVEL,
} from "../game/content/economyRecipes";
import { DOCTRINE_DEFINITIONS } from "../game/content/doctrines";
import type { DiplomacyActionType, DoctrineUpgradeId } from "../game/state/types";

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

export function App() {
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

  function renderDiplomacyBar(channel: string, value: number) {
    const position = ((value + 100) / 200) * 100;
    const leaningLeft = ((100 - LEANING_THRESHOLD) / 200) * 100;
    const leaningRight = ((100 + LEANING_THRESHOLD) / 200) * 100;
    const transitLeft = ((100 - TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;
    const transitRight = ((100 + TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;

    return (
      <div className="diplo-bar">
        <div className="diplo-bar__topline">
          <span className="diplo-bar__channel">{channel}</span>
          <span className="diplo-bar__tilt">{getCountryTiltLabel(value)}</span>
        </div>
        <div className="diplo-bar__track">
          <div className="diplo-bar__half diplo-bar__half--brics" />
          <div className="diplo-bar__half diplo-bar__half--nato" />
          <div className="diplo-bar__marker diplo-bar__marker--center" style={{ left: "50%" }} />
          <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningLeft}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningRight}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitLeft}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitRight}%` }} />
          <div className="diplo-bar__thumb" style={{ left: `${position}%` }} />
        </div>
        <div className="diplo-bar__legend">
          <span>BRICS</span>
          <span>Lean</span>
          <span>Neutral</span>
          <span>Transit</span>
          <span>NATO</span>
        </div>
      </div>
    );
  }

  function renderDiplomacyListCard(country: typeof diplomacyTargets[number]) {
    const diplomacy = gameState.diplomacy[country.id];
    const status = gameState.countryStates[country.id];
    const leanBloc = getCountryLeanBloc(gameState, country.id);
    const transitGranted = canBlocUseTransit(gameState, playerBlocId, country.id);
    const combinedTilt = getCountryDualTiltLabel(diplomacy.eliteSupport, diplomacy.publicSupport);
    const selected = selectedDiplomacyCountryId === country.id;

    return (
      <button
        key={country.id}
        className={`diplo-list-card ${selected ? "diplo-list-card--selected" : ""}`}
        onClick={() => setSelectedDiplomacyCountryId(country.id)}
      >
        <div className="diplo-list-card__title-row">
          <span className="diplo-list-card__title">{country.name}</span>
          <span className={`diplo-list-card__lean ${leanBloc === "EU_NATO" ? "diplo-list-card__lean--nato" : leanBloc === "BRICS" ? "diplo-list-card__lean--brics" : ""}`}>
            {combinedTilt}
          </span>
        </div>
        <div className="diplo-list-card__subline">
          {status.atWar ? "At war" : country.alignment === "neutral" ? "Neutral" : "Aligned"}
          {country.alignment === "neutral" ? ` • ${transitGranted ? "Transit open" : "Transit closed"}` : ""}
        </div>
        <div className="diplo-list-card__mini-bars">
          <div className="diplo-list-card__mini-bar">
            <span>Elite</span>
            <div className="diplo-list-card__mini-track">
              <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.eliteSupport + 100) / 200) * 100}%` }} />
            </div>
          </div>
          <div className="diplo-list-card__mini-bar">
            <span>Public</span>
            <div className="diplo-list-card__mini-track">
              <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.publicSupport + 100) / 200) * 100}%` }} />
            </div>
          </div>
        </div>
      </button>
    );
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

  if (!gameStarted) {
    return (
      <LandingPage
        nations={landingNations}
        selectedCountryId={playerCountryId}
        onSelectCountry={setPlayerCountryId}
        onStartGame={handleStartGame}
      />
    );
  }

  return (
    <div className="game-shell">
      {/* TOP BAR */}
      <div className="top-bar">
        <span className="top-bar__brand">Map Game</span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">Nation<strong>{playerCountry.name}</strong></span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">Turn<strong>{gameState.turn}</strong></span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">Bloc<strong>{playerBlocId === "BRICS" ? "BRICS" : playerBlocId === "EU_NATO" ? "EU NATO" : "Neutral"}</strong></span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">Active<strong>{gameState.countries[gameState.currentActorId].name}</strong></span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">National Units<strong>{playerCountryUnits.length}</strong></span>
        <span className="top-bar__divider" />
        <span className="top-bar__stat">Trade<strong>{gameState.countryStockpiles[playerCountryId].tradePoints}</strong></span>
        <span className="top-bar__divider" />
        <span
          className={`top-bar__stat top-bar__stat--clickable ${globalUnitsOpen ? "top-bar__stat--active" : ""}`}
          onClick={() => setGlobalUnitsOpen((o) => !o)}
          title="Click to view all your units"
        >
          Units<strong>{allPlayerUnits.length}</strong>
        </span>
        <span className="top-bar__divider" />

        <select
          className="top-bar__select"
          value={selectedRegionId}
          onChange={(e) => { setSelectedRegionId(e.target.value); setSelectedUnitIds(new Set()); }}
        >
          {quickJumpRegions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <span className="top-bar__spacer" />

        <button className="top-bar__btn top-bar__btn--primary" onClick={handleAdvanceTurn}>End Turn</button>
        <button className="top-bar__btn top-bar__btn--secondary" onClick={handleRunAiTurn}>Run AI</button>
        <button className="top-bar__btn top-bar__btn--secondary" onClick={() => handleAutoPlay(6)}>Auto x6</button>
        <button className={`top-bar__btn top-bar__btn--secondary ${diplomacyOpen ? "top-bar__btn--active" : ""}`} onClick={() => setDiplomacyOpen((open) => !open)}>Diplomacy</button>
        <button className={`top-bar__btn top-bar__btn--secondary ${doctrineOpen ? "top-bar__btn--active" : ""}`} onClick={() => setDoctrineOpen((open) => !open)}>🎓 Doctrines</button>
        <span className="top-bar__divider" />
        <button className="top-bar__btn top-bar__btn--secondary" onClick={handleSaveGame} title="Save game">💾</button>
        <button className="top-bar__btn top-bar__btn--secondary" onClick={handleLoadGame} title="Load game">📂</button>
      </div>

      {saveLoadOpen && (
        <div className="save-modal-overlay" onClick={() => setSaveLoadOpen(false)}>
          <div className="save-modal" onClick={(event) => event.stopPropagation()}>
            <div className="save-modal__header">
              <div>
                <h3>Save / Load</h3>
                <p>{saveLoadMode === "save" ? "Create or overwrite save slots." : "Select a slot and load instantly."}</p>
              </div>
              <button className="float-panel__close" onClick={() => setSaveLoadOpen(false)}>×</button>
            </div>
            <div className="save-modal__body">
              <div className="save-modal__list">
                {saveSlots.length === 0 && (
                  <div className="save-slot save-slot--empty">No saved slots yet.</div>
                )}
                {saveSlots.map((slot) => {
                  const savedAtLabel =
                    slot.envelope.savedAt && slot.envelope.savedAt !== new Date(0).toISOString()
                      ? new Date(slot.envelope.savedAt).toLocaleString()
                      : "Legacy";
                  return (
                    <button
                      key={slot.name}
                      className={`save-slot ${selectedSaveSlotName === slot.name ? "save-slot--active" : ""}`}
                      onClick={() => setSelectedSaveSlotName(slot.name)}
                    >
                      <div className="save-slot__title-row">
                        <span className="save-slot__name">{slot.name}</span>
                        <span className="save-slot__turn">T{slot.envelope.turn}</span>
                      </div>
                      <div className="save-slot__meta">{savedAtLabel}</div>
                      <div className="save-slot__meta">{gameState.countries[slot.envelope.countryId]?.name ?? slot.envelope.countryId}</div>
                    </button>
                  );
                })}
              </div>
              <div className="save-modal__actions">
                <label className="save-modal__label" htmlFor="save-slot-input">Slot Name</label>
                <input
                  id="save-slot-input"
                  className="save-modal__input"
                  value={saveSlotInput}
                  onChange={(event) => setSaveSlotInput(event.target.value)}
                  placeholder="my-campaign-turn12"
                />
                <div className="save-modal__buttons">
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={() => saveToSlot(saveSlotInput)}>Save New</button>
                  <button
                    className="top-bar__btn top-bar__btn--secondary"
                    onClick={() => selectedSaveSlotName ? saveToSlot(selectedSaveSlotName) : addToast("Select a slot first", "warning")}
                  >
                    Overwrite Selected
                  </button>
                  <button className="top-bar__btn top-bar__btn--primary" onClick={handleLoadSelectedSlot}>Load Selected</button>
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={handleDeleteSelectedSlot}>Delete Selected</button>
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={handleLoadLegacyQuickSave}>Load Legacy Quick Save</button>
                </div>
                {selectedSaveSlot && (
                  <div className="save-modal__selected">
                    Selected: <strong>{selectedSaveSlot.name}</strong> (Turn {selectedSaveSlot.envelope.turn})
                    {selectedSaveSlot.isLegacyPayload ? " - Legacy Slot" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {diplomacyOpen && (
        <div className="float-panel" style={{ top: 52, bottom: "auto", left: "50%", transform: "translateX(-50%)", width: "min(1380px, calc(100vw - 20px))", maxWidth: "1380px", minWidth: "980px", zIndex: 42, maxHeight: "84vh" }}>
          <div className="float-panel__header">
            <span>Diplomacy</span>
            <button className="float-panel__close" onClick={() => setDiplomacyOpen(false)}>✕</button>
          </div>
          <div className="float-panel__body" style={{ maxHeight: "80vh" }}>
            <div className="diplomacy-workspace">
              <div className="diplomacy-browser">
                <div className="diplomacy-browser__tabs">
                  <button className={`diplomacy-browser__tab ${diplomacyTab === "allies" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("allies")}>
                    Allies ({diplomacyAlliesTargets.length})
                  </button>
                  <button className={`diplomacy-browser__tab ${diplomacyTab === "enemies" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("enemies")}>
                    Enemies ({diplomacyEnemyTargets.length})
                  </button>
                  <button className={`diplomacy-browser__tab ${diplomacyTab === "neutral" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("neutral")}>
                    Neutral ({diplomacyNeutralTargets.length})
                  </button>
                </div>
                <div className="diplomacy-browser__content">
                  <div className="panel-card" style={{ marginBottom: "12px" }}>
                    <h4>How This Works</h4>
                    <p>We track both elites and the public. You need both to move before a country truly starts drifting.</p>
                    <p>Leaning begins once both bars cross {LEANING_THRESHOLD}. Neutral transit opens once both cross {TRANSIT_SUPPORT_THRESHOLD} for your bloc.</p>
                    <p>Neutrals always build their economies. They only start raising armies once they are clearly leaning.</p>
                  </div>
                  <div className="diplomacy-list">
                    {visibleDiplomacyTargets.map((country) => renderDiplomacyListCard(country))}
                    {visibleDiplomacyTargets.length === 0 && (
                      <div className="panel-card">
                        <p>No countries in this tab right now.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="diplomacy-detail">
                <div className="panel-card" style={{ marginBottom: "12px" }}>
                  <h4>Strategic Picture</h4>
                  <div className="diplo-summary">
                    <div className="diplo-summary__item">
                      <span className="diplo-summary__value">{diplomacySnapshot.natoLean}</span>
                      <span className="diplo-summary__label">Leaning NATO</span>
                    </div>
                    <div className="diplo-summary__item">
                      <span className="diplo-summary__value">{diplomacySnapshot.bricsLean}</span>
                      <span className="diplo-summary__label">Leaning BRICS</span>
                    </div>
                    <div className="diplo-summary__item">
                      <span className="diplo-summary__value">{diplomacySnapshot.transitOpen}</span>
                      <span className="diplo-summary__label">Transit open to you</span>
                    </div>
                  </div>
                </div>
                {selectedDiplomacyCountry && selectedDiplomacyState ? (
                  <>
                    <div className="diplo-card" style={{ marginBottom: "12px" }}>
                      <div className="diplo-card__header">
                        <div>
                          <div className="diplo-card__title">{selectedDiplomacyCountry.name}</div>
                          <div className="diplo-card__subtitle">
                            {gameState.countryStates[selectedDiplomacyCountry.id].atWar
                              ? "Already at war"
                              : selectedDiplomacyCountry.alignment === "neutral"
                                ? "Neutral and influenceable"
                                : selectedDiplomacyCountry.alignment === "aligned_non_belligerent"
                                  ? "Aligned country with scripted entry rules"
                                  : "Hard member"}
                          </div>
                        </div>
                        <div className="diplo-card__pills">
                          <span className={`diplo-pill ${canBlocUseTransit(gameState, playerBlocId, selectedDiplomacyCountry.id) ? "diplo-pill--open" : "diplo-pill--closed"}`}>
                            {selectedDiplomacyCountry.alignment === "neutral"
                              ? (canBlocUseTransit(gameState, playerBlocId, selectedDiplomacyCountry.id) ? "Transit open" : "Transit closed")
                              : "Bloc transit"}
                          </span>
                          <span className={`diplo-pill ${getCountryLeanBloc(gameState, selectedDiplomacyCountry.id) === "EU_NATO" ? "diplo-pill--nato" : getCountryLeanBloc(gameState, selectedDiplomacyCountry.id) === "BRICS" ? "diplo-pill--brics" : "diplo-pill--balanced"}`}>
                            {getCountryDualTiltLabel(selectedDiplomacyState.eliteSupport, selectedDiplomacyState.publicSupport)}
                          </span>
                        </div>
                      </div>
                      <div className="diplo-card__bars">
                        {renderDiplomacyBar("Elite", selectedDiplomacyState.eliteSupport)}
                        {renderDiplomacyBar("Public", selectedDiplomacyState.publicSupport)}
                      </div>
                    </div>
                    <div className="panel-card" style={{ marginBottom: "12px" }}>
                      <h4>Operation Intensity</h4>
                      <div className="diplo-intensity">
                        <div className="diplo-intensity__labels">
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                        <input
                          className="diplo-intensity__slider"
                          type="range"
                          min={1}
                          max={3}
                          step={1}
                          value={diplomacyIntensity}
                          onChange={(e) => setDiplomacyIntensity(Number(e.target.value))}
                        />
                        <div className="diplo-intensity__value">Level {diplomacyIntensity}</div>
                      </div>
                    </div>
                    <div className="diplomacy-actions-grid" style={{ marginBottom: "12px" }}>
                      {(["eliteBribery", "publicCampaign", "economicAid", "weedSmuggling", "securityPressure"] as DiplomacyActionType[]).map((actionType) => {
                        const action = getScaledDiplomacyActionDefinition(actionType, diplomacyIntensity);
                        const affordable = canAfford(action.cost);
                        const canInfluence = selectedDiplomacyCountry.alignment === "neutral";
                        const alreadyActed = selectedDiplomacyState.lastActionTurn === gameState.turn;
                        const disabled = !playerTurnActive || gameState.countryStates[selectedDiplomacyCountry.id].atWar || alreadyActed || !affordable || !canInfluence;
                        const direction = playerBlocId === "BRICS" ? -1 : 1;
                        const eliteDelta = action.eliteDelta * direction;
                        const publicDelta = action.publicDelta * direction;
                        const costLabel = Object.entries(action.cost).map(([key, amount]) => `${amount} ${key}`).join(" • ");

                        return (
                          <button
                            key={actionType}
                            className={`diplo-action-tile ${disabled ? "diplo-action-tile--disabled" : ""}`}
                            disabled={disabled}
                            onClick={() => handleDiplomacyAction(selectedDiplomacyCountry.id, actionType)}
                          >
                            <div className="diplo-action-tile__title">{action.label}</div>
                            <div className="diplo-action-tile__desc">{action.description}</div>
                            <div className="diplo-action-tile__effect-row">
                              <span className={`diplo-action-tile__effect ${eliteDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                                Elite {eliteDelta > 0 ? "+" : ""}{eliteDelta}
                              </span>
                              <span className={`diplo-action-tile__effect ${publicDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                                Public {publicDelta > 0 ? "+" : ""}{publicDelta}
                              </span>
                            </div>
                            <div className="diplo-action-tile__cost">{costLabel}</div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedDiplomacyCountry.alignment !== "neutral" && (
                      <div className="panel-card" style={{ marginBottom: "12px" }}>
                        <h4>Diplomatic Limits</h4>
                        <p>This country is not directly swayable through aid and bribery. Its war entry is driven by bloc alignment and scripted conditions.</p>
                      </div>
                    )}
                    {selectedDiplomacyState.lastActionTurn === gameState.turn && (
                      <div className="panel-card" style={{ marginBottom: "12px" }}>
                        <p style={{ color: "#e8c96a" }}>You already used a diplomacy action in {selectedDiplomacyCountry.name} this turn.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="panel-card" style={{ marginBottom: "12px" }}>
                    <p>Select a country to inspect its leaning and send actions.</p>
                  </div>
                )}
                <div className="panel-card">
                  <h4>Available Resources</h4>
                  <ul>
                    <li><strong>Trade:</strong> {gameState.countryStockpiles[playerCountryId].tradePoints}</li>
                    <li><strong>Luxury:</strong> {gameState.countryStockpiles[playerCountryId].luxuryGoods}</li>
                    <li><strong>Electronics:</strong> {gameState.countryStockpiles[playerCountryId].electronics}</li>
                    <li><strong>Textiles:</strong> {gameState.countryStockpiles[playerCountryId].textiles}</li>
                    <li><strong>Weed:</strong> {gameState.countryStockpiles[playerCountryId].weed}</li>
                    <li><strong>Munitions:</strong> {gameState.countryStockpiles[playerCountryId].munitions}</li>
                    <li><strong>Fuel:</strong> {gameState.countryStockpiles[playerCountryId].fuel}</li>
                  </ul>
                  {!playerTurnActive && (
                    <p style={{ color: "#e8c96a" }}>Diplomatic actions are only available during your own turn.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL UNITS DROPDOWN */}
      {globalUnitsOpen && (
        <div className="global-units-panel">
          <div className="global-units-panel__header">
            <span>All {playerCountry.name} Units ({allPlayerUnits.length})</span>
            <button className="global-units-panel__close" onClick={() => setGlobalUnitsOpen(false)}>Close</button>
          </div>
          <div className="global-units-panel__list">
            {allPlayerUnits.map((unit) => {
              const region = gameState.regions[unit.regionId];
              const order = getUnitOrder(unit.id);
              const supplyStatus = getSupplyStatus(unit);
              return (
                <div
                  key={unit.id}
                  className={`global-unit-row global-unit-row--supply-${supplyStatus.tone}`}
                  onClick={() => { setSelectedRegionId(unit.regionId); setGlobalUnitsOpen(false); }}
                >
                  <span className="global-unit-row__icon">
                    {unit.type === "infantry" ? "\u2694" : unit.type === "armor" ? "\u{1F6E1}" : unit.type === "fighter" ? "\u2708" : unit.type === "bomber" ? "\u{1F4A3}" : "\u{1F3AF}"}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="global-unit-row__type">{unit.type}</span>
                    <span className="global-unit-row__location">{region?.name ?? "?"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="global-unit-row__stats">
                      STR {unit.strength} | SUP {unit.supplyTurnsRemaining} | VET {getVeterancyLevel(unit)} | ENT {getEntrenchmentBonus(unit)}%
                    </span>
                    <span className={`global-unit-row__supply global-unit-row__supply--${supplyStatus.tone}`}>{supplyStatus.label}</span>
                    {order && <span className={`global-unit-row__order global-unit-row__order--${order.type}`}>{order.type}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MAP */}
      <div className="map-stage">
        <TheaterMap
          state={gameState}
          selectedRegionId={selectedRegionId}
          onSelectRegion={handleSelectRegion}
          onSelectFacility={handleSelectFacilityFromMap}
          onSelectUnit={handleSelectUnitFromMap}
          validMoveTargets={validTargets.moves}
          validAttackTargets={[...validTargets.attacks, ...validTargets.airTargets, ...validTargets.bombardTargets, ...validTargets.missileTargets]}
          showSupplyOverlay={showSupplyOverlay}
        />

        {/* UNIT DRAWER — floats up from bottom of map */}
        {unitsInRegion.length > 0 && (
          <div className={`unit-drawer ${unitDrawerOpen ? "unit-drawer--open" : "unit-drawer--closed"}`}>
            <button className="unit-drawer__toggle" onClick={() => setUnitDrawerOpen((o) => !o)}>
              {unitDrawerOpen ? "\u25BC" : "\u25B2"} Units in {selectedRegion.name} ({unitsInRegion.length})
            </button>
            {unitDrawerOpen && (
              <div className="unit-drawer__list">
                {selectedUnitIds.size > 0 && (
                  <div className="unit-drawer__hint">
                    {selectedUnitIds.size === 1 ? "Click an adjacent region to move or attack" : `${selectedUnitIds.size} units selected — click a target region to attack with all`}
                  </div>
                )}
                {unitsInRegion.map((unit) => {
                  const order = getUnitOrder(unit.id);
                  const isOwnNation = unit.countryId === playerCountryId;
                  const isOwn = isOwnNation && playerTurnActive;
                  const isSelected = selectedUnitIds.has(unit.id);
                  const isBrics = unit.blocId === "BRICS";
                  const isNeutral = unit.blocId === "NEUTRAL";
                  const isAllied = unit.blocId === playerBlocId && !isOwnNation;
                  const isEnemy = unit.blocId !== playerBlocId;
                  const supplyStatus = getSupplyStatus(unit);
                  return (
                    <div
                      key={unit.id}
                      className={`unit-card ${isSelected ? "unit-card--selected" : ""} ${isOwn ? "unit-card--own" : ""} ${isAllied ? "unit-card--ally" : ""} ${isEnemy ? "unit-card--enemy" : ""} ${isBrics ? "unit-card--brics" : isNeutral ? "unit-card--neutral" : "unit-card--nato"} unit-card--supply-${supplyStatus.tone}`}
                      onClick={() => isOwn && handleSelectUnit(unit)}
                    >
                      <div className="unit-card__icon">
                        {unit.type === "infantry" ? "\u2694" : unit.type === "armor" ? "\u{1F6E1}" : unit.type === "fighter" ? "\u2708" : unit.type === "bomber" ? "\u{1F4A3}" : "\u{1F3AF}"}
                      </div>
                      <div className="unit-card__info">
                        <div className="unit-card__type">{unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}</div>
                        <div className="unit-card__stats">
                          <span className="unit-card__strength">STR {unit.strength}</span>
                          <span className={`unit-card__supply unit-card__supply--${supplyStatus.tone}`}>SUP {unit.supplyTurnsRemaining}</span>
                          <span className="unit-card__strength">VET {getVeterancyLevel(unit)}</span>
                          <span className="unit-card__strength">ENT {getEntrenchmentBonus(unit)}%</span>
                        </div>
                      </div>
                      <div className={`unit-card__supply-badge unit-card__supply-badge--${supplyStatus.tone}`}>{supplyStatus.label}</div>
                      <div className="unit-card__bloc">{isBrics ? "BRICS" : isNeutral ? "NEUTRAL" : "NATO"}</div>
                      {isAllied && <div className="unit-card__ally-label">ALLY</div>}
                      {isEnemy && <div className="unit-card__enemy-label">ENEMY</div>}
                      {order && (
                        <div className={`unit-card__order unit-card__order--${order.type}`}>
                          {order.type === "attack" ? "\u2192 ATK " : order.type === "move" ? "\u2192 MOV " : "HOLD"}
                          {order.type !== "hold" && gameState.regions[order.targetRegionId]?.name}
                        </div>
                      )}
                      {isSelected && isOwn && (
                        <div className="unit-card__actions">
                          <button className="unit-card__btn" onClick={(e) => { e.stopPropagation(); handleHoldUnit(unit.id); }}>Hold</button>
                          {unit.strength < (MAX_UNIT_STRENGTH[unit.type] ?? 8) && (() => {
                            const recruitRecipe = getUnitRecruitmentRecipe(unit.type);
                            const sourceFacility = recruitRecipe ? getBestOperationalFacility(unit.regionId, recruitRecipe.requiredFacility) : null;
                            const repInfo = getReplenishmentCost(unit.type, unit.strength, sourceFacility?.level ?? 1);
                            const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
                            if (alreadyReplenishing) return <span className="unit-card__btn" style={{ opacity: 0.5, cursor: "default" }}>Replenishing...</span>;
                            if (!repInfo) return null;
                            const costStr = Object.entries(repInfo.cost).map(([k, v]) => `${v}${k.slice(0,3)}`).join("+");
                            return (
                              <button className="unit-card__btn unit-card__btn--replenish" onClick={(e) => { e.stopPropagation(); handleReplenishUnit(unit.id); }} title={`Restore to full strength (${repInfo.turns}T, ${costStr})`}>
                                🔧 Replenish ({costStr})
                              </button>
                            );
                          })()}
                          {order && (
                            <button className="unit-card__btn unit-card__btn--cancel" onClick={(e) => { e.stopPropagation(); handleCancelOrder(unit.id); }}>Cancel</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STOCKPILE POPUP — floating window over map */}
        {stockpileOpen && (() => {
          const stockpile = gameState.countryStockpiles[playerCountryId];
          return (
            <div className="stockpile-popup">
              <div className="stockpile-popup__header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>Country Stockpile — {playerCountry.name}</span>
                  <button className="build-btn" onClick={() => setLogicMapOpen(true)}>📊 Logic Map</button>
                </div>
                <button className="stockpile-popup__close" onClick={() => setStockpileOpen(false)}>✕</button>
              </div>
              <div className="stockpile-popup__grid">
                <div className="stockpile-popup__section">
                  <div className="stockpile-popup__section-title">Raw Resources</div>
                  <div className="stockpile-popup__items">
                    <div className="stockpile-item"><span className="stockpile-item__icon">🛢</span><span className="stockpile-item__label">Oil</span><span className="stockpile-item__value">{stockpile.oil}</span></div>
                    <div className="stockpile-item"><span className="stockpile-item__icon">⛏</span><span className="stockpile-item__label">Coal</span><span className="stockpile-item__value">{stockpile.coal}</span></div>
                    <div className="stockpile-item"><span className="stockpile-item__icon">⚙</span><span className="stockpile-item__label">Iron</span><span className="stockpile-item__value">{stockpile.iron}</span></div>
                    <div className="stockpile-item"><span className="stockpile-item__icon">🔩</span><span className="stockpile-item__label">Tungsten</span><span className="stockpile-item__value">{stockpile.tungsten}</span></div>
                    <div className="stockpile-item"><span className="stockpile-item__icon">🌾</span><span className="stockpile-item__label">Food</span><span className="stockpile-item__value">{stockpile.food}</span></div>
                    <div className="stockpile-item"><span className="stockpile-item__icon">⚗</span><span className="stockpile-item__label">Chemicals</span><span className="stockpile-item__value">{stockpile.chemicals}</span></div>
                  </div>
                </div>
                <div className="stockpile-popup__section">
                  <div className="stockpile-popup__section-title">Processed</div>
                  <div className="stockpile-popup__items">
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">⚡</span><span className="stockpile-item__label">Energy</span><span className="stockpile-item__value">{stockpile.energy}</span></div>
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">🔧</span><span className="stockpile-item__label">Steel</span><span className="stockpile-item__value">{stockpile.steel}</span></div>
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">⛽</span><span className="stockpile-item__label">Fuel</span><span className="stockpile-item__value">{stockpile.fuel}</span></div>
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">💥</span><span className="stockpile-item__label">Explosives</span><span className="stockpile-item__value">{stockpile.explosives}</span></div>
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">🌱</span><span className="stockpile-item__label">Fertilizer</span><span className="stockpile-item__value">{stockpile.fertilizer}</span></div>
                    <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">💣</span><span className="stockpile-item__label">Munitions</span><span className="stockpile-item__value">{stockpile.munitions}</span></div>
                  </div>
                </div>
                <div className="stockpile-popup__section">
                  <div className="stockpile-popup__section-title">Civilian Goods</div>
                  <div className="stockpile-popup__items">
                    <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">👕</span><span className="stockpile-item__label">Textiles</span><span className="stockpile-item__value">{stockpile.textiles}</span></div>
                    <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💻</span><span className="stockpile-item__label">Electronics</span><span className="stockpile-item__value">{stockpile.electronics}</span></div>
                    <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">🚗</span><span className="stockpile-item__label">Vehicles</span><span className="stockpile-item__value">{stockpile.vehicles}</span></div>
                    <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💊</span><span className="stockpile-item__label">Pharma</span><span className="stockpile-item__value">{stockpile.pharmaceuticals}</span></div>
                    <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💎</span><span className="stockpile-item__label">Luxury</span><span className="stockpile-item__value">{stockpile.luxuryGoods}</span></div>
                  </div>
                </div>
                <div className="stockpile-popup__section">
                  <div className="stockpile-popup__section-title">Special</div>
                  <div className="stockpile-popup__items">
                    <div className="stockpile-item stockpile-item--weed"><span className="stockpile-item__icon">🌿</span><span className="stockpile-item__label">Weed</span><span className="stockpile-item__value">{stockpile.weed}</span></div>
                    <div className="stockpile-item stockpile-item--trade"><span className="stockpile-item__icon">💰</span><span className="stockpile-item__label">Trade</span><span className="stockpile-item__value">{stockpile.tradePoints}</span></div>
                  </div>
                </div>
              </div>
              {gameState.weedSaturation[playerCountryId] > 0 && (
                <div style={{ fontSize: "0.65rem", marginTop: "6px", color: "#8bc99a", padding: "0 8px 6px" }}>
                  🌿 Weed saturation: {(gameState.weedSaturation[playerCountryId] * 100).toFixed(1)}% — Morale +{gameState.weedSaturation[playerCountryId] >= 0.25 ? 5 : gameState.weedSaturation[playerCountryId] >= 0.10 ? 3 : 1}, Food ×{gameState.weedSaturation[playerCountryId] >= 0.25 ? "1.3" : gameState.weedSaturation[playerCountryId] >= 0.10 ? "1.15" : "1.05"}
                </div>
              )}
            </div>
          );
        })()}

        {/* FACILITY DETAIL POPUP — floating window over map */}
        {selectedFacilityId && (() => {
          const economy = gameState.regionEconomies[selectedRegionId];
          if (!economy) return null;
          const facility = economy.facilities.find((f) => f.id === selectedFacilityId);
          if (!facility) return null;
          const buildRecipe = getFacilityBuildRecipe(facility.type);
          const upgradeCost = facility.level < 3 ? (getFacilityUpgradeCost(facility.type, facility.level) ?? {}) : {};
          const repairProfile = facility.damaged ? getFacilityRepairProfile(facility.type, facility.level) : null;
          // Production info
          const extractionResources = EXTRACTION_FACILITY_RESOURCES[facility.type];
          const processingRecipe = PROCESSING_RECIPES.find((r) => r.facilityType === facility.type);
          const isMunitionsPlant = facility.type === "munitionsPlant";
          const isChemicalPlant = facility.type === "chemicalPlant";
          const isCivilianFactory = facility.type === "civilianFactory";
          const isFarm = facility.type === "farm";
          // Military production: which units can this facility recruit?
          const recruitableUnits = UNIT_RECRUITMENT_COSTS.filter((r) => r.requiredFacility === facility.type);
          const militaryTimeBonus = Math.max(0, facility.level - 1);

          return (
            <div className="facility-popup">
              <div className="facility-popup__header">
                <span>{facility.type} — Lv.{facility.level}</span>
                <button className="facility-popup__close" onClick={() => setSelectedFacilityId(null)}>✕</button>
              </div>
              <div className="facility-popup__body">
                {facility.damaged && (
                  <div className="facility-popup__info" style={{ color: "#ff6b6b" }}>⚠ DAMAGED — not producing</div>
                )}
                {recruitableUnits.length > 0 && !facility.damaged && militaryTimeBonus > 0 && (
                  <div className="facility-popup__info" style={{ color: "#8bc99a" }}>
                    Recruitment bonus: -{militaryTimeBonus} turn{militaryTimeBonus === 1 ? "" : "s"} for units built here
                  </div>
                )}

                {/* Extraction facilities */}
                {extractionResources && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Extracts per turn:</div>
                    {economy.resourceDeposits.filter((d) => extractionResources.includes(d.type)).map((dep, i) => (
                      <div key={i} className="facility-popup__prod-row">
                        <span>{dep.type === "food" ? "Food (fertility)" : dep.type}</span>
                        <span className="facility-popup__prod-yield">+{dep.richness * facility.level} /turn</span>
                      </div>
                    ))}
                    {isFarm && facility.level >= 2 && (
                      <div className="facility-popup__prod-row" style={{ color: "#8bc99a" }}>
                        <span>🌿 Weed production unlocked</span>
                        <span className="facility-popup__prod-yield">1 food + 1 fert → 3 weed</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Processing facilities */}
                {processingRecipe && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Processes per turn (×Lv.{facility.level}):</div>
                    <div className="facility-popup__prod-row">
                      <span>In: {Object.entries(processingRecipe.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                      <span className="facility-popup__prod-yield">→ {Object.entries(processingRecipe.outputs).map(([k, v]) => `${(v ?? 0) * facility.level} ${k}`).join(" + ")}</span>
                    </div>
                    {processingRecipe.energyCost > 0 && <div className="facility-popup__prod-cost">⚡ {processingRecipe.energyCost} energy/turn</div>}
                  </div>
                )}

                {/* Munitions plant */}
                {isMunitionsPlant && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Produces per turn (×Lv.{facility.level}):</div>
                    <div className="facility-popup__prod-row">
                      <span>In: {Object.entries(MUNITIONS_PLANT_RECIPE.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                      <span className="facility-popup__prod-yield">→ {(MUNITIONS_PLANT_RECIPE.outputs.munitions ?? 0) * facility.level} munitions</span>
                    </div>
                    <div className="facility-popup__prod-cost">⚡ {MUNITIONS_PLANT_RECIPE.energyCost} energy/turn</div>
                  </div>
                )}

                {/* Chemical plant mode */}
                {isChemicalPlant && (() => {
                  const mode = facility.chemicalMode ?? "fertilizer";
                  const cRecipe = CHEMICAL_PLANT_RECIPES[mode as keyof typeof CHEMICAL_PLANT_RECIPES];
                  return (
                    <div className="facility-popup__production">
                      <div className="facility-popup__prod-title">Mode: {mode}</div>
                      <div className="facility-popup__prod-row">
                        <span>In: {Object.entries(cRecipe.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                        <span className="facility-popup__prod-yield">→ {Object.entries(cRecipe.outputs).map(([k, v]) => `${(v ?? 0) * facility.level} ${k}`).join(" + ")}</span>
                      </div>
                      <button className="build-btn" style={{ marginTop: 4 }} onClick={() => handleToggleChemicalMode(selectedRegionId, facility.id)}>
                        Switch to {mode === "explosives" ? "fertilizer" : "explosives"}
                      </button>
                    </div>
                  );
                })()}

                {/* Civilian factory */}
                {isCivilianFactory && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Civilian goods (auto per turn):</div>
                    {CIVILIAN_GOOD_RECIPES.filter((r) => r.requiredLevel <= facility.level).map((r) => (
                      <div key={r.good} className="facility-popup__prod-row">
                        <span>{Object.entries(r.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                        <span className="facility-popup__prod-yield">→ {r.outputAmount} {r.good} (+{r.tradeValue} trade)</span>
                      </div>
                    ))}
                    {CIVILIAN_GOOD_RECIPES.some((r) => r.requiredLevel > facility.level) && (
                      <div className="facility-popup__prod-cost" style={{ color: "var(--muted)" }}>
                        Upgrade to unlock: {CIVILIAN_GOOD_RECIPES.filter((r) => r.requiredLevel > facility.level).map((r) => `${r.good} (Lv.${r.requiredLevel})`).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Military recruitment */}
                {recruitableUnits.length > 0 && !facility.damaged && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Recruit units:</div>
                    {recruitableUnits.map((recipe) => {
                      const affordable = canAfford(recipe.cost);
                      const recruitTurns = getMilitaryProductionTurns(recipe.turns, facility.level);
                      return (
                        <div key={recipe.unitType} className="facility-popup__prod-row" style={{ alignItems: "center" }}>
                          <span>{recipe.unitType} — {Object.entries(recipe.cost).map(([k, v]) => `${v} ${k}`).join(", ")}</span>
                          <button
                            className={`build-btn ${affordable && !facility.damaged ? "" : "build-btn--disabled"}`}
                            disabled={!affordable || facility.damaged}
                            onClick={() => { handleRecruitUnit(selectedRegionId, recipe.unitType); }}
                            title={facility.damaged ? "Repair this facility first" : affordable ? "" : `Missing: ${getMissingResources(recipe.cost).join(", ")}`}
                          >
                            Recruit ({recruitTurns}t)
                          </button>
                        </div>
                      );
                    })}
                    
                    {/* Replenish troops currently stationed here */}
                    {Object.values(gameState.units).some(u => 
                      u.regionId === selectedRegionId && 
                      u.countryId === playerCountryId && 
                      u.strength < MAX_UNIT_STRENGTH[u.type] && 
                      recruitableUnits.some(r => r.unitType === u.type)
                    ) && (
                      <div style={{ marginTop: 12 }}>
                        <div className="facility-popup__prod-title">Replenish stationed troops:</div>
                        {Object.values(gameState.units).filter(u => 
                          u.regionId === selectedRegionId && 
                          u.countryId === playerCountryId && 
                          u.strength < MAX_UNIT_STRENGTH[u.type] && 
                          recruitableUnits.some(r => r.unitType === u.type)
                        ).map((unit) => {
                          const repInfo = getReplenishmentCost(unit.type, unit.strength, facility.level);
                          if (!repInfo) return null;
                          const replenishCost = repInfo.cost;
                          const affordable = canAfford(replenishCost);
                          const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
                          return (
                            <div key={unit.id} className="facility-popup__prod-row" style={{ alignItems: "center" }}>
                              <span>{unit.type} (STR: {unit.strength}/{MAX_UNIT_STRENGTH[unit.type]})</span>
                              <button
                                className={`build-btn ${affordable && !alreadyReplenishing ? "" : "build-btn--disabled"}`}
                                disabled={!affordable || alreadyReplenishing}
                                onClick={() => { handleReplenishUnit(unit.id); }}
                                title={alreadyReplenishing ? "Already replenishing" : affordable ? "" : `Missing: ${getMissingResources(replenishCost).join(", ")}`}
                              >
                                {alreadyReplenishing ? "Queued" : `Replenish (${repInfo.turns}t - ${Object.entries(replenishCost).map(([k, v]) => `${v} ${k}`).join(", ")})`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Upgrade */}
                {facility.level < 3 && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__actions">
                    <button className="build-btn" disabled={facility.damaged || !canAfford(upgradeCost)} onClick={() => { handleUpgradeFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }} title={facility.damaged ? "Repair this facility first" : canAfford(upgradeCost) ? "" : `Missing: ${getMissingResources(upgradeCost).join(", ")}`}>
                      ⬆ Upgrade to Lv.{facility.level + 1} ({Object.entries(upgradeCost).map(([k, v]) => `${v} ${k}`).join(", ")})
                    </button>
                  </div>
                )}
                {repairProfile && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__actions">
                    <button
                      className="build-btn"
                      disabled={!canAfford(repairProfile.cost) || (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "repairFacility" && o.facilityId === facility.id)}
                      onClick={() => { handleRepairFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }}
                      title={canAfford(repairProfile.cost) ? "" : `Missing: ${getMissingResources(repairProfile.cost).join(", ")}`}
                    >
                      Repair ({repairProfile.turns}t{Object.keys(repairProfile.cost).length > 0 ? ` - ${Object.entries(repairProfile.cost).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""})
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* FLOATING PANELS — each tab opens its own popup over the map */}
      {bottomOpen && activeTab === "region" && (() => {
        const economy = gameState.regionEconomies[selectedRegionId];
        return (
          <div className="float-panel float-panel--bottom-left">
            <div className="float-panel__header">
              <span>{selectedRegion.name}</span>
              <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
            </div>
            <div className="float-panel__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="float-panel__row" style={{ paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "6px" }}>
                  <span className="float-panel__lbl">Controlled By:</span>
                  <span style={{ fontWeight: 800, color: controllerCountry.blocId === 'BRICS' ? '#ff9a9d' : controllerCountry.blocId === 'EU_NATO' ? '#9dc2ff' : '#c7d0da', fontSize: "1.05rem" }}>
                    {controllerCountry.blocId === 'BRICS' ? '🟥' : controllerCountry.blocId === 'EU_NATO' ? '🟦' : '⬜'} {controllerCountry.name}
                  </span>
                </div>
                <div className="float-panel__row"><span className="float-panel__lbl">Core Territory</span><span>{selectedCountry.name}</span></div>
                <div className="float-panel__row"><span className="float-panel__lbl">Terrain</span><span>{selectedRegion.terrain}</span></div>
                <div className="float-panel__row"><span className="float-panel__lbl">Value</span><span>{selectedRegion.points} pts</span></div>
                {selectedRegion.id === "chisinau-pridnestrovie" && (
                  <>
                    <div className="float-panel__row">
                      <span className="float-panel__lbl">Depot</span>
                      <span style={{ color: pridnestrovieDepotStatus.tone === "claimed" ? "#7fd98b" : pridnestrovieDepotStatus.tone === "claimable" ? "#f2d36b" : "#c0cad5" }}>
                        {pridnestrovieDepotStatus.label}
                      </span>
                    </div>
                    <div className="float-panel__subtle">{pridnestrovieDepotStatus.detail}</div>
                  </>
                )}
                {economy && (
                  <>
                    <div className="float-panel__row"><span className="float-panel__lbl">Population</span><span>{economy.population.toLocaleString()}k</span></div>
                    <div className="float-panel__row"><span className="float-panel__lbl">Stability</span><span style={{ color: economy.stability >= 70 ? "#8bc99a" : economy.stability >= 40 ? "#e8c96a" : "#ff6b6b" }}>{economy.stability}%</span></div>
                    <div className="float-panel__row"><span className="float-panel__lbl">Recruitable</span><span>{economy.recruitablePool.toLocaleString()}</span></div>
                    <div className="float-panel__row"><span className="float-panel__lbl">Build Slots</span><span>{economy.facilities.length}/{economy.buildingSlots}</span></div>
                  </>
                )}
              </div>
              <div>
                <div className="economy-section__title" style={{ marginBottom: 4 }}>Deposits</div>
                {!economy || economy.resourceDeposits.length === 0 ? (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>None</span>
                ) : (
                  <div className="deposit-list">
                    {economy.resourceDeposits.map((dep, i) => (
                      <div key={i} className="deposit-item">
                        <span className="deposit-item__type">{dep.type === "food" ? "Fertility" : dep.type}</span>
                        <span className="deposit-item__richness">{"★".repeat(dep.richness)}{"☆".repeat(5 - dep.richness)}</span>
                        {dep.type === "food" && <span style={{ fontSize: "0.55rem", color: "#8bc99a" }}>+{dep.richness * 15}%</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="economy-section__title" style={{ marginTop: 8, marginBottom: 4 }}>Adjacent</div>
                <div style={{ fontSize: "0.65rem", color: "var(--muted)", lineHeight: 1.4 }}>
                  {selectedRegion.adjacentRegionIds.map((id) => gameState.regions[id].name).join(" · ")}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {bottomOpen && activeTab === "economy" && (() => {
        const economy = gameState.regionEconomies[selectedRegionId];
        if (!economy) return null;
        
        const civilianFacilitiesList = ["farm", "mine", "oilWell", "powerPlant", "smelter", "civilianFactory", "syntheticRefinery", "chemicalPlant"];
        const civFacilitiesBuilt = economy.facilities.filter(f => civilianFacilitiesList.includes(f.type));
        const civOrders = regionBuildOrders.filter(o => {
          if (o.type === "buildFacility" && o.facilityType) return civilianFacilitiesList.includes(o.facilityType);
          if (o.type === "upgradeFacility" && o.facilityId) {
            const fac = economy.facilities.find(f => f.id === o.facilityId);
            return fac && civilianFacilitiesList.includes(fac.type);
          }
          if (o.type === "repairFacility" && o.facilityId) {
            const fac = economy.facilities.find(f => f.id === o.facilityId);
            return fac && civilianFacilitiesList.includes(fac.type);
          }
          return false;
        });

        return (
          <div className="float-panel float-panel--bottom-center float-panel--wide">
            <div className="float-panel__header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>{selectedRegion.name} — Economy</span>
                <button className="build-btn build-btn--cancel" style={{ padding: "4px 8px" }} onClick={() => setLogicMapOpen(true)}>📊 Logic Map</button>
              </div>
              <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
            </div>
            <div className="float-panel__body economy-tab">
              {/* COL 1: Facilities (clickable) */}
              <div className="economy-tab__col">
                <div className="economy-section__title">Civilian Facilities</div>
                {civFacilitiesBuilt.length === 0 ? (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>No facilities built</span>
                ) : (
                  <div className="facility-list">
                    {civFacilitiesBuilt.map((fac) => (
                      <div
                        key={fac.id}
                        className={`facility-item facility-item--clickable ${fac.damaged ? "facility-item--damaged" : ""} ${selectedFacilityId === fac.id ? "facility-item--active" : ""}`}
                        onClick={() => setSelectedFacilityId(selectedFacilityId === fac.id ? null : fac.id)}
                      >
                        <span className="facility-item__type">{fac.type}</span>
                        <span className="facility-item__level">Lv.{fac.level}</span>
                        {fac.chemicalMode && <span className="facility-item__mode">{fac.chemicalMode}</span>}
                        {fac.damaged && <span className="facility-item__damaged">DMG</span>}
                        <button className="facility-item__remove" title="Demolish" onClick={(e) => { e.stopPropagation(); handleRemoveFacility(selectedRegionId, fac.id); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="economy-section__title" style={{ marginTop: 12 }}>Build Status ({economy.facilities.length}/{economy.buildingSlots} Region Slots)</div>
                {civOrders.length > 0 ? (
                  <div className="build-queue" style={{ marginBottom: 6 }}>
                    {civOrders.map((order) => (
                      <div key={order.id} className="build-queue__item">
                        <span className="build-queue__type">
                          {order.type === "buildFacility"
                            ? `Build ${order.facilityType}`
                            : order.type === "repairFacility"
                              ? `Repair ${economy.facilities.find((f) => f.id === order.facilityId)?.type ?? "facility"}`
                              : `Upgrade ${economy.facilities.find((f) => f.id === order.facilityId)?.type ?? "facility"}`}
                        </span>
                        <span className="build-queue__progress">{order.turnsRemaining}/{order.totalTurns}t</span>
                        <div className="build-queue__bar">
                          <div className="build-queue__bar-fill" style={{ width: `${((order.totalTurns - order.turnsRemaining) / order.totalTurns) * 100}%` }} />
                        </div>
                        <button className="build-btn build-btn--cancel" onClick={() => handleCancelBuildOrder(order.id)} title="Cancel (refund)">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>No active construction</span>
                )}
              </div>
              {/* COL 2: Build */}
              <div className="economy-tab__col">
                <div className="economy-section__title">Construct Facility</div>
                {selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="build-actions">
                    {economy.facilities.length + regionBuildOrders.filter((o) => o.type === "buildFacility").length < economy.buildingSlots ? (
                      <div className="build-row">
                        <div className="build-row__buttons">
                          {FACILITY_BUILD_COSTS.filter(r => civilianFacilitiesList.includes(r.facilityType)).map((recipe) => {
                            const extractableResources = EXTRACTION_FACILITY_RESOURCES[recipe.facilityType];
                            if (extractableResources) {
                              const hasDeposit = economy.resourceDeposits.some((d) => extractableResources.includes(d.type));
                              if (!hasDeposit) return null;
                            }

                            const affordable = canAfford(recipe.cost);
                            const missing = getMissingResources(recipe.cost);
                            const costStr = Object.entries(recipe.cost).length > 0 ? Object.entries(recipe.cost).map(([k, v]) => `${k}: ${v}`).join(", ") : "Free";
                            const titleStr = affordable ? `${costStr} — ${recipe.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} — ${recipe.turns} turns)`;
                            return (
                              <button key={recipe.facilityType} className={`build-btn ${affordable ? "" : "build-btn--disabled"}`} disabled={!affordable} onClick={() => handleBuildFacility(selectedRegionId, recipe.facilityType)} title={titleStr}>{recipe.facilityType} ({recipe.turns}t)</button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.75rem", color: "#ff9a9d", padding: "10px 0" }}>Region building limit reached ({economy.buildingSlots} slots).</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {bottomOpen && activeTab === "military" && (() => {
        const economy = gameState.regionEconomies[selectedRegionId];
        if (!economy) return null;
        
        const militaryFacilitiesList = ["barracks", "armorFactory", "airFactory", "munitionsPlant"];
        const milFacilitiesBuilt = economy.facilities.filter(f => militaryFacilitiesList.includes(f.type));
        const fort = economy.fortification;
        const milBuildOrders = regionBuildOrders.filter(o => {
          if (o.type === "buildFacility" && o.facilityType) return militaryFacilitiesList.includes(o.facilityType);
          if (o.type === "upgradeFacility" && o.facilityId) {
            const fac = economy.facilities.find(f => f.id === o.facilityId);
            return fac && militaryFacilitiesList.includes(fac.type);
          }
          if (o.type === "repairFacility" && o.facilityId) {
            const fac = economy.facilities.find(f => f.id === o.facilityId);
            return fac && militaryFacilitiesList.includes(fac.type);
          }
          return false;
        });
        const fortOrders = regionBuildOrders.filter(o => o.type === "buildFortification" || o.type === "upgradeFortification" || o.type === "repairFortification");
        const unitOrders = regionBuildOrders.filter(o => o.type === "recruitUnit" || o.type === "replenishUnit");

        return (
          <div className="float-panel float-panel--bottom-center float-panel--wide">
            <div className="float-panel__header">
              <span>{selectedRegion.name} — Recruitment & Military</span>
              <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
            </div>
            <div className="float-panel__body economy-tab">
              <div className="economy-tab__col">
                <div className="economy-section__title">Military Facilities</div>
                {milFacilitiesBuilt.length === 0 ? (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>No facilities built</span>
                ) : (
                  <div className="facility-list">
                    {milFacilitiesBuilt.map((fac) => (
                      <div
                        key={fac.id}
                        className={`facility-item facility-item--clickable ${fac.damaged ? "facility-item--damaged" : ""} ${selectedFacilityId === fac.id ? "facility-item--active" : ""}`}
                        onClick={() => setSelectedFacilityId(selectedFacilityId === fac.id ? null : fac.id)}
                      >
                        <span className="facility-item__type">{fac.type}</span>
                        <span className="facility-item__level">Lv.{fac.level}</span>
                        {fac.damaged && <span className="facility-item__damaged">DMG</span>}
                        <button className="facility-item__remove" title="Demolish" onClick={(e) => { e.stopPropagation(); handleRemoveFacility(selectedRegionId, fac.id); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="economy-section__title" style={{ marginTop: 12 }}>Regional Fortification</div>
                {!fort ? (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>No fortification built</span>
                ) : (
                  <div className="facility-list">
                    <div className={`facility-item ${fort.damaged ? "facility-item--damaged" : ""}`}>
                      <span className="facility-item__type">fortification</span>
                      <span className="facility-item__level">Lv.{fort.level}</span>
                      <span className="facility-item__mode">HP {fort.health}/{fort.maxHealth}</span>
                      {fort.damaged && <span className="facility-item__damaged">DMG</span>}
                    </div>
                  </div>
                )}
                
                <div className="economy-section__title" style={{ marginTop: 12 }}>Build & Recruit Queue ({economy.facilities.length}/{economy.buildingSlots} Region Slots)</div>
                {milBuildOrders.length + fortOrders.length + unitOrders.length > 0 ? (
                  <div className="build-queue" style={{ marginBottom: 6 }}>
                    {[...milBuildOrders, ...fortOrders, ...unitOrders].map((order) => (
                      <div key={order.id} className="build-queue__item">
                        <span className="build-queue__type">
                          {order.type === "recruitUnit"
                            ? `Recruit ${order.unitType}`
                            : order.type === "replenishUnit"
                              ? `Replenish ${order.unitType}`
                              : order.type === "buildFortification"
                                ? "Build fortification"
                                : order.type === "upgradeFortification"
                                  ? "Upgrade fortification"
                                  : order.type === "repairFortification"
                                    ? "Repair fortification"
                              : order.type === "buildFacility"
                                ? `Build ${order.facilityType}`
                                : order.type === "repairFacility"
                                  ? `Repair ${economy.facilities.find((f) => f.id === order.facilityId)?.type ?? "facility"}`
                                  : `Upgrade ${economy.facilities.find((f) => f.id === order.facilityId)?.type ?? "facility"}`}
                        </span>
                        <span className="build-queue__progress">{order.turnsRemaining}/{order.totalTurns}t</span>
                        <div className="build-queue__bar">
                          <div className="build-queue__bar-fill" style={{ width: `${((order.totalTurns - order.turnsRemaining) / order.totalTurns) * 100}%` }} />
                        </div>
                        <button className="build-btn build-btn--cancel" onClick={() => handleCancelBuildOrder(order.id)} title="Cancel (refund)">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>No active military production</span>
                )}
              </div>

              <div className="economy-tab__col">
                <div className="economy-section__title">Military Build Options</div>
                {selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="build-actions">
                    {economy.facilities.length + regionBuildOrders.filter((o) => o.type === "buildFacility").length < economy.buildingSlots ? (
                      <div className="build-row">
                        <span className="build-row__label" style={{ width: 60 }}>Facilities:</span>
                        <div className="build-row__buttons">
                          {FACILITY_BUILD_COSTS.filter(r => militaryFacilitiesList.includes(r.facilityType)).map((recipe) => {
                            const affordable = canAfford(recipe.cost);
                            const missing = getMissingResources(recipe.cost);
                            const costStr = Object.entries(recipe.cost).length > 0 ? Object.entries(recipe.cost).map(([k, v]) => `${k}: ${v}`).join(", ") : "Free";
                            const titleStr = affordable ? `${costStr} — ${recipe.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} — ${recipe.turns} turns)`;
                            return (
                              <button key={recipe.facilityType} className={`build-btn ${affordable ? "" : "build-btn--disabled"}`} disabled={!affordable} onClick={() => handleBuildFacility(selectedRegionId, recipe.facilityType)} title={titleStr}>{recipe.facilityType} ({recipe.turns}t)</button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.75rem", color: "#ff9a9d", padding: "10px 0" }}>Region building limit reached ({economy.buildingSlots} slots).</div>
                    )}
                    <div className="build-row" style={{ marginTop: 8 }}>
                      <span className="build-row__label" style={{ width: 60 }}>Units:</span>
                      <div className="build-row__buttons">
                        {UNIT_RECRUITMENT_COSTS.map((recipe) => {
                            const bestFacility = getBestOperationalFacility(selectedRegionId, recipe.requiredFacility);
                            const hasBuilding = bestFacility !== null;
                            const recruitTurns = getMilitaryProductionTurns(recipe.turns, bestFacility?.level ?? 1);
                          const affordable = canAfford(recipe.cost);
                          const missing = getMissingResources(recipe.cost);
                          const costStr = Object.entries(recipe.cost).map(([k, v]) => `${k}: ${v}`).join(", ");
                          let titleStr = "";
                          const dynamicTitleStr = `${costStr} - ${recruitTurns} turns`;
                          const dynamicMissingTitleStr = `Missing: ${missing.join(", ")}\n(Cost: ${dynamicTitleStr})`;
                          if (!hasBuilding) titleStr = `Requires: ${recipe.requiredFacility}`;
                          else if (!affordable) titleStr = `Missing: ${missing.join(", ")}\n(Cost: ${costStr} - ${recruitTurns} turns)`;
                          else titleStr = `${costStr} - ${recruitTurns} turns`;
                          return (
                            <button key={recipe.unitType} className={`build-btn ${hasBuilding && affordable ? "" : "build-btn--disabled"}`} disabled={!hasBuilding || !affordable} onClick={() => handleRecruitUnit(selectedRegionId, recipe.unitType)} title={hasBuilding ? (affordable ? dynamicTitleStr : dynamicMissingTitleStr) : titleStr}>{recipe.unitType} ({recruitTurns}t)</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="build-row" style={{ marginTop: 8 }}>
                      <span className="build-row__label" style={{ width: 60 }}>Fort:</span>
                      <div className="build-row__buttons">
                        {!fort ? (() => {
                          const buildProfile = getFortificationBuildProfile(1);
                          if (!buildProfile) return null;
                          const affordable = canAfford(buildProfile.cost);
                          const missing = getMissingResources(buildProfile.cost);
                          const costStr = Object.entries(buildProfile.cost).map(([k, v]) => `${k}: ${v}`).join(", ");
                          const titleStr = affordable ? `${costStr} - ${buildProfile.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} - ${buildProfile.turns} turns)`;
                          return (
                            <button className={`build-btn ${affordable ? "" : "build-btn--disabled"}`} disabled={!affordable} onClick={() => handleBuildFortification(selectedRegionId)} title={titleStr}>Build Fort (Lv.1)</button>
                          );
                        })() : (
                          <>
                            {fort.level < FORTIFICATION_MAX_LEVEL && (() => {
                              const upgradeProfile = getFortificationBuildProfile(fort.level + 1);
                              if (!upgradeProfile) return null;
                              const affordable = canAfford(upgradeProfile.cost);
                              const missing = getMissingResources(upgradeProfile.cost);
                              const costStr = Object.entries(upgradeProfile.cost).map(([k, v]) => `${k}: ${v}`).join(", ");
                              const titleStr = affordable ? `${costStr} - ${upgradeProfile.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} - ${upgradeProfile.turns} turns)`;
                              return (
                                <button className={`build-btn ${affordable ? "" : "build-btn--disabled"}`} disabled={!affordable} onClick={() => handleUpgradeFortification(selectedRegionId)} title={titleStr}>Upgrade Fort</button>
                              );
                            })()}
                            {fort.health < fort.maxHealth && (() => {
                              const repairProfile = getFortificationRepairProfile(fort.level, fort.health, fort.maxHealth);
                              if (!repairProfile) return null;
                              const affordable = canAfford(repairProfile.cost);
                              const missing = getMissingResources(repairProfile.cost);
                              const costStr = Object.entries(repairProfile.cost).map(([k, v]) => `${k}: ${v}`).join(", ");
                              const titleStr = affordable ? `${costStr} - ${repairProfile.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} - ${repairProfile.turns} turns)`;
                              return (
                                <button className={`build-btn ${affordable ? "" : "build-btn--disabled"}`} disabled={!affordable} onClick={() => handleRepairFortification(selectedRegionId)} title={titleStr}>Repair Fort</button>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {bottomOpen && activeTab === "orders" && (
        <div className="float-panel float-panel--bottom-center float-panel--wide">
          <div className="float-panel__header">
            <span>Orders — {playerCountry.name} ({currentOrders.length})</span>
            <div style={{ display: "flex", gap: 6 }}>
              {currentOrders.length > 0 && <button className="build-btn build-btn--cancel" onClick={handleClearAllOrders}>Clear All</button>}
              <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
            </div>
          </div>
          <div className="float-panel__body">
            {currentOrders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>No orders issued. Select a unit, then click an adjacent region.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {currentOrders.map((order) => {
                  const unit = gameState.units[order.unitId];
                  if (!unit) return null;
                  const fromRegion = gameState.regions[unit.regionId];
                  const toRegion = gameState.regions[order.targetRegionId];
                  return (
                    <span key={order.unitId} style={{ padding: "3px 8px", borderRadius: "3px", fontSize: "0.72rem", background: order.type === "attack" ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,215,0,0.3)", color: unit.blocId === "BRICS" ? "#ff9a9d" : unit.blocId === "EU_NATO" ? "#9dc2ff" : "#c7d0da" }}>
                      {unit.type} ({fromRegion?.name}) → {order.type} → {toRegion?.name}
                      <span style={{ marginLeft: "6px", cursor: "pointer", color: "#ff6b6b" }} onClick={() => handleCancelOrder(order.unitId)}>✕</span>
                    </span>
                  );
                })}
              </div>
            )}
            {lastEventLogSnapshot.length > 0 && (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6 }}>
                <strong style={{ color: "#ff9a9d", fontSize: "0.72rem" }}>Last Turn Events:</strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: 4 }}>
                  {lastEventLogSnapshot.slice(-8).map((evt, i) => (
                    <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: "0.68rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                      {evt}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {bottomOpen && activeTab === "ai" && (
        <div className="float-panel float-panel--bottom-center float-panel--wide">
          <div className="float-panel__header">
            <span>AI Intel</span>
            <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
          </div>
          <div className="float-panel__body panel-grid panel-grid--cols-2">
            <div className="panel-card">
              <h4>AI Priority</h4>
              {currentRecommendation ? (
                <>
                  <p>{currentRecommendation.reasoning}</p>
                  <ul>{currentRecommendation.actions.map((a, i) => (<li key={`rec-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> ← {a.orderType} from {gameState.regions[a.fromRegionId]?.name} <em style={{ color: "var(--accent)" }}>(score {Math.round(a.score)})</em></li>))}</ul>
                </>
              ) : (
                <p style={{ color: "var(--muted)" }}>Switch to this tab to compute AI recommendation.</p>
              )}
            </div>
            <div className="panel-card">
              <h4>Last AI Move</h4>
              <p>{lastBotDecision === null ? "No AI move executed yet." : lastBotDecision.reasoning}</p>
              {lastBotDecision && (<ul>{lastBotDecision.actions.map((a, i) => (<li key={`last-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> {a.orderType} (score {Math.round(a.score)})</li>))}</ul>)}
            </div>
          </div>
        </div>
      )}

      {bottomOpen && activeTab === "war" && (
        <div className="float-panel float-panel--bottom-center float-panel--wide">
          <div className="float-panel__header">
            <span>War Status</span>
            <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
          </div>
          <div className="float-panel__body panel-grid panel-grid--cols-4">
            {Object.values(gameState.countries).map((country) => {
              const status = gameState.countryStates[country.id];
              return (<div className="panel-card" key={country.id}><p><span className={`war-dot ${status.atWar ? "war-dot--active" : "war-dot--inactive"}`} /><strong>{country.name}</strong> — {status.atWar ? `At war (turn ${status.activatedOnTurn})` : country.alignment === "neutral" ? "Neutral" : "Aligned, not at war"}</p></div>);
            })}
          </div>
        </div>
      )}

      {bottomOpen && activeTab === "log" && (
        <div className="float-panel float-panel--bottom-center">
          <div className="float-panel__header">
            <span>Event Log</span>
            <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
          </div>
          <div className="float-panel__body panel-card">
            <ul>{[...gameState.eventLog].slice(-12).reverse().map((entry, i) => (<li key={`${entry}-${i}`}>{entry}</li>))}</ul>
          </div>
        </div>
      )}

      {/* BOTTOM BAR — just the tab row, never expands */}
      <div className="bottom-bar">
        <div className="bottom-bar__tab-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-bar__tab ${tab.id === "stockpile" ? (stockpileOpen ? "bottom-bar__tab--active" : "") : (bottomOpen && activeTab === tab.id) ? "bottom-bar__tab--active" : ""}`}
              onClick={() => {
                if (tab.id === "stockpile") {
                  setStockpileOpen((o) => !o);
                  setBottomOpen(false);
                } else {
                  if (activeTab === tab.id && bottomOpen) {
                    setBottomOpen(false);
                  } else {
                    setActiveTab(tab.id);
                    setBottomOpen(true);
                  }
                  setStockpileOpen(false);
                  setSelectedFacilityId(null);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {latestDefeatAnnouncement && dismissedDefeatAnnouncement !== latestDefeatAnnouncement && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 10, 18, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80
          }}
        >
          <div
            style={{
              width: "min(540px, calc(100vw - 32px))",
              border: "1px solid rgba(255, 215, 120, 0.35)",
              background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              borderRadius: "14px",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f2d36b", fontWeight: 800, letterSpacing: "0.08em" }}>
              COUNTRY DEFEATED
            </div>
            <div style={{ padding: "18px", color: "#dbe6f2", lineHeight: 1.5 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px" }}>
                Strategic collapse confirmed
              </div>
              <div style={{ fontSize: "0.92rem", color: "#b7c4d3" }}>
                {latestDefeatAnnouncement}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 18px 18px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => setDismissedDefeatAnnouncement(latestDefeatAnnouncement)}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATTLE REPORT MODAL */}
      {combatReportOpen && lastEventLogSnapshot.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 10, 18, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
          }}
          onClick={() => setCombatReportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, calc(100vw - 40px))",
              maxHeight: "80vh",
              overflowY: "auto",
              border: "1px solid rgba(255, 180, 80, 0.35)",
              background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              borderRadius: 14,
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f2d36b", fontWeight: 800, letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚔️ TURN {gameState.turn - 1} — BATTLE REPORT</span>
              <button style={{ background: "none", border: "none", color: "#8a9bb0", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setCombatReportOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              {lastEventLogSnapshot.map((evt, i) => {
                const isCombat = evt.toLowerCase().includes("attack") || evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("retreat") || evt.toLowerCase().includes("captures");
                const isDefeat = evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("eliminated");
                const isVictory = evt.toLowerCase().includes("captures") || evt.toLowerCase().includes("won");
                return (
                  <div key={i} style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    background: isDefeat ? "rgba(239,68,68,0.1)" : isVictory ? "rgba(34,197,94,0.1)" : isCombat ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isDefeat ? "rgba(239,68,68,0.25)" : isVictory ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
                    color: isDefeat ? "#fca5a5" : isVictory ? "#86efac" : "#cbd5e1",
                  }}>
                    {isCombat ? "⚔️ " : "📡 "}{evt}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px 18px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => setCombatReportOpen(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed",
          top: 60,
          right: 16,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}>
          {toasts.map((toast) => {
            const bgMap = { info: "#1e3a5f", success: "#1e4d2e", warning: "#4d3b1e", danger: "#4d1e1e" };
            const borderMap = { info: "#3b82f6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444" };
            return (
              <div key={toast.id} style={{
                background: bgMap[toast.type],
                border: `1px solid ${borderMap[toast.type]}`,
                borderRadius: 8,
                padding: "10px 16px",
                color: "#e2e8f0",
                fontSize: "0.85rem",
                fontWeight: 600,
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                animation: "fadeIn 0.3s ease",
                maxWidth: 320,
              }}>
                {toast.message}
              </div>
            );
          })}
        </div>
      )}

      {/* VICTORY / DEFEAT OVERLAY */}
      {victoryStatus !== "ongoing" && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: victoryStatus === "player_victory"
            ? "radial-gradient(ellipse at center, rgba(34,197,94,0.15), rgba(5,10,18,0.85))"
            : "radial-gradient(ellipse at center, rgba(239,68,68,0.15), rgba(5,10,18,0.85))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 150,
        }}>
          <div style={{
            width: "min(520px, calc(100vw - 40px))",
            border: victoryStatus === "player_victory" ? "2px solid rgba(34,197,94,0.5)" : "2px solid rgba(239,68,68,0.5)",
            background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            borderRadius: 16,
            overflow: "hidden",
            textAlign: "center",
          }}>
            <div style={{
              padding: "24px",
              background: victoryStatus === "player_victory"
                ? "linear-gradient(180deg, rgba(34,197,94,0.15), transparent)"
                : "linear-gradient(180deg, rgba(239,68,68,0.15), transparent)",
            }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: victoryStatus === "player_victory" ? "#22c55e" : "#ef4444", marginBottom: 8 }}>
                {victoryStatus === "player_victory" ? "🏆 VICTORY" : "💀 DEFEAT"}
              </div>
              <div style={{ fontSize: "1.1rem", color: "#b7c4d3", lineHeight: 1.6 }}>
                {victoryStatus === "player_victory"
                  ? `${playerCountry.name} has achieved total dominance! All enemy major powers have been defeated.`
                  : `${playerCountry.name} has fallen. The war is lost.`}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#8a9bb0", marginTop: 12 }}>
                Turn {gameState.turn} • {Object.values(gameState.countryStates).filter((s) => s.defeatedOnTurn !== undefined).length} nations defeated
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", padding: "0 24px 24px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => { setGameStarted(false); }}>
                New Game
              </button>
              <button className="top-bar__btn top-bar__btn--secondary" onClick={() => handleLoadGame()}>
                Load Save
              </button>
            </div>
          </div>
        </div>
      )}

      {logicMapOpen && (
        <EconomyLogicMap onClose={() => setLogicMapOpen(false)} />
      )}

      {/* SUPPLY OVERLAY BUTTON (map controls companion) */}
      <button
        onClick={() => setShowSupplyOverlay(o => !o)}
        style={{
          position: "fixed",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          padding: "5px 18px",
          borderRadius: 20,
          border: `1px solid ${showSupplyOverlay ? "rgba(100,200,255,0.7)" : "rgba(100,150,200,0.3)"}`,
          background: showSupplyOverlay ? "rgba(30,80,140,0.85)" : "rgba(10,20,40,0.6)",
          color: showSupplyOverlay ? "#90d4ff" : "#8aa0c0",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          letterSpacing: "0.06em",
          transition: "all 0.2s",
        }}
      >
        📡 SUPPLY LINES {showSupplyOverlay ? "[ON]" : "[OFF]"}
      </button>

      {/* DOCTRINES PANEL */}
      {doctrineOpen && (
        <div
          onClick={() => setDoctrineOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, calc(100vw - 40px))",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "linear-gradient(180deg, rgba(15,22,35,0.99), rgba(8,13,22,0.99))",
              border: "1px solid rgba(100,150,220,0.3)",
              borderRadius: 14,
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#90cdf4", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.08em" }}>🎓 DOCTRINE UPGRADES</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#f2d36b", fontSize: "0.85rem" }}>Trade Points: {Math.floor(gameState.countryStockpiles[playerCountryId].tradePoints)}</span>
                <button style={{ background: "none", border: "none", color: "#8a9bb0", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setDoctrineOpen(false)}>✕</button>
              </div>
            </div>
            {/* Doctrine grid */}
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {DOCTRINE_DEFINITIONS.map((def) => {
                const owned = gameState.doctrineUpgrades?.[playerCountryId]?.includes(def.id) ?? false;
                const prereqsMet = (def.requires ?? []).every(r => gameState.doctrineUpgrades?.[playerCountryId]?.includes(r));
                const canAfford = gameState.countryStockpiles[playerCountryId].tradePoints >= def.cost;
                const available = !owned && prereqsMet;
                const catColor = def.category === "military" ? "#f87171" : def.category === "logistics" ? "#fb923c" : "#4ade80";
                return (
                  <div key={def.id} style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${owned ? "rgba(34,197,94,0.4)" : available ? "rgba(100,150,220,0.3)" : "rgba(255,255,255,0.06)"}`,
                    background: owned ? "rgba(34,197,94,0.06)" : available ? "rgba(30,60,120,0.3)" : "rgba(255,255,255,0.02)",
                    opacity: !owned && !available ? 0.5 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: owned ? "#86efac" : "#e2e8f0", fontSize: "0.88rem" }}>
                        {owned ? "✓ " : ""}{def.name}
                      </span>
                      <span style={{ fontSize: "0.7rem", background: `rgba(0,0,0,0.3)`, color: catColor, border: `1px solid ${catColor}44`, borderRadius: 4, padding: "1px 6px", flexShrink: 0, marginLeft: 8 }}>
                        {def.category}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: 10 }}>{def.description}</div>
                    {def.requires && def.requires.length > 0 && !owned && (
                      <div style={{ fontSize: "0.7rem", color: "#f59e0b", marginBottom: 8 }}>
                        Requires: {def.requires.map(r => DOCTRINE_DEFINITIONS.find(d => d.id === r)?.name ?? r).join(", ")}
                      </div>
                    )}
                    {!owned && (
                      <button
                        onClick={() => handlePurchaseDoctrine(def.id)}
                        disabled={!available || !canAfford}
                        style={{
                          width: "100%",
                          padding: "6px 0",
                          borderRadius: 6,
                          border: "none",
                          background: !available ? "rgba(255,255,255,0.05)" : canAfford ? "rgba(94,144,234,0.25)" : "rgba(255,255,255,0.05)",
                          color: !available ? "#4a5568" : canAfford ? "#90cdf4" : "#f87171",
                          cursor: !available || !canAfford ? "not-allowed" : "pointer",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                        }}
                      >
                        {!prereqsMet ? "🔒 Locked" : canAfford ? `Unlock — ${def.cost} TP` : `Need ${def.cost} TP`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
