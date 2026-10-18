import "./FloatPanel.css";
import { ScrollText } from "lucide-react";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";

export function EventLogPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab } = useGame();

  if (!bottomOpen || activeTab !== "log") return null;

  return (
    <Window
      title="Event Log"
      icon={ScrollText}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center"
      layoutId="panel-eventlog"
    >
      <div className="panel-card panel-card--log">
        <ul>{[...gameState.eventLog].slice(-12).reverse().map((entry, i) => (<li key={`${entry}-${i}`}>{entry}</li>))}</ul>
      </div>
    </Window>
  );
}
