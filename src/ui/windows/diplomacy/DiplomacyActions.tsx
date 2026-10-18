import type { DiplomacyActionType } from "../../../game/state/types";
import { getScaledDiplomacyActionDefinition } from "../../../game/rules/diplomacy";
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
    <div className="diplomacy-actions-grid" style={{ marginBottom: "12px" }}>
      {(["eliteBribery", "publicCampaign", "economicAid", "weedSmuggling", "securityPressure"] as DiplomacyActionType[]).map((actionType) => {
        const action = getScaledDiplomacyActionDefinition(actionType, diplomacyIntensity);
        const affordable = canAfford(action.cost);
        const canInfluence = selectedDiplomacyCountry.alignment === "neutral";
        const alreadyActed = selectedDiplomacyState.lastActionTurn === gameState.turn;
        const disabled = !playerTurnActive || gameState.countryStates[selectedDiplomacyCountry.id].atWar || alreadyActed || !affordable || !canInfluence;
        const direction = playerBlocId === "BRICS" ? -1 : 1;
        const eliteDelta = action.eliteDelta * direction;
        const publicDelta = action.publicDelta * direction;
        const costLabel = Object.entries(action.cost).map(([key, amount]) => `${amount} ${key}`).join(" • ");

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
              <span className={`diplo-action-tile__effect ${eliteDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                Elite {eliteDelta > 0 ? "+" : ""}{eliteDelta}
              </span>
              <span className={`diplo-action-tile__effect ${publicDelta >= 0 ? "diplo-action-tile__effect--nato" : "diplo-action-tile__effect--brics"}`}>
                Public {publicDelta > 0 ? "+" : ""}{publicDelta}
              </span>
            </div>
            <div className="diplo-action-tile__cost">{costLabel}</div>
          </button>
        );
      })}
    </div>
  );
}
