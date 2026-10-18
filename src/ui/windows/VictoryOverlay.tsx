import { Button } from "../kit/Button";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";
import "./windows.css";

export function VictoryOverlay() {
  const { victoryStatus, playerCountry, gameState, setGameStarted, handleLoadGame } = useGame();

  if (victoryStatus === "ongoing") return null;

  const won = victoryStatus === "player_victory";

  return (
    <Window
      title={won ? "Victory" : "Defeat"}
      flag={playerCountry.id}
      variant="modal"
      className={`victory-overlay__panel ${won ? "victory-overlay__panel--victory" : "victory-overlay__panel--defeat"}`}
      backdropClassName={`victory-overlay ${won ? "victory-overlay--victory" : "victory-overlay--defeat"}`}
      layoutId="victory"
      footer={
        <>
          <Button variant="primary" onClick={() => { setGameStarted(false); }}>
            New Game
          </Button>
          <Button variant="secondary" onClick={() => handleLoadGame()}>
            Load Save
          </Button>
        </>
      }
    >
      <div className="victory-overlay__message">
        {won
          ? `${playerCountry.name} has achieved total dominance! All enemy major powers have been defeated.`
          : `${playerCountry.name} has fallen. The war is lost.`}
      </div>
      <div className="victory-overlay__meta">
        Turn {gameState.turn} • {Object.values(gameState.countryStates).filter((s) => s.defeatedOnTurn !== undefined).length} nations defeated
      </div>
    </Window>
  );
}
