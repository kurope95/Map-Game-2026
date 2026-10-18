import type { CountryDefinition, CountryId, CountryState } from "../game/state/types";
import { getDifficulty, getStartingStatus } from "./screens/start/briefing";
import "./LandingPage.css";

interface NationCard {
  country: CountryDefinition;
  state: CountryState;
  startingUnitCount: number;
}

interface LandingPageProps {
  nations: NationCard[];
  selectedCountryId: CountryId;
  onSelectCountry: (countryId: CountryId) => void;
  onStartGame: () => void;
}

const tierLabel: Record<CountryDefinition["tier"], string> = {
  major: "Major",
  middle: "Middle",
  minor: "Minor"
};

function getBlocGroup(card: NationCard): "BRICS" | "NEUTRAL" | "EU_NATO" {
  if (card.country.blocId === "BRICS") {
    return "BRICS";
  }
  if (card.country.blocId === "EU_NATO") {
    return "EU_NATO";
  }
  return "NEUTRAL";
}

export function LandingPage({
  nations,
  selectedCountryId,
  onSelectCountry,
  onStartGame,
}: LandingPageProps) {
  const grouped = {
    BRICS: nations.filter((card) => getBlocGroup(card) === "BRICS"),
    NEUTRAL: nations.filter((card) => getBlocGroup(card) === "NEUTRAL"),
    EU_NATO: nations.filter((card) => getBlocGroup(card) === "EU_NATO"),
  };

  return (
    <div className="landing-shell">
      <div className="landing-hero">
        <div className="landing-hero__eyebrow">Europe 2026 Scenario</div>
        <h1 className="landing-hero__title">Map Game</h1>
        <p className="landing-hero__copy">
          Choose a nation, review its opening position, then drop into the current war UI.
        </p>
        <button className="landing-hero__start" onClick={onStartGame}>
          Start as {nations.find((card) => card.country.id === selectedCountryId)?.country.name}
        </button>
      </div>

      <div className="landing-grid">
        {(["BRICS", "NEUTRAL", "EU_NATO"] as const).map((group) => (
          <section key={group} className={`landing-column landing-column--${group.toLowerCase()}`}>
            <div className="landing-column__header">
              <span>{group === "EU_NATO" ? "EU NATO" : group}</span>
              <span>{grouped[group].length} nations</span>
            </div>

            <div className="landing-column__body">
              {grouped[group].map((card) => {
                const selected = card.country.id === selectedCountryId;
                return (
                  <button
                    key={card.country.id}
                    type="button"
                    className={`nation-card ${selected ? "nation-card--selected" : ""}`}
                    onClick={() => onSelectCountry(card.country.id)}
                  >
                    <div className="nation-card__top">
                      <div>
                        <div className="nation-card__name">{card.country.name}</div>
                        <div className="nation-card__meta">
                          {tierLabel[card.country.tier]} · {getDifficulty(card.country)}
                        </div>
                      </div>
                      <span className="nation-card__badge">{getStartingStatus(card.country, card.state)}</span>
                    </div>

                    <div className="nation-card__stats">
                      <span>{card.country.startingRegionIds.length} regions</span>
                      <span>{card.startingUnitCount} units</span>
                      <span>{card.country.keyRegionIds.length} key cities</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
