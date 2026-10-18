import "./FloatPanel.css";
import "./EconomyPanels.css";
import { FACILITY_BUILD_COSTS, EXTRACTION_FACILITY_RESOURCES } from "../../game/content/economyRecipes";
import { useGame } from "../session/GameProvider";

export function EconomyPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, selectedRegionId, selectedRegion, playerCountryId,
    playerTurnActive, canAfford, getMissingResources, handleBuildFacility, handleRemoveFacility,
    handleCancelBuildOrder, setLogicMapOpen, selectedFacilityId, setSelectedFacilityId, regionBuildOrders,
  } = useGame();

  if (!bottomOpen || activeTab !== "economy") return null;

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
    <div className="float-panel float-panel--bottom-center float-panel--wide" data-layout="panel-economy">
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
}
