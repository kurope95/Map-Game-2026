import type { DiplomacyActionType, StockpileKey } from "../../../game/state/types";
import { getScaledDiplomacyActionDefinition } from "../../../game/rules/diplomacy";
import { Badge } from "../../kit/Badge";
import { ResourceAmount } from "../../kit/ResourceAmount";
import { useGame } from "../../session/GameProvider";

export function DiplomacyActions() {
  const {
    gameState,
    selectedDiplomacyCountry,
    selectedDiplomacyState,
    diplomacyIntensity,
    canAfford,
    playerTurnActive,
    playerBlocId,
    handleDiplomacyAction,
  } = useGame();

  if (!selectedDiplomacyCountry || !selectedDiplomacyState) return null;

  return (
    <div className="diplomacy-actions-grid">
      {(["eliteBribery", "publicCampaign", "economicAid", "weedSmuggling", "securityPressure"] as DiplomacyActionType[]).map((actionType) => {
        const action = getScaledDiplomacyActionDefinition(actionType, diplomacyIntensity);
        const affordable = canAfford(action.cost);
        const canInfluence = selectedDiplomacyCountry.alignment === "neutral";
        const alreadyActed = selectedDiplomacyState.lastActionTurn === gameState.turn;
        const disabled = !playerTurnActive || gameState.countryStates[selectedDiplomacyCountry.id].atWar || alreadyActed || !affordable || !canInfluence;
        const direction = playerBlocId === "BRICS" ? -1 : 1;
        const eliteDelta = action.eliteDelta * direction;
        const publicDelta = action.publicDelta * direction;

        return (
          <button
            key={actionType}
            className={`diplo-action-tile ${disabled ? "diplo-action-tile--disabled" : ""}`}
            disabled={disabled}
            onClick={() => handleDiplomacyAction(selectedDiplomacyCountry.id, actionType)}
          >
            <div className="diplo-action-tile__title">{action.label}</div>
            <div className="diplo-action-tile__desc">{action.description}</div>
            <div className="diplo-action-tile__effect-row">
              <Badge tone={eliteDelta >= 0 ? "nato" : "brics"}>
                Elite {eliteDelta > 0 ? "+" : ""}{eliteDelta}
              </Badge>
              <Badge tone={publicDelta >= 0 ? "nato" : "brics"}>
                Public {publicDelta > 0 ? "+" : ""}{publicDelta}
              </Badge>
            </div>
            <div className="diplo-action-tile__cost">
              {Object.entries(action.cost).map(([resource, amount]) => (
                <ResourceAmount key={resource} resource={resource as StockpileKey} amount={amount ?? 0} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
