import "./BottomBar.css";
import { useGame } from "../session/GameProvider";

// Probe keys of the tab buttons (scripts/layout/capture-layout.js), by tab id.
const TAB_LAYOUT_KEYS: Record<string, string> = {
  region: "region",
  stockpile: "stockpile",
  economy: "economy",
  military: "recruitment",
  orders: "orders",
  ai: "aiintel",
  war: "warstatus",
  log: "eventlog",
};

export function BottomBar() {
  const {
    bottomOpen, setBottomOpen, activeTab, setActiveTab, stockpileOpen, setStockpileOpen,
    setSelectedFacilityId, tabs,
  } = useGame();

  return (
    <div className="bottom-bar" data-layout="bottom-bar">
      <div className="bottom-bar__tab-row">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-layout-key={TAB_LAYOUT_KEYS[tab.id]}
            className={`bottom-bar__tab ${tab.id === "stockpile" ? (stockpileOpen ? "bottom-bar__tab--active" : "") : (bottomOpen && activeTab === tab.id) ? "bottom-bar__tab--active" : ""}`}
            onClick={() => {
              if (tab.id === "stockpile") {
                setStockpileOpen((o) => !o);
                setBottomOpen(false);
              } else {
                if (activeTab === tab.id && bottomOpen) {
                  setBottomOpen(false);
                } else {
                  setActiveTab(tab.id);
                  setBottomOpen(true);
                }
                setStockpileOpen(false);
                setSelectedFacilityId(null);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
