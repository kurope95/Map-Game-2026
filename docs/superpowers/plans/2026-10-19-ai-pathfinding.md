# AI pathfinding implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the design spec first:
> [`2026-10-19-ai-pathfinding-design.md`](../specs/2026-10-19-ai-pathfinding-design.md).

**Goal:** Give the AI a distance-to-objective field so its units march toward distant national
goals, allied shield objectives, lost homeland and threatened fronts instead of only reacting to
adjacent regions, without replacing the existing hard-coded focus and scoring.

**Architecture:** a new `src/game/ai/pathfinding.ts` computes a multi-source BFS distance map over
legal transit edges. `planCountryTurn` computes each map once per turn and adds a small progress
bonus to the existing evaluators. A later stage adds reinforcement-march candidates. One order per
unit per turn; no route is stored in `GameState`.

**Tech stack:** TypeScript, Vitest, the existing pure rules engine. No new dependencies.

## Global constraints

- **C1 No rule changes.** Movement, combat, supply, diplomacy and economy rules stay as they are.
  The only rules-file change is a pure extraction of the transit predicate in Task 2.
- **C2 Save compatibility.** `GameState` and `UnitDefinition` do not change. No route state is saved.
- **C3 One hop per order.** The AI still emits exactly one move/attack per unit per turn. The
  distance field chooses the next hop; it never emits a multi-hop route.
- **C4 Preserve the hard-coded focus.** `AI_NATIONAL_GOALS`, `AI_COUNTRY_PROFILES`,
  `AI_STRATEGY_WEIGHTS`, `primaryObjectiveBonus`, `primaryObjectiveAttackCap`,
  `attackReserveFlex`, defender reservation, attack caps and ally claims keep their current roles.
- **C5 Determinism.** No new randomness. BFS tie-breaks are deterministic (sorted destinations,
  `adjacentRegionIds` order).
- **C6 Layering.** New code lives under `src/game/ai`; it may import `src/game/rules` and
  `src/game/state`, never `src/ui` or React. `npm run check:layers` must pass.
- **C7 Gates.** After every task that changes `src/game/`:
  `npx tsc -p tsconfig.app.json --noEmit`, `npm test`, `npm run smoke`, `npm run balance-check`.
  `npm run check-war-entry` is required after Tasks 3 and 4 (war timing can shift).
- **C8 Changelog.** Every commit adds an `[Unreleased]` entry citing
  `(plan 2026-10-19-ai-pathfinding → Task N)` and the files touched.
- **C9 Git.** Commit on `main` only; never `legacy`. Push only when Marek asks.

## Task 1: Characterization tests (no behavior change)

**Files:**
- Create `src/game/ai/heuristicBot.test.ts`
- Create `src/game/ai/allyCoordination.test.ts`

- [ ] Write `heuristicBot.test.ts` with a `fresh()` helper:
  `evaluateWarEntryRules(createInitialState("RUSSIA"))`, matching
  [`playerActions.test.ts`](../../../src/game/rules/playerActions.test.ts).
- [ ] Test: `planCountryTurn` is deterministic — calling it twice on the same state returns
  deep-equal decisions.
- [ ] Test: one action per unit — for RUSSIA, ROMANIA and AUSTRIA, `actions.length` equals the number
  of units owned by the country and every `unitId` appears once.
- [ ] Test: every action target is legal — a `move`/`attack` target is in `getValidTargets` for that
  unit; `hold` targets the unit's own region; `airSupport`/`bombard`/`missileStrike` targets are in
  the corresponding `getValidTargets` list.
- [ ] Test: every attack target is adjacent to the attacking unit's region and belongs to an at-war
  country.
- [ ] Test: a lone defender of a frontline region does not leave. Find a RUSSIA-controlled region
  with `hostileAdjacents.length > 0` and exactly one defending infantry/armor unit; assert that
  unit's action target is its own region (hold) or another action that does not leave the region
  (currently only `hold`).
- [ ] Write `allyCoordination.test.ts` with three cases: no claim; own-country claim does not defer;
  another country's claim at `>= 1.5x` defenders defers a unit whose strength is not greater.
- [ ] Run `npx vitest run src/game/ai/heuristicBot.test.ts src/game/ai/allyCoordination.test.ts`.
  **Expected:** all pass against the current code. If a test fails, the test is wrong, not the AI —
  fix the test before proceeding.
