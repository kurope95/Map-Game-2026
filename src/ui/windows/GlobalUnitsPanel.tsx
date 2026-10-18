import "./GlobalUnitsPanel.css";
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
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

export function GlobalUnitsPanel() {
  const {
    gameState, globalUnitsOpen, setGlobalUnitsOpen, playerCountry, allPlayerUnits,
    setSelectedRegionId, getUnitOrder,
  } = useGame();

  if (!globalUnitsOpen) return null;

  return (
    <div className="global-units-panel" data-layout="global-units">
      <div className="global-units-panel__header">
        <span className="global-units-panel__title">All {playerCountry.name} Units ({allPlayerUnits.length})</span>
        <Button variant="ghost" size="sm" icon={X} className="global-units-panel__close" onClick={() => setGlobalUnitsOpen(false)} title="Close" aria-label="Close" />
      </div>
      <div className="global-units-panel__list">
        {allPlayerUnits.map((unit) => {
          const region = gameState.regions[unit.regionId];
          const order = getUnitOrder(unit.id);
          const supplyStatus = getSupplyStatus(unit);
          const maxStrength = MAX_UNIT_STRENGTH[unit.type] ?? 8;
          const strengthRatio = unit.strength / maxStrength;
          const strengthTone = strengthRatio > 0.66 ? "good" : strengthRatio > 0.33 ? "warn" : "bad";
          const nationColor = NATION_COLORS[unit.countryId];
          return (
            <div
              key={unit.id}
              className={`global-unit-row global-unit-row--supply-${supplyStatus.tone}`}
              style={{ "--unit-color": nationColor } as CSSProperties}
              onClick={() => { setSelectedRegionId(unit.regionId); setGlobalUnitsOpen(false); }}
            >
              <div className="global-unit-row__top">
                <UnitSymbol type={unit.type} size={20} color={nationColor} />
                <span className="global-unit-row__type">{UNIT_TYPE_LABELS[unit.type]}</span>
                <span className="global-unit-row__location">{region?.name ?? "?"}</span>
              </div>
              <ProgressBar value={strengthRatio} tone={strengthTone} />
              <div className="global-unit-row__stats">
                <Badge tone={SUPPLY_TONES[supplyStatus.tone] ?? "plain"}>{supplyStatus.label}</Badge>
                <Badge tone="plain">Str {unit.strength}</Badge>
                <Badge tone="plain">Vet {getVeterancyLevel(unit)}</Badge>
                <Badge tone="plain">Ent {getEntrenchmentBonus(unit)}%</Badge>
                {order && <Badge tone={order.type === "attack" ? "bad" : "info"}>{order.type}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
