import type { BlocId } from "../../../game/state/types";
import type { ScenarioOverview } from "./scenarioOverview";
import "./TheatrePanel.css";

const BLOC_MODIFIERS: Record<BlocId, string> = {
  BRICS: "brics",
  NEUTRAL: "neutral",
  EU_NATO: "nato"
};

interface TheatrePanelProps {
  overview: ScenarioOverview;
}

export function TheatrePanel({ overview }: TheatrePanelProps) {
  const share = (regionCount: number) =>
    overview.regionCount === 0 ? 0 : (regionCount / overview.regionCount) * 100;

  return (
    <section className="start-theatre" data-layout="start-theatre">
      <header className="start-theatre__header">
        <span>Starting control</span>
        <span className="start-theatre__count">{overview.regionCount} city-regions</span>
      </header>
      <div
        className="start-theatre__bar"
        role="img"
        aria-label={overview.blocs
          .map((bloc) => `${bloc.label} controls ${bloc.regionCount} regions`)
          .join(", ")}
      >
        {overview.blocs.map((bloc) => (
          <span
            key={bloc.blocId}
            className={`start-theatre__segment start-theatre__segment--${BLOC_MODIFIERS[bloc.blocId]}`}
            style={{ width: `${share(bloc.regionCount)}%` }}
          />
        ))}
      </div>
      <ul className="start-theatre__legend">
        {overview.blocs.map((bloc) => (
          <li key={bloc.blocId}>
            <span
              className={`start-theatre__swatch start-theatre__swatch--${BLOC_MODIFIERS[bloc.blocId]}`}
            />
            <span className="start-theatre__label">{bloc.label}</span>
            <span className="start-theatre__value">{bloc.regionCount}</span>
          </li>
        ))}
      </ul>
      <p className="start-theatre__note">
        {overview.atWarCount} of {overview.nationCount} nations are already at war on turn 1.
      </p>
    </section>
  );
}
