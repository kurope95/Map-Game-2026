import { createInitialState } from "../src/game/state/createInitialState.ts";
import { evaluateWarEntryRules, advanceTurn } from "../src/game/rules/turnEngine.ts";
import { executeCountryTurn } from "../src/game/ai/heuristicBot.ts";

let state = evaluateWarEntryRules(createInitialState("RUSSIA"));

for (let i = 0; i < 36; i++) {
  const actor = state.currentActorId;
  const beforeOrders = state.economyBuildOrders[actor].length;
  const beforeUnits = Object.values(state.units).filter((unit) => unit.countryId === actor).length;
  const result = executeCountryTurn(state, actor);
  state = advanceTurn(result.state);
  const afterOrders = state.economyBuildOrders[actor].length;
  const afterUnits = Object.values(state.units).filter((unit) => unit.countryId === actor).length;
  if (afterOrders !== beforeOrders || afterUnits !== beforeUnits) {
    console.log(actor, { beforeOrders, afterOrders, beforeUnits, afterUnits });
  }
}

console.log(
  "events",
  state.eventLog.filter((entry) =>
    entry.includes("New ") || entry.includes("deployed") || entry.includes("built") || entry.includes("upgraded")
  ).slice(-20)
);
