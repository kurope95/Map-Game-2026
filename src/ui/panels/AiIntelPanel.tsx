import "./FloatPanel.css";
import { BrainCircuit } from "lucide-react";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";

export function AiIntelPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab, currentRecommendation, lastBotDecision } = useGame();

  if (!bottomOpen || activeTab !== "ai") return null;

  return (
    <Window
      title="AI Intel"
      icon={BrainCircuit}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center float-panel--wide"
      bodyClassName="panel-grid panel-grid--cols-2"
      layoutId="panel-aiintel"
    >
      <div className="panel-card">
        <h4>AI Priority</h4>
        {currentRecommendation ? (
          <>
            <p>{currentRecommendation.reasoning}</p>
            <ul>{currentRecommendation.actions.map((a, i) => (<li key={`rec-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> ← {a.orderType} from {gameState.regions[a.fromRegionId]?.name} <em className="panel-card__score">(score {Math.round(a.score)})</em></li>))}</ul>
          </>
        ) : (
          <p>Switch to this tab to compute AI recommendation.</p>
        )}
      </div>
      <div className="panel-card">
        <h4>Last AI Move</h4>
        <p>{lastBotDecision === null ? "No AI move executed yet." : lastBotDecision.reasoning}</p>
        {lastBotDecision && (<ul>{lastBotDecision.actions.map((a, i) => (<li key={`last-${i}`}><strong>{gameState.regions[a.targetRegionId]?.name}</strong> {a.orderType} (score {Math.round(a.score)})</li>))}</ul>)}
      </div>
    </Window>
  );
}
