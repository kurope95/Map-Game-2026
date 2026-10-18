import { Badge, type BadgeTone } from "../../kit/Badge";
import { Button } from "../../kit/Button";
import { Flag } from "../../kit/Flag";
import { StatRow } from "../../kit/StatRow";
import type { NationBriefing } from "./briefing";
import "./BriefingPanel.css";

interface BriefingPanelProps {
  briefing: NationBriefing;
  continueLabel: string | null;
  onStart: () => void;
  onContinue: () => void;
  onOpenLoad: () => void;
}

const BLOC_TONE: Record<NationBriefing["blocLabel"], BadgeTone> = {
  BRICS: "brics",
  "EU NATO": "nato",
  Neutral: "neutral"
};

const DIFFICULTY_TONE: Record<NationBriefing["difficulty"], BadgeTone> = {
  Easy: "good",
  Medium: "warn",
  Hard: "bad",
  "Very hard": "bad"
};

export function BriefingPanel({ briefing, continueLabel, onStart, onContinue, onOpenLoad }: BriefingPanelProps) {
  return (
    <aside className="start-briefing" data-layout="start-briefing">
      <div className="start-briefing__kicker">Campaign briefing</div>

      <div className="start-briefing__head">
        <Flag countryId={briefing.countryId} width={40} />
        <div>
          <h2 className="start-briefing__name">{briefing.name}</h2>
          <div className="start-briefing__bloc">
            <Badge tone={BLOC_TONE[briefing.blocLabel]}>{briefing.blocLabel}</Badge>
            <span className="start-briefing__tier">{briefing.tierLabel}</span>
          </div>
        </div>
      </div>

      <div className="start-briefing__stats">
        <StatRow
          label="Difficulty"
          value={<Badge tone={DIFFICULTY_TONE[briefing.difficulty]}>{briefing.difficulty}</Badge>}
        />
        <StatRow label="Capital" value={briefing.capitalName} />
        <StatRow
          label="Territory"
          value={`${briefing.regionCount} regions · ${briefing.keyCityCount} key cities`}
        />
        <StatRow
          className="start-briefing__forces"
          label="Starting forces"
          value={briefing.unitSummary}
        />
      </div>

      <div className="start-briefing__war">
        <div className="start-briefing__war-label">War entry</div>
        <p>{briefing.warEntryText}</p>
        {briefing.enemyBlocLabel && (
          <div className="start-briefing__enemy">
            <span>
              Facing {briefing.enemyBlocLabel} · {briefing.enemyBelligerentCount} nations at war
            </span>
            {briefing.enemyMajorLabels.length > 0 && (
              <span>Enemy majors: {briefing.enemyMajorLabels.join(", ")}</span>
            )}
          </div>
        )}
      </div>

      <div className="start-briefing__actions">
        <Button variant="primary" size="lg" onClick={onStart} data-layout="start-button">
          Start as {briefing.name}
        </Button>
        {continueLabel && (
          <Button variant="secondary" className="start-briefing__continue" onClick={onContinue}>
            {continueLabel}
          </Button>
        )}
        <Button variant="ghost" onClick={onOpenLoad}>
          Load game
        </Button>
      </div>
    </aside>
  );
}
