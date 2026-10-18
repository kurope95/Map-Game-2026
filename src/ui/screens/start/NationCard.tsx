import type { CountryId } from "../../../game/state/types";
import { Badge, type BadgeTone } from "../../kit/Badge";
import { Flag } from "../../kit/Flag";
import { Pips } from "../../kit/Pips";
import type { NationBriefing } from "./briefing";

interface NationCardProps {
  briefing: NationBriefing;
  selected: boolean;
  onSelect: () => void;
  onHover: (countryId: CountryId | null) => void;
}

function statusTone(status: string): BadgeTone {
  if (status === "At war") return "bad";
  if (status.startsWith("Joins")) return "warn";
  if (status.includes("reserve")) return "info";
  return "plain";
}

export function NationCard({ briefing, selected, onSelect, onHover }: NationCardProps) {
  const { countryId } = briefing;
  return (
    <button
      type="button"
      className={`nation-card${selected ? " nation-card--selected" : ""}`}
      onClick={onSelect}
      onMouseEnter={() => onHover(countryId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(countryId)}
      onBlur={() => onHover(null)}
    >
      <span className="nation-card__top">
        <span className="nation-card__flag">
          <Flag countryId={countryId} />
        </span>
        <span className="nation-card__name">{briefing.name}</span>
        <Pips count={briefing.difficultyPips} />
      </span>
      <span className="nation-card__meta">
        <span className="nation-card__tier">{briefing.tierLabel}</span>
        <Badge tone={statusTone(briefing.status)}>{briefing.status}</Badge>
      </span>
    </button>
  );
}
