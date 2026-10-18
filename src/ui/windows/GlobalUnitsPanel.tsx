import "./GlobalUnitsPanel.css";
import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "../format/unitStatus";
import { useGame } from "../session/GameProvider";

export function GlobalUnitsPanel() {
  const {
    gameState, globalUnitsOpen, setGlobalUnitsOpen, playerCountry, allPlayerUnits,
    setSelectedRegionId, getUnitOrder,
  } = useGame();

  if (!globalUnitsOpen) return null;

  return (
    <div className="global-units-panel" data-layout="global-units">
      <div className="global-units-panel__header">
        <span>All {playerCountry.name} Units ({allPlayerUnits.length})</span>
        <button className="global-units-panel__close" onClick={() => setGlobalUnitsOpen(false)}>Close</button>
      </div>
      <div className="global-units-panel__list">
        {allPlayerUnits.map((unit) => {
          const region = gameState.regions[unit.regionId];
          const order = getUnitOrder(unit.id);
          const supplyStatus = getSupplyStatus(unit);
          return (
            <div
              key={unit.id}
              className={`global-unit-row global-unit-row--supply-${supplyStatus.tone}`}
              onClick={() => { setSelectedRegionId(unit.regionId); setGlobalUnitsOpen(false); }}
            >
              <span className="global-unit-row__icon">
                {unit.type === "infantry" ? "\u2694" : unit.type === "armor" ? "\u{1F6E1}" : unit.type === "fighter" ? "\u2708" : unit.type === "bomber" ? "\u{1F4A3}" : "\u{1F3AF}"}
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="global-unit-row__type">{unit.type}</span>
                <span className="global-unit-row__location">{region?.name ?? "?"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="global-unit-row__stats">
                  STR {unit.strength} | SUP {unit.supplyTurnsRemaining} | VET {getVeterancyLevel(unit)} | ENT {getEntrenchmentBonus(unit)}%
                </span>
                <span className={`global-unit-row__supply global-unit-row__supply--${supplyStatus.tone}`}>{supplyStatus.label}</span>
                {order && <span className={`global-unit-row__order global-unit-row__order--${order.type}`}>{order.type}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
