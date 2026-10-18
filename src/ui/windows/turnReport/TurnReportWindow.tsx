import {
  Bomb,
  ChevronDown,
  ChevronRight,
  Factory,
  Flag as FlagIcon,
  Globe,
  Handshake,
  Info,
  OctagonAlert,
  Plane,
  Route,
  ScrollText,
  Swords,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../kit/Badge";
import { Button } from "../../kit/Button";
import { Flag } from "../../kit/Flag";
import { Window } from "../../kit/Window";
import { useGame } from "../../session/GameProvider";
import { parseTurnReport, type ReportCategory, type ReportRow, type ReportSection } from "./parseTurnReport";
import "./TurnReportWindow.css";

const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = {
  capture: FlagIcon,
  battle: Swords,
  air: Plane,
  strike: Bomb,
  move: Route,
  supply: TriangleAlert,
  diplomacy: Handshake,
  production: Factory,
  warning: OctagonAlert,
  other: Info
};

const RELATION_TONES = {
  you: "info",
  ally: "good",
  enemy: "bad",
  neutral: "neutral"
} as const;

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function ReportRowView({ row }: { row: ReportRow }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[row.category];
  const expandable = (row.children?.length ?? 0) > 0;
  const content = (
    <>
      <Icon className="turn-report__row-icon" size={14} aria-hidden="true" />
      <span className="turn-report__row-text">{row.text}</span>
      {expandable ? (
        expanded ? (
          <ChevronDown className="turn-report__chevron" size={14} aria-hidden="true" />
        ) : (
          <ChevronRight className="turn-report__chevron" size={14} aria-hidden="true" />
        )
      ) : null}
    </>
  );

  return (
    <div className={`turn-report__row turn-report__row--${row.tone}`}>
      {expandable ? (
        <button
          type="button"
          className="turn-report__row-head"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {content}
        </button>
      ) : (
        <div className="turn-report__row-head">{content}</div>
      )}
      {expandable && expanded ? (
        <ul className="turn-report__children">
          {row.children?.map((child, index) => (
            <li key={`${index}-${child}`}>{child}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReportSectionView({ section }: { section: ReportSection }) {
  const { gameState } = useGame();
  const name = section.key === "WORLD" ? "World events" : gameState.countries[section.key]?.name ?? section.key;

  return (
    <section className="turn-report__section" data-report-section={section.key}>
      <header className="turn-report__section-head">
        {section.key === "WORLD" ? (
          <Globe className="turn-report__world-icon" size={16} aria-hidden="true" />
        ) : (
          <Flag countryId={section.key} width={18} />
        )}
        <span className="turn-report__section-name">{name}</span>
        {section.relation !== "world" ? (
          <Badge tone={RELATION_TONES[section.relation]}>{section.relation}</Badge>
        ) : null}
      </header>
      <div className="turn-report__rows">
        {section.rows.map((row, index) => (
          <ReportRowView key={index} row={row} />
        ))}
      </div>
    </section>
  );
}

export function TurnReportWindow() {
  const { turnReport, turnReportOpen, setTurnReportOpen } = useGame();
  const report = useMemo(() => (turnReport ? parseTurnReport(turnReport) : null), [turnReport]);

  if (!turnReportOpen || !report) return null;

  const { summary } = report;

  return (
    <Window
      title={`Turn ${report.turn} report`}
      icon={ScrollText}
      variant="modal"
      className="turn-report"
      backdropClassName="turn-report-backdrop"
      bodyClassName="turn-report__body"
      layoutId="turn-report"
      onClose={() => setTurnReportOpen(false)}
      footer={
        <Button variant="primary" onClick={() => setTurnReportOpen(false)}>
          Dismiss
        </Button>
      }
    >
      <div className="turn-report__summary">
        <Badge tone="info">{plural(summary.battles, "battle")}</Badge>
        <Badge tone="good">{plural(summary.captures, "capture")}</Badge>
        <Badge tone="plain">{plural(summary.moves, "move")}</Badge>
        {summary.warEntries > 0 ? <Badge tone="warn">{plural(summary.warEntries, "war entry", "war entries")}</Badge> : null}
        {summary.defeats > 0 ? <Badge tone="bad">{plural(summary.defeats, "defeat")}</Badge> : null}
      </div>
      {report.sections.length === 0 ? (
        <p className="turn-report__empty">No events were recorded this turn.</p>
      ) : (
        report.sections.map((section) => <ReportSectionView key={section.key} section={section} />)
      )}
    </Window>
  );
}
