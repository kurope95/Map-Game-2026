import "./FloatPanel.css";
import { useGame } from "../session/GameProvider";

export function AiIntelPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab, currentRecommendation, lastBotDecision } = useGame();

  if (!bottomOpen || activeTab !== "ai") return null;

  return (
    <div className="float-panel float-panel--bottom-center float-panel--wide" data-layout="panel-aiintel">
      <div className="float-panel__header">
        <span>AI Intel</span>
        <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
      </div>
      <div className="float-panel__body panel-grid panel-grid--cols-2">
        <div className="panel-card">
          <h4>AI Priority</h4>
          {currentRecommendation ? (
            <>
              <p>{currentRecommendation.reasoning}</p>
              <ul>{currentRecommendation.actions.map((a, i) => (<li key={`rec-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> ← {a.orderType} from {gameState.regions[a.fromRegionId]?.name} <em style={{ color: "var(--accent)" }}>(score {Math.round(a.score)})</em></li>))}</ul>
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>Switch to this tab to compute AI recommendation.</p>
          )}
        </div>
        <div className="panel-card">
          <h4>Last AI Move</h4>
          <p>{lastBotDecision === null ? "No AI move executed yet." : lastBotDecision.reasoning}</p>
          {lastBotDecision && (<ul>{lastBotDecision.actions.map((a, i) => (<li key={`last-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> {a.orderType} (score {Math.round(a.score)})</li>))}</ul>)}
        </div>
      </div>
    </div>
  );
}
