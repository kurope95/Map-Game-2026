import "./FloatPanel.css";
import { useGame } from "../session/GameProvider";

export function EventLogPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab } = useGame();

  if (!bottomOpen || activeTab !== "log") return null;

  return (
    <div className="float-panel float-panel--bottom-center" data-layout="panel-eventlog">
      <div className="float-panel__header">
        <span>Event Log</span>
        <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
      </div>
      <div className="float-panel__body panel-card">
        <ul>{[...gameState.eventLog].slice(-12).reverse().map((entry, i) => (<li key={`${entry}-${i}`}>{entry}</li>))}</ul>
      </div>
    </div>
  );
}
