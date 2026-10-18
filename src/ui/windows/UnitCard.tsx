import "./UnitCard.css";
import { getReplenishmentCost, getUnitRecruitmentRecipe, MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import type { UnitDefinition } from "../../game/state/types";
import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "../format/unitStatus";
import { useGame } from "../session/GameProvider";

export function UnitCard({ unit }: { unit: UnitDefinition }) {
  const {
    gameState, playerCountryId, playerTurnActive, playerBlocId, selectedUnitIds,
    getUnitOrder, getBestOperationalFacility, handleSelectUnit, handleHoldUnit,
    handleReplenishUnit, handleCancelOrder,
  } = useGame();

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
}
