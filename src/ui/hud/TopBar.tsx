import "./TopBar.css";
import { FolderOpen, GraduationCap, Handshake, Save } from "lucide-react";
import { Button } from "../kit/Button";
import { Flag } from "../kit/Flag";
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
      <span className="top-bar__stat" data-layout-key="nation">
        <span className="top-bar__stat-label">Nation</span>
        <strong className="top-bar__stat-value">
          <Flag countryId={playerCountryId} width={16} />
          {playerCountry.name}
        </strong>
      </span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="turn">
        <span className="top-bar__stat-label">Turn</span>
        <strong className="top-bar__stat-value">{gameState.turn}</strong>
      </span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="bloc">
        <span className="top-bar__stat-label">Bloc</span>
        <strong className="top-bar__stat-value">{playerBlocId === "BRICS" ? "BRICS" : playerBlocId === "EU_NATO" ? "EU NATO" : "Neutral"}</strong>
      </span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="active">
        <span className="top-bar__stat-label">Active</span>
        <strong className="top-bar__stat-value">{gameState.countries[gameState.currentActorId].name}</strong>
      </span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="nationalunits">
        <span className="top-bar__stat-label">National Units</span>
        <strong className="top-bar__stat-value">{playerCountryUnits.length}</strong>
      </span>
      <span className="top-bar__divider" />
      <span className="top-bar__stat" data-layout-key="trade">
        <span className="top-bar__stat-label">Trade</span>
        <strong className="top-bar__stat-value">{gameState.countryStockpiles[playerCountryId].tradePoints}</strong>
      </span>
      <span className="top-bar__divider" />
      <span
        className={`top-bar__stat top-bar__stat--clickable ${globalUnitsOpen ? "top-bar__stat--active" : ""}`}
        onClick={() => setGlobalUnitsOpen((o) => !o)}
        title="Click to view all your units"
        data-layout-key="units"
      >
        <span className="top-bar__stat-label">Units</span>
        <strong className="top-bar__stat-value">{allPlayerUnits.length}</strong>
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

      <Button variant="primary" data-layout-key="endturn" onClick={handleAdvanceTurn}>End Turn</Button>
      <Button variant="secondary" data-layout-key="runai" onClick={handleRunAiTurn}>Run AI</Button>
      <Button variant="secondary" data-layout-key="autox" onClick={() => handleAutoPlay(6)}>Auto x6</Button>
      <Button
        variant="secondary"
        icon={Handshake}
        className={diplomacyOpen ? "top-bar__open" : ""}
        data-layout-key="diplomacy"
        onClick={() => setDiplomacyOpen((open) => !open)}
      >
        Diplomacy
      </Button>
      <Button
        variant="secondary"
        icon={GraduationCap}
        className={doctrineOpen ? "top-bar__open" : ""}
        data-layout-key="doctrines"
        onClick={() => setDoctrineOpen((open) => !open)}
      >
        Doctrines
      </Button>
      <span className="top-bar__divider" />
      <Button
        variant="ghost"
        size="sm"
        icon={Save}
        className="top-bar__icon-button"
        data-layout-key="savegame"
        onClick={handleSaveGame}
        title="Save game"
        aria-label="Save game"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={FolderOpen}
        className="top-bar__icon-button"
        data-layout-key="loadgame"
        onClick={handleLoadGame}
        title="Load game"
        aria-label="Load game"
      />
    </div>
  );
}
