import "./FacilityPopup.css";
import { TriangleAlert } from "lucide-react";
import type { StockpileKey } from "../../game/state/types";
import { CHEMICAL_PLANT_RECIPES, CIVILIAN_GOOD_RECIPES, EXTRACTION_FACILITY_RESOURCES, MUNITIONS_PLANT_RECIPE, PROCESSING_RECIPES, UNIT_RECRUITMENT_COSTS, getFacilityBuildRecipe, getFacilityRepairProfile, getFacilityUpgradeCost, getMilitaryProductionTurns, getReplenishmentCost, MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import { Button } from "../kit/Button";
import { ResourceAmount } from "../kit/ResourceAmount";
import { ResourceIcon } from "../kit/ResourceIcon";
import { RESOURCE_META, FACILITY_META } from "../kit/resources";
import { UNIT_TYPE_LABELS } from "../kit/unitSymbols";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";

function ResourceList({ amounts }: { amounts: Record<string, number> }) {
  return (
    <span className="facility-popup__resources">
      {Object.entries(amounts).map(([resource, amount]) => (
        <ResourceAmount key={resource} resource={resource as StockpileKey} amount={amount} />
      ))}
    </span>
  );
}

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
  const stationableUnits = Object.values(gameState.units).filter(u =>
    u.regionId === selectedRegionId &&
    u.countryId === playerCountryId &&
    u.strength < MAX_UNIT_STRENGTH[u.type] &&
    recruitableUnits.some(r => r.unitType === u.type)
  );

  return (
    <Window
      title={`${FACILITY_META[facility.type].label} — Lv.${facility.level}`}
      icon={FACILITY_META[facility.type].Icon}
      onClose={() => setSelectedFacilityId(null)}
      variant="popup"
      className="facility-popup"
      layoutId="facility"
    >
      {facility.damaged && (
        <div className="facility-popup__info facility-popup__info--bad">
          <TriangleAlert size={13} aria-hidden="true" />
          DAMAGED — not producing
        </div>
      )}
      {recruitableUnits.length > 0 && !facility.damaged && militaryTimeBonus > 0 && (
        <div className="facility-popup__info facility-popup__info--good">
          Recruitment bonus: -{militaryTimeBonus} turn{militaryTimeBonus === 1 ? "" : "s"} for units built here
        </div>
      )}

      {/* Extraction facilities */}
      {extractionResources && (
        <div className="facility-popup__production">
          <div className="facility-popup__prod-title">Extracts per turn:</div>
          {economy.resourceDeposits.filter((d) => extractionResources.includes(d.type)).map((dep, i) => (
            <div key={i} className="facility-popup__prod-row">
              <span className="facility-popup__prod-label">
                <ResourceIcon resource={dep.type} />
                {dep.type === "food" ? "Food (fertility)" : RESOURCE_META[dep.type].label}
              </span>
              <span className="facility-popup__prod-yield">+{dep.richness * facility.level} /turn</span>
            </div>
          ))}
          {isFarm && facility.level >= 2 && (
            <div className="facility-popup__prod-row facility-popup__prod-row--good">
              <span className="facility-popup__prod-label">Weed production unlocked</span>
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
            <span className="facility-popup__prod-label">In:</span>
            <ResourceList amounts={processingRecipe.inputs} />
          </div>
          <div className="facility-popup__prod-row">
            <span className="facility-popup__prod-label">Out:</span>
            <ResourceList amounts={Object.fromEntries(Object.entries(processingRecipe.outputs).map(([k, v]) => [k, (v ?? 0) * facility.level]))} />
          </div>
          {processingRecipe.energyCost > 0 && <div className="facility-popup__prod-cost">{processingRecipe.energyCost} energy/turn</div>}
        </div>
      )}

      {/* Munitions plant */}
      {isMunitionsPlant && (
        <div className="facility-popup__production">
          <div className="facility-popup__prod-title">Produces per turn (×Lv.{facility.level}):</div>
          <div className="facility-popup__prod-row">
            <span className="facility-popup__prod-label">In:</span>
            <ResourceList amounts={MUNITIONS_PLANT_RECIPE.inputs} />
          </div>
          <div className="facility-popup__prod-row">
            <span className="facility-popup__prod-label">Out:</span>
            <ResourceAmount resource="munitions" amount={(MUNITIONS_PLANT_RECIPE.outputs.munitions ?? 0) * facility.level} />
          </div>
          <div className="facility-popup__prod-cost">{MUNITIONS_PLANT_RECIPE.energyCost} energy/turn</div>
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
              <span className="facility-popup__prod-label">In:</span>
              <ResourceList amounts={cRecipe.inputs} />
            </div>
            <div className="facility-popup__prod-row">
              <span className="facility-popup__prod-label">Out:</span>
              <ResourceList amounts={Object.fromEntries(Object.entries(cRecipe.outputs).map(([k, v]) => [k, (v ?? 0) * facility.level]))} />
            </div>
            <Button variant="secondary" size="sm" className="facility-popup__mode-button" onClick={() => handleToggleChemicalMode(selectedRegionId, facility.id)}>
              Switch to {mode === "explosives" ? "fertilizer" : "explosives"}
            </Button>
          </div>
        );
      })()}

      {/* Civilian factory */}
      {isCivilianFactory && (
        <div className="facility-popup__production">
          <div className="facility-popup__prod-title">Civilian goods (auto per turn):</div>
          {CIVILIAN_GOOD_RECIPES.filter((r) => r.requiredLevel <= facility.level).map((r) => (
            <div key={r.good} className="facility-popup__prod-row">
              <ResourceList amounts={r.inputs} />
              <span className="facility-popup__prod-arrow">→</span>
              <span className="facility-popup__prod-out">
                <ResourceAmount resource={r.good} amount={r.outputAmount} />
                <span className="facility-popup__trade">+{r.tradeValue} trade</span>
              </span>
            </div>
          ))}
          {CIVILIAN_GOOD_RECIPES.some((r) => r.requiredLevel > facility.level) && (
            <div className="facility-popup__prod-cost facility-popup__prod-cost--muted">
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
              <div key={recipe.unitType} className="facility-popup__prod-row">
                <span className="facility-popup__prod-label">{UNIT_TYPE_LABELS[recipe.unitType]}</span>
                <ResourceList amounts={recipe.cost} />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!affordable || facility.damaged}
                  onClick={() => { handleRecruitUnit(selectedRegionId, recipe.unitType); }}
                  title={facility.damaged ? "Repair this facility first" : affordable ? "" : `Missing: ${getMissingResources(recipe.cost).join(", ")}`}
                >
                  Recruit ({recruitTurns}t)
                </Button>
              </div>
            );
          })}

          {/* Replenish troops currently stationed here */}
          {stationableUnits.length > 0 && (
            <div className="facility-popup__subsection">
              <div className="facility-popup__prod-title">Replenish stationed troops:</div>
              {stationableUnits.map((unit) => {
                const repInfo = getReplenishmentCost(unit.type, unit.strength, facility.level);
                if (!repInfo) return null;
                const replenishCost = repInfo.cost;
                const affordable = canAfford(replenishCost);
                const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
                return (
                  <div key={unit.id} className="facility-popup__prod-row">
                    <span className="facility-popup__prod-label">{UNIT_TYPE_LABELS[unit.type]} ({unit.strength}/{MAX_UNIT_STRENGTH[unit.type]})</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!affordable || alreadyReplenishing}
                      onClick={() => { handleReplenishUnit(unit.id); }}
                      title={alreadyReplenishing ? "Already replenishing" : affordable ? "" : `Missing: ${getMissingResources(replenishCost).join(", ")}`}
                    >
                      {alreadyReplenishing ? "Queued" : `Replenish (${repInfo.turns}t - ${Object.entries(replenishCost).map(([k, v]) => `${v} ${k}`).join(", ")})`}
                    </Button>
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
          <Button
            variant="secondary"
            size="sm"
            disabled={facility.damaged || !canAfford(upgradeCost)}
            onClick={() => { handleUpgradeFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }}
            title={facility.damaged ? "Repair this facility first" : canAfford(upgradeCost) ? "" : `Missing: ${getMissingResources(upgradeCost).join(", ")}`}
          >
            Upgrade to Lv.{facility.level + 1} ({Object.entries(upgradeCost).map(([k, v]) => `${v} ${k}`).join(", ")})
          </Button>
        </div>
      )}
      {repairProfile && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
        <div className="facility-popup__actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canAfford(repairProfile.cost) || (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "repairFacility" && o.facilityId === facility.id)}
            onClick={() => { handleRepairFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }}
            title={canAfford(repairProfile.cost) ? "" : `Missing: ${getMissingResources(repairProfile.cost).join(", ")}`}
          >
            Repair ({repairProfile.turns}t{Object.keys(repairProfile.cost).length > 0 ? ` - ${Object.entries(repairProfile.cost).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""})
          </Button>
        </div>
      )}
    </Window>
  );
}
