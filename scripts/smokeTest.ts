import type { CountryId } from "../src/game/state/types";
import { autoPlayTurns, createSession } from "./lib/autoPlay";

const SMOKE_NATIONS: CountryId[] = ["RUSSIA", "ROMANIA", "AUSTRIA"];
const SMOKE_TURNS = 5;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  for (const countryId of SMOKE_NATIONS) {
    const initial = createSession(countryId);
    assert(initial.turnOrder.length > 0, `${countryId}: turnOrder must not be empty`);
    assert(initial.playerCountryId === countryId, `${countryId}: playerCountryId mismatch`);
    assert(initial.countries[countryId] !== undefined, `${countryId}: missing country definition`);

    const initialLogLength = initial.eventLog.length;
    const final = autoPlayTurns(initial, countryId, SMOKE_TURNS);

    assert(final.turnOrder.length > 0, `${countryId}: turnOrder empty after auto-play`);
    assert(final.countries[countryId] !== undefined, `${countryId}: country missing after auto-play`);
    assert(final.eventLog.length > initialLogLength, `${countryId}: event log did not grow`);
    assert(final.turn >= initial.turn, `${countryId}: turn counter did not advance`);
  }

  console.log(`Smoke test passed for ${SMOKE_NATIONS.join(", ")} (${SMOKE_TURNS} turns each).`);
}

main();
