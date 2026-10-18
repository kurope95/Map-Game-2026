import "./UnitCard.css";
import type { CSSProperties } from "react";
import { getReplenishmentCost, getUnitRecruitmentRecipe, MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import type { UnitDefinition } from "../../game/state/types";
import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "../format/unitStatus";
import { Badge, type BadgeTone } from "../kit/Badge";
import { Button } from "../kit/Button";
import { ProgressBar } from "../kit/ProgressBar";
import { UnitSymbol } from "../kit/UnitSymbol";
import { UNIT_TYPE_LABELS } from "../kit/unitSymbols";
import { NATION_COLORS } from "../theme/palette";
import { useGame } from "../session/GameProvider";

const SUPPLY_TONES: Record<string, BadgeTone> = {
  good: "good",
  low: "warn",
  critical: "warn",
  cutoff: "bad",
  air: "info"
};

const ORDER_LABELS: Record<string, string> = {
  attack: "Attack",
  move: "Move",
  airSupport: "Air support",
  bombardment: "Bombard",
  hold: "Hold"
};

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
  const maxStrength = MAX_UNIT_STRENGTH[unit.type] ?? 8;
  const strengthRatio = unit.strength / maxStrength;
  const strengthTone = strengthRatio > 0.66 ? "good" : strengthRatio > 0.33 ? "warn" : "bad";
  const nationColor = NATION_COLORS[unit.countryId];

  return (
    <div
      className={`unit-card ${isSelected ? "unit-card--selected" : ""} ${isOwn ? "unit-card--own" : ""} ${isAllied ? "unit-card--ally" : ""} ${isEnemy ? "unit-card--enemy" : ""} unit-card--supply-${supplyStatus.tone}`}
      style={{ "--unit-color": nationColor } as CSSProperties}
      onClick={() => isOwn && handleSelectUnit(unit)}
    >
      <div className="unit-card__top">
        <UnitSymbol type={unit.type} size={22} color={nationColor} />
        <span className="unit-card__type">{UNIT_TYPE_LABELS[unit.type]}</span>
        <Badge tone={isBrics ? "brics" : isNeutral ? "neutral" : "nato"}>
          {isBrics ? "BRICS" : isNeutral ? "Neutral" : "NATO"}
        </Badge>
      </div>
      <ProgressBar value={strengthRatio} tone={strengthTone} />
      <div className="unit-card__badges">
        <Badge tone={SUPPLY_TONES[supplyStatus.tone] ?? "plain"}>{supplyStatus.label}</Badge>
        <Badge tone="plain">Vet {getVeterancyLevel(unit)}</Badge>
        <Badge tone="plain">Ent {getEntrenchmentBonus(unit)}%</Badge>
        {isAllied && <Badge tone="good">Ally</Badge>}
        {isEnemy && <Badge tone="bad">Enemy</Badge>}
      </div>
      {order && (
        <span className={`unit-card__order unit-card__order--${order.type}`}>
          {ORDER_LABELS[order.type] ?? order.type}
          {order.type !== "hold" && gameState.regions[order.targetRegionId] ? ` → ${gameState.regions[order.targetRegionId].name}` : ""}
        </span>
      )}
      {isSelected && isOwn && (
        <div className="unit-card__actions">
          <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleHoldUnit(unit.id); }}>Hold</Button>
          {unit.strength < maxStrength && (() => {
            const recruitRecipe = getUnitRecruitmentRecipe(unit.type);
            const sourceFacility = recruitRecipe ? getBestOperationalFacility(unit.regionId, recruitRecipe.requiredFacility) : null;
            const repInfo = getReplenishmentCost(unit.type, unit.strength, sourceFacility?.level ?? 1);
            const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
            if (alreadyReplenishing) return <Button variant="secondary" size="sm" disabled>Replenishing…</Button>;
            if (!repInfo) return null;
            const costStr = Object.entries(repInfo.cost).map(([k, v]) => `${v}${k.slice(0, 3)}`).join("+");
            return (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleReplenishUnit(unit.id); }}
                title={`Restore to full strength (${repInfo.turns}T, ${costStr})`}
              >
                Replenish ({costStr})
              </Button>
            );
          })()}
          {order && (
            <Button
              variant="ghost"
              size="sm"
              className="unit-card__cancel"
              onClick={(e) => { e.stopPropagation(); handleCancelOrder(unit.id); }}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
