import { useGame } from "../session/GameProvider";
import "./windows.css";

export function VictoryOverlay() {
  const { victoryStatus, playerCountry, gameState, setGameStarted, handleLoadGame } = useGame();

  if (victoryStatus === "ongoing") return null;

  const won = victoryStatus === "player_victory";

  return (
    <div className={`victory-overlay ${won ? "victory-overlay--victory" : "victory-overlay--defeat"}`}>
      <div className={`victory-overlay__panel ${won ? "victory-overlay__panel--victory" : "victory-overlay__panel--defeat"}`} data-layout="victory">
        <div className={`victory-overlay__header ${won ? "victory-overlay__header--victory" : "victory-overlay__header--defeat"}`}>
          <div className={`victory-overlay__title ${won ? "victory-overlay__title--victory" : "victory-overlay__title--defeat"}`}>
            {won ? "🏆 VICTORY" : "💀 DEFEAT"}
          </div>
          <div className="victory-overlay__message">
            {won
              ? `${playerCountry.name} has achieved total dominance! All enemy major powers have been defeated.`
              : `${playerCountry.name} has fallen. The war is lost.`}
          </div>
          <div className="victory-overlay__meta">
            Turn {gameState.turn} • {Object.values(gameState.countryStates).filter((s) => s.defeatedOnTurn !== undefined).length} nations defeated
          </div>
        </div>
        <div className="victory-overlay__actions">
          <button className="top-bar__btn top-bar__btn--primary" onClick={() => { setGameStarted(false); }}>
            New Game
          </button>
          <button className="top-bar__btn top-bar__btn--secondary" onClick={() => handleLoadGame()}>
            Load Save
          </button>
        </div>
      </div>
    </div>
  );
}
