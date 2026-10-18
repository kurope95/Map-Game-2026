import "./FloatPanel.css";
import "./EconomyPanels.css";
import { useGame } from "../session/GameProvider";

export function RegionPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, selectedRegionId, selectedRegion,
    selectedCountry, controllerCountry, pridnestrovieDepotStatus,
  } = useGame();

  if (!bottomOpen || activeTab !== "region") return null;

  const economy = gameState.regionEconomies[selectedRegionId];
  return (
    <div className="float-panel float-panel--bottom-left" data-layout="panel-region">
      <div className="float-panel__header">
        <span>{selectedRegion.name}</span>
        <button className="float-panel__close" onClick={() => setBottomOpen(false)}>✕</button>
      </div>
      <div className="float-panel__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div className="float-panel__row" style={{ paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "6px" }}>
            <span className="float-panel__lbl">Controlled By:</span>
            <span style={{ fontWeight: 800, color: controllerCountry.blocId === 'BRICS' ? '#ff9a9d' : controllerCountry.blocId === 'EU_NATO' ? '#9dc2ff' : '#c7d0da', fontSize: "1.05rem" }}>
              {controllerCountry.blocId === 'BRICS' ? '🟥' : controllerCountry.blocId === 'EU_NATO' ? '🟦' : '⬜'} {controllerCountry.name}
            </span>
          </div>
          <div className="float-panel__row"><span className="float-panel__lbl">Core Territory</span><span>{selectedCountry.name}</span></div>
          <div className="float-panel__row"><span className="float-panel__lbl">Terrain</span><span>{selectedRegion.terrain}</span></div>
          <div className="float-panel__row"><span className="float-panel__lbl">Value</span><span>{selectedRegion.points} pts</span></div>
          {selectedRegion.id === "chisinau-pridnestrovie" && (
            <>
              <div className="float-panel__row">
                <span className="float-panel__lbl">Depot</span>
                <span style={{ color: pridnestrovieDepotStatus.tone === "claimed" ? "#7fd98b" : pridnestrovieDepotStatus.tone === "claimable" ? "#f2d36b" : "#c0cad5" }}>
                  {pridnestrovieDepotStatus.label}
                </span>
              </div>
              <div className="float-panel__subtle">{pridnestrovieDepotStatus.detail}</div>
            </>
          )}
          {economy && (
            <>
              <div className="float-panel__row"><span className="float-panel__lbl">Population</span><span>{economy.population.toLocaleString()}k</span></div>
              <div className="float-panel__row"><span className="float-panel__lbl">Stability</span><span style={{ color: economy.stability >= 70 ? "#8bc99a" : economy.stability >= 40 ? "#e8c96a" : "#ff6b6b" }}>{economy.stability}%</span></div>
              <div className="float-panel__row"><span className="float-panel__lbl">Recruitable</span><span>{economy.recruitablePool.toLocaleString()}</span></div>
              <div className="float-panel__row"><span className="float-panel__lbl">Build Slots</span><span>{economy.facilities.length}/{economy.buildingSlots}</span></div>
            </>
          )}
        </div>
        <div>
          <div className="economy-section__title" style={{ marginBottom: 4 }}>Deposits</div>
          {!economy || economy.resourceDeposits.length === 0 ? (
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>None</span>
          ) : (
            <div className="deposit-list">
              {economy.resourceDeposits.map((dep, i) => (
                <div key={i} className="deposit-item">
                  <span className="deposit-item__type">{dep.type === "food" ? "Fertility" : dep.type}</span>
                  <span className="deposit-item__richness">{"★".repeat(dep.richness)}{"☆".repeat(5 - dep.richness)}</span>
                  {dep.type === "food" && <span style={{ fontSize: "0.55rem", color: "#8bc99a" }}>+{dep.richness * 15}%</span>}
                </div>
              ))}
            </div>
          )}
          <div className="economy-section__title" style={{ marginTop: 8, marginBottom: 4 }}>Adjacent</div>
          <div style={{ fontSize: "0.65rem", color: "var(--muted)", lineHeight: 1.4 }}>
            {selectedRegion.adjacentRegionIds.map((id) => gameState.regions[id].name).join(" · ")}
          </div>
        </div>
      </div>
    </div>
  );
}
