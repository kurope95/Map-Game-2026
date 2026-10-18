import type { Dispatch, SetStateAction } from "react";
import { canAfford as stockpileCanAfford, cancelBuildOrder, demolishFacility, getBestOperationalFacility as findBestOperationalFacility, getMissingResources as getStockpileShortfall, getOperationalFacilities as findOperationalFacilities, purchaseDoctrine, queueFacilityBuild, queueFacilityRepair, queueFacilityUpgrade, queueFortificationBuild, queueFortificationRepair, queueFortificationUpgrade, queueUnitRecruit, queueUnitReplenish, toggleChemicalMode, type ActionResult } from "../../game/rules/playerActions";
import type { CountryId, DoctrineUpgradeId, FacilityType, GameState, StockpileKey, UnitType } from "../../game/state/types";
import type { AddToast } from "./useToasts";

interface EconomyActionsOptions {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  playerCountryId: CountryId;
  addToast: AddToast;
}

export function useEconomyActions({ gameState, setGameState, playerCountryId, addToast }: EconomyActionsOptions) {
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

  function handleReplenishUnit(unitId: string) {
    applyAction(queueUnitReplenish(gameState, playerCountryId, unitId));
  }

  function handlePurchaseDoctrine(docId: DoctrineUpgradeId) {
    applyAction(purchaseDoctrine(gameState, playerCountryId, docId));
  }

  return {
    applyAction,
    canAfford,
    getMissingResources,
    getOperationalFacilities,
    getBestOperationalFacility,
    handleBuildFacility,
    handleUpgradeFacility,
    handleRepairFacility,
    handleBuildFortification,
    handleUpgradeFortification,
    handleRepairFortification,
    handleRemoveFacility,
    handleRecruitUnit,
    handleCancelBuildOrder,
    handleReplenishUnit,
    handlePurchaseDoctrine,
    handleToggleChemicalMode,
  };
}
