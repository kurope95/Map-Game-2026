import type { CountryId } from "../../../game/state/types";
import type { NationBriefing } from "./briefing";
import { NationCard } from "./NationCard";

interface NationColumnProps {
  label: string;
  modifier: "brics" | "neutral" | "nato";
  nations: NationBriefing[];
  selectedCountryId: CountryId;
  onSelectCountry: (countryId: CountryId) => void;
  onHoverCountry: (countryId: CountryId | null) => void;
}

export function NationColumn({
  label,
  modifier,
  nations,
  selectedCountryId,
  onSelectCountry,
  onHoverCountry
}: NationColumnProps) {
  return (
    <section className={`start-column start-column--${modifier}`}>
      <header className="start-column__header">
        <span>{label}</span>
        <span className="start-column__count">{nations.length} nations</span>
      </header>
      <div className="start-column__body">
        {nations.map((briefing) => (
          <NationCard
            key={briefing.countryId}
            briefing={briefing}
            selected={briefing.countryId === selectedCountryId}
            onSelect={() => onSelectCountry(briefing.countryId)}
            onHover={onHoverCountry}
          />
        ))}
      </div>
    </section>
  );
}
