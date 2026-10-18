import "./SupplyToggle.css";
import { useGame } from "../session/GameProvider";

export function SupplyToggle() {
  const { showSupplyOverlay, setShowSupplyOverlay } = useGame();
  return (
    <button
      className={`supply-toggle ${showSupplyOverlay ? "supply-toggle--on" : ""}`}
      data-layout="supply-toggle"
      onClick={() => setShowSupplyOverlay((o) => !o)}
    >
      📡 SUPPLY LINES {showSupplyOverlay ? "[ON]" : "[OFF]"}
    </button>
  );
}
