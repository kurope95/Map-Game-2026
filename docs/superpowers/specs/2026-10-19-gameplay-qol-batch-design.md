# AI spending, noding cleanup, economy QoL and attack preview

Date: 2026-10-19
Status: approved by Marek ("do the mentioned 1, 3, 4 and 5"). Item 2 (the gameplay spec
folding `implementation_plan.md` TASK 6–9) is explicitly out of scope.

This spec covers four independent changes delivered in one batch:

1. **AI spending.** AI nations use the same economy actions the player has: replenish damaged
   units, repair damaged civilian facilities, upgrade facilities and buy doctrines.
3. **Noding cleanup.** Apply the core 15-edit reshuffle from
   [`2026-10-19-noding-reshuffle-analysis.md`](./2026-10-19-noding-reshuffle-analysis.md),
   plus a runtime graph test and a save-adjacency migration.
4. **Economy quality of life.** Repeat the last facility build, and show the global
   construction queue in the Orders panel.
5. **Attack odds preview.** Show a deterministic battle estimate in the map hover tooltip
   before the player commits an attack.

## Non-goals and hard constraints

- **No control-layout changes.** Top bar, bottom tab bar, floating panel positions, unit drawer,
  map controls and supply toggle stay where they are. Restyling and content inside panels are
  allowed.
- **No map re-render on pan/zoom.** The attack preview reaches the canvas layer through the
  imperative tooltip only; `mapRenders` must stay 0 in the pan/zoom benchmark.
- **No new combat rules.** The preview must not consume the seeded RNG or change any resolved
  outcome. It is an estimate shown before the attack; the attack click still commits at once.
- **No Odesa–Tokmak literal edge.** The required chain remains the 2-hop
  Odesa–Zaporizhzhia–Tokmak route.
- **No `implementation_plan.md` TASK 6–9.** No victory rework, siege loop, bloc AI or difficulty
  levels in this batch.
- Existing save format stays readable. See the migration decision under Feature 3.
- `src/game/` remains free of React/DOM/ui/app imports (`npm run check:layers`).

---

## Feature 1 — AI spending

### Starting point

`aiEconomyTurn` in [`heuristicBot.ts`](../../../src/game/ai/heuristicBot.ts) already builds
facilities, repairs military facilities, builds/upgrades/repairs forts and recruits units. It
does **not** replenish damaged units, repair civilian facilities, upgrade facilities or buy
doctrines. It also checks only `economy.facilities.length < economy.buildingSlots` when choosing
a build region, while the player rule also counts pending `buildFacility` orders in that region.

### Design

All changes stay inside `aiEconomyTurn`; the existing priority ladder, reserve policy
(`steel: 2`, `food: 5`) and `maxQueues` (major 4 / middle 3 / minor 2) are kept.

1. **Slot accounting fix.** `findBuildRegion` and `totalSlotsRemaining` count pending
   `buildFacility` orders in the region as occupied slots, matching
   `queueFacilityBuild` in [`playerActions.ts`](../../../src/game/rules/playerActions.ts).
2. **Doctrine purchase.** Once per `aiEconomyTurn`, before the build loop, buy at most one
   doctrine when trade points cover its cost plus a 10-point reserve. Selection is deterministic:
   first definition in `DOCTRINE_DEFINITIONS` order whose prerequisites are owned and which is
   affordable. Use the pure `purchaseDoctrine` action rather than duplicating its rules.
3. **Replenishment.** Prefer repairing an existing unit over recruiting a new one. For each
   damaged land/air unit not already pending replenishment, require an operational facility of
   the unit's recruitment type in the unit's current region, then queue the same
   `replenishUnit` order shape the player action produces, with the cost and turns from
   `getReplenishmentCost`. Order candidates by lowest strength ratio, then frontline region,
   then unit id, for determinism. The branch sits before new recruitment.
4. **Civilian facility repair.** After the existing military-facility repair branch, queue
   repair for damaged non-military facilities (farm, mine, oil well, power plant, smelter,
   refinery, synthetic refinery, chemical plant, civilian factory) when no repair is pending.
   Extraction facilities are free to repair, so this mostly costs queue time.
