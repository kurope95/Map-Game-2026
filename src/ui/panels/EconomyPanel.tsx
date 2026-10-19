import "./FloatPanel.css";
import "./EconomyPanels.css";
import { Factory, X } from "lucide-react";
import { FACILITY_BUILD_COSTS, EXTRACTION_FACILITY_RESOURCES } from "../../game/content/economyRecipes";
import { Badge } from "../kit/Badge";
import { Button } from "../kit/Button";
import { ProgressBar } from "../kit/ProgressBar";
import { Window } from "../kit/Window";
import { FACILITY_META } from "../kit/resources";
import { useGame } from "../session/GameProvider";
import { canRepeatFacilityBuild } from "../session/lastFacilityBuild";
import { cancelRefundLabel } from "./buildOrderText";

export function EconomyPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, selectedRegionId, selectedRegion, playerCountryId,
    playerTurnActive, canAfford, getMissingResources, handleBuildFacility, handleRemoveFacility,
    handleCancelBuildOrder, setLogicMapOpen, selectedFacilityId, setSelectedFacilityId, regionBuildOrders,
    lastFacilityBuild,
  } = useGame();

  if (!bottomOpen || activeTab !== "economy") return null;

  const economy = gameState.regionEconomies[selectedRegionId];
  if (!economy) return null;

  const civilianFacilitiesList = ["farm", "mine", "oilWell", "powerPlant", "smelter", "civilianFactory", "syntheticRefinery", "chemicalPlant"];
  const civFacilitiesBuilt = economy.facilities.filter(f => civilianFacilitiesList.includes(f.type));
  const lastBuildRegion = lastFacilityBuild ? gameState.regions[lastFacilityBuild.regionId] : undefined;
  const canRepeatLastBuild = canRepeatFacilityBuild(
    lastFacilityBuild,
    lastBuildRegion,
    playerCountryId,
    playerTurnActive
  );
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
    <Window
      title={`${selectedRegion.name} — Economy`}
      icon={Factory}
      actions={<Button variant="secondary" size="sm" onClick={() => setLogicMapOpen(true)}>Logic Map</Button>}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center float-panel--wide"
      bodyClassName="economy-tab"
      layoutId="panel-economy"
    >
      {/* COL 1: Facilities (clickable) */}
      <div className="economy-tab__col">
        <div className="economy-section__title">Civilian Facilities</div>
        {civFacilitiesBuilt.length === 0 ? (
          <span className="economy-empty">No facilities built</span>
        ) : (
          <div className="facility-list">
            {civFacilitiesBuilt.map((fac) => {
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
                  {fac.chemicalMode && <Badge tone="info">{fac.chemicalMode}</Badge>}
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

        <div className="economy-section__title economy-section__title--spaced">Build Status ({economy.facilities.length}/{economy.buildingSlots} Region Slots)</div>
        {civOrders.length > 0 ? (
          <div className="build-queue">
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
          <span className="economy-empty">No active construction</span>
        )}
      </div>
      {/* COL 2: Build */}
      <div className="economy-tab__col">
        <div className="economy-section__title">Construct Facility</div>
        {lastFacilityBuild && lastFacilityBuild.countryId === playerCountryId && (
          <div className="economy-repeat">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canRepeatLastBuild}
              title={
                canRepeatLastBuild
                  ? `Queue another ${FACILITY_META[lastFacilityBuild.facilityType].label} in ${lastBuildRegion?.name ?? lastFacilityBuild.regionId}`
                  : !playerTurnActive
                    ? "Only during your turn"
                    : "That region is no longer under your control"
              }
              onClick={() => handleBuildFacility(lastFacilityBuild.regionId, lastFacilityBuild.facilityType)}
            >
              Repeat: {FACILITY_META[lastFacilityBuild.facilityType].label} ({lastBuildRegion?.name ?? lastFacilityBuild.regionId})
            </Button>
          </div>
        )}
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
          </div>
        )}
      </div>
    </Window>
  );
}
