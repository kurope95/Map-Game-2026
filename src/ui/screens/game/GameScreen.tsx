import { getEntrenchmentBonus, getSupplyStatus, getVeterancyLevel } from "../../format/unitStatus";
import { TheaterMap } from "../../TheaterMap";
import { EconomyLogicMap } from "../../EconomyLogicMap";
import { canBlocUseTransit, getCountryDualTiltLabel, getCountryLeanBloc, getCountryTiltLabel, getScaledDiplomacyActionDefinition, LEANING_THRESHOLD, TRANSIT_SUPPORT_THRESHOLD } from "../../../game/rules/diplomacy";
import { PROCESSING_RECIPES, CHEMICAL_PLANT_RECIPES, MUNITIONS_PLANT_RECIPE, EXTRACTION_FACILITY_RESOURCES, CIVILIAN_GOOD_RECIPES, getFacilityBuildRecipe, getFacilityRepairProfile, getFacilityUpgradeCost, getMilitaryProductionTurns, getReplenishmentCost, getUnitRecruitmentRecipe, MAX_UNIT_STRENGTH, UNIT_RECRUITMENT_COSTS } from "../../../game/content/economyRecipes";
import { DOCTRINE_DEFINITIONS } from "../../../game/content/doctrines";
import type { DiplomacyActionType } from "../../../game/state/types";
import "./GameScreen.css";
import { BottomBar } from "../../hud/BottomBar";
import { SupplyToggle } from "../../hud/SupplyToggle";
import { ToastStack } from "../../hud/ToastStack";
import { TopBar } from "../../hud/TopBar";
import { AiIntelPanel } from "../../panels/AiIntelPanel";
import { EconomyPanel } from "../../panels/EconomyPanel";
import { EventLogPanel } from "../../panels/EventLogPanel";
import { OrdersPanel } from "../../panels/OrdersPanel";
import { RecruitmentPanel } from "../../panels/RecruitmentPanel";
import { RegionPanel } from "../../panels/RegionPanel";
import { WarStatusPanel } from "../../panels/WarStatusPanel";
import { useGame } from "../../session/GameProvider";

