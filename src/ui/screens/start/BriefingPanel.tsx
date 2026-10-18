import { Button } from "../../kit/Button";
import { Flag } from "../../kit/Flag";
import { Pips } from "../../kit/Pips";
import { StatRow } from "../../kit/StatRow";
import type { NationBriefing } from "./briefing";

interface BriefingPanelProps {
  briefing: NationBriefing;
  continueLabel: string | null;
  onStart: () => void;
  onContinue: () => void;
  onOpenLoad: () => void;
}

export function BriefingPanel({ briefing, continueLabel, onStart, onContinue, onOpenLoad }: BriefingPanelProps) {
  return (
    <aside className="start-briefing" data-layout="start-briefing">
      <div className="start-briefing__head">
        <Flag countryId={briefing.countryId} width={34} />
        <div>
          <h2 className="start-briefing__name">{briefing.name}</h2>
          <div className="start-briefing__bloc">
            {briefing.blocLabel} · {briefing.tierLabel}
          </div>
        </div>
      </div>

      <div className="start-briefing__stats">
        <StatRow
          label="Difficulty"
          value={
            <span className="start-briefing__difficulty">
              <Pips count={briefing.difficultyPips} />
              {briefing.difficulty}
            </span>
          }
        />
        <StatRow label="Capital" value={briefing.capitalName} />
        <StatRow
          label="Territory"
          value={`${briefing.regionCount} regions · ${briefing.keyCityCount} key cities`}
        />
        <StatRow label="Starting forces" value={briefing.unitSummary} />
      </div>

      <div className="start-briefing__war">
        <div className="start-briefing__war-label">War entry</div>
        <p>{briefing.warEntryText}</p>
      </div>

      <div className="start-briefing__actions">
        <Button variant="primary" onClick={onStart} data-layout="start-button">
          Start as {briefing.name}
        </Button>
        {continueLabel && (
          <Button variant="secondary" onClick={onContinue}>
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
