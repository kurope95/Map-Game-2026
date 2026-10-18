import { createInitialState } from "../src/game/state/createInitialState";
import { advanceTurn, evaluateWarEntryRules, setRegionController } from "../src/game/rules/turnEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function advanceToTurnFive() {
  let state = evaluateWarEntryRules(createInitialState());
  while (state.turn < 5 || state.currentBlocId !== "BRICS") {
    state = advanceTurn(state);
  }
  return state;
}

function testScriptedTurnEntries() {
  const state = advanceToTurnFive();
  assert(state.countryStates.SLOVAKIA.atWar, "Slovakia should enter the war by turn 5.");
  assert(state.countryStates.HUNGARY.atWar, "Hungary should enter the war by turn 5.");
}

function testBelarusEscalationViaMajorCapital() {
  let state = evaluateWarEntryRules(createInitialState());
  state = setRegionController(state, "berlin", "RUSSIA");
  state = advanceTurn(state);

  assert(state.countryStates.BELARUS.atWar, "Belarus should enter the war after a major capital is captured.");
}

function testCzechEntryViaPolishKeyCityLoss() {
  let state = evaluateWarEntryRules(createInitialState());
  state = setRegionController(state, "gdansk", "RUSSIA");
  state = advanceTurn(state);

  assert(
    state.countryStates.CZECH_REPUBLIC.atWar,
    "Czech Republic should enter the war after Poland loses a key city."
  );
}

function main() {
  testScriptedTurnEntries();
  testBelarusEscalationViaMajorCapital();
  testCzechEntryViaPolishKeyCityLoss();
  console.log("War-entry simulation checks passed.");
}

main();
