# AI pathfinding — design

Date: 2026-10-19
Status: **design only. No AI behavior has changed yet.**
The implementation plan is [`2026-10-19-ai-pathfinding.md`](../plans/2026-10-19-ai-pathfinding.md).

## The problem

The AI has no routes. `planCountryTurn` gets every candidate from `getValidTargets`
([`orderResolution.ts:1079`](../../../src/game/rules/orderResolution.ts#L1079)), and land moves and
attacks are adjacent-only. The strategic evaluators recognize a goal only when the candidate
region **is** the goal or is **directly adjacent** to it:

- `evaluateNationalGoalPriority` — direct goal or one-hop approach,
  [`heuristicBot.ts:117`](../../../src/game/ai/heuristicBot.ts#L117)
- `evaluateAllySupportPriority` — allied goal or one-hop approach,
  [`heuristicBot.ts:154`](../../../src/game/ai/heuristicBot.ts#L154)
- `evaluateHomelandPriority` — lost starting region or one-hop approach,
  [`heuristicBot.ts:188`](../../../src/game/ai/heuristicBot.ts#L188)

Consequences:

1. A unit in the interior of its country never marches to a threatened front unless it happens to
   start adjacent to one. `getCountryFrontlineData` and the staging-move branch only know regions
   that are on the front line **now**.
2. A national goal two or more hops away contributes nothing to any score. Russia's `berlin` goal,
   Poland's `minsk`/`brest`/`gomel` goals and Ukraine's `kursk` goal have no pull until the front
   physically reaches their neighbour.
3. `getPrimaryObjective` scans only enemy regions adjacent to owned regions, so a distant weak
   capital can never become the focus.
4. Units that cannot attack and have no adjacent reinforcement target hold in place. `hold` is the
   fallback for every unassigned unit ([`heuristicBot.ts:1435`](../../../src/game/ai/heuristicBot.ts#L1435)).

The AI already has hard-coded focus: `AI_NATIONAL_GOALS`, `AI_COUNTRY_PROFILES`,
`primaryObjectiveBonus`, `attackReserveFlex` and the strategic weights in
[`aiObjectives.ts`](../../../src/game/content/aiObjectives.ts). Pathfinding must **feed those
goals**, not replace them. Marek's concern about the recent "focus on some regions" work is exactly
this: the goal lists and the four-evaluator score mix are tuning, and a route layer that overrides
them would undo that tuning.

## What "pathfinding" means in this game

It is **not** a stored multi-turn route. Three rules force the shape:

- A unit receives exactly one order per turn (`executeCountryTurn` issues one action per unit,
  [`heuristicBot.ts:1570`](../../../src/game/ai/heuristicBot.ts#L1570)).
- `issueOrder` replaces that unit's previous order; issuing a multi-hop route as several orders
  would keep only the last one.
- Control, war entry, transit rights and stacking change between turns, so a cached path goes stale.

So the design is a **recomputed distance field plus one-hop selection**: every turn, compute how
many hops each region is from a set of destinations, then give a bonus to the adjacent move that
reduces that distance. The unit still moves exactly one region per turn; it simply walks downhill
toward a destination instead of only noticing the destination when it is already next door.

## Cost and passability model

- **Cost is 1 per adjacency.** There are no movement points, roads or terrain costs.
- **Passability is the existing movement rule**, not a new one. A region may be used as a route node
  only when it matches the legal transit rule in
  [`isRegionOpenForTransit`](../../../src/game/rules/orderResolution.ts#L179): own country, or
  same-bloc control with the neutral/transit-rights check, and neutral Moldova is closed.
- **Stacking is ignored while computing distances** (a full region is a temporary, local condition)
  but every emitted move is still filtered by `getValidTargets`. If the shortest step is full, the
  AI picks another legal move or holds; it never issues an invalid order, because
  `issueOrder` silently drops those.
- **Enemy regions are terminals, not corridors.** They cannot be entered by a move. For an
  enemy-held goal, the useful distance is to the nearest friendly region adjacent to it; the final
  step is an attack and stays in the existing attack scoring.
- **Neutral countries are walls** unless the bloc has transit rights. Pathfinding cannot create a
  route the rules do not allow; if a goal is unreachable, its distances are infinite and the pull
  is zero.
- **Supplied status is not part of the distance field.** The existing supply penalties stay in the
  candidate score, and the `criticallyUnsupplied` filter stays a hard gate. A future version can
  make the BFS supply-aware; version 1 does not.

## Architecture

### New module

`src/game/ai/pathfinding.ts`:

```ts
export interface RouteDistances {
  /** Region id -> hops to the nearest destination; absent means unreachable. */
  readonly distances: ReadonlyMap<string, number>;
  /** Region id -> the destination that produced its distance, for reasons and scoring. */
  readonly sources: ReadonlyMap<string, string>;
}

export function buildRouteDistances(
  state: GameState,
  countryId: CountryId,
  destinations: ReadonlySet<string>
): RouteDistances;

export function getRouteDistance(map: RouteDistances, regionId: string): number;
/** Positive = the move gets closer, 0 = sideways, negative = away. */
export function getRouteProgress(map: RouteDistances, fromRegionId: string, toRegionId: string): number;
```

- Multi-source BFS over region IDs. 103 nodes, so this is cheap.
- Seed each destination at distance 0 and expand only through regions that pass the country-level
  transit predicate. A destination that is not transit-open (an enemy-held goal) is seeded but not
  expanded, so its friendly neighbours get distance 1 and nothing paths **through** it.
- Deterministic: expansion follows the order of `adjacentRegionIds` and a sorted destination list;
  no randomness.
- Computed once per objective set per country per turn, never inside a candidate comparison.

### Shared transit predicate

`isRegionOpenForTransit` and `isAttackableEnemyRegion` are private. Add one exported helper in
`orderResolution.ts`:

```ts
export function isRegionOpenForCountryTransit(
  state: GameState,
  countryId: CountryId,
  blocId: BlocId | undefined,
  regionId: string,
  options?: { ignoreStacking?: boolean }
): boolean;
```

`isRegionOpenForTransit` delegates to it with `ignoreStacking: false`. The pathfinder calls it with
`ignoreStacking: true`. This is a pure refactor: the unit-level behavior must not change.

### Scoring integration

`planCountryTurn` computes the distance maps it needs once:

| Map | Destinations | Used by |
|---|---|---|
| National goals | unresolved `AI_NATIONAL_GOALS` | national-goal progress bonus |
| Ally goals | profile `allyDefenseGoals` | ally-support progress bonus |
| Homeland | lost `startingRegionIds` | homeland progress bonus |
| Threatened front | `reinforcementTargets` region ids | multi-hop reinforcement march |
| Primary staging | friendly regions adjacent to `primaryObjective` | optional staging stage |

Each evaluator gains `fromRegionId` (it already receives `targetRegionId`) and the relevant map.
The bonus is **added to**, not substituted for, the existing direct/adjacent values:

- National goal move that reduces distance: `AI_ROUTE_WEIGHTS.nationalGoalProgress`
  (default 12), scaled by goal priority / 100.
- Ally goal move that reduces distance: 10.
- Homeland move that reduces distance: 8.
- A move that increases distance gets no bonus (and no penalty in version 1; the existing
  destination score already discourages bad moves).

The route weights live in `aiObjectives.ts` next to `AI_STRATEGY_WEIGHTS`, so tuning is visible in
one place.

### Reinforcement marches (the behavior change that matters most)

Today the reinforcement branch only creates candidates when the target is itself a frontline
region (`targetFront`), i.e. adjacent to the unit. Add a second branch for surplus units:

- For each legal move, look up the distance to the nearest threatened region and its
  `source` (which threatened region).
- If the move reduces distance and `distance <= AI_ROUTE_WEIGHTS.maxMarchDistance` (default 6),
  add a candidate with score
  `reinforcementMarchBase + targetFrontPriority - distance * reinforcementMarchPerHop + supplyAdjustment`.
- Respect `canLeaveRegion` exactly as today: reserved defenders do not march unless the region has
  surplus.
- Keep the existing `sourceDeficit` and supply penalties. A march is a move, so all existing move
  filters apply.

### Primary-objective staging (stage 4, optional)

If balance allows, surplus units with no defensive or reinforcement candidate can march toward a
friendly staging region adjacent to the primary objective, capped at
`primaryObjectiveAttackCap` units. This makes attacks mass instead of trickling in. It is a separate
stage because it changes offense more than the other stages.

## Hard-coded rules that must survive

These are not replaced by pathfinding:

- `AI_NATIONAL_GOALS` order/priority and `AI_COUNTRY_PROFILES`.
- `AI_STRATEGY_WEIGHTS` (0.3 / 0.3 / 0.2 / 0.2) and `buildStrategicAdjustment`.
- `primaryObjectiveBonus` and `primaryObjectiveAttackCap`.
- Defender reservation (`desiredDefenders`, `reservedUnits`, `canLeaveRegion`).
- Per-target attack caps and `shouldDeferAttackToAlly` / `recordAllyAttackClaims`.
- Supply penalties and the `criticallyUnsupplied` hard filter.
- One order per unit per turn.

Pathfinding only adds an intermediate-hop gradient and (in stage 3) march candidates.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Frontline stripped by long marches | Stage 3 only emits candidates for surplus units; `canLeaveRegion` stays a hard gate. Tests pin a lone defender holding. |
| Ping-pong between two regions | The distance field is monotone for a stable objective set; destination tie-break is deterministic. Stage 3 records the nearest threatened source in the reason. If testing shows oscillation, add a destination hint to the unit (deliberate state change, separate decision). |
| Route through enemy or neutral land | The BFS uses the same transit predicate as movement; enemy regions are terminals. |
| Full region blocks the shortest step | Distances ignore stacking; `getValidTargets` filters the emitted move. The unit may step sideways or hold instead; never an invalid order. |
| Units stranded in a non-belligerent ally | Moves into an allied host are legal, but attacks from it require the host to be at war. Staging candidates should prefer own-controlled regions; if the only staging region is an allied non-belligerent, do not march there for an attack. |
| Supply attrition on long routes | Existing supply penalties stay; `criticallyUnsupplied` units may only move into supplied regions. Stage 3 adds no exemption. |
| Double-counting with the existing one-hop approach bonus | The existing direct/adjacent values are terminal values; the progress bonus is small (8–12) and additive. A unit one hop from the goal still gets the larger existing bonus. |
| Balance regression | Required gates after every stage: `npm run smoke`, `npm run balance-check`, and `npm run check-war-entry` (war timing can shift). |
| Determinism / flaky smoke | `smoke` does not seed combat or `Math.random`; compare balance-check (seeded) for reproducibility and treat smoke as a crash/flow check. Do not add new randomness to the route layer. |
| Performance | One BFS per objective set per country per turn: at most five 103-node traversals, ~500 node visits, shared across every candidate. No per-candidate BFS. |
| Save compatibility | None: the distance field is derived at decision time and never stored. `GameState` is unchanged. |
| Noding reshuffle changes routes | The field is recomputed from the live adjacency every turn, so a future noding change shifts routes automatically. No cached paths to migrate. |

## What this is not

- It is not A* over the whole map per unit. BFS with unit costs is enough and easier to test.
- It is not multi-turn route execution or route memory.
- It is not a bloc-level planner. `planBlocTurn` / `executeBlocTurn` are dead code and
  `validateOrder` only accepts orders for the current actor; wiring them in is a separate decision.
- It is not retreat pathing. Retreat currently picks the first adjacent friendly region with no
  scoring; that is a separate, smaller improvement.
- It does not change player movement rules, combat, supply or diplomacy.

## Open questions for Marek

1. **March radius:** 6 hops is the proposed cap for reinforcement marches. Larger makes the AI
   respond across the whole country; smaller keeps it local. Which feels right?
2. **Staging in allied territory:** the rules allow movement but not attacks from a non-belligerent
   ally. Should the AI ever stage there (and wait for the ally to enter the war), or only on its own
   soil?
3. **Primary-objective staging:** is massing units before an attack wanted, or should the AI keep
   attacking with whatever is adjacent?
4. **Route memory:** should a unit remember its destination between turns? It reduces oscillation
   but adds a field to `UnitDefinition` and to saves. Recommendation: no for version 1.

## Verification plan

- Unit tests for the pathfinder on the real 103-region map and on the transit predicate.
- Characterization tests for `planCountryTurn` before any behavior change.
- Scenario tests: a rear unit moves closer to a distant national goal; a surplus unit marches toward
  a threatened front; a lone defender holds.
- `npx tsc -p tsconfig.app.json --noEmit`, `npm test`, `npm run smoke`,
  `npm run balance-check`, `npm run check-war-entry`.
- Browser check of the AI recommendation tab (it calls the same `planCountryTurn`).
