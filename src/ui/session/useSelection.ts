import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { clearOrders, getValidTargets, issueOrder } from "../../game/rules/orderResolution";
import type { CountryId, GameState, Order, UnitDefinition } from "../../game/state/types";
import type { AddToast } from "./useToasts";
import type { BottomTab, ValidTargets } from "./types";

interface SelectionOptions {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  playerCountryId: CountryId;
  playerTurnActive: boolean;
  currentOrders: Order[];
  addToast: AddToast;
  setUnitDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setActiveTab: Dispatch<SetStateAction<BottomTab>>;
  setBottomOpen: Dispatch<SetStateAction<boolean>>;
  setStockpileOpen: Dispatch<SetStateAction<boolean>>;
}

export function useSelection({
  gameState,
  setGameState,
  playerCountryId,
  playerTurnActive,
  currentOrders,
  addToast,
  setUnitDrawerOpen,
  setActiveTab,
  setBottomOpen,
  setStockpileOpen,
}: SelectionOptions) {
  const [selectedRegionId, setSelectedRegionId] = useState<string>(gameState.scenario.regions[0].id);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const selectedRegion = gameState.regions[selectedRegionId];
  const selectedCountry = gameState.countries[selectedRegion.homeCountryId];
  const controllerCountry = gameState.countries[selectedRegion.controllerCountryId];

  // Units in the selected region
  const unitsInRegion = useMemo(
    () => Object.values(gameState.units).filter((u) => u.regionId === selectedRegionId),
    [gameState.units, selectedRegionId]
  );

  // Valid targets for selected units — intersection of all selected units' targets
  const selectedUnitId = selectedUnitIds.size === 1 ? [...selectedUnitIds][0] : null;
  const validTargets = useMemo(() => {
    const empty: ValidTargets = { moves: [], attacks: [], airTargets: [], bombardTargets: [], missileTargets: [] };
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

  // Pending build orders for current region
  const regionBuildOrders = useMemo(
    () => (gameState.economyBuildOrders[playerCountryId] ?? []).filter((o) => o.regionId === selectedRegionId),
    [gameState.economyBuildOrders, selectedRegionId, playerCountryId]
  );

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

  // Get unit order status
  function getUnitOrder(unitId: string) {
    return currentOrders.find((o) => o.unitId === unitId);
  }

  return {
    selectedRegionId,
    setSelectedRegionId,
    selectedUnitIds,
    setSelectedUnitIds,
    selectedFacilityId,
    setSelectedFacilityId,
    selectedUnitId,
    selectedRegion,
    selectedCountry,
    controllerCountry,
    unitsInRegion,
    validTargets,
    regionBuildOrders,
    handleSelectRegion,
    handleSelectUnit,
    handleSelectUnitFromMap,
    handleSelectFacilityFromMap,
    handleHoldUnit,
    handleCancelOrder,
    handleClearAllOrders,
    getUnitOrder,
  };
}
