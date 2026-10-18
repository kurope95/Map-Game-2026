import {
  canBlocUseTransit,
  getCountryDualTiltLabel,
  getCountryLeanBloc,
  LEANING_THRESHOLD,
  TRANSIT_SUPPORT_THRESHOLD,
} from "../../../game/rules/diplomacy";
import { useGame } from "../../session/GameProvider";
import "./diplomacy.css";
import { DiplomacyActions } from "./DiplomacyActions";
import { DiplomacyBar } from "./DiplomacyBar";
import { DiplomacyListCard } from "./DiplomacyListCard";

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

  return (
    <div className="float-panel diplomacy-window" data-layout="diplomacy">
      <div className="float-panel__header">
        <span>Diplomacy</span>
        <button className="float-panel__close" onClick={() => setDiplomacyOpen(false)}>✕</button>
      </div>
      <div className="float-panel__body diplomacy-window__body">
        <div className="diplomacy-workspace">
          <div className="diplomacy-browser">
            <div className="diplomacy-browser__tabs">
              <button className={`diplomacy-browser__tab ${diplomacyTab === "allies" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("allies")}>
                Allies ({diplomacyAlliesTargets.length})
              </button>
              <button className={`diplomacy-browser__tab ${diplomacyTab === "enemies" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("enemies")}>
                Enemies ({diplomacyEnemyTargets.length})
              </button>
              <button className={`diplomacy-browser__tab ${diplomacyTab === "neutral" ? "diplomacy-browser__tab--active" : ""}`} onClick={() => setDiplomacyTab("neutral")}>
                Neutral ({diplomacyNeutralTargets.length})
              </button>
            </div>
            <div className="diplomacy-browser__content">
              <div className="panel-card" style={{ marginBottom: "12px" }}>
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
            <div className="panel-card" style={{ marginBottom: "12px" }}>
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
                <div className="diplo-card" style={{ marginBottom: "12px" }}>
                  <div className="diplo-card__header">
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
                    <div className="diplo-card__pills">
                      <span className={`diplo-pill ${canBlocUseTransit(gameState, playerBlocId, selectedDiplomacyCountry.id) ? "diplo-pill--open" : "diplo-pill--closed"}`}>
                        {selectedDiplomacyCountry.alignment === "neutral"
                          ? (canBlocUseTransit(gameState, playerBlocId, selectedDiplomacyCountry.id) ? "Transit open" : "Transit closed")
                          : "Bloc transit"}
                      </span>
                      <span className={`diplo-pill ${getCountryLeanBloc(gameState, selectedDiplomacyCountry.id) === "EU_NATO" ? "diplo-pill--nato" : getCountryLeanBloc(gameState, selectedDiplomacyCountry.id) === "BRICS" ? "diplo-pill--brics" : "diplo-pill--balanced"}`}>
                        {getCountryDualTiltLabel(selectedDiplomacyState.eliteSupport, selectedDiplomacyState.publicSupport)}
                      </span>
                    </div>
                  </div>
                  <div className="diplo-card__bars">
                    <DiplomacyBar channel="Elite" value={selectedDiplomacyState.eliteSupport} />
                    <DiplomacyBar channel="Public" value={selectedDiplomacyState.publicSupport} />
                  </div>
                </div>
                <div className="panel-card" style={{ marginBottom: "12px" }}>
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
                  <div className="panel-card" style={{ marginBottom: "12px" }}>
                    <h4>Diplomatic Limits</h4>
                    <p>This country is not directly swayable through aid and bribery. Its war entry is driven by bloc alignment and scripted conditions.</p>
                  </div>
                )}
                {selectedDiplomacyState.lastActionTurn === gameState.turn && (
                  <div className="panel-card" style={{ marginBottom: "12px" }}>
                    <p style={{ color: "#e8c96a" }}>You already used a diplomacy action in {selectedDiplomacyCountry.name} this turn.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="panel-card" style={{ marginBottom: "12px" }}>
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
                <p style={{ color: "#e8c96a" }}>Diplomatic actions are only available during your own turn.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
