# Balance Report

Generated from `npm run balance-check` after completing `implementation_plan.md` TASK 1.

## Harness

- Script: [`scripts/balanceCheck.ts`](../scripts/balanceCheck.ts)
- Shared auto-play: [`src/game/sim/autoPlay.ts`](../src/game/sim/autoPlay.ts)
- Method: 10 full player cycles of AI auto-play per nation, deterministic combat/AI RNG seeded per country
- Runtime: ~5 seconds for all 24 playable nations

## Results (latest passing run)

| Nation | Survived | Lowest Food | Min Units | Notes |
|--------|----------|-------------|-----------|-------|
| RUSSIA | yes | 0 | 8 | ok |
| BELARUS | yes | 45 | 4 | ok |
| NOVOROSSIA | yes | 55 | 2 | ok |
| PRIDNESTROVIE | yes | 70 | 1 | ok |
| SLOVAKIA | yes | 49 | 4 | ok |
| HUNGARY | yes | 31 | 2 | ok |
| GERMANY | yes | 0 | 7 | ok |
| POLAND | yes | 19 | 1 | ok |
| ROMANIA | yes | 24 | 6 | ok |
| CZECH_REPUBLIC | yes | 5 | 4 | ok |
| FINLAND | yes | 6 | 4 | ok |
| BALTIC_FEDERATION | yes | 21 | 1 | ok |
| UKRAINE | yes | 52 | 1 | ok |
| AUSTRIA | yes | 9 | 4 | ok |
| SERBIA | yes | 6 | 4 | ok |
| SWITZERLAND | yes | 19 | 3 | ok |
| BOSNIA_AND_HERZEGOVINA | yes | 25 | 3 | ok |
| MONTENEGRO | yes | 25 | 3 | ok |
| KOSOVO | yes | 25 | 3 | ok |
| ALBANIA | yes | 25 | 3 | ok |
| NORTH_MACEDONIA | yes | 25 | 3 | ok |
| CROATIA | yes | 25 | 3 | ok |
| SLOVENIA | yes | 25 | 3 | ok |
| MOLDOVA | yes | 25 | 3 | ok |

## Balance adjustments applied

Minimal per-nation fixes in:

- [`src/game/state/createInitialState.ts`](../src/game/state/createInitialState.ts) — `balancePassMinimums`, at-war food buffers, scripted-entry bonuses, capital fortifications for late-war minors
- [`src/game/content/units.ts`](../src/game/content/units.ts) — additional starting units for frontline / late-entry nations

## Known harness bug fixed

The original auto-play loop could run forever when the player nation was defeated and removed from `turnOrder`. Fixed in [`src/game/sim/autoPlay.ts`](../src/game/sim/autoPlay.ts) by detecting elimination and breaking out of the wait loop.