5. **Facility upgrades.** One upgrade branch after the new-facility and recruitment ladders and
   before the civilian-factory branch, capped at one upgrade per `aiEconomyTurn` (upgrades are a
   long-term investment; without the cap the per-iteration loop spent every free slot on them and
   the 10-turn balance sweep failed). Candidates are facilities with `level < 3`, not damaged,
   and not already pending an upgrade. Score military production facilities highest when the
   country is at war or preparing, then the extractor/processor matching a current shortage
   (food, steel, fuel), then power and civilian industry. Try candidates in score order and queue
   the first affordable one with `getFacilityUpgradeCost` + the build recipe's turns. No new
   resource reserve beyond the existing policy.

### Determinism

No new randomness is introduced. Candidate sorts use stable keys and unit/facility ids as final
tie-breakers. AI economy order ids and completed unit/facility ids are now deterministic
(`t<turn>-<sequence>` instead of a `Math.random()` suffix). The seeded balance harness replaces
`Math.random` with a deterministic stream, so a random suffix made every added order shift the
later AI diplomacy choices; deterministic ids keep those simulations stable when the economy
changes.

### Tests

- Slot accounting: a region at its slot limit with only pending builds is not chosen again.
- Replenishment: a damaged unit in a region with the required operational facility gets one
  `replenishUnit` order; a unit without the facility does not; an already-pending unit is skipped.
- Civilian repair: a damaged farm is queued for repair; a damaged military facility still wins
  priority over it.
- Upgrade: an eligible facility at level 1 queues an `upgradeFacility`; a level-3 or damaged
  facility is not queued.
- Doctrine: a country with enough trade points buys one available doctrine and not an
  unavailable or already-owned one; with fewer than cost + 10 it buys nothing.
- Harness gates: `npm run smoke` and `npm run balance-check` must pass.

---

## Feature 3 — Noding cleanup

### Exact edits (the tested core 15)

Runtime ids. Cuts:

| # | Edge | Where |
|---|---|---|
| 1 | `moscow`–`kazan` | static `regions.ts`, both directions |
| 2 | `kazan-volga-bend-2`–`moscow` | `MANUAL_SPLIT_PLANS.kazan[0].linkIds` |
| 3 | `nizhny-novgorod-oka-district`–`moscow` | `MANUAL_SPLIT_PLANS["nizhny-novgorod"][0].linkIds` |
| 4 | `minsk`–`warsaw` | static, both directions |
| 5 | `minsk-central-belt`–`warsaw` | `MANUAL_SPLIT_PLANS.minsk[0].linkIds` |
| 6 | `bryansk`–`minsk` | static, both directions |
| 7 | `berlin`–`essen` | static, both directions |
| 8 | `odesa`–`bucharest` | static, both directions |
| 9 | `saint-petersburg-neva-corridor`–`tallinn` | `MANUAL_SPLIT_PLANS["saint-petersburg"][0].linkIds` |
| 10 | `tallinn-east`–`helsinki` | post-generation unlink (Narva is a fallback-slice satellite) |

Adds:

| # | Edge | Where |
|---|---|---|
| 11 | `minsk`–`vilnius` | static, both directions |
| 12 | `warsaw`–`kaunas` | static, both directions |
| 13 | `berlin`–`hannover` | static, both directions |
| 14 | `belgrade`–`zagreb` | static, both directions |
| 15 | `sevastopol`–`mariupol` | static, both directions |

`minsk-western-gate` keeps its existing Warsaw link: it is not one of the 15 tested edits and
changing it would deviate from the measured 222-edge result. This is recorded in the changelog.

### Why a post-generation unlink is needed

`tallinn-east` (Narva) has no `manualVariant`, so it inherits
`source.adjacentRegionIds.slice(0, 2)` — currently `helsinki` and `riga`. The cut is applied in
`applyGeneratedAdjacencyCorrections` with `unlinkRegions("tallinn-east", "helsinki")`, the same
hook already used for the Bratislava corrections.

### Graph acceptance

The runtime graph from `createInitialState("RUSSIA")` must have:

