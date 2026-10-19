import "./FloatPanel.css";
import "./EconomyPanels.css";
import { Medal, Shield, X } from "lucide-react";
import { FACILITY_BUILD_COSTS, UNIT_RECRUITMENT_COSTS, getMilitaryProductionTurns, getFortificationBuildProfile, getFortificationRepairProfile, FORTIFICATION_MAX_LEVEL } from "../../game/content/economyRecipes";
import { Badge } from "../kit/Badge";
import { Button } from "../kit/Button";
import { ProgressBar } from "../kit/ProgressBar";
import { Window } from "../kit/Window";
import { FACILITY_META } from "../kit/resources";
import { UNIT_TYPE_LABELS } from "../kit/unitSymbols";
import { useGame } from "../session/GameProvider";
import { cancelRefundLabel } from "./buildOrderText";

export function RecruitmentPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, selectedRegionId, selectedRegion, playerCountryId,
    playerTurnActive, canAfford, getMissingResources, getBestOperationalFacility, handleBuildFacility,
    handleRemoveFacility, handleCancelBuildOrder, handleRecruitUnit, handleBuildFortification,
    handleUpgradeFortification, handleRepairFortification, selectedFacilityId, setSelectedFacilityId,
    regionBuildOrders,
  } = useGame();

  if (!bottomOpen || activeTab !== "military") return null;

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
    <Window
      title={`${selectedRegion.name} — Recruitment & Military`}
      icon={Medal}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center float-panel--wide"
      bodyClassName="economy-tab"
      layoutId="panel-recruitment"
    >
      <div className="economy-tab__col">
        <div className="economy-section__title">Military Facilities</div>
        {milFacilitiesBuilt.length === 0 ? (
          <span className="economy-empty">No facilities built</span>
        ) : (
          <div className="facility-list">
            {milFacilitiesBuilt.map((fac) => {
              const FacilityIcon = FACILITY_META[fac.type].Icon;
              return (
                <div
                  key={fac.id}
                  className={`facility-item facility-item--clickable ${fac.damaged ? "facility-item--damaged" : ""} ${selectedFacilityId === fac.id ? "facility-item--active" : ""}`}
                  onClick={() => setSelectedFacilityId(selectedFacilityId === fac.id ? null : fac.id)}
                >
                  <FacilityIcon className="facility-item__icon" size={13} aria-hidden="true" />
                  <span className="facility-item__type">{FACILITY_META[fac.type].label}</span>
                  <span className="facility-item__level">Lv.{fac.level}</span>
                  {fac.damaged && <Badge tone="bad">Damaged</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={X}
                    className="facility-item__remove"
                    title="Demolish"
                    aria-label="Demolish"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFacility(selectedRegionId, fac.id); }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="economy-section__title economy-section__title--spaced">Regional Fortification</div>
        {!fort ? (
          <span className="economy-empty">No fortification built</span>
        ) : (
          <div className="facility-list">
            <div className={`facility-item ${fort.damaged ? "facility-item--damaged" : ""}`}>
              <Shield className="facility-item__icon" size={13} aria-hidden="true" />
              <span className="facility-item__type">Fortification</span>
              <span className="facility-item__level">Lv.{fort.level}</span>
              <Badge tone="plain">HP {fort.health}/{fort.maxHealth}</Badge>
              {fort.damaged && <Badge tone="bad">Damaged</Badge>}
            </div>
          </div>
        )}

        <div className="economy-section__title economy-section__title--spaced">Build & Recruit Queue ({economy.facilities.length}/{economy.buildingSlots} Region Slots)</div>
        {milBuildOrders.length + fortOrders.length + unitOrders.length > 0 ? (
          <div className="build-queue">
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
                <ProgressBar value={(order.totalTurns - order.turnsRemaining) / order.totalTurns} />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  title={cancelRefundLabel(order)}
                  aria-label={cancelRefundLabel(order)}
                  onClick={() => handleCancelBuildOrder(order.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <span className="economy-empty">No active military production</span>
        )}
      </div>

      <div className="economy-tab__col">
        <div className="economy-section__title">Military Build Options</div>
        {selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
          <div className="build-actions">
            {economy.facilities.length + regionBuildOrders.filter((o) => o.type === "buildFacility").length < economy.buildingSlots ? (
              <div className="build-row">
                <span className="build-row__label">Facilities:</span>
                <div className="build-row__buttons">
                  {FACILITY_BUILD_COSTS.filter(r => militaryFacilitiesList.includes(r.facilityType)).map((recipe) => {
                    const affordable = canAfford(recipe.cost);
                    const missing = getMissingResources(recipe.cost);
                    const costStr = Object.entries(recipe.cost).length > 0 ? Object.entries(recipe.cost).map(([k, v]) => `${k}: ${v}`).join(", ") : "Free";
                    const titleStr = affordable ? `${costStr} — ${recipe.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} — ${recipe.turns} turns)`;
                    return (
                      <Button
                        key={recipe.facilityType}
                        variant="secondary"
                        size="sm"
                        disabled={!affordable}
                        onClick={() => handleBuildFacility(selectedRegionId, recipe.facilityType)}
                        title={titleStr}
                      >
                        {FACILITY_META[recipe.facilityType].label} ({recipe.turns}t)
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="economy-warning">Region building limit reached ({economy.buildingSlots} slots).</div>
            )}
            <div className="build-row">
              <span className="build-row__label">Units:</span>
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
                    <Button
                      key={recipe.unitType}
                      variant="secondary"
                      size="sm"
                      disabled={!hasBuilding || !affordable}
                      onClick={() => handleRecruitUnit(selectedRegionId, recipe.unitType)}
                      title={hasBuilding ? (affordable ? dynamicTitleStr : dynamicMissingTitleStr) : titleStr}
                    >
                      {UNIT_TYPE_LABELS[recipe.unitType]} ({recruitTurns}t)
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="build-row">
              <span className="build-row__label">Fort:</span>
              <div className="build-row__buttons">
                {!fort ? (() => {
                  const buildProfile = getFortificationBuildProfile(1);
                  if (!buildProfile) return null;
                  const affordable = canAfford(buildProfile.cost);
                  const missing = getMissingResources(buildProfile.cost);
                  const costStr = Object.entries(buildProfile.cost).map(([k, v]) => `${k}: ${v}`).join(", ");
                  const titleStr = affordable ? `${costStr} - ${buildProfile.turns} turns` : `Missing: ${missing.join(", ")}\n(Cost: ${costStr} - ${buildProfile.turns} turns)`;
                  return (
                    <Button variant="secondary" size="sm" disabled={!affordable} onClick={() => handleBuildFortification(selectedRegionId)} title={titleStr}>
                      Build Fort (Lv.1)
                    </Button>
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
                        <Button variant="secondary" size="sm" disabled={!affordable} onClick={() => handleUpgradeFortification(selectedRegionId)} title={titleStr}>
                          Upgrade Fort
                        </Button>
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
                        <Button variant="secondary" size="sm" disabled={!affordable} onClick={() => handleRepairFortification(selectedRegionId)} title={titleStr}>
                          Repair Fort
                        </Button>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Window>
  );
}
