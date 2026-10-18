import "./FloatPanel.css";
import "./EconomyPanels.css";
import { MapPin } from "lucide-react";
import { Badge } from "../kit/Badge";
import { Flag } from "../kit/Flag";
import { Pips } from "../kit/Pips";
import { ResourceIcon } from "../kit/ResourceIcon";
import { StatRow } from "../kit/StatRow";
import { Window } from "../kit/Window";
import { RESOURCE_META } from "../kit/resources";
import { useGame } from "../session/GameProvider";

export function RegionPanel() {
  const {
    gameState, bottomOpen, setBottomOpen, activeTab, selectedRegionId, selectedRegion,
    selectedCountry, controllerCountry, pridnestrovieDepotStatus,
  } = useGame();

  if (!bottomOpen || activeTab !== "region") return null;

  const economy = gameState.regionEconomies[selectedRegionId];
  const stabilityTone = !economy ? undefined : economy.stability >= 70 ? "good" : economy.stability >= 40 ? "warn" : "bad";
  const depotTone = pridnestrovieDepotStatus.tone === "claimed" ? "good" : pridnestrovieDepotStatus.tone === "claimable" ? "warn" : undefined;

  return (
    <Window
      title={selectedRegion.name}
      icon={MapPin}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-left"
      layoutId="panel-region"
    >
      <div className="region-panel__grid">
        <div>
          <div className="region-panel__controller">
            <span className="region-panel__label">Controlled by</span>
            <span className="region-panel__controller-value">
              <Flag countryId={controllerCountry.id} width={18} />
              {controllerCountry.name}
              <Badge tone={controllerCountry.blocId === "BRICS" ? "brics" : controllerCountry.blocId === "EU_NATO" ? "nato" : "neutral"}>
                {controllerCountry.blocId === "BRICS" ? "BRICS" : controllerCountry.blocId === "EU_NATO" ? "EU NATO" : "Neutral"}
              </Badge>
            </span>
          </div>
          <StatRow label="Core territory" value={selectedCountry.name} />
          <StatRow label="Terrain" value={selectedRegion.terrain} />
          <StatRow label="Value" value={`${selectedRegion.points} pts`} />
          {selectedRegion.id === "chisinau-pridnestrovie" && (
            <>
              <StatRow label="Depot" value={pridnestrovieDepotStatus.label} tone={depotTone} />
              <div className="region-panel__subtle">{pridnestrovieDepotStatus.detail}</div>
            </>
          )}
          {economy && (
            <>
              <StatRow label="Population" value={`${economy.population.toLocaleString()}k`} />
              <StatRow label="Stability" value={`${economy.stability}%`} tone={stabilityTone} />
              <StatRow label="Recruitable" value={economy.recruitablePool.toLocaleString()} />
              <StatRow label="Build slots" value={`${economy.facilities.length}/${economy.buildingSlots}`} />
            </>
          )}
        </div>
        <div>
          <div className="economy-section__title">Deposits</div>
          {!economy || economy.resourceDeposits.length === 0 ? (
            <span className="economy-empty">None</span>
          ) : (
            <div className="deposit-list">
              {economy.resourceDeposits.map((dep, i) => (
                <div key={i} className="deposit-item">
                  <ResourceIcon resource={dep.type} />
                  <span className="deposit-item__type">{dep.type === "food" ? "Fertility" : RESOURCE_META[dep.type].label}</span>
                  <Pips count={dep.richness} max={5} />
                  {dep.type === "food" && <span className="deposit-item__bonus">+{dep.richness * 15}%</span>}
                </div>
              ))}
            </div>
          )}
          <div className="economy-section__title economy-section__title--spaced">Adjacent</div>
          <div className="region-panel__adjacent">
            {selectedRegion.adjacentRegionIds.map((id) => gameState.regions[id].name).join(" · ")}
          </div>
        </div>
      </div>
    </Window>
  );
}
