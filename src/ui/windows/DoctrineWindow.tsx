import { DOCTRINE_DEFINITIONS } from "../../game/content/doctrines";
import { useGame } from "../session/GameProvider";
import "./windows.css";

export function DoctrineWindow() {
  const { gameState, playerCountryId, doctrineOpen, setDoctrineOpen, handlePurchaseDoctrine } = useGame();

  if (!doctrineOpen) return null;

  return (
    <div className="doctrine-overlay" data-layout="doctrines-backdrop" onClick={() => setDoctrineOpen(false)}>
      <div className="doctrine-window" data-layout="doctrines" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doctrine-window__header">
          <span className="doctrine-window__title">🎓 DOCTRINE UPGRADES</span>
          <div className="doctrine-window__tools">
            <span className="doctrine-window__trade">Trade Points: {Math.floor(gameState.countryStockpiles[playerCountryId].tradePoints)}</span>
            <button className="window-close" onClick={() => setDoctrineOpen(false)}>✕</button>
          </div>
        </div>
        {/* Doctrine grid */}
        <div className="doctrine-window__grid">
          {DOCTRINE_DEFINITIONS.map((def) => {
            const owned = gameState.doctrineUpgrades?.[playerCountryId]?.includes(def.id) ?? false;
            const prereqsMet = (def.requires ?? []).every(r => gameState.doctrineUpgrades?.[playerCountryId]?.includes(r));
            const canAfford = gameState.countryStockpiles[playerCountryId].tradePoints >= def.cost;
            const available = !owned && prereqsMet;
            const cardState = owned ? "owned" : available ? "available" : "unavailable";
            const buyState = !available ? "locked" : canAfford ? "ready" : "poor";
            return (
              <div key={def.id} className={`doctrine-card doctrine-card--${cardState}`}>
                <div className="doctrine-card__head">
                  <span className={`doctrine-card__name ${owned ? "doctrine-card__name--owned" : ""}`}>
                    {owned ? "✓ " : ""}{def.name}
                  </span>
                  <span className={`doctrine-card__category doctrine-card__category--${def.category}`}>
                    {def.category}
                  </span>
                </div>
                <div className="doctrine-card__description">{def.description}</div>
                {def.requires && def.requires.length > 0 && !owned && (
                  <div className="doctrine-card__requires">
                    Requires: {def.requires.map(r => DOCTRINE_DEFINITIONS.find(d => d.id === r)?.name ?? r).join(", ")}
                  </div>
                )}
                {!owned && (
                  <button
                    onClick={() => handlePurchaseDoctrine(def.id)}
                    disabled={!available || !canAfford}
                    className={`doctrine-card__buy doctrine-card__buy--${buyState}`}
                  >
                    {!prereqsMet ? "🔒 Locked" : canAfford ? `Unlock — ${def.cost} TP` : `Need ${def.cost} TP`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
