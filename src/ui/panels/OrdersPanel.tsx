import "./FloatPanel.css";
import "./EconomyPanels.css";
import { useGame } from "../session/GameProvider";

export function OrdersPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, playerCountry, currentOrders,
    handleClearAllOrders, handleCancelOrder, lastEventLogSnapshot,
  } = useGame();

  if (!bottomOpen || activeTab !== "orders") return null;

  return (
    <div className="float-panel float-panel--bottom-center float-panel--wide" data-layout="panel-orders">
      <div className="float-panel__header">
        <span>Orders — {playerCountry.name} ({currentOrders.length})</span>
        <div style={{ display: "flex", gap: 6 }}>
          {currentOrders.length > 0 && <button className="build-btn build-btn--cancel" onClick={handleClearAllOrders}>Clear All</button>}
          <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
        </div>
      </div>
      <div className="float-panel__body">
        {currentOrders.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>No orders issued. Select a unit, then click an adjacent region.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {currentOrders.map((order) => {
              const unit = gameState.units[order.unitId];
              if (!unit) return null;
              const fromRegion = gameState.regions[unit.regionId];
              const toRegion = gameState.regions[order.targetRegionId];
              return (
                <span key={order.unitId} style={{ padding: "3px 8px", borderRadius: "3px", fontSize: "0.72rem", background: order.type === "attack" ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,215,0,0.3)", color: unit.blocId === "BRICS" ? "#ff9a9d" : unit.blocId === "EU_NATO" ? "#9dc2ff" : "#c7d0da" }}>
                  {unit.type} ({fromRegion?.name}) → {order.type} → {toRegion?.name}
                  <span style={{ marginLeft: "6px", cursor: "pointer", color: "#ff6b6b" }} onClick={() => handleCancelOrder(order.unitId)}>✕</span>
                </span>
              );
            })}
          </div>
        )}
        {lastEventLogSnapshot.length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6 }}>
            <strong style={{ color: "#ff9a9d", fontSize: "0.72rem" }}>Last Turn Events:</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: 4 }}>
              {lastEventLogSnapshot.slice(-8).map((evt, i) => (
                <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: "0.68rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                  {evt}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