- 103 regions, 222 undirected edges, symmetric adjacency;
- one connected component, 0 bridges, no leaves (degree ≥ 2);
- articulation points exactly `helsinki` and `nizhny-novgorod`;
- all must-keep links present: Odesa–Tiraspol, Odesa–Zaporizhzhia,
  Zaporizhzhia–Tokmak, Mariupol–Tokmak, Chisinau–Tiraspol, Brest–Warsaw, Brest–Minsk,
  Odesa–Constanta;
- all 10 cut edges absent and all 5 added edges present;
- no direct Odesa–Tokmak edge (still 2 hops).

A new test asserts this from live state, not from the static file.

### Save migration decision

**Decision: migrate adjacency on load.** Saves serialize `state.regions[].adjacentRegionIds`
and `state.scenario.regions[].adjacentRegionIds`. A new pure function
`migrateSaveAdjacency(state)` rebuilds both adjacency graphs from a freshly generated
`createInitialState(state.playerCountryId)` for every region id present in the save. Region
identity, ownership, units, economy and pending orders are untouched. This keeps an in-progress
campaign playable and gives it the new graph.

Cost if wrong: a pending move or attack order issued under the old graph can still resolve once
on the first loaded turn even if one of its endpoint edges was cut; normal validation resumes on
the next order. The alternative (old saves keep the old graph) was rejected because it leaves two
maps in circulation and makes bug reports ambiguous.

### Gates

`npm run validate-map`, `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`,
`npm run check-war-entry`, `npm run smoke`, `npm run balance-check`. Browser check of the map
and layout lock.

---

## Feature 4 — Economy quality of life

### Repeat last build

`useUiState` gains transient `lastFacilityBuild: { regionId, facilityType } | null` and a setter.
`useEconomyActions.handleBuildFacility` records the pair when the build succeeds. The Economy
panel's Construct column gets a secondary "Repeat: <Facility> (<Region>)" button above the recipe
buttons, disabled when there is no remembered build or the remembered action is no longer legal
(the rule engine still rejects illegal repeats; the button is an affordance, not a new rule).
Clicking it repeats the exact same region + facility type.

No localStorage persistence: this is a session convenience, and stale builds across saves would
be more confusing than useful.

### Construction queue visibility

The Orders panel gains a "Construction queue" section listing every pending
`economyBuildOrders[playerCountryId]` entry with region name, a human-readable description
(build/recruit/replenish/upgrade/repair/fortification), turns remaining, committed resources and
a cancel button (refund via the existing `cancelBuildOrder` action). The economy panel's
region-scoped list is unchanged.

### What does **not** change

The construction list keeps ticking every order in parallel each turn. This is not converted to
a serial queue, because that would change economy mechanics. The QoL change is visibility plus
one-click repeat.

### Gates

Type check, tests, browser check, layout lock (`Layout lock: PASS`), `npm run build`. No
`src/game/` rule change is expected for this feature.

---

## Feature 5 — Attack odds preview

### What the player sees

While units are selected and the pointer hovers a region that is a valid attack target, the
existing map tooltip gains an attack-estimate block:

```
Attack estimate: likely victory (ratio 1.32)
Losses: attackers 20–28% · defenders 39–52%
Fort Lv.2 12/16: +12% attacker losses
Support: 1 fighter (+2), 1 bomber bombardment
Capture not guaranteed if defenders retreat or the fort holds.
```

The band vocabulary follows the resolution thresholds:

| Ratio | Band | Resolution win chance |
|---|---|---|
| ≥ 1.5 | decisive | attacker wins |
| ≥ 1.0 | likely victory | attacker wins |
| ≥ 0.7 | marginal | 60% attacker win |
| < 0.7 | unlikely | 15% attacker breakthrough |

Loss figures are the resolution percentage ranges: band base × seeded variance ±15%, clamped
exactly as the resolver clamps them, plus the active-fort penalty. They are labelled as an
estimate, never a promise.

### Computation

New pure module `src/game/rules/combatEstimate.ts`:

