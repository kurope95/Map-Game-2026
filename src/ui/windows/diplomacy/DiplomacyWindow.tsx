import { Handshake } from "lucide-react";
import {
  canBlocUseTransit,
  getCountryDualTiltLabel,
  getCountryLeanBloc,
  LEANING_THRESHOLD,
  TRANSIT_SUPPORT_THRESHOLD,
} from "../../../game/rules/diplomacy";
import { Badge } from "../../kit/Badge";
import { Flag } from "../../kit/Flag";
import { Tabs } from "../../kit/Tabs";
import { Window } from "../../kit/Window";
import { useGame } from "../../session/GameProvider";
import "./diplomacy.css";
import "./diplomacy-actions.css";
import { DiplomacyActions } from "./DiplomacyActions";
import { DiplomacyBar } from "./DiplomacyBar";
import { DiplomacyListCard } from "./DiplomacyListCard";

const DIPLOMACY_TABS = [
  { id: "allies" as const, label: "Allies" },
  { id: "enemies" as const, label: "Enemies" },
  { id: "neutral" as const, label: "Neutral" }
];

export function DiplomacyWindow() {
  const {
    gameState,
    diplomacyOpen,
    setDiplomacyOpen,
    diplomacyTab,
    setDiplomacyTab,
    diplomacyAlliesTargets,
    diplomacyEnemyTargets,
    diplomacyNeutralTargets,
    visibleDiplomacyTargets,
    diplomacySnapshot,
    selectedDiplomacyCountry,
    selectedDiplomacyState,
    diplomacyIntensity,
    setDiplomacyIntensity,
    playerCountryId,
    playerBlocId,
    playerTurnActive,
  } = useGame();

  if (!diplomacyOpen) return null;

  const tabs = DIPLOMACY_TABS.map((tab) => ({
    ...tab,
    count:
      tab.id === "allies" ? diplomacyAlliesTargets.length
        : tab.id === "enemies" ? diplomacyEnemyTargets.length
          : diplomacyNeutralTargets.length
  }));
  const selectedLean = selectedDiplomacyCountry ? getCountryLeanBloc(gameState, selectedDiplomacyCountry.id) : null;
  const transitOpen = selectedDiplomacyCountry ? canBlocUseTransit(gameState, playerBlocId, selectedDiplomacyCountry.id) : false;

  return (
    <Window
      title="Diplomacy"
      icon={Handshake}
      onClose={() => setDiplomacyOpen(false)}
      variant="panel"
      className="diplomacy-window"
      bodyClassName="diplomacy-window__body"
      layoutId="diplomacy"
    >
      <div className="diplomacy-workspace">
        <div className="diplomacy-browser">
          <Tabs tabs={tabs} active={diplomacyTab} onChange={setDiplomacyTab} />
          <div className="diplomacy-browser__content">
            <div className="panel-card">
              <h4>How This Works</h4>
              <p>We track both elites and the public. You need both to move before a country truly starts drifting.</p>
              <p>Leaning begins once both bars cross {LEANING_THRESHOLD}. Neutral transit opens once both cross {TRANSIT_SUPPORT_THRESHOLD} for your bloc.</p>
              <p>Neutrals always build their economies. They only start raising armies once they are clearly leaning.</p>
            </div>
            <div className="diplomacy-list">
              {visibleDiplomacyTargets.map((country) => (
                <DiplomacyListCard key={country.id} country={country} />
              ))}
              {visibleDiplomacyTargets.length === 0 && (
                <div className="panel-card">
                  <p>No countries in this tab right now.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="diplomacy-detail">
          <div className="panel-card">
            <h4>Strategic Picture</h4>
            <div className="diplo-summary">
              <div className="diplo-summary__item">
                <span className="diplo-summary__value">{diplomacySnapshot.natoLean}</span>
                <span className="diplo-summary__label">Leaning NATO</span>
              </div>
              <div className="diplo-summary__item">
                <span className="diplo-summary__value">{diplomacySnapshot.bricsLean}</span>
                <span className="diplo-summary__label">Leaning BRICS</span>
              </div>
              <div className="diplo-summary__item">
                <span className="diplo-summary__value">{diplomacySnapshot.transitOpen}</span>
                <span className="diplo-summary__label">Transit open to you</span>
              </div>
            </div>
          </div>
          {selectedDiplomacyCountry && selectedDiplomacyState ? (
            <>
              <div className="diplo-card">
                <div className="diplo-card__header">
                  <div className="diplo-card__identity">
                    <Flag countryId={selectedDiplomacyCountry.id} width={24} />
                    <div>
                      <div className="diplo-card__title">{selectedDiplomacyCountry.name}</div>
                      <div className="diplo-card__subtitle">
                        {gameState.countryStates[selectedDiplomacyCountry.id].atWar
                          ? "Already at war"
                          : selectedDiplomacyCountry.alignment === "neutral"
                            ? "Neutral and influenceable"
                            : selectedDiplomacyCountry.alignment === "aligned_non_belligerent"
                              ? "Aligned country with scripted entry rules"
                              : "Hard member"}
                      </div>
                    </div>
                  </div>
                  <div className="diplo-card__pills">
                    <Badge tone={transitOpen ? "good" : "plain"}>
                      {selectedDiplomacyCountry.alignment === "neutral"
                        ? (transitOpen ? "Transit open" : "Transit closed")
                        : "Bloc transit"}
                    </Badge>
                    <Badge tone={selectedLean === "EU_NATO" ? "nato" : selectedLean === "BRICS" ? "brics" : "neutral"}>
                      {getCountryDualTiltLabel(selectedDiplomacyState.eliteSupport, selectedDiplomacyState.publicSupport)}
                    </Badge>
                  </div>
                </div>
                <div className="diplo-card__bars">
                  <DiplomacyBar channel="Elite" value={selectedDiplomacyState.eliteSupport} />
                  <DiplomacyBar channel="Public" value={selectedDiplomacyState.publicSupport} />
                </div>
              </div>
              <div className="panel-card">
                <h4>Operation Intensity</h4>
                <div className="diplo-intensity">
                  <div className="diplo-intensity__labels">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                  <input
                    className="diplo-intensity__slider"
                    type="range"
                    min={1}
                    max={3}
                    step={1}
                    value={diplomacyIntensity}
                    onChange={(e) => setDiplomacyIntensity(Number(e.target.value))}
                  />
                  <div className="diplo-intensity__value">Level {diplomacyIntensity}</div>
                </div>
              </div>
              <DiplomacyActions />
              {selectedDiplomacyCountry.alignment !== "neutral" && (
                <div className="panel-card">
                  <h4>Diplomatic Limits</h4>
                  <p>This country is not directly swayable through aid and bribery. Its war entry is driven by bloc alignment and scripted conditions.</p>
                </div>
              )}
              {selectedDiplomacyState.lastActionTurn === gameState.turn && (
                <div className="panel-card">
                  <p className="diplo-note">You already used a diplomacy action in {selectedDiplomacyCountry.name} this turn.</p>
                </div>
              )}
            </>
          ) : (
            <div className="panel-card">
              <p>Select a country to inspect its leaning and send actions.</p>
            </div>
          )}
          <div className="panel-card">
            <h4>Available Resources</h4>
            <ul>
              <li><strong>Trade:</strong> {gameState.countryStockpiles[playerCountryId].tradePoints}</li>
              <li><strong>Luxury:</strong> {gameState.countryStockpiles[playerCountryId].luxuryGoods}</li>
              <li><strong>Electronics:</strong> {gameState.countryStockpiles[playerCountryId].electronics}</li>
              <li><strong>Textiles:</strong> {gameState.countryStockpiles[playerCountryId].textiles}</li>
              <li><strong>Weed:</strong> {gameState.countryStockpiles[playerCountryId].weed}</li>
              <li><strong>Munitions:</strong> {gameState.countryStockpiles[playerCountryId].munitions}</li>
              <li><strong>Fuel:</strong> {gameState.countryStockpiles[playerCountryId].fuel}</li>
            </ul>
            {!playerTurnActive && (
              <p className="diplo-note">Diplomatic actions are only available during your own turn.</p>
            )}
          </div>
        </div>
      </div>
    </Window>
  );
}
