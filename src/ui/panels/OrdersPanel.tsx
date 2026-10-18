import "./FloatPanel.css";
import { ListChecks, X } from "lucide-react";
import { Button } from "../kit/Button";
import { UnitSymbol } from "../kit/UnitSymbol";
import { Window } from "../kit/Window";
import { NATION_COLORS } from "../theme/palette";
import { useGame } from "../session/GameProvider";

export function OrdersPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, playerCountry, currentOrders,
    handleClearAllOrders, handleCancelOrder, lastEventLogSnapshot,
  } = useGame();

  if (!bottomOpen || activeTab !== "orders") return null;

  return (
    <Window
      title={`Orders — ${playerCountry.name} (${currentOrders.length})`}
      icon={ListChecks}
      actions={currentOrders.length > 0 ? <Button variant="secondary" size="sm" onClick={handleClearAllOrders}>Clear All</Button> : undefined}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center float-panel--wide"
      layoutId="panel-orders"
    >
      {currentOrders.length === 0 ? (
        <p className="panel-empty">No orders issued. Select a unit, then click an adjacent region.</p>
      ) : (
        <div className="order-chips">
          {currentOrders.map((order) => {
            const unit = gameState.units[order.unitId];
            if (!unit) return null;
            const fromRegion = gameState.regions[unit.regionId];
            const toRegion = gameState.regions[order.targetRegionId];
            return (
              <span key={order.unitId} className={`order-chip${order.type === "attack" ? " order-chip--attack" : ""}`}>
                <UnitSymbol type={unit.type} size={16} color={NATION_COLORS[unit.countryId]} />
                <span className="order-chip__order">{order.type}</span>
                <span className="order-chip__route">{order.type === "hold" ? toRegion?.name : `${fromRegion?.name} → ${toRegion?.name}`}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  className="order-chip__cancel"
                  title="Cancel order"
                  aria-label="Cancel order"
                  onClick={() => handleCancelOrder(order.unitId)}
                />
              </span>
            );
          })}
        </div>
      )}
      {lastEventLogSnapshot.length > 0 && (
        <div className="orders-panel__events">
          <strong className="orders-panel__events-title">Last Turn Events:</strong>
          <div className="orders-panel__event-list">
            {lastEventLogSnapshot.slice(-8).map((evt, i) => (
              <span key={i} className="orders-panel__event">{evt}</span>
            ))}
          </div>
        </div>
      )}
    </Window>
  );
}
