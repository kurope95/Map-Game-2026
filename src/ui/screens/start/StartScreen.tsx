import { useMemo, useState } from "react";
import type { CountryId } from "../../../game/state/types";
import { MapView } from "../../map/MapView";
import { useGame } from "../../session/GameProvider";
import { AUTOSAVE_KEY, parseAutosave, type ParsedAutosave } from "../../session/autosave";
import { getNationBriefing } from "./briefing";
import { BriefingPanel } from "./BriefingPanel";
import { NationColumn } from "./NationColumn";
import "./StartScreen.css";

const BLOC_COLUMNS = [
  { blocId: "BRICS", label: "BRICS", modifier: "brics" },
  { blocId: "NEUTRAL", label: "Neutral", modifier: "neutral" },
  { blocId: "EU_NATO", label: "EU NATO", modifier: "nato" }
] as const;

function readAutosave(): ParsedAutosave | null {
  try {
    return parseAutosave(localStorage.getItem(AUTOSAVE_KEY));
  } catch {
    return null;
  }
}

export function StartScreen() {
  const {
    gameState,
    playerCountryId,
    setPlayerCountryId,
    handleStartGame,
    loadStateFromSave,
    openSaveLoadPanel
  } = useGame();
  const [hoveredCountryId, setHoveredCountryId] = useState<CountryId | null>(null);
  const [autosave] = useState<ParsedAutosave | null>(readAutosave);

  const briefings = useMemo(
    () => Object.values(gameState.countries).map((country) => getNationBriefing(gameState, country.id)),
    [gameState]
  );
  const selectedBriefing = getNationBriefing(gameState, playerCountryId);
  const continueLabel = autosave
    ? `Continue · ${autosave.state.countries[autosave.countryId]?.name ?? autosave.countryId}, turn ${autosave.turn}`
    : null;

  return (
    <div className="start-screen">
      <div className="start-screen__map">
        <MapView
          state={gameState}
          selectedRegionId={null}
          mode="showcase"
          highlightCountryId={hoveredCountryId ?? playerCountryId}
        />
      </div>
      <div className="start-screen__overlay" />

      <div className="start-screen__content">
        <header className="start-screen__header">
          <div className="start-screen__eyebrow">Europe 2026</div>
          <h1 className="start-screen__title">Map Game</h1>
          <p className="start-screen__subtitle">Pick a nation. Each one starts the war differently.</p>
        </header>

        <div className="start-screen__grid">
          {BLOC_COLUMNS.map((column) => (
            <NationColumn
              key={column.blocId}
              label={column.label}
              modifier={column.modifier}
              nations={briefings
                .filter((briefing) => gameState.countries[briefing.countryId].blocId === column.blocId)
                .sort((left, right) => left.name.localeCompare(right.name))}
              selectedCountryId={playerCountryId}
              onSelectCountry={setPlayerCountryId}
              onHoverCountry={setHoveredCountryId}
            />
          ))}

          <BriefingPanel
            briefing={selectedBriefing}
            continueLabel={continueLabel}
            onStart={handleStartGame}
            onContinue={() => {
              if (autosave) loadStateFromSave(autosave.state, "Continued autosave");
            }}
            onOpenLoad={() => openSaveLoadPanel("load")}
          />
        </div>
      </div>
    </div>
  );
}
