import { useMemo, useState } from "react";
import type { CountryId } from "../../../game/state/types";
import { MapView } from "../../map/MapView";
import { useGame } from "../../session/GameProvider";
import { AUTOSAVE_KEY, parseAutosave, type ParsedAutosave } from "../../session/autosave";
import { getNationBriefing } from "./briefing";
import { BriefingPanel } from "./BriefingPanel";
import { NationColumn } from "./NationColumn";
import { getScenarioOverview } from "./scenarioOverview";
import { TheatrePanel } from "./TheatrePanel";
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
  const overview = useMemo(() => getScenarioOverview(gameState), [gameState]);
  const selectedBriefing = useMemo(
    () => getNationBriefing(gameState, playerCountryId),
    [gameState, playerCountryId]
  );
  const continueLabel = autosave
    ? `Autosave · ${autosave.state.countries[autosave.countryId]?.name ?? autosave.countryId}, turn ${autosave.turn}`
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
          <div className="start-screen__masthead">
            <div>
              <div className="start-screen__eyebrow">Europe 2026</div>
              <h1 className="start-screen__title">Map Game</h1>
              <p className="start-screen__subtitle">
                Pick a nation. Each one starts the war differently.
              </p>
            </div>
            <div className="start-screen__stats" role="group" aria-label="Scenario at a glance">
              <div className="start-stat">
                <span className="start-stat__value">{overview.nationCount}</span>
                <span className="start-stat__label">Nations</span>
              </div>
              <div className="start-stat">
                <span className="start-stat__value">{overview.regionCount}</span>
                <span className="start-stat__label">City-regions</span>
              </div>
              <div className="start-stat start-stat--war">
                <span className="start-stat__value">{overview.atWarCount}</span>
                <span className="start-stat__label">At war</span>
              </div>
            </div>
          </div>
        </header>

        <div className="start-screen__grid">
          {BLOC_COLUMNS.map((column) => {
            const blocOverview = overview.blocs.find((entry) => entry.blocId === column.blocId);
            return (
              <NationColumn
                key={column.blocId}
                label={column.label}
                modifier={column.modifier}
                regionCount={blocOverview?.regionCount ?? 0}
                atWarCount={blocOverview?.atWarCount ?? 0}
                nations={briefings
                  .filter((briefing) => gameState.countries[briefing.countryId].blocId === column.blocId)
                  .sort((left, right) => left.name.localeCompare(right.name))}
                selectedCountryId={playerCountryId}
                onSelectCountry={setPlayerCountryId}
                onHoverCountry={setHoveredCountryId}
              />
            );
          })}

          <div className="start-screen__sidebar">
            <BriefingPanel
              briefing={selectedBriefing}
              continueLabel={continueLabel}
              onStart={handleStartGame}
              onContinue={() => {
                if (autosave) loadStateFromSave(autosave.state, "Continued autosave");
              }}
              onOpenLoad={() => openSaveLoadPanel("load")}
            />
            <TheatrePanel overview={overview} />
          </div>
        </div>
      </div>
    </div>
  );
}
