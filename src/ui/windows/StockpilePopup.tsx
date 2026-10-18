import "./StockpilePopup.css";
import { Package } from "lucide-react";
import type { StockpileKey } from "../../game/state/types";
import { Button } from "../kit/Button";
import { ResourceAmount } from "../kit/ResourceAmount";
import { RESOURCE_META } from "../kit/resources";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";

const STOCKPILE_GROUPS: { title: string; resources: StockpileKey[] }[] = [
  { title: "Raw Resources", resources: ["oil", "coal", "iron", "tungsten", "food", "chemicals"] },
  { title: "Processed", resources: ["energy", "steel", "fuel", "explosives", "fertilizer", "munitions"] },
  { title: "Civilian Goods", resources: ["textiles", "electronics", "vehicles", "pharmaceuticals", "luxuryGoods"] },
  { title: "Special", resources: ["weed", "tradePoints"] }
];

export function StockpilePopup() {
  const {
    gameState, playerCountryId, playerCountry, stockpileOpen, setStockpileOpen, setLogicMapOpen,
  } = useGame();

  if (!stockpileOpen) return null;

  const stockpile = gameState.countryStockpiles[playerCountryId];
  const weedSaturation = gameState.weedSaturation[playerCountryId];
  return (
    <Window
      title={`Country Stockpile — ${playerCountry.name}`}
      icon={Package}
      actions={<Button variant="secondary" size="sm" onClick={() => setLogicMapOpen(true)}>Logic Map</Button>}
      onClose={() => setStockpileOpen(false)}
      className="stockpile-popup"
      layoutId="stockpile"
    >
      <div className="stockpile-popup__grid">
        {STOCKPILE_GROUPS.map((group) => (
          <div className="stockpile-popup__section" key={group.title}>
            <div className="stockpile-popup__section-title">{group.title}</div>
            <div className="stockpile-popup__items">
              {group.resources.map((resource) => (
                <div className="stockpile-popup__item" key={resource}>
                  <span className="stockpile-popup__item-label">{RESOURCE_META[resource].label}</span>
                  <ResourceAmount resource={resource} amount={stockpile[resource]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {weedSaturation > 0 && (
        <div className="stockpile-popup__weed">
          🌿 Weed saturation: {(weedSaturation * 100).toFixed(1)}% — Morale +{weedSaturation >= 0.25 ? 5 : weedSaturation >= 0.10 ? 3 : 1}, Food ×{weedSaturation >= 0.25 ? "1.3" : weedSaturation >= 0.10 ? "1.15" : "1.05"}
        </div>
      )}
    </Window>
  );
}
