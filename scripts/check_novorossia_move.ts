import { createInitialState } from "../src/game/state/createInitialState.ts";
import { evaluateWarEntryRules, advanceTurn } from "../src/game/rules/turnEngine.ts";
import { issueOrder } from "../src/game/rules/orderResolution.ts";
import { executeCountryTurn } from "../src/game/ai/heuristicBot.ts";

let state = evaluateWarEntryRules(createInitialState("NOVOROSSIA"));

const unitId = "nr-inf-2";
console.log("initial actor", state.currentActorId);
console.log("initial unit region", state.units[unitId]?.regionId);

state = issueOrder(state, { unitId, type: "move", targetRegionId: "kharkov" });
state = advanceTurn(state);
console.log("after player advance actor", state.currentActorId);
console.log("after player advance unit region", state.units[unitId]?.regionId);

while (state.currentActorId !== "NOVOROSSIA") {
  const result = executeCountryTurn(state, state.currentActorId);
  state = advanceTurn(result.state);
}

console.log("after full cycle actor", state.currentActorId);
console.log("after full cycle unit region", state.units[unitId]?.regionId);
