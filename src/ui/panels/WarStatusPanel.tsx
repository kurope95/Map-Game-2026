import "./FloatPanel.css";
import { Swords } from "lucide-react";
import { Badge } from "../kit/Badge";
import { Flag } from "../kit/Flag";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";

export function WarStatusPanel() {
  const { gameState, bottomOpen, setBottomOpen, activeTab } = useGame();

  if (!bottomOpen || activeTab !== "war") return null;

  return (
    <Window
      title="War Status"
      icon={Swords}
      onClose={() => setBottomOpen(false)}
      className="float-panel--bottom-center float-panel--wide"
      bodyClassName="panel-grid panel-grid--cols-4"
      layoutId="panel-warstatus"
    >
      {Object.values(gameState.countries).map((country) => {
        const status = gameState.countryStates[country.id];
        const label = status.atWar
          ? `At war (turn ${status.activatedOnTurn})`
          : country.alignment === "neutral"
            ? "Neutral"
            : "Aligned, not at war";
        return (
          <div className="panel-card panel-card--country" key={country.id}>
            <div className="panel-card__title">
              <Flag countryId={country.id} width={20} />
              <strong>{country.name}</strong>
            </div>
            <Badge tone={status.atWar ? "bad" : country.alignment === "neutral" ? "plain" : "info"}>{label}</Badge>
          </div>
        );
      })}
    </Window>
  );
}