export function GameScreen() {
  const {
    gameState, setGameStarted, playerCountryId, selectedRegionId, setSelectedRegionId, selectedUnitIds,
    combatReportOpen, setCombatReportOpen, lastEventLogSnapshot, unitDrawerOpen, setUnitDrawerOpen, globalUnitsOpen, setGlobalUnitsOpen, stockpileOpen,
    setStockpileOpen, diplomacyOpen, setDiplomacyOpen, diplomacyTab, setDiplomacyTab, selectedDiplomacyCountryId,
    setSelectedDiplomacyCountryId, diplomacyIntensity, setDiplomacyIntensity, selectedFacilityId, setSelectedFacilityId, dismissedDefeatAnnouncement,
    setDismissedDefeatAnnouncement, logicMapOpen, setLogicMapOpen, doctrineOpen, setDoctrineOpen, showSupplyOverlay,
    saveLoadOpen, setSaveLoadOpen, saveLoadMode, saveSlots, selectedSaveSlotName, setSelectedSaveSlotName,
    saveSlotInput, setSaveSlotInput, playerCountry, playerBlocId, playerTurnActive, selectedRegion,
    allPlayerUnits, unitsInRegion, validTargets,
    addToast, victoryStatus, latestDefeatAnnouncement, diplomacyTargets,
    diplomacyAlliesTargets, diplomacyEnemyTargets, diplomacyNeutralTargets, visibleDiplomacyTargets, diplomacySnapshot, selectedDiplomacyCountry,
    selectedDiplomacyState, selectedSaveSlot, saveToSlot, handleLoadGame, handleLoadSelectedSlot, handleLoadLegacyQuickSave,
    handleDeleteSelectedSlot, handleSelectRegion, handleSelectUnit, handleSelectUnitFromMap, handleSelectFacilityFromMap, handleHoldUnit,
    handleCancelOrder, handleReplenishUnit, handlePurchaseDoctrine, canAfford, getMissingResources,
    getBestOperationalFacility, handleDiplomacyAction, handleUpgradeFacility, handleRepairFacility,
    handleRecruitUnit, handleToggleChemicalMode,
    getUnitOrder,
  } = useGame();

  function renderDiplomacyBar(channel: string, value: number) {
    const position = ((value + 100) / 200) * 100;
    const leaningLeft = ((100 - LEANING_THRESHOLD) / 200) * 100;
    const leaningRight = ((100 + LEANING_THRESHOLD) / 200) * 100;
    const transitLeft = ((100 - TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;
    const transitRight = ((100 + TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;

    return (
      <div className="diplo-bar">
        <div className="diplo-bar__topline">
          <span className="diplo-bar__channel">{channel}</span>
          <span className="diplo-bar__tilt">{getCountryTiltLabel(value)}</span>
        </div>
        <div className="diplo-bar__track">
          <div className="diplo-bar__half diplo-bar__half--brics" />
          <div className="diplo-bar__half diplo-bar__half--nato" />
          <div className="diplo-bar__marker diplo-bar__marker--center" style={{ left: "50%" }} />
          <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningLeft}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningRight}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitLeft}%` }} />
          <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitRight}%` }} />
          <div className="diplo-bar__thumb" style={{ left: `${position}%` }} />
        </div>
        <div className="diplo-bar__legend">
          <span>BRICS</span>
          <span>Lean</span>
          <span>Neutral</span>
          <span>Transit</span>
          <span>NATO</span>
        </div>
      </div>
    );
  }

  function renderDiplomacyListCard(country: typeof diplomacyTargets[number]) {
    const diplomacy = gameState.diplomacy[country.id];
    const status = gameState.countryStates[country.id];
    const leanBloc = getCountryLeanBloc(gameState, country.id);
    const transitGranted = canBlocUseTransit(gameState, playerBlocId, country.id);
    const combinedTilt = getCountryDualTiltLabel(diplomacy.eliteSupport, diplomacy.publicSupport);
    const selected = selectedDiplomacyCountryId === country.id;

    return (
      <button
        key={country.id}
        className={`diplo-list-card ${selected ? "diplo-list-card--selected" : ""}`}
        onClick={() => setSelectedDiplomacyCountryId(country.id)}
      >
        <div className="diplo-list-card__title-row">
          <span className="diplo-list-card__title">{country.name}</span>
          <span className={`diplo-list-card__lean ${leanBloc === "EU_NATO" ? "diplo-list-card__lean--nato" : leanBloc === "BRICS" ? "diplo-list-card__lean--brics" : ""}`}>
            {combinedTilt}
          </span>
        </div>
        <div className="diplo-list-card__subline">
          {status.atWar ? "At war" : country.alignment === "neutral" ? "Neutral" : "Aligned"}
          {country.alignment === "neutral" ? ` • ${transitGranted ? "Transit open" : "Transit closed"}` : ""}
        </div>
        <div className="diplo-list-card__mini-bars">
          <div className="diplo-list-card__mini-bar">
            <span>Elite</span>
            <div className="diplo-list-card__mini-track">
              <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.eliteSupport + 100) / 200) * 100}%` }} />
            </div>
          </div>
          <div className="diplo-list-card__mini-bar">
            <span>Public</span>
            <div className="diplo-list-card__mini-track">
              <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.publicSupport + 100) / 200) * 100}%` }} />
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="game-shell">
      <TopBar />

      {saveLoadOpen && (
        <div className="save-modal-overlay" onClick={() => setSaveLoadOpen(false)}>
          <div className="save-modal" onClick={(event) => event.stopPropagation()}>
            <div className="save-modal__header">
              <div>
                <h3>Save / Load</h3>
                <p>{saveLoadMode === "save" ? "Create or overwrite save slots." : "Select a slot and load instantly."}</p>
              </div>
              <button className="float-panel__close" onClick={() => setSaveLoadOpen(false)}>×</button>
            </div>
            <div className="save-modal__body">
              <div className="save-modal__list">
                {saveSlots.length === 0 && (
                  <div className="save-slot save-slot--empty">No saved slots yet.</div>
                )}
                {saveSlots.map((slot) => {
                  const savedAtLabel =
                    slot.envelope.savedAt && slot.envelope.savedAt !== new Date(0).toISOString()
                      ? new Date(slot.envelope.savedAt).toLocaleString()
                      : "Legacy";
                  return (
                    <button
                      key={slot.name}
                      className={`save-slot ${selectedSaveSlotName === slot.name ? "save-slot--active" : ""}`}
                      onClick={() => setSelectedSaveSlotName(slot.name)}
                    >
                      <div className="save-slot__title-row">
                        <span className="save-slot__name">{slot.name}</span>
                        <span className="save-slot__turn">T{slot.envelope.turn}</span>
                      </div>
                      <div className="save-slot__meta">{savedAtLabel}</div>
                      <div className="save-slot__meta">{gameState.countries[slot.envelope.countryId]?.name ?? slot.envelope.countryId}</div>
                    </button>
                  );
                })}
              </div>
              <div className="save-modal__actions">
                <label className="save-modal__label" htmlFor="save-slot-input">Slot Name</label>
                <input
                  id="save-slot-input"
                  className="save-modal__input"
                  value={saveSlotInput}
                  onChange={(event) => setSaveSlotInput(event.target.value)}
                  placeholder="my-campaign-turn12"
                />
                <div className="save-modal__buttons">
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={() => saveToSlot(saveSlotInput)}>Save New</button>
                  <button
                    className="top-bar__btn top-bar__btn--secondary"
                    onClick={() => selectedSaveSlotName ? saveToSlot(selectedSaveSlotName) : addToast("Select a slot first", "warning")}
                  >
                    Overwrite Selected
                  </button>
                  <button className="top-bar__btn top-bar__btn--primary" onClick={handleLoadSelectedSlot}>Load Selected</button>
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={handleDeleteSelectedSlot}>Delete Selected</button>
                  <button className="top-bar__btn top-bar__btn--secondary" onClick={handleLoadLegacyQuickSave}>Load Legacy Quick Save</button>
                </div>
                {selectedSaveSlot && (
                  <div className="save-modal__selected">
                    Selected: <strong>{selectedSaveSlot.name}</strong> (Turn {selectedSaveSlot.envelope.turn})
                    {selectedSaveSlot.isLegacyPayload ? " - Legacy Slot" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {diplomacyOpen && (
        <div className="float-panel" style={{ top: 52, bottom: "auto", left: "50%", transform: "translateX(-50%)", width: "min(1380px, calc(100vw - 20px))", maxWidth: "1380px", minWidth: "980px", zIndex: 42, maxHeight: "84vh" }}>
          <div className="float-panel__header">
            <span>Diplomacy</span>
            <button className="float-panel__close" onClick={() => setDiplomacyOpen(false)}>✕</button>
          </div>
          <div className="float-panel__body" style={{ maxHeight: "80vh" }}>
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
                    {visibleDiplomacyTargets.map((country) => renderDiplomacyListCard(country))}
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
                        {renderDiplomacyBar("Elite", selectedDiplomacyState.eliteSupport)}
                        {renderDiplomacyBar("Public", selectedDiplomacyState.publicSupport)}
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
                    <div className="diplomacy-actions-grid" style={{ marginBottom: "12px" }}>
                      {(["eliteBribery", "publicCampaign", "economicAid", "weedSmuggling", "securityPressure"] as DiplomacyActionType[]).map((actionType) => {
                        const action = getScaledDiplomacyActionDefinition(actionType, diplomacyIntensity);
                        const affordable = canAfford(action.cost);
                        const canInfluence = selectedDiplomacyCountry.alignment === "neutral";
                        const alreadyActed = selectedDiplomacyState.lastActionTurn === gameState.turn;
                        const disabled = !playerTurnActive || gameState.countryStates[selectedDiplomacyCountry.id].atWar || alreadyActed || !affordable || !canInfluence;
                        const direction = playerBlocId === "BRICS" ? -1 : 1;
                        const eliteDelta = action.eliteDelta * direction;
                        const publicDelta = action.publicDelta * direction;
                        const costLabel = Object.entries(action.cost).map(([key, amount]) => `${amount} ${key}`).join(" • ");

                        return (
                          <button
                            key={actionType}
                            className={`diplo-action-tile ${disabled ? "diplo-action-tile--disabled" : ""}`}
                            disabled={disabled}
                            onClick={() => handleDiplomacyAction(selectedDiplomacyCountry.id, actionType)}
                          >
                            <div className="diplo-action-tile__title">{action.label}</div>
                            <div className="diplo-action-tile__desc">{action.description}</div>
                            <div className="diplo-action-tile__effect-row">
                              <span className={`diplo-action-tile__effect ${eliteDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                                Elite {eliteDelta > 0 ? "+" : ""}{eliteDelta}
                              </span>
                              <span className={`diplo-action-tile__effect ${publicDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                                Public {publicDelta > 0 ? "+" : ""}{publicDelta}
                              </span>
                            </div>
                            <div className="diplo-action-tile__cost">{costLabel}</div>
                          </button>
                        );
                      })}
                    </div>
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
      )}

      {/* GLOBAL UNITS DROPDOWN */}
      {globalUnitsOpen && (
        <div className="global-units-panel">
          <div className="global-units-panel__header">
            <span>All {playerCountry.name} Units ({allPlayerUnits.length})</span>
            <button className="global-units-panel__close" onClick={() => setGlobalUnitsOpen(false)}>Close</button>
          </div>
          <div className="global-units-panel__list">
            {allPlayerUnits.map((unit) => {
              const region = gameState.regions[unit.regionId];
              const order = getUnitOrder(unit.id);
              const supplyStatus = getSupplyStatus(unit);
              return (
                <div
                  key={unit.id}
                  className={`global-unit-row global-unit-row--supply-${supplyStatus.tone}`}
                  onClick={() => { setSelectedRegionId(unit.regionId); setGlobalUnitsOpen(false); }}
                >
                  <span className="global-unit-row__icon">
                    {unit.type === "infantry" ? "\u2694" : unit.type === "armor" ? "\u{1F6E1}" : unit.type === "fighter" ? "\u2708" : unit.type === "bomber" ? "\u{1F4A3}" : "\u{1F3AF}"}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="global-unit-row__type">{unit.type}</span>
                    <span className="global-unit-row__location">{region?.name ?? "?"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="global-unit-row__stats">
                      STR {unit.strength} | SUP {unit.supplyTurnsRemaining} | VET {getVeterancyLevel(unit)} | ENT {getEntrenchmentBonus(unit)}%
                    </span>
                    <span className={`global-unit-row__supply global-unit-row__supply--${supplyStatus.tone}`}>{supplyStatus.label}</span>
                    {order && <span className={`global-unit-row__order global-unit-row__order--${order.type}`}>{order.type}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MAP */}
      <div className="map-stage" data-layout="map-stage">
        <TheaterMap
          state={gameState}
          selectedRegionId={selectedRegionId}
          onSelectRegion={handleSelectRegion}
          onSelectFacility={handleSelectFacilityFromMap}
          onSelectUnit={handleSelectUnitFromMap}
          validMoveTargets={validTargets.moves}
          validAttackTargets={[...validTargets.attacks, ...validTargets.airTargets, ...validTargets.bombardTargets, ...validTargets.missileTargets]}
          showSupplyOverlay={showSupplyOverlay}
        />

        {/* UNIT DRAWER — floats up from bottom of map */}
        {unitsInRegion.length > 0 && (
          <div className={`unit-drawer ${unitDrawerOpen ? "unit-drawer--open" : "unit-drawer--closed"}`}>
            <button className="unit-drawer__toggle" onClick={() => setUnitDrawerOpen((o) => !o)}>
              {unitDrawerOpen ? "\u25BC" : "\u25B2"} Units in {selectedRegion.name} ({unitsInRegion.length})
            </button>
            {unitDrawerOpen && (
              <div className="unit-drawer__list">
                {selectedUnitIds.size > 0 && (
                  <div className="unit-drawer__hint">
                    {selectedUnitIds.size === 1 ? "Click an adjacent region to move or attack" : `${selectedUnitIds.size} units selected — click a target region to attack with all`}
                  </div>
                )}
                {unitsInRegion.map((unit) => {
                  const order = getUnitOrder(unit.id);
                  const isOwnNation = unit.countryId === playerCountryId;
                  const isOwn = isOwnNation && playerTurnActive;
                  const isSelected = selectedUnitIds.has(unit.id);
                  const isBrics = unit.blocId === "BRICS";
                  const isNeutral = unit.blocId === "NEUTRAL";
                  const isAllied = unit.blocId === playerBlocId && !isOwnNation;
                  const isEnemy = unit.blocId !== playerBlocId;
                  const supplyStatus = getSupplyStatus(unit);
                  return (
                    <div
                      key={unit.id}
                      className={`unit-card ${isSelected ? "unit-card--selected" : ""} ${isOwn ? "unit-card--own" : ""} ${isAllied ? "unit-card--ally" : ""} ${isEnemy ? "unit-card--enemy" : ""} ${isBrics ? "unit-card--brics" : isNeutral ? "unit-card--neutral" : "unit-card--nato"} unit-card--supply-${supplyStatus.tone}`}
                      onClick={() => isOwn && handleSelectUnit(unit)}
                    >
                      <div className="unit-card__icon">
                        {unit.type === "infantry" ? "\u2694" : unit.type === "armor" ? "\u{1F6E1}" : unit.type === "fighter" ? "\u2708" : unit.type === "bomber" ? "\u{1F4A3}" : "\u{1F3AF}"}
                      </div>
                      <div className="unit-card__info">
                        <div className="unit-card__type">{unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}</div>
                        <div className="unit-card__stats">
                          <span className="unit-card__strength">STR {unit.strength}</span>
                          <span className={`unit-card__supply unit-card__supply--${supplyStatus.tone}`}>SUP {unit.supplyTurnsRemaining}</span>
                          <span className="unit-card__strength">VET {getVeterancyLevel(unit)}</span>
                          <span className="unit-card__strength">ENT {getEntrenchmentBonus(unit)}%</span>
                        </div>
                      </div>
                      <div className={`unit-card__supply-badge unit-card__supply-badge--${supplyStatus.tone}`}>{supplyStatus.label}</div>
                      <div className="unit-card__bloc">{isBrics ? "BRICS" : isNeutral ? "NEUTRAL" : "NATO"}</div>
                      {isAllied && <div className="unit-card__ally-label">ALLY</div>}
                      {isEnemy && <div className="unit-card__enemy-label">ENEMY</div>}
                      {order && (
                        <div className={`unit-card__order unit-card__order--${order.type}`}>
                          {order.type === "attack" ? "\u2192 ATK " : order.type === "move" ? "\u2192 MOV " : "HOLD"}
                          {order.type !== "hold" && gameState.regions[order.targetRegionId]?.name}
                        </div>
                      )}
                      {isSelected && isOwn && (
                        <div className="unit-card__actions">
                          <button className="unit-card__btn" onClick={(e) => { e.stopPropagation(); handleHoldUnit(unit.id); }}>Hold</button>
                          {unit.strength < (MAX_UNIT_STRENGTH[unit.type] ?? 8) && (() => {
                            const recruitRecipe = getUnitRecruitmentRecipe(unit.type);
                            const sourceFacility = recruitRecipe ? getBestOperationalFacility(unit.regionId, recruitRecipe.requiredFacility) : null;
                            const repInfo = getReplenishmentCost(unit.type, unit.strength, sourceFacility?.level ?? 1);
                            const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
                            if (alreadyReplenishing) return <span className="unit-card__btn" style={{ opacity: 0.5, cursor: "default" }}>Replenishing...</span>;
                            if (!repInfo) return null;
                            const costStr = Object.entries(repInfo.cost).map(([k, v]) => `${v}${k.slice(0,3)}`).join("+");
                            return (
                              <button className="unit-card__btn unit-card__btn--replenish" onClick={(e) => { e.stopPropagation(); handleReplenishUnit(unit.id); }} title={`Restore to full strength (${repInfo.turns}T, ${costStr})`}>
                                🔧 Replenish ({costStr})
                              </button>
                            );
                          })()}
                          {order && (
                            <button className="unit-card__btn unit-card__btn--cancel" onClick={(e) => { e.stopPropagation(); handleCancelOrder(unit.id); }}>Cancel</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STOCKPILE POPUP — floating window over map */}
        {stockpileOpen && (() => {
          const stockpile = gameState.countryStockpiles[playerCountryId];
          return (
            <div className="stockpile-popup">
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
        })()}

        {/* FACILITY DETAIL POPUP — floating window over map */}
        {selectedFacilityId && (() => {
          const economy = gameState.regionEconomies[selectedRegionId];
          if (!economy) return null;
          const facility = economy.facilities.find((f) => f.id === selectedFacilityId);
          if (!facility) return null;
          const buildRecipe = getFacilityBuildRecipe(facility.type);
          const upgradeCost = facility.level < 3 ? (getFacilityUpgradeCost(facility.type, facility.level) ?? {}) : {};
          const repairProfile = facility.damaged ? getFacilityRepairProfile(facility.type, facility.level) : null;
          // Production info
          const extractionResources = EXTRACTION_FACILITY_RESOURCES[facility.type];
          const processingRecipe = PROCESSING_RECIPES.find((r) => r.facilityType === facility.type);
          const isMunitionsPlant = facility.type === "munitionsPlant";
          const isChemicalPlant = facility.type === "chemicalPlant";
          const isCivilianFactory = facility.type === "civilianFactory";
          const isFarm = facility.type === "farm";
          // Military production: which units can this facility recruit?
          const recruitableUnits = UNIT_RECRUITMENT_COSTS.filter((r) => r.requiredFacility === facility.type);
          const militaryTimeBonus = Math.max(0, facility.level - 1);

          return (
            <div className="facility-popup">
              <div className="facility-popup__header">
                <span>{facility.type} — Lv.{facility.level}</span>
                <button className="facility-popup__close" onClick={() => setSelectedFacilityId(null)}>✕</button>
              </div>
              <div className="facility-popup__body">
                {facility.damaged && (
                  <div className="facility-popup__info" style={{ color: "#ff6b6b" }}>⚠ DAMAGED — not producing</div>
                )}
                {recruitableUnits.length > 0 && !facility.damaged && militaryTimeBonus > 0 && (
                  <div className="facility-popup__info" style={{ color: "#8bc99a" }}>
                    Recruitment bonus: -{militaryTimeBonus} turn{militaryTimeBonus === 1 ? "" : "s"} for units built here
                  </div>
                )}

                {/* Extraction facilities */}
                {extractionResources && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Extracts per turn:</div>
                    {economy.resourceDeposits.filter((d) => extractionResources.includes(d.type)).map((dep, i) => (
                      <div key={i} className="facility-popup__prod-row">
                        <span>{dep.type === "food" ? "Food (fertility)" : dep.type}</span>
                        <span className="facility-popup__prod-yield">+{dep.richness * facility.level} /turn</span>
                      </div>
                    ))}
                    {isFarm && facility.level >= 2 && (
                      <div className="facility-popup__prod-row" style={{ color: "#8bc99a" }}>
                        <span>🌿 Weed production unlocked</span>
                        <span className="facility-popup__prod-yield">1 food + 1 fert → 3 weed</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Processing facilities */}
                {processingRecipe && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Processes per turn (×Lv.{facility.level}):</div>
                    <div className="facility-popup__prod-row">
                      <span>In: {Object.entries(processingRecipe.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                      <span className="facility-popup__prod-yield">→ {Object.entries(processingRecipe.outputs).map(([k, v]) => `${(v ?? 0) * facility.level} ${k}`).join(" + ")}</span>
                    </div>
                    {processingRecipe.energyCost > 0 && <div className="facility-popup__prod-cost">⚡ {processingRecipe.energyCost} energy/turn</div>}
                  </div>
                )}

                {/* Munitions plant */}
                {isMunitionsPlant && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Produces per turn (×Lv.{facility.level}):</div>
                    <div className="facility-popup__prod-row">
                      <span>In: {Object.entries(MUNITIONS_PLANT_RECIPE.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                      <span className="facility-popup__prod-yield">→ {(MUNITIONS_PLANT_RECIPE.outputs.munitions ?? 0) * facility.level} munitions</span>
                    </div>
                    <div className="facility-popup__prod-cost">⚡ {MUNITIONS_PLANT_RECIPE.energyCost} energy/turn</div>
                  </div>
                )}

                {/* Chemical plant mode */}
                {isChemicalPlant && (() => {
                  const mode = facility.chemicalMode ?? "fertilizer";
                  const cRecipe = CHEMICAL_PLANT_RECIPES[mode as keyof typeof CHEMICAL_PLANT_RECIPES];
                  return (
                    <div className="facility-popup__production">
                      <div className="facility-popup__prod-title">Mode: {mode}</div>
                      <div className="facility-popup__prod-row">
                        <span>In: {Object.entries(cRecipe.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                        <span className="facility-popup__prod-yield">→ {Object.entries(cRecipe.outputs).map(([k, v]) => `${(v ?? 0) * facility.level} ${k}`).join(" + ")}</span>
                      </div>
                      <button className="build-btn" style={{ marginTop: 4 }} onClick={() => handleToggleChemicalMode(selectedRegionId, facility.id)}>
                        Switch to {mode === "explosives" ? "fertilizer" : "explosives"}
                      </button>
                    </div>
                  );
                })()}

                {/* Civilian factory */}
                {isCivilianFactory && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Civilian goods (auto per turn):</div>
                    {CIVILIAN_GOOD_RECIPES.filter((r) => r.requiredLevel <= facility.level).map((r) => (
                      <div key={r.good} className="facility-popup__prod-row">
                        <span>{Object.entries(r.inputs).map(([k, v]) => `${v} ${k}`).join(" + ")}</span>
                        <span className="facility-popup__prod-yield">→ {r.outputAmount} {r.good} (+{r.tradeValue} trade)</span>
                      </div>
                    ))}
                    {CIVILIAN_GOOD_RECIPES.some((r) => r.requiredLevel > facility.level) && (
                      <div className="facility-popup__prod-cost" style={{ color: "var(--muted)" }}>
                        Upgrade to unlock: {CIVILIAN_GOOD_RECIPES.filter((r) => r.requiredLevel > facility.level).map((r) => `${r.good} (Lv.${r.requiredLevel})`).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Military recruitment */}
                {recruitableUnits.length > 0 && !facility.damaged && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__production">
                    <div className="facility-popup__prod-title">Recruit units:</div>
                    {recruitableUnits.map((recipe) => {
                      const affordable = canAfford(recipe.cost);
                      const recruitTurns = getMilitaryProductionTurns(recipe.turns, facility.level);
                      return (
                        <div key={recipe.unitType} className="facility-popup__prod-row" style={{ alignItems: "center" }}>
                          <span>{recipe.unitType} — {Object.entries(recipe.cost).map(([k, v]) => `${v} ${k}`).join(", ")}</span>
                          <button
                            className={`build-btn ${affordable && !facility.damaged ? "" : "build-btn--disabled"}`}
                            disabled={!affordable || facility.damaged}
                            onClick={() => { handleRecruitUnit(selectedRegionId, recipe.unitType); }}
                            title={facility.damaged ? "Repair this facility first" : affordable ? "" : `Missing: ${getMissingResources(recipe.cost).join(", ")}`}
                          >
                            Recruit ({recruitTurns}t)
                          </button>
                        </div>
                      );
                    })}
                    
                    {/* Replenish troops currently stationed here */}
                    {Object.values(gameState.units).some(u => 
                      u.regionId === selectedRegionId && 
                      u.countryId === playerCountryId && 
                      u.strength < MAX_UNIT_STRENGTH[u.type] && 
                      recruitableUnits.some(r => r.unitType === u.type)
                    ) && (
                      <div style={{ marginTop: 12 }}>
                        <div className="facility-popup__prod-title">Replenish stationed troops:</div>
                        {Object.values(gameState.units).filter(u => 
                          u.regionId === selectedRegionId && 
                          u.countryId === playerCountryId && 
                          u.strength < MAX_UNIT_STRENGTH[u.type] && 
                          recruitableUnits.some(r => r.unitType === u.type)
                        ).map((unit) => {
                          const repInfo = getReplenishmentCost(unit.type, unit.strength, facility.level);
                          if (!repInfo) return null;
                          const replenishCost = repInfo.cost;
                          const affordable = canAfford(replenishCost);
                          const alreadyReplenishing = (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "replenishUnit" && o.unitId === unit.id);
                          return (
                            <div key={unit.id} className="facility-popup__prod-row" style={{ alignItems: "center" }}>
                              <span>{unit.type} (STR: {unit.strength}/{MAX_UNIT_STRENGTH[unit.type]})</span>
                              <button
                                className={`build-btn ${affordable && !alreadyReplenishing ? "" : "build-btn--disabled"}`}
                                disabled={!affordable || alreadyReplenishing}
                                onClick={() => { handleReplenishUnit(unit.id); }}
                                title={alreadyReplenishing ? "Already replenishing" : affordable ? "" : `Missing: ${getMissingResources(replenishCost).join(", ")}`}
                              >
                                {alreadyReplenishing ? "Queued" : `Replenish (${repInfo.turns}t - ${Object.entries(replenishCost).map(([k, v]) => `${v} ${k}`).join(", ")})`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Upgrade */}
                {facility.level < 3 && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__actions">
                    <button className="build-btn" disabled={facility.damaged || !canAfford(upgradeCost)} onClick={() => { handleUpgradeFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }} title={facility.damaged ? "Repair this facility first" : canAfford(upgradeCost) ? "" : `Missing: ${getMissingResources(upgradeCost).join(", ")}`}>
                      ⬆ Upgrade to Lv.{facility.level + 1} ({Object.entries(upgradeCost).map(([k, v]) => `${v} ${k}`).join(", ")})
                    </button>
                  </div>
                )}
                {repairProfile && selectedRegion.controllerCountryId === playerCountryId && playerTurnActive && (
                  <div className="facility-popup__actions">
                    <button
                      className="build-btn"
                      disabled={!canAfford(repairProfile.cost) || (gameState.economyBuildOrders[playerCountryId] ?? []).some((o) => o.type === "repairFacility" && o.facilityId === facility.id)}
                      onClick={() => { handleRepairFacility(facility.id, selectedRegionId); setSelectedFacilityId(null); }}
                      title={canAfford(repairProfile.cost) ? "" : `Missing: ${getMissingResources(repairProfile.cost).join(", ")}`}
                    >
                      Repair ({repairProfile.turns}t{Object.keys(repairProfile.cost).length > 0 ? ` - ${Object.entries(repairProfile.cost).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""})
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* FLOATING PANELS — each tab opens its own popup over the map */}
      <RegionPanel />
      <EconomyPanel />
      <RecruitmentPanel />
      <OrdersPanel />
      <AiIntelPanel />
      <WarStatusPanel />
      <EventLogPanel />

      <BottomBar />

      {latestDefeatAnnouncement && dismissedDefeatAnnouncement !== latestDefeatAnnouncement && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 10, 18, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80
          }}
        >
          <div
            style={{
              width: "min(540px, calc(100vw - 32px))",
              border: "1px solid rgba(255, 215, 120, 0.35)",
              background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              borderRadius: "14px",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f2d36b", fontWeight: 800, letterSpacing: "0.08em" }}>
              COUNTRY DEFEATED
            </div>
            <div style={{ padding: "18px", color: "#dbe6f2", lineHeight: 1.5 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px" }}>
                Strategic collapse confirmed
              </div>
              <div style={{ fontSize: "0.92rem", color: "#b7c4d3" }}>
                {latestDefeatAnnouncement}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 18px 18px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => setDismissedDefeatAnnouncement(latestDefeatAnnouncement)}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATTLE REPORT MODAL */}
      {combatReportOpen && lastEventLogSnapshot.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 10, 18, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
          }}
          onClick={() => setCombatReportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, calc(100vw - 40px))",
              maxHeight: "80vh",
              overflowY: "auto",
              border: "1px solid rgba(255, 180, 80, 0.35)",
              background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              borderRadius: 14,
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f2d36b", fontWeight: 800, letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚔️ TURN {gameState.turn - 1} — BATTLE REPORT</span>
              <button style={{ background: "none", border: "none", color: "#8a9bb0", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setCombatReportOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              {lastEventLogSnapshot.map((evt, i) => {
                const isCombat = evt.toLowerCase().includes("attack") || evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("retreat") || evt.toLowerCase().includes("captures");
                const isDefeat = evt.toLowerCase().includes("defeat") || evt.toLowerCase().includes("eliminated");
                const isVictory = evt.toLowerCase().includes("captures") || evt.toLowerCase().includes("won");
                return (
                  <div key={i} style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    background: isDefeat ? "rgba(239,68,68,0.1)" : isVictory ? "rgba(34,197,94,0.1)" : isCombat ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isDefeat ? "rgba(239,68,68,0.25)" : isVictory ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
                    color: isDefeat ? "#fca5a5" : isVictory ? "#86efac" : "#cbd5e1",
                  }}>
                    {isCombat ? "⚔️ " : "📡 "}{evt}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px 18px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => setCombatReportOpen(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastStack />

      {/* VICTORY / DEFEAT OVERLAY */}
      {victoryStatus !== "ongoing" && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: victoryStatus === "player_victory"
            ? "radial-gradient(ellipse at center, rgba(34,197,94,0.15), rgba(5,10,18,0.85))"
            : "radial-gradient(ellipse at center, rgba(239,68,68,0.15), rgba(5,10,18,0.85))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 150,
        }}>
          <div style={{
            width: "min(520px, calc(100vw - 40px))",
            border: victoryStatus === "player_victory" ? "2px solid rgba(34,197,94,0.5)" : "2px solid rgba(239,68,68,0.5)",
            background: "linear-gradient(180deg, rgba(23,30,40,0.98), rgba(13,18,26,0.98))",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            borderRadius: 16,
            overflow: "hidden",
            textAlign: "center",
          }}>
            <div style={{
              padding: "24px",
              background: victoryStatus === "player_victory"
                ? "linear-gradient(180deg, rgba(34,197,94,0.15), transparent)"
                : "linear-gradient(180deg, rgba(239,68,68,0.15), transparent)",
            }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: victoryStatus === "player_victory" ? "#22c55e" : "#ef4444", marginBottom: 8 }}>
                {victoryStatus === "player_victory" ? "🏆 VICTORY" : "💀 DEFEAT"}
              </div>
              <div style={{ fontSize: "1.1rem", color: "#b7c4d3", lineHeight: 1.6 }}>
                {victoryStatus === "player_victory"
                  ? `${playerCountry.name} has achieved total dominance! All enemy major powers have been defeated.`
                  : `${playerCountry.name} has fallen. The war is lost.`}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#8a9bb0", marginTop: 12 }}>
                Turn {gameState.turn} • {Object.values(gameState.countryStates).filter((s) => s.defeatedOnTurn !== undefined).length} nations defeated
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", padding: "0 24px 24px" }}>
              <button className="top-bar__btn top-bar__btn--primary" onClick={() => { setGameStarted(false); }}>
                New Game
              </button>
              <button className="top-bar__btn top-bar__btn--secondary" onClick={() => handleLoadGame()}>
                Load Save
              </button>
            </div>
          </div>
        </div>
      )}

      {logicMapOpen && (
        <EconomyLogicMap onClose={() => setLogicMapOpen(false)} />
      )}

      <SupplyToggle />

      {/* DOCTRINES PANEL */}
      {doctrineOpen && (
        <div
          onClick={() => setDoctrineOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, calc(100vw - 40px))",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "linear-gradient(180deg, rgba(15,22,35,0.99), rgba(8,13,22,0.99))",
              border: "1px solid rgba(100,150,220,0.3)",
              borderRadius: 14,
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#90cdf4", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.08em" }}>🎓 DOCTRINE UPGRADES</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#f2d36b", fontSize: "0.85rem" }}>Trade Points: {Math.floor(gameState.countryStockpiles[playerCountryId].tradePoints)}</span>
                <button style={{ background: "none", border: "none", color: "#8a9bb0", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setDoctrineOpen(false)}>✕</button>
              </div>
            </div>
            {/* Doctrine grid */}
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {DOCTRINE_DEFINITIONS.map((def) => {
                const owned = gameState.doctrineUpgrades?.[playerCountryId]?.includes(def.id) ?? false;
                const prereqsMet = (def.requires ?? []).every(r => gameState.doctrineUpgrades?.[playerCountryId]?.includes(r));
                const canAfford = gameState.countryStockpiles[playerCountryId].tradePoints >= def.cost;
                const available = !owned && prereqsMet;
                const catColor = def.category === "military" ? "#f87171" : def.category === "logistics" ? "#fb923c" : "#4ade80";
                return (
                  <div key={def.id} style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${owned ? "rgba(34,197,94,0.4)" : available ? "rgba(100,150,220,0.3)" : "rgba(255,255,255,0.06)"}`,
                    background: owned ? "rgba(34,197,94,0.06)" : available ? "rgba(30,60,120,0.3)" : "rgba(255,255,255,0.02)",
                    opacity: !owned && !available ? 0.5 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: owned ? "#86efac" : "#e2e8f0", fontSize: "0.88rem" }}>
                        {owned ? "✓ " : ""}{def.name}
                      </span>
                      <span style={{ fontSize: "0.7rem", background: `rgba(0,0,0,0.3)`, color: catColor, border: `1px solid ${catColor}44`, borderRadius: 4, padding: "1px 6px", flexShrink: 0, marginLeft: 8 }}>
                        {def.category}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: 10 }}>{def.description}</div>
                    {def.requires && def.requires.length > 0 && !owned && (
                      <div style={{ fontSize: "0.7rem", color: "#f59e0b", marginBottom: 8 }}>
                        Requires: {def.requires.map(r => DOCTRINE_DEFINITIONS.find(d => d.id === r)?.name ?? r).join(", ")}
                      </div>
                    )}
                    {!owned && (
                      <button
                        onClick={() => handlePurchaseDoctrine(def.id)}
                        disabled={!available || !canAfford}
                        style={{
                          width: "100%",
                          padding: "6px 0",
                          borderRadius: 6,
                          border: "none",
                          background: !available ? "rgba(255,255,255,0.05)" : canAfford ? "rgba(94,144,234,0.25)" : "rgba(255,255,255,0.05)",
                          color: !available ? "#4a5568" : canAfford ? "#90cdf4" : "#f87171",
                          cursor: !available || !canAfford ? "not-allowed" : "pointer",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                        }}
                      >
                        {!prereqsMet ? "🔒 Locked" : canAfford ? `Unlock — ${def.cost} TP` : `Need ${def.cost} TP`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
