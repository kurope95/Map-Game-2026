import "./FloatPanel.css";
import { useGame } from "../session/GameProvider";

export function WarStatusPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab } = useGame();

  if (!bottomOpen || activeTab !== "war") return null;

  return (
    <div className="float-panel float-panel--bottom-center float-panel--wide" data-layout="panel-warstatus">
      <div className="float-panel__header">
        <span>War Status</span>
        <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
      </div>
      <div className="float-panel__body panel-grid panel-grid--cols-4">
        {Object.values(gameState.countries).map((country) => {
          const status = gameState.countryStates[country.id];
          return (<div className="panel-card" key={country.id}><p><span className={`war-dot ${status.atWar ? "war-dot--active" : "war-dot--inactive"}`} /><strong>{country.name}</strong> — {status.atWar ? `At war (turn ${status.activatedOnTurn})` : country.alignment === "neutral" ? "Neutral" : "Aligned, not at war"}</p></div>);
        })}
      </div>
    </div>
  );
}
