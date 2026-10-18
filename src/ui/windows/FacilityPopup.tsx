import "./FacilityPopup.css";
import "../panels/EconomyPanels.css";
import { CHEMICAL_PLANT_RECIPES, CIVILIAN_GOOD_RECIPES, EXTRACTION_FACILITY_RESOURCES, MUNITIONS_PLANT_RECIPE, PROCESSING_RECIPES, UNIT_RECRUITMENT_COSTS, getFacilityBuildRecipe, getFacilityRepairProfile, getFacilityUpgradeCost, getMilitaryProductionTurns, getReplenishmentCost, MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import { useGame } from "../session/GameProvider";

export function FacilityPopup() {
  const {
    gameState, selectedRegionId, selectedRegion, selectedFacilityId, setSelectedFacilityId,
    playerCountryId, playerTurnActive, canAfford, getMissingResources, handleRecruitUnit,
    handleReplenishUnit, handleToggleChemicalMode, handleUpgradeFacility, handleRepairFacility,
  } = useGame();

  const economy = gameState.regionEconomies[selectedRegionId];
  if (!selectedFacilityId || !economy) return null;
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
    <div className="facility-popup" data-layout="facility">
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
}
