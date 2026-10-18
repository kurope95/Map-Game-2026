import { useGame } from "../session/GameProvider";
import "./windows.css";

export function BattleReportWindow() {
  const { combatReportOpen, setCombatReportOpen, lastEventLogSnapshot, gameState } = useGame();

  if (!combatReportOpen || lastEventLogSnapshot.length === 0) return null;

  return (
    <div className="battle-report-overlay" onClick={() => setCombatReportOpen(false)}>
      <div className="battle-report" data-layout="battle-report" onClick={(e) => e.stopPropagation()}>
        <div className="battle-report__header">
          <span>⚔️ TURN {gameState.turn - 1} — BATTLE REPORT</span>
          <button className="window-close" onClick={() => setCombatReportOpen(false)}>✕</button>
        </div>
        <div className="battle-report__body">
          {lastEventLogSnapshot.map((evt, i) => {
            const isCombat = evt.toLowerCase().includes("attack") || evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("retreat") || evt.toLowerCase().includes("captures");
            const isDefeat = evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("eliminated");
            const isVictory = evt.toLowerCase().includes("captures") || evt.toLowerCase().includes("won");
            const eventClass = isDefeat
              ? "battle-report__event battle-report__event--defeat"
              : isVictory
                ? "battle-report__event battle-report__event--victory"
                : isCombat
                  ? "battle-report__event battle-report__event--combat"
                  : "battle-report__event";
            return (
              <div key={i} className={eventClass}>
                {isCombat ? "⚔️ " : "📡 "}{evt}
              </div>
            );
          })}
        </div>
        <div className="battle-report__footer">
          <button className="top-bar__btn top-bar__btn--primary" onClick={() => setCombatReportOpen(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