- [ ] Commit: `Add AI characterization tests before pathfinding`.

## Task 2: Transit predicate and pathfinding module

**Files:**
- Modify `src/game/rules/orderResolution.ts`
- Create `src/game/ai/pathfinding.ts`
- Create `src/game/ai/pathfinding.test.ts`

- [ ] In `orderResolution.ts`, add:
  ```ts
  export function isRegionOpenForCountryTransit(
    state: GameState,
    countryId: CountryId,
    blocId: BlocId | undefined,
    regionId: string,
    options?: { ignoreStacking?: boolean }
  ): boolean;
  ```
  It must contain the current body of `isRegionOpenForTransit` (Moldova closure, own-country,
  same-bloc, neutral transit rights, stacking check). `isRegionOpenForTransit` becomes a one-line
  delegate with `ignoreStacking: false`. No behavior change.
- [ ] In `pathfinding.ts`, implement `RouteDistances`, `buildRouteDistances`, `getRouteDistance` and
  `getRouteProgress` exactly as described in the design spec. Use a plain array queue and a
  `Map<string, number>`; no `queue.shift()` on large arrays is needed at 103 nodes, but a head index
  is preferred.
- [ ] `buildRouteDistances` rules:
  - seed every destination that exists in `state.regions` at distance 0;
  - expand a seeded destination only when `isRegionOpenForCountryTransit(..., { ignoreStacking: true })`
    is true for it; an enemy-held destination is a terminal;
  - expand neighbours only through transit-open regions;
  - write `sources` for each reached region (the destination that seeded it; first writer wins in
    deterministic BFS order);
  - unreachable regions are absent from `distances`.
- [ ] Tests in `pathfinding.test.ts`:
  - destination distance is 0 and `sources` names the destination;
  - BFS distances satisfy `d(neighbour) <= d(region) + 1` for every transit edge;
  - a friendly region adjacent to an enemy-held destination has distance 1, and the enemy region is
    not used as a corridor (only its friendly neighbours are expanded);
  - neutral Moldova is not crossed while Moldova is neutral;
  - an unreachable region has `Infinity` via `getRouteDistance`;
  - `getRouteProgress` returns +1 for a step that reduces distance, 0 for a sideways step and a
    negative value for a step away.
- [ ] Run `npx tsc -p tsconfig.app.json --noEmit` and
  `npx vitest run src/game/ai/pathfinding.test.ts src/game/ai/heuristicBot.test.ts`.
  **Expected:** pass; no existing test changes.
- [ ] Commit: `Add AI route-distance field over legal transit`.

## Task 3: Distance-aware national, ally and homeland scoring

**Files:**
- Modify `src/game/content/aiObjectives.ts`
- Modify `src/game/ai/heuristicBot.ts`
- Modify `src/game/ai/heuristicBot.test.ts`

- [ ] Add `AI_ROUTE_WEIGHTS` to `aiObjectives.ts`:
  ```ts
  export const AI_ROUTE_WEIGHTS = {
    nationalGoalProgress: 12,
    allyGoalProgress: 10,
    homelandProgress: 8,
    maxMarchDistance: 6,
  } as const;
  ```
- [ ] In `planCountryTurn`, compute distance maps once:
  - `nationalGoalDistances` from `unresolvedNationalGoals` when non-empty;
  - `allyGoalDistances` from the profile's valid `allyDefenseGoals` when non-empty;
  - `homelandDistances` from `startingRegionIds` not controlled by the country when non-empty.
- [ ] Thread the maps through `buildStrategicAdjustment` into the three evaluators. Add
  `fromRegionId` and the relevant map to each evaluator's parameters.
- [ ] In each evaluator, for `orderType === "move"` only, add
  `AI_ROUTE_WEIGHTS.<x> * progress` when `getRouteProgress(map, fromRegionId, targetRegionId) > 0`,
  scaled by goal priority / 100 for national goals. Do not remove or reduce the existing direct and
  one-hop values.
- [ ] Add a reason line such as `National goal: route step reduces distance to <name> by 1.` so the
  AI tab explains the move.
