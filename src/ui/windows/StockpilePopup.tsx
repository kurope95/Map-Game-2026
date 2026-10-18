import "./StockpilePopup.css";
import "../panels/EconomyPanels.css";
import { useGame } from "../session/GameProvider";

export function StockpilePopup() {
  const {
    gameState, playerCountryId, playerCountry, stockpileOpen, setStockpileOpen, setLogicMapOpen,
  } = useGame();

  if (!stockpileOpen) return null;

  const stockpile = gameState.countryStockpiles[playerCountryId];
  return (
    <div className="stockpile-popup" data-layout="stockpile">
      <div className="stockpile-popup__header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Country Stockpile — {playerCountry.name}</span>
          <button className="build-btn" onClick={() => setLogicMapOpen(true)}>📊 Logic Map</button>
        </div>
        <button className="stockpile-popup__close" onClick={() => setStockpileOpen(false)}>✕</button>
      </div>
      <div className="stockpile-popup__grid">
        <div className="stockpile-popup__section">
          <div className="stockpile-popup__section-title">Raw Resources</div>
          <div className="stockpile-popup__items">
            <div className="stockpile-item"><span className="stockpile-item__icon">🛢</span><span className="stockpile-item__label">Oil</span><span className="stockpile-item__value">{stockpile.oil}</span></div>
            <div className="stockpile-item"><span className="stockpile-item__icon">⛏</span><span className="stockpile-item__label">Coal</span><span className="stockpile-item__value">{stockpile.coal}</span></div>
            <div className="stockpile-item"><span className="stockpile-item__icon">⚙</span><span className="stockpile-item__label">Iron</span><span className="stockpile-item__value">{stockpile.iron}</span></div>
            <div className="stockpile-item"><span className="stockpile-item__icon">🔩</span><span className="stockpile-item__label">Tungsten</span><span className="stockpile-item__value">{stockpile.tungsten}</span></div>
            <div className="stockpile-item"><span className="stockpile-item__icon">🌾</span><span className="stockpile-item__label">Food</span><span className="stockpile-item__value">{stockpile.food}</span></div>
            <div className="stockpile-item"><span className="stockpile-item__icon">⚗</span><span className="stockpile-item__label">Chemicals</span><span className="stockpile-item__value">{stockpile.chemicals}</span></div>
          </div>
        </div>
        <div className="stockpile-popup__section">
          <div className="stockpile-popup__section-title">Processed</div>
          <div className="stockpile-popup__items">
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">⚡</span><span className="stockpile-item__label">Energy</span><span className="stockpile-item__value">{stockpile.energy}</span></div>
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">🔧</span><span className="stockpile-item__label">Steel</span><span className="stockpile-item__value">{stockpile.steel}</span></div>
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">⛽</span><span className="stockpile-item__label">Fuel</span><span className="stockpile-item__value">{stockpile.fuel}</span></div>
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">💥</span><span className="stockpile-item__label">Explosives</span><span className="stockpile-item__value">{stockpile.explosives}</span></div>
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">🌱</span><span className="stockpile-item__label">Fertilizer</span><span className="stockpile-item__value">{stockpile.fertilizer}</span></div>
            <div className="stockpile-item stockpile-item--processed"><span className="stockpile-item__icon">💣</span><span className="stockpile-item__label">Munitions</span><span className="stockpile-item__value">{stockpile.munitions}</span></div>
          </div>
        </div>
        <div className="stockpile-popup__section">
          <div className="stockpile-popup__section-title">Civilian Goods</div>
          <div className="stockpile-popup__items">
            <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">👕</span><span className="stockpile-item__label">Textiles</span><span className="stockpile-item__value">{stockpile.textiles}</span></div>
            <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💻</span><span className="stockpile-item__label">Electronics</span><span className="stockpile-item__value">{stockpile.electronics}</span></div>
            <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">🚗</span><span className="stockpile-item__label">Vehicles</span><span className="stockpile-item__value">{stockpile.vehicles}</span></div>
            <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💊</span><span className="stockpile-item__label">Pharma</span><span className="stockpile-item__value">{stockpile.pharmaceuticals}</span></div>
            <div className="stockpile-item stockpile-item--civilian"><span className="stockpile-item__icon">💎</span><span className="stockpile-item__label">Luxury</span><span className="stockpile-item__value">{stockpile.luxuryGoods}</span></div>
          </div>
        </div>
        <div className="stockpile-popup__section">
          <div className="stockpile-popup__section-title">Special</div>
          <div className="stockpile-popup__items">
            <div className="stockpile-item stockpile-item--weed"><span className="stockpile-item__icon">🌿</span><span className="stockpile-item__label">Weed</span><span className="stockpile-item__value">{stockpile.weed}</span></div>
            <div className="stockpile-item stockpile-item--trade"><span className="stockpile-item__icon">💰</span><span className="stockpile-item__label">Trade</span><span className="stockpile-item__value">{stockpile.tradePoints}</span></div>
          </div>
        </div>
      </div>
      {gameState.weedSaturation[playerCountryId] > 0 && (
        <div style={{ fontSize: "0.65rem", marginTop: "6px", color: "#8bc99a", padding: "0 8px 6px" }}>
          🌿 Weed saturation: {(gameState.weedSaturation[playerCountryId] * 100).toFixed(1)}% — Morale +{gameState.weedSaturation[playerCountryId] >= 0.25 ? 5 : gameState.weedSaturation[playerCountryId] >= 0.10 ? 3 : 1}, Food ×{gameState.weedSaturation[playerCountryId] >= 0.25 ? "1.3" : gameState.weedSaturation[playerCountryId] >= 0.10 ? "1.15" : "1.05"}
        </div>
      )}
    </div>
  );
}
