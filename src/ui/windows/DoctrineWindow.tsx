import { Check, Coins, GraduationCap, Lock } from "lucide-react";
import { DOCTRINE_DEFINITIONS } from "../../game/content/doctrines";
import { Badge } from "../kit/Badge";
import { Button } from "../kit/Button";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";
import "./windows.css";

const CATEGORY_TONE = {
  military: "bad",
  logistics: "warn",
  economy: "good"
} as const;

export function DoctrineWindow() {
  const { gameState, playerCountryId, doctrineOpen, setDoctrineOpen, handlePurchaseDoctrine } = useGame();

  if (!doctrineOpen) return null;

  const tradePoints = Math.floor(gameState.countryStockpiles[playerCountryId].tradePoints);

  return (
    <Window
      title="Doctrine Upgrades"
      icon={GraduationCap}
      onClose={() => setDoctrineOpen(false)}
      variant="modal"
      className="doctrine-window"
      backdropClassName="doctrine-backdrop"
      layoutId="doctrines"
      actions={<span className="doctrine-window__trade"><Coins size={13} aria-hidden="true" /> {tradePoints} TP</span>}
    >
      <div className="doctrine-window__grid">
        {DOCTRINE_DEFINITIONS.map((def) => {
          const owned = gameState.doctrineUpgrades?.[playerCountryId]?.includes(def.id) ?? false;
          const prereqsMet = (def.requires ?? []).every(r => gameState.doctrineUpgrades?.[playerCountryId]?.includes(r));
          const canAfford = tradePoints >= def.cost;
          const available = !owned && prereqsMet;
          const cardState = owned ? "owned" : available ? "available" : "unavailable";
          return (
            <div key={def.id} className={`doctrine-card doctrine-card--${cardState}`}>
              <div className="doctrine-card__head">
                <span className="doctrine-card__name">
                  {owned ? <Check className="doctrine-card__check" size={14} aria-hidden="true" /> : null}
                  {def.name}
                </span>
                <Badge tone={CATEGORY_TONE[def.category]}>{def.category}</Badge>
              </div>
              <div className="doctrine-card__description">{def.description}</div>
              {def.requires && def.requires.length > 0 && !owned && (
                <div className="doctrine-card__requires">
                  Requires: {def.requires.map(r => DOCTRINE_DEFINITIONS.find(d => d.id === r)?.name ?? r).join(", ")}
                </div>
              )}
              {!owned && (
                prereqsMet ? (
                  <Button
                    variant={canAfford ? "primary" : "secondary"}
                    size="sm"
                    disabled={!canAfford}
                    className="doctrine-card__buy"
                    onClick={() => handlePurchaseDoctrine(def.id)}
                  >
                    {canAfford ? `Unlock — ${def.cost} TP` : `Need ${def.cost} TP`}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled className="doctrine-card__buy" icon={Lock}>
                    Locked
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
    </Window>
  );
}