- [ ] Integration tests:
  - Move one RUSSIA infantry to a rear region with no adjacent enemy and no defender deficit.
    Ensure all national goals except one are RUSSIA-controlled. Assert the unit's chosen action is a
    move whose target has a smaller `nationalGoalDistances` value than its current region.
  - Repeat for a lost starting region (homeland map) and for RUSSIA's `gomel`/`minsk`/`brest` ally
    goals. Keep the assertions on distance reduction, not exact scores.
  - Re-run the Task 1 lone-defender test: it must still pass.
- [ ] Run the full gates C7 (including `npm run check-war-entry`). **Expected:** tsc clean, tests pass,
  smoke exits 0, balance-check prints `Balance check passed for all playable nations.`
- [ ] Commit: `Let AI score route progress toward distant goals`.

## Task 4: Multi-hop reinforcement marches

**Files:**
- Modify `src/game/ai/heuristicBot.ts`
- Modify `src/game/ai/heuristicBot.test.ts`

- [ ] In `planCountryTurn`, build `threatDistances` from the `reinforcementTargets` region ids when
  the list is non-empty.
- [ ] For every land unit that reaches the move-generation section and passes `canLeaveRegion`, add a
  march candidate for each legal move that:
  - reduces the distance to the nearest threatened region,
  - has `distance <= AI_ROUTE_WEIGHTS.maxMarchDistance`, and
  - is not already covered by the existing adjacent-reinforcement candidate (skip duplicates by
    `(unitId, targetId)`).
- [ ] Score:
  `reinforcementMarchBase (24) + priority - distance * 6 + supplyAdjustment`, where `priority` is the
  threat priority already used to sort `reinforcementTargets`
  (`(isCritical ? 20 : 0) + hostileAdjacents * 5 + deficit * 4`). Add a reason line naming the
  threatened region and the remaining distance.
- [ ] Do not change the `reservedUnits` / `canLeaveRegion` logic. A lone defender must still hold.
- [ ] Tests:
  - With all RUSSIA national goals controlled, move a surplus infantry deep into friendly territory;
    assert its action reduces distance to a threatened region.
  - A region with a lone defender still holds (Task 1 test).
  - A critically unsupplied unit does not take a march that ends unsupplied (existing hard gate).
- [ ] Run the full gates C7 plus `npm run check-war-entry`. **Expected:** all pass.
- [ ] Commit: `Let AI march reserves to threatened fronts`.

## Task 5: Primary-objective staging (only after Tasks 1–4 are green)

**Files:**
- Modify `src/game/ai/heuristicBot.ts`
- Modify `src/game/ai/heuristicBot.test.ts`

- [ ] Build `stagingDistances` from the friendly transit regions adjacent to `primaryObjective`
  (include the objective itself only if it is friendly-controlled).
- [ ] For surplus units with no attack, adjacent-reinforcement or march candidate, add a staging
  candidate for moves that reduce staging distance, capped at
  `primaryObjectiveAttackCap` units per objective per turn.
- [ ] Do not stage in an allied country whose `atWar` is false: the move is legal but attacks from
  that host are blocked. Prefer own-controlled staging regions.
- [ ] Score: `24 + primaryObjectiveBonus * 0.2 - distance * 6`; add a reason line.
- [ ] Test: a surplus rear unit with no other candidate moves toward a staging region adjacent to the
  primary objective; the cap is respected.
- [ ] Run the full gates C7. **Expected:** all pass. If balance regresses and cannot be tuned with the
  route weights, revert this task and keep Tasks 1–4.
- [ ] Commit: `Let AI stage for its primary objective`.

## Task 6: Documentation and final verification

**Files:**
- Modify `CHANGELOG.md`
- Modify the design spec's status line and verification section
- Optionally update `CLAUDE.md` if the AI model description changed

- [ ] Record the implemented stages, the weight values and the harness results in
  `CHANGELOG.md` under `[Unreleased]`, citing the plan and tasks.
- [ ] Update the design spec from "design only" to "implemented" with the actual measured results.
- [ ] Run the full gates C7, `npm run build`, and `npm run check:layers`.
- [ ] Browser check: open the game, use the AI recommendation tab on a nation with a distant goal,
  and confirm the reasons include the route step and the main screen still pans/zooms smoothly.
- [ ] Commit: `Record AI pathfinding verification`.

## Rollback

Each task is a separate commit. If a stage regresses balance beyond tuning, revert that stage's
commit; Tasks 1–2 are behavior-neutral and can stay.
