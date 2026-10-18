import "./UnitDrawer.css";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useGame } from "../session/GameProvider";
import { UnitCard } from "./UnitCard";

export function UnitDrawer() {
  const { selectedRegion, unitsInRegion, unitDrawerOpen, setUnitDrawerOpen, selectedUnitIds } = useGame();

  if (unitsInRegion.length === 0) return null;

  return (
    <div className={`unit-drawer ${unitDrawerOpen ? "unit-drawer--open" : "unit-drawer--closed"}`} data-layout="unit-drawer">
      <button className="unit-drawer__toggle" onClick={() => setUnitDrawerOpen((o) => !o)}>
        <span className="unit-drawer__label">Units in {selectedRegion.name} ({unitsInRegion.length})</span>
        {unitDrawerOpen ? <ChevronDown className="unit-drawer__chevron" size={14} aria-hidden="true" /> : <ChevronUp className="unit-drawer__chevron" size={14} aria-hidden="true" />}
      </button>
      {unitDrawerOpen && (
        <div className="unit-drawer__list">
          {selectedUnitIds.size > 0 && (
            <div className="unit-drawer__hint">
              {selectedUnitIds.size === 1 ? "Click an adjacent region to move or attack" : `${selectedUnitIds.size} units selected — click a target region to attack with all`}
            </div>
          )}
          {unitsInRegion.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
