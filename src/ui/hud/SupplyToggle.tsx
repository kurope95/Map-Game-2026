import "./SupplyToggle.css";
import { Network } from "lucide-react";
import { useGame } from "../session/GameProvider";

export function SupplyToggle() {
  const { showSupplyOverlay, setShowSupplyOverlay } = useGame();
  return (
    <button
      className={`supply-toggle ${showSupplyOverlay ? "supply-toggle--on" : ""}`}
      data-layout="supply-toggle"
      aria-pressed={showSupplyOverlay}
      onClick={() => setShowSupplyOverlay((o) => !o)}
    >
      <Network className="supply-toggle__icon" size={13} aria-hidden="true" />
      Supply lines
    </button>
  );
}
