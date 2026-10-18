import { getCountryTiltLabel, LEANING_THRESHOLD, TRANSIT_SUPPORT_THRESHOLD } from "../../../game/rules/diplomacy";

export function DiplomacyBar({ channel, value }: { channel: string; value: number }) {
  const position = ((value + 100) / 200) * 100;
  const leaningLeft = ((100 - LEANING_THRESHOLD) / 200) * 100;
  const leaningRight = ((100 + LEANING_THRESHOLD) / 200) * 100;
  const transitLeft = ((100 - TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;
  const transitRight = ((100 + TRANSIT_SUPPORT_THRESHOLD) / 200) * 100;

  return (
    <div className="diplo-bar">
      <div className="diplo-bar__topline">
        <span className="diplo-bar__channel">{channel}</span>
        <span className="diplo-bar__tilt">{getCountryTiltLabel(value)}</span>
      </div>
      <div className="diplo-bar__track">
        <div className="diplo-bar__half diplo-bar__half--brics" />
        <div className="diplo-bar__half diplo-bar__half--nato" />
        <div className="diplo-bar__marker diplo-bar__marker--center" />
        <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningLeft}%` }} />
        <div className="diplo-bar__marker diplo-bar__marker--lean" style={{ left: `${leaningRight}%` }} />
        <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitLeft}%` }} />
        <div className="diplo-bar__marker diplo-bar__marker--transit" style={{ left: `${transitRight}%` }} />
        <div className="diplo-bar__thumb" style={{ left: `${position}%` }} />
      </div>
      <div className="diplo-bar__legend">
        <span>BRICS</span>
        <span>Lean</span>
        <span>Neutral</span>
        <span>Transit</span>
        <span>NATO</span>
      </div>
    </div>
  );
}
