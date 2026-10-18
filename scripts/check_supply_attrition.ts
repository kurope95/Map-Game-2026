import { createInitialState } from "../src/game/state/createInitialState.ts";
import { evaluateWarEntryRules, advanceTurn } from "../src/game/rules/turnEngine.ts";

let state = evaluateWarEntryRules(createInitialState("RUSSIA"));

state = {
  ...state,
  units: {
    ...state.units,
    "ru-inf-1": {
      ...state.units["ru-inf-1"],
      regionId: "kaliningrad",
      supplyTurnsRemaining: 1,
      strength: 8,
    },
  },
};

console.log("before", {
  actor: state.currentActorId,
  region: state.units["ru-inf-1"]?.regionId,
  supply: state.units["ru-inf-1"]?.supplyTurnsRemaining,
  strength: state.units["ru-inf-1"]?.strength,
});

state = advanceTurn(state);

console.log("after one turn", {
  actor: state.currentActorId,
  region: state.units["ru-inf-1"]?.regionId,
  supply: state.units["ru-inf-1"]?.supplyTurnsRemaining,
  strength: state.units["ru-inf-1"]?.strength,
});

while (state.currentActorId !== "RUSSIA") {
  state = advanceTurn(state);
}

state = advanceTurn(state);

console.log("after second russian turn", {
  actor: state.currentActorId,
  region: state.units["ru-inf-1"]?.regionId,
  supply: state.units["ru-inf-1"]?.supplyTurnsRemaining,
  strength: state.units["ru-inf-1"]?.strength,
});

console.log(
  "supply events",
  state.eventLog.filter((entry) => entry.includes("supply") || entry.includes("attrition")).slice(-10)
);
