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

function testCzechEntryRule() {
  let oneKeyCity = evaluateWarEntryRules(createInitialState());
  oneKeyCity = setRegionController(oneKeyCity, "gdansk", "RUSSIA");
  oneKeyCity = advanceTurn(oneKeyCity);
  assert(
    !oneKeyCity.countryStates.CZECH_REPUBLIC.atWar,
    "Czech Republic should NOT enter the war after Poland loses only one key city."
  );

  let twoKeyCities = evaluateWarEntryRules(createInitialState());
  twoKeyCities = setRegionController(twoKeyCities, "gdansk", "RUSSIA");
  twoKeyCities = setRegionController(twoKeyCities, "krakow", "RUSSIA");
  twoKeyCities = advanceTurn(twoKeyCities);
  assert(
    twoKeyCities.countryStates.CZECH_REPUBLIC.atWar,
    "Czech Republic should enter the war after Poland loses two key cities."
  );

  let polishCapital = evaluateWarEntryRules(createInitialState());
  polishCapital = setRegionController(polishCapital, "warsaw", "RUSSIA");
  polishCapital = advanceTurn(polishCapital);
  assert(
    polishCapital.countryStates.CZECH_REPUBLIC.atWar,
    "Czech Republic should enter the war after Poland loses its capital."
  );
}

function main() {
  testScriptedTurnEntries();
  testBelarusEscalationViaMajorCapital();
  testCzechEntryRule();
  console.log("War-entry simulation checks passed.");
}

main();
