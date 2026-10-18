import { createInitialState } from "../src/game/state/createInitialState.ts";
import { evaluateWarEntryRules, advanceTurn } from "../src/game/rules/turnEngine.ts";
import { issueOrder } from "../src/game/rules/orderResolution.ts";
import { executeCountryTurn } from "../src/game/ai/heuristicBot.ts";

let state = evaluateWarEntryRules(createInitialState("NOVOROSSIA"));

state = issueOrder(state, { unitId: "nr-inf-2", type: "move", targetRegionId: "kharkov" });
state = advanceTurn(state);
while (state.currentActorId !== "NOVOROSSIA") {
  const result = executeCountryTurn(state, state.currentActorId);
  state = advanceTurn(result.state);
}

console.log("before attack region", state.units["nr-inf-2"]?.regionId, "strength", state.units["nr-inf-2"]?.strength);
state = issueOrder(state, { unitId: "nr-inf-2", type: "attack", targetRegionId: "kyiv" });
state = advanceTurn(state);
console.log("after attack step actor", state.currentActorId);
console.log("after attack unit region", state.units["nr-inf-2"]?.regionId, "strength", state.units["nr-inf-2"]?.strength);
console.log("combat log", state.combatLog.map((entry) => ({
  region: entry.regionId,
  won: entry.attackerWon,
  atkAfter: entry.attackerStrengthAfter,
  defAfter: entry.defenderStrengthAfter,
})));