```ts
export interface AttackEstimate {
  band: "decisive" | "likely" | "marginal" | "unlikely";
  ratio: number;                    // attacker/defender effective strength
  attackerLossPct: { min: number; max: number };
  defenderLossPct: { min: number; max: number };
  attackerStrength: number;
  defenderStrength: number;
  airSupportBonus: number;
  support: { fighters: number; bombardments: number; missiles: number };
  fort: { level: number; health: number; maxHealth: number; attackerLossPenaltyPct: number } | null;
  notes: string[];
}

export function estimateAttack(
  state: GameState,
  attackerUnitIds: readonly string[],
  targetRegionId: string
): AttackEstimate | null;
```

It reuses the exported combat helpers (`getTerrainDefenseModifier`, and newly exported
supply/veterancy/entrenchment/anti-fort helpers from `orderResolution.ts`) and composes the same
effective-strength formula:

- attackers: selected land units, supply × veterancy × infantry-drill × anti-fort (when a fort is
  active), summed, × combined-arms bonus, + air support;
- defenders: enemy-bloc units in the target, strength × supply × veterancy × entrenchment,
  × (1 + fort protection) × terrain (armor spearhead may ignore terrain) × trench networks,
  + fort base power × health ratio;
- pending player orders targeting the region are included deterministically: `airSupport` adds
  fighter strength × 0.25 (×1.25 with close air support); `bombard` and `missileStrike` apply
  their documented damage split before the land ratio, and strategic missiles/bombardment reduce
  fort health first;
- the seeded RNG is never called; `combatRandom`/`randomVariance` are not imported.

If there are no selected attackers or no defenders, the estimate is still returned for a
no-defender target (ratio ∞, decisive) but the UI only asks for targets the selection can attack.
Null only when the target region or all attacker ids are invalid.

### UI plumbing

- `GameScreen` builds `attackPreviews: Record<regionId, AttackEstimate>` in a `useMemo` from
  `gameState`, selected unit ids and `validTargets.attacks`, and passes it to `MapView`.
- `MapViewProps` and `mapViewPropsEqual` carry the new optional prop; the comparator uses
  reference equality because the memo keeps identity between renders.
- `MapController.updateHover` passes `props.attackPreviews?.[regionId]` to `TooltipView.update`.
- `TooltipView` rebuilds the tooltip HTML when the estimate reference changes (in addition to
  region/state). Pan/zoom still only moves the tooltip DOM node.
- `tooltipHtml` renders the estimate block with escaped text and existing tooltip classes plus a
  small `.map-tooltip__estimate` block.

No new panel, no new confirmation click, no change to `handleSelectRegion` (click still commits).

### Tests

- Band boundaries at 1.5, 1.0, 0.7.
- Terrain, fort, entrenchment, veterancy and doctrine modifiers change the ratio in the expected
  direction.
- Pending air support raises attacker strength; pending bombardment/missile damage lowers
  defender strength and fort health.
- Loss ranges match the resolver's clamps and fort penalty.
- `mapViewPropsEqual` returns false when the preview map reference changes and true when it does
  not.
- `tooltipHtml` includes the estimate and escapes text; no estimate means no estimate block.
- Pan/zoom benchmark: scripted pan/zoom still reports `mapRenders: 0`; frame-time output recorded
  in the changelog.

### Risk / fallback

The resolver stays the source of truth; the estimator mirrors it. If the mirror drifts, prefer
fixing the shared helpers and adding a regression test over changing combat. A future larger
refactor can extract the whole land-battle calculation; it is out of scope here.

---

## Verification matrix

| Feature | Unit tests | Type/build | Rules harness | Browser |
|---|---|---|---|---|
| AI spending | new `heuristicBot` tests | yes | smoke, balance-check | AI Intel spot check |
| Noding | new graph test | yes | validate-map, check-war-entry, smoke, balance-check | map + layout lock |
| Economy QoL | component/handler tests where testable | yes | — | panels, layout lock |
| Attack preview | estimator/tooltip/props tests | yes | smoke (unchanged) | hover check, pan/zoom bench |

Every change is recorded in `CHANGELOG.md` under `[Unreleased]`. A final implementation report for
external review is written to `docs/superpowers/reports/2026-10-19-feature-batch-report.md`.
