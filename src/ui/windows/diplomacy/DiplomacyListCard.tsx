import type { CountryDefinition } from "../../../game/state/types";
import { canBlocUseTransit, getCountryDualTiltLabel, getCountryLeanBloc } from "../../../game/rules/diplomacy";
import { useGame } from "../../session/GameProvider";

export function DiplomacyListCard({ country }: { country: CountryDefinition }) {
  const { gameState, playerBlocId, selectedDiplomacyCountryId, setSelectedDiplomacyCountryId } = useGame();
  const diplomacy = gameState.diplomacy[country.id];
  const status = gameState.countryStates[country.id];
  const leanBloc = getCountryLeanBloc(gameState, country.id);
  const transitGranted = canBlocUseTransit(gameState, playerBlocId, country.id);
  const combinedTilt = getCountryDualTiltLabel(diplomacy.eliteSupport, diplomacy.publicSupport);
  const selected = selectedDiplomacyCountryId === country.id;

  return (
    <button
      className={`diplo-list-card ${selected ? "diplo-list-card--selected" : ""}`}
      onClick={() => setSelectedDiplomacyCountryId(country.id)}
    >
      <div className="diplo-list-card__title-row">
        <span className="diplo-list-card__title">{country.name}</span>
        <span className={`diplo-list-card__lean ${leanBloc === "EU_NATO" ? "diplo-list-card__lean--nato" : leanBloc === "BRICS" ? "diplo-list-card__lean--brics" : ""}`}>
          {combinedTilt}
        </span>
      </div>
      <div className="diplo-list-card__subline">
        {status.atWar ? "At war" : country.alignment === "neutral" ? "Neutral" : "Aligned"}
        {country.alignment === "neutral" ? ` • ${transitGranted ? "Transit open" : "Transit closed"}` : ""}
      </div>
      <div className="diplo-list-card__mini-bars">
        <div className="diplo-list-card__mini-bar">
          <span>Elite</span>
          <div className="diplo-list-card__mini-track">
            <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.eliteSupport + 100) / 200) * 100}%` }} />
          </div>
        </div>
        <div className="diplo-list-card__mini-bar">
          <span>Public</span>
          <div className="diplo-list-card__mini-track">
            <div className="diplo-list-card__mini-thumb" style={{ left: `${((diplomacy.publicSupport + 100) / 200) * 100}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}
