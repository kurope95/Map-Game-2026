import "./TopBar.css";
import { useGame } from "../session/GameProvider";

export function TopBar() {
  const {
    gameState, playerCountryId, selectedRegionId, setSelectedRegionId, setSelectedUnitIds, globalUnitsOpen,
    setGlobalUnitsOpen, diplomacyOpen, setDiplomacyOpen, doctrineOpen, setDoctrineOpen, playerCountry,
    playerBlocId, playerCountryUnits, allPlayerUnits, quickJumpRegions, handleSaveGame, handleLoadGame,
    handleAdvanceTurn, handleRunAiTurn, handleAutoPlay,
  } = useGame();

  return (
    <div className="top-bar" data-layout="top-bar">
      <span className="top-bar__brand" data-layout-key="mapgame">Map Game</span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="nation">Nation<strong>{playerCountry.name}</strong></span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="turn">Turn<strong>{gameState.turn}</strong></span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="bloc">Bloc<strong>{playerBlocId === "BRICS" ? "BRICS" : playerBlocId === "EU_NATO" ? "EU NATO" : "Neutral"}</strong></span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="active">Active<strong>{gameState.countries[gameState.currentActorId].name}</strong></span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="nationalunits">National Units<strong>{playerCountryUnits.length}</strong></span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="trade">Trade<strong>{gameState.countryStockpiles[playerCountryId].tradePoints}</strong></span>
      <span className="top-bar__divider" />
      <span
        className={`top-bar__stat top-bar__stat--clickable ${globalUnitsOpen ? "top-bar__stat--active" : ""}`}
        onClick={() => setGlobalUnitsOpen((o) => !o)}
        title="Click to view all your units"
        data-layout-key="units"
      >
        Units<strong>{allPlayerUnits.length}</strong>
      </span>
      <span className="top-bar__divider" />

      <select
        className="top-bar__select"
        data-layout-key="select"
        value={selectedRegionId}
        onChange={(e) => { setSelectedRegionId(e.target.value); setSelectedUnitIds(new Set()); }}
      >
        {quickJumpRegions.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <span className="top-bar__spacer" data-layout-key="spacer" />

      <button className="top-bar__btn top-bar__btn--primary" data-layout-key="endturn" onClick={handleAdvanceTurn}>End Turn</button>
      <button className="top-bar__btn top-bar__btn--secondary" data-layout-key="runai" onClick={handleRunAiTurn}>Run AI</button>
      <button className="top-bar__btn top-bar__btn--secondary" data-layout-key="autox" onClick={() => handleAutoPlay(6)}>Auto x6</button>
      <button className={`top-bar__btn top-bar__btn--secondary ${diplomacyOpen ? "top-bar__btn--active" : ""}`} data-layout-key="diplomacy" onClick={() => setDiplomacyOpen((open) => !open)}>Diplomacy</button>
      <button className={`top-bar__btn top-bar__btn--secondary ${doctrineOpen ? "top-bar__btn--active" : ""}`} data-layout-key="doctrines" onClick={() => setDoctrineOpen((open) => !open)}>🎓 Doctrines</button>
      <span className="top-bar__divider" />
      <button className="top-bar__btn top-bar__btn--secondary" data-layout-key="savegame" onClick={handleSaveGame} title="Save game">💾</button>
      <button className="top-bar__btn top-bar__btn--secondary" data-layout-key="loadgame" onClick={handleLoadGame} title="Load game">📂</button>
    </div>
  );
}
