import React from "react";

interface EconomyLogicMapProps {
  onClose: () => void;
}

export function EconomyLogicMap({ onClose }: EconomyLogicMapProps) {
  return (
    <div className="logic-map-overlay" onClick={onClose}>
      <div className="logic-map-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logic-map-header">
          <h2>Economy Logic Map</h2>
          <button className="build-btn build-btn--cancel" onClick={onClose}>✕ Close</button>
        </div>
        
        <div className="logic-map-legend">
          <span className="node raw">Raw Resource</span> ➔ <span className="node fac">Facility</span> ➔ <span className="node good">Processed Good</span> ➔ <span className="node unit">Military Unit</span>
          <span style={{ marginLeft: 20, color: "#f2d36b" }}>⚡ Power Plants must be built to generate Energy for Industrial Facilities.</span>
        </div>

        <div className="logic-map-body">
          {/* Row 1: Food & Weed */}
          <div className="logic-flow">
            <div className="flow-col">
              <div className="node raw">Fertility Deposit</div>
              <div className="node raw">Fertilizer (Optional Base Boost)</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🚜 Farm</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">🌾 Food</div>
              <div className="node good" style={{ marginTop: 4 }}>🌿 Weed (Trade & Morale)</div>
            </div>
          </div>

          <hr className="divider" />

          {/* Row 2: Metals & Minerals */}
          <div className="logic-flow">
            <div className="flow-col">
              <div className="node raw">Iron Deposit</div>
              <div className="node raw">Coal Deposit</div>
              <div className="node raw">Tungsten Deposit</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">⛏️ Mine</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">🪨 Iron</div>
              <div className="node good">⛏️ Coal</div>
              <div className="node good">🔩 Tungsten</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🏭 Smelter</div>
              <em style={{ fontSize: "0.6rem", textAlign: "center", color: "#f2d36b" }}>⚡ Requires Energy</em>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">🔗 Steel</div>
            </div>
          </div>

          <hr className="divider" />

          {/* Row 3: Oil & Chemicals */}
          <div className="logic-flow">
            <div className="flow-col">
              <div className="node raw">Oil Deposit</div>
              <div className="arrow" style={{ transform: "rotate(90deg)", margin: "4px 0" }}>➔</div>
              <div className="node fac">🛢️ Oil Well</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">🛢️ Oil</div>
              <div className="node good" style={{ color: "var(--muted)", fontSize: "0.6rem" }}>(or Coal via Refinery)</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🧪 Chemical Plant</div>
              <em style={{ fontSize: "0.6rem", textAlign: "center", color: "#f2d36b" }}>⚡ Requires Energy</em>
              <div className="node fac" style={{ marginTop: 4 }}>🛢️ Synthetic Refinery</div>
              <em style={{ fontSize: "0.6rem", textAlign: "center", color: "#f2d36b" }}>⚡ Requires Energy</em>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">🌱 Fertilizer</div>
              <div className="node good">💥 Explosives</div>
              <div className="node good">⛽ Fuel</div>
              <div className="node good">🧪 Chemicals</div>
            </div>
          </div>

          <hr className="divider" />

          {/* Row 4: Military Industry */}
          <div className="logic-flow">
            <div className="flow-col">
              <div className="node good">🔗 Steel</div>
              <div className="node good">💥 Explosives</div>
              <div className="node good">🧪 Chemicals</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🏭 Munitions Plant</div>
              <em style={{ fontSize: "0.6rem", textAlign: "center", color: "#f2d36b" }}>⚡ Requires Energy</em>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">💣 Munitions</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🎖️ Barracks / Factories</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node unit">🪖 Infantry</div>
              <div className="node unit">🛡️ Armor (Requires Fuel)</div>
              <div className="node unit">✈️ Aircraft (Requires Fuel)</div>
            </div>
          </div>

          <hr className="divider" />

          {/* Row 5: Civilian Industry */}
          <div className="logic-flow">
            <div className="flow-col">
              <div className="node good">🔗 Steel</div>
              <div className="node good">🧪 Chemicals</div>
              <div className="node good">🌾 Food</div>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node fac">🏭 Civilian Factory</div>
              <em style={{ fontSize: "0.6rem", textAlign: "center", color: "#f2d36b" }}>⚡ Requires Energy</em>
            </div>
            <div className="arrow">➔</div>
            <div className="flow-col">
              <div className="node good">👕 Textiles (Trade)</div>
              <div className="node good">💻 Electronics (Trade)</div>
              <div className="node good">🚗 Vehicles (Trade)</div>
              <div className="node good">💊 Pharma (Trade)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
