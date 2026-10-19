import { useEffect, useRef, useState } from "react";
import type { CountryId } from "../../../game/state/types";
import type { NationBriefing } from "./briefing";
import { NationCard } from "./NationCard";

interface NationColumnProps {
  label: string;
  modifier: "brics" | "neutral" | "nato";
  regionCount: number;
  atWarCount: number;
  nations: NationBriefing[];
  selectedCountryId: CountryId;
  onSelectCountry: (countryId: CountryId) => void;
  onHoverCountry: (countryId: CountryId | null) => void;
}

export function NationColumn({
  label,
  modifier,
  regionCount,
  atWarCount,
  nations,
  selectedCountryId,
  onSelectCountry,
  onHoverCountry
}: NationColumnProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const update = () => {
      const scrollable = body.scrollHeight > body.clientHeight + 1;
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      setShowFade(scrollable && !atEnd);
    };

    update();
    body.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(body);

    return () => {
      body.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [nations.length]);

  return (
    <section className={`start-column start-column--${modifier}`}>
      <header className="start-column__header">
        <span>{label}</span>
        <span className="start-column__count">{nations.length} nations</span>
      </header>
      <div className="start-column__scroll">
        <div className="start-column__body" ref={bodyRef}>
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
        {showFade && <div className="start-column__fade" aria-hidden="true" />}
      </div>
      <footer className="start-column__footer">
        <span>{regionCount} regions</span>
        <span className={atWarCount > 0 ? "start-column__footer-war" : undefined}>
          {atWarCount} at war
        </span>
      </footer>
    </section>
  );
}
