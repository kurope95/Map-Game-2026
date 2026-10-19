# Feature batch report — AI spending, noding, economy QoL, attack preview

Date: 2026-10-19
Author: Claude Code (implementer)
Audience: an external reviewer agent checking that the work matches what was requested and that it
actually does what it claims.

## 1. What was requested

Marek asked for four of five proposed improvements and explicitly excluded the second:

| # | Item | Status |
|---|---|---|
| 1 | Give the AI more things to spend on: replenishment, upgrades, doctrines | **Done** — commit `a61b69d` |
| 2 | Fold `implementation_plan.md` TASK 6–9 into one gameplay spec | **Not started, by request** |
| 3 | Noding cleanup: remove redundant/implausible map links | **Done** — commit `5281ab3` |
| 4 | Economy quality of life: repeat-last-build and a visible construction queue | **Done** — commit `e58911c` |
| 5 | Attack odds preview before committing an attack | **Done** — commit `7e01c72` |

The work was implemented inline against the checked-in plan and spec
(`docs/superpowers/plans/2026-10-19-gameplay-qol-batch.md` and
`docs/superpowers/specs/2026-10-19-gameplay-qol-batch-design.md`), which were added in `5281ab3`.

## 2. Repository state

- Branch: `main`.
- Batch base: `7f6fc36` (the last pushed commit).
- Batch commits, oldest first:
  - `5281ab3` **Apply core noding reshuffle with save migration**
  - `a61b69d` **Let the AI spend on replenishment, upgrades and doctrines**
  - `e58911c` **Add repeat-last-build and a visible construction queue**
  - `7e01c72` **Preview attack odds in the hover tooltip**
  - a final **Document the AI, noding, economy and preview batch** commit containing this report,
    the CHANGELOG wording fixes and the plan checkbox updates.
- `main` is 4 commits ahead of `origin/main` before the documentation commit. **Nothing has been
  pushed**, per Marek's standing instruction.
- `legacy` was not touched.

## 3. Feature 1 — AI spending (`a61b69d`)

### Goal

The AI previously built facilities and recruited units, but never replenished damaged units,
repaired civilian infrastructure, upgraded facilities or bought doctrines. The goal was to make it
use the economy it already has, without letting it run away with the game.

### What changed

All changes are in [`heuristicBot.ts`](../../../src/game/ai/heuristicBot.ts) unless noted.

1. **Pending builds count against building slots.** The per-turn loop up to the nation's queue cap
   (major 4, middle 3, minor 2) already existed before this batch. What changed is that pending
   facility builds are now counted per region, in `findBuildRegion` and in `totalSlotsRemaining`,
   so two buildings are not double-booked into one region. (An earlier version of this report said
   the loop itself was new; the independent review found that it was not.)
2. **Unit replenishment.** A damaged unit whose region has an operational recruitment facility
   queues `replenishUnit` through the same cost profile the player uses. Candidates are sorted by
   weakest strength ratio, then frontline presence, then unit id, so the choice is deterministic.
   This branch runs before new recruitment. As first shipped it only checked for the facility; after
   the review the unit's region must also be held by its own country or its bloc (see "Rules
   decisions made after the review" in section 6).
3. **Civilian facility repair.** Damaged non-military facilities (farm, mine, oil well, power
   plant, smelter, refinery, synthetic refinery, chemical plant, civilian factory) are repaired
   after the existing military-repair branch, skipping facilities that already have a pending
   repair order.
4. **Facility upgrades.** A level 1–2, undamaged, not-already-upgrading facility can be upgraded
   once per economy turn. Scoring: military production facilities while the nation is preparing,
   then the extractor/processor matching a current food/steel/fuel shortage, then power and
   civilian industry. The branch sits after the new-facility and recruitment ladders so upgrades
   cannot starve unit production.
5. **Doctrine purchases.** At most one doctrine per economy turn: the first definition in
   [`doctrines.ts`](../../../src/game/content/doctrines.ts) order whose prerequisites are owned and
   whose cost leaves a 10 trade-point reserve, bought through the pure `purchaseDoctrine` action.
6. **Deterministic ids.** Completed AI units and facilities in
   [`economyEngine.ts`](../../../src/game/rules/economyEngine.ts) no longer use `Math.random()`
   suffixes; ids use the turn plus a sequence. This was required because the seeded harness
   substitutes a deterministic `Math.random` stream, so a random id suffix shifted every later
   random draw (AI diplomacy) and made the balance harness measure call counts rather than
   behavior.

### Tests

- New [`aiEconomyTurn.test.ts`](../../../src/game/ai/aiEconomyTurn.test.ts): 12 tests covering slot
  accounting, replenishment, civilian repair priority, upgrades, doctrines and determinism.
- Extended [`economyEngine.test.ts`](../../../src/game/rules/economyEngine.test.ts): 2 tests pinning
  deterministic completed unit and facility ids.
- Suite at that commit: 372 tests in 48 files.

### Verification

- `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p tsconfig.scripts.json --noEmit`: 0 errors.
- `npm run check:layers`: PASS.
- `npm test`: 372/372.
- `npm run smoke`: RUSSIA, ROMANIA, AUSTRIA.
- `npm run balance-check`: passed for all playable nations.
- `npm run build`: OK.

### Decisions and limits

- The upgrade branch is capped at one per economy turn. Without the cap, the 10-turn balance sweep
  queued roughly 1,400 upgrades across 24 nations and eliminated Ukraine on turn 8. With the cap it
  passes. Cost if wrong: the AI upgrades more slowly than a min-maxing player.
- Deterministic ids make ids predictable. This only matters if a save format or UI relies on
  opacity; nothing does today.
- The AI does not use the attack preview; this feature is player-facing only.

## 4. Feature 3 — Noding cleanup (`5281ab3`)

### Goal

Remove redundant and implausible direct links while keeping the corridors the game depends on and
keeping the graph free of dead ends.

### Exact edits

The implementation shipped the tested "core 15" set from
[`2026-10-19-noding-reshuffle-analysis.md`](../specs/2026-10-19-noding-reshuffle-analysis.md).

**Cuts (10)**

| Edge | Where it is edited |
|---|---|
| Moscow–Kazan | static [`regions.ts`](../../../src/game/content/regions.ts) |
| Zelenodolsk–Moscow | satellite link plan in [`createInitialState.ts`](../../../src/game/state/createInitialState.ts) |
| Dzerzhinsk–Moscow | satellite link plan in `createInitialState.ts` |
| Warsaw–Minsk | static `regions.ts` |
| Barysaw–Warsaw | satellite link plan in `createInitialState.ts` |
| Bryansk–Minsk | static `regions.ts` |
| Berlin–Essen | static `regions.ts` |
| Odesa–Bucharest | static `regions.ts` |
| Gatchina–Tallinn | satellite link plan in `createInitialState.ts` |
| Narva–Helsinki | generated-adjacency correction in `createInitialState.ts` |

**Additions (5)**

| Edge | Where it is edited |
|---|---|
| Warsaw–Kaunas | static `regions.ts` |
| Berlin–Hannover | static `regions.ts` |
| Vilnius–Minsk | static `regions.ts` |
| Belgrade–Zagreb | static `regions.ts` |
| Sevastopol–Mariupol | static `regions.ts` |

**Required links kept:** Odesa–Tiraspol, Odesa–Zaporizhzhia, the Tokmak chain
(Zaporizhzhia–Tokmak and Mariupol–Tokmak), Chisinau–Tiraspol, Brest–Warsaw, Brest–Minsk and
Odesa–Constanta. No direct Odesa–Tokmak edge was added.

### Runtime graph

`createInitialState("RUSSIA")` now produces:

- 103 regions (63 static + 40 generated satellites).
- 222 symmetric undirected edges.
- 1 connected component.
- 0 bridges, no leaves (every region has degree ≥ 2).
- Articulation points exactly `helsinki` and `nizhny-novgorod`.

### Save migration

[`migrateSaveAdjacency.ts`](../../../src/game/state/migrateSaveAdjacency.ts) rebuilds both
serialized adjacency maps (`state.regions[]` and `state.scenario.regions[]`) from current scenario
content when a save is loaded. It leaves ownership, units, economy, orders and every other field
untouched, and returns the same object when the save is already current. It is wired into
`loadStateFromSave` in [`GameProvider.tsx`](../../../src/ui/session/GameProvider.tsx).

### Tests

- [`regionGraph.test.ts`](../../../src/game/state/regionGraph.test.ts): 6 tests — edge count and
  symmetry, connectivity/bridges/articulation points/no leaves, every must-keep corridor, all 10
  cuts and 5 additions, no Odesa–Tokmak edge, runtime graph equals scenario graph.
- [`migrateSaveAdjacency.test.ts`](../../../src/game/state/migrateSaveAdjacency.test.ts): 4 tests.
- Suite at that commit: 358 tests in 46 files.

### Verification

- `npm run validate-map`: passed for 63 regions.
- `npm run check-war-entry`: passed.
- `npm run smoke`: RUSSIA, ROMANIA, AUSTRIA.
- `npm run balance-check`: passed.
- `npm run check:layers`, `npm test`, both type checks, `npm run build`: all pass.

### Decisions and notes

- The generated `minsk-western-gate` satellite deliberately keeps its direct Warsaw link. It is
  outside the tested core graph; cutting it would change the measured 222-edge result.
- The wider probe (7 more cuts, 4 more adds) and a generator-rule rewrite were **not**
  implemented. They remain analysis in the spec and need Marek's decision.
- `npm run validate-map` only covers the 63 static regions; the graph test covers the runtime 103.
- **Documentation discrepancy:** the `5281ab3` commit message is wrong in several places and is
  deliberately not rewritten (Marek's decision). It lists only six cuts, names "Sevastopol–Odesa and
  Sevastopol–Mariupol" among them, says "Bucharest–Belgrade" was added, and contains the garbled phrase
  "Odesa-Sevastopol is not added". The code, the graph test and the CHANGELOG are authoritative: the batch
  made **ten cuts** (Moscow–Kazan, Zelenodolsk–Moscow, Dzerzhinsk–Moscow, Warsaw–Minsk, Barysaw–Warsaw,
  Bryansk–Minsk, Berlin–Essen, Odesa–Bucharest, Gatchina–Tallinn, Narva–Helsinki) and **five adds**
  (Warsaw–Kaunas, Berlin–Hannover, Vilnius–Minsk, Belgrade–Zagreb, Sevastopol–Mariupol). **Odesa–Bucharest
  was cut** and **Sevastopol–Mariupol was added**; Bucharest–Belgrade already existed. The edits are exactly
  the table above.

## 5. Feature 4 — Economy quality of life (`e58911c`)

### Goal

Reduce repeated clicking when building the same thing and make pending construction visible and
cancellable.

### What changed

1. **Repeat last build.** A successful facility build is remembered for the session in
   [`useUiState.ts`](../../../src/ui/session/useUiState.ts). The Construct column in
   [`EconomyPanel.tsx`](../../../src/ui/panels/EconomyPanel.tsx) shows
   `Repeat: <Facility> (<Region>)` above the recipe list. The button is enabled only during the
   player's turn while the remembered region is still player-controlled; slot and resource legality
   is still enforced by `queueFacilityBuild`. The remembered build is not written to localStorage
   (see the decision below).
2. **Visible construction queue.** The Orders panel in
   [`OrdersPanel.tsx`](../../../src/ui/panels/OrdersPanel.tsx) lists every pending
   `economyBuildOrders[playerCountryId]` entry with a human-readable description
   (build/upgrade/repair/recruit/replenish/fortification), region name, committed resources,
   `turnsRemaining/totalTurns`, and a cancel button that returns the cost through the existing
   `cancelBuildOrder` action (in full as first shipped; after the review in full before the first
   End Turn and afterwards in proportion to the build time left, see section 6).
3. **Pure helpers.** [`buildOrderText.ts`](../../../src/ui/panels/buildOrderText.ts) formats order
   descriptions and committed costs; [`lastFacilityBuild.ts`](../../../src/ui/session/lastFacilityBuild.ts)
   owns the remembered-build type and `canRepeatFacilityBuild`. Both are unit-tested.
4. **Recording hook.** [`useEconomyActions.ts`](../../../src/ui/session/useEconomyActions.ts)
   records the remembered build only after `queueFacilityBuild` succeeds, so failed or illegal
   builds do not overwrite it.

### Tests

- [`buildOrderText.test.ts`](../../../src/ui/panels/buildOrderText.test.ts): 6 tests across every
  order type and cost formatting.
- [`lastFacilityBuild.test.ts`](../../../src/ui/session/lastFacilityBuild.test.ts): 5 tests for the
  disabled reasons.
- Suite at that commit: 383 tests in 50 files.

### Verification

- Both type checks: 0 errors.
- `npm test`: 383/383.
- Headless Chrome at 1440x900: building a Farm shows `Repeat: Farm (Moscow)`; repeating queues a
  second Farm in Moscow; the Orders panel lists `Construction queue (2)` including `4 Coal`
  committed for a Power plant; cancelling a row drops the count immediately.
- Layout capture at 1440x900 and 1920x1080: `Layout lock: PASS`.

### Decisions and limits

- The remembered build is session-only. A remembered build that survived a campaign load would be
  more confusing than useful; cost if wrong is one extra click after a reload.
- The repeat button repeats one build into the remembered region; it does not repeat a batch across
  regions.

## 6. Feature 5 — Attack odds preview (`7e01c72`)

### Goal

Before committing an attack, the player should see the likely outcome and loss ranges in the
existing hover tooltip, without changing combat rules or making the map re-render through React on
hover.

### Estimator

New pure module [`combatEstimate.ts`](../../../src/game/rules/combatEstimate.ts) exports
`estimateAttack(state, attackerUnitIds, targetRegionId)`. It mirrors the deterministic parts of
`resolveOrders` in [`orderResolution.ts`](../../../src/game/rules/orderResolution.ts):

- **Attackers:** existing selected units filtered to assault types (`isAssaultUnit`). The attacker
  bloc is taken from the first selected unit.
- **Defenders:** units in the target region where `isEnemyBloc(unit.blocId, attackerBlocId)` is
  true. Note the resolver's convention: a different bloc counts as enemy, including NEUTRAL.
- **Pending player support:** only orders for `state.playerCountryId` that target this region are
  included.
  - Air support: each fighter adds `round(strength × 0.25 × (close_air_support ? 1.25 : 1))` to
    attacker strength.
  - Missiles: tactical 3, strategic 5 flat damage; `missile_corps` multiplies by 1.2; strategic
    missiles also reduce fort health. Missile damage is split `ceil(damage / defenderCount)` per
    defender and has no floor.
  - Bombardment: MLRS `0.55 × strength`, bomber `0.4 × strength`, `artillery_doctrine` ×1.25,
    `counterbattery` ×0.8. Damage uses a minimum of 1 and also damages the fort.
  - All support damage is applied before strengths are computed.
- **Attacker strength:** sum of `strength × supply modifier × veterancy × infantry-drill bonus ×
  anti-fort modifier`, multiplied by the combined-arms bonus (1.15 when both infantry and armor are
  present), plus the air-support bonus.
- **Defender strength:** sum of `strength × supply modifier × veterancy × entrenchment`, multiplied
  by `(1 + fort protection)`, by terrain (except armored spearhead on mountains), and by trench
  networks (1.18), plus the fort's base power.
- **Fort:** active only while `health > 0`. Level tables are exported from `orderResolution.ts`:
  protection 20/35/50%, base power 8/14/20.
- **Ratio:** attacker/defender; `Infinity` when there are no defenders.
- **Bands:** ratio ≥ 1.5 decisive, ≥ 1.0 likely, ≥ 0.7 marginal, otherwise unlikely.
- **Loss ranges** (fraction of current strength):

  | Band | Attacker base | Defender base |
  |---|---|---|
  | decisive | 0.10 | 0.60 |
  | likely | 0.25 | 0.45 |
  | marginal | 0.40 | 0.35 |
  | unlikely | 0.50 | 0.15 |

  Each base is multiplied by 0.85 and 1.15 for the range, clamped to 5–80%. If the ratio is ≥ 5,
  defender losses are shown as 100%. An active fort adds its attacker-loss penalty (18/12/8/4/2%
  depending on the anti-fort/fort-defense ratio) capped at 85%, and multiplies defender losses by
  0.65 with a 3% floor.
- **Notes** warn when defenders can retreat, when a fort must be broken, or when there are no
  defenders.
- The estimator **never calls the seeded RNG**. Given the same state, selected units and target, it
  returns the same value. This is what makes it safe to compute on hover.

The helper exports added to `orderResolution.ts` are export-only changes; no resolver logic changed.
That is proven by [`orderResolution.test.ts`](../../../src/game/rules/orderResolution.test.ts),
which pins a fixed-seed battle on Odesa to the exact pre-change result (attacker 8→3, defender 8→7,
fort 24→23, the exact combat log entry and event-log line).

### UI plumbing

- [`GameScreen.tsx`](../../../src/ui/screens/game/GameScreen.tsx) memoizes
  `Record<regionId, AttackEstimate>` over `validTargets.attacks` whenever the game state, selection
  or attack-target list changes.
- [`MapView.tsx`](../../../src/ui/map/MapView.tsx) takes `attackPreviews?`.
  [`mapViewProps.ts`](../../../src/ui/map/mapViewProps.ts) compares it by reference, matching the
  memoized object identity.
- [`MapController.ts`](../../../src/ui/map/MapController.ts) looks up the preview for the hovered
  region and passes it to `TooltipView.update`.
- [`TooltipView.ts`](../../../src/ui/map/TooltipView.ts) rebuilds the tooltip only when the region,
  state or estimate reference changes. Moving the pointer still only moves the DOM element.
- [`tooltip.ts`](../../../src/ui/map/tooltip.ts) adds the estimate block (band, ratio, loss ranges,
  fort penalty, support counts, notes) and escapes every note. [`MapView.css`](../../../src/ui/map/MapView.css)
  styles `.map-tooltip__estimate`.

### Tests

- [`combatEstimate.test.ts`](../../../src/game/rules/combatEstimate.test.ts): 21 tests — band
  boundaries, terrain/urban, entrenchment, veterancy on both sides, trench networks, infantry drill,
  combined arms, armored spearhead, supply, attacker/defender filtering, fort protection and health
  scaling, weak attackers, pending air support and close air support, MLRS/bomber bombard,
  tactical/strategic missiles, missile corps, artillery doctrine, counterbattery, damage splitting,
  other-country/other-region order exclusion, loss ranges and clamps, and null returns.
- [`orderResolution.test.ts`](../../../src/game/rules/orderResolution.test.ts): 1 characterization
  test.
- [`tooltip.test.ts`](../../../src/ui/map/tooltip.test.ts): 4 new tests — estimate block rendering
  and escaping, absent estimate, infinite ratio/no support/no fort, and the model pass-through.
- [`mapViewProps.test.ts`](../../../src/ui/map/mapViewProps.test.ts): 1 new test for preview
  identity.
- Full suite after the commit: **410 tests in 52 files**.

### Browser verification

Environment: headless Chrome, 1440x900, dev server; game started as RUSSIA, turn 1.

- Selected the Russian infantry `pmr-ru-inf-1` in Tiraspol and hovered Odesa (Ukraine, fort level 3,
  no defenders). The tooltip showed:
  `Attack estimate: unlikely (15% breakthrough) (ratio 0.40)`,
  `Losses: attackers 61–75% · defenders 8–11%`,
  `Fort Lv.3 24/24: +18% attacker losses`,
  `No defending units; the fort must be broken to capture the region.`
- Adding the armor `pmr-ru-arm-1` updated the same tooltip to
  `likely victory (ratio 1.19)` with `Losses: attackers 33–41% · defenders 25–34%`, proving the
  preview follows the selection.
- Hovering Kyiv, which is not a valid attack target from Tiraspol, showed no estimate block.
- Clicking Odesa issued `attack` orders for both selected units and produced the unchanged
  `2 unit(s) ordered to attack Odesa` toast. The click path was not modified.

### Revision after the independent review

Two independent reviews found that the first version of the preview was honest about the battle but
misleading about the thing the player cares about, whether the region is taken. A resolver probe
(400 spread seeds per case, Odesa at turn 1) showed it: with the level 3 fort standing, every setup the
tooltip called "likely victory (ratio 1.19)" or "decisive victory (ratio 1.59)" captured **0 of 400**
times, because the fort is only damaged (24 to 19 and 24 to 13 health) and capture needs it destroyed.
Without a fort, "decisive" still captured only 65% and 78% of the time because a won assault can bounce
back. The preview also showed defender losses when nothing defended, ignored attack orders the player
had already queued on the same region (the resolver pools them), and showed nominal loss percentages
that the resolver's per-unit rounding does not produce. Changes:

- `estimateAttack` now returns the fort outcome (`fort.healthAfter`, `fort.holds`; the fort damage is
  fixed, no dice), `captureChance` (0 while a fort survives, 1 with no defenders or when the battle wipes
  them out, otherwise the battle win chance times one minus the assault bounce chance), the attacker and
  defender counts, and `queuedAttackers`.
- Attack orders the player has already queued on the target are counted together with the selection
  (a selected unit that is already queued counts once), as the resolver pools them.
- Loss ranges are what the resolver's variance extremes leave after its per-unit rounding, so the range is
  the real spread (for example 12-24% where the nominal figure said 17-20%).
- The tooltip now leads with the capture outlook ("no capture this turn, the fort holds", "capture
  expected", "capture about 65%"), shows the battle odds and the defender losses only when defenders
  exist, and shows the fort before and after.
- `getAssaultBounceChance` is exported from `orderResolution.ts` (keyword only, no logic change).
- [`combatEstimate.resolver.test.ts`](../../../src/game/rules/combatEstimate.resolver.test.ts) checks
  the estimator against the real resolver on the Odesa scenario: fort health after, no capture while the
  fort stands, capture when it breaks, capture frequency within 7 points over 300 seeds, loss ranges that
  enclose every observed loss, and queued attacks.
- Also fixed: the remembered build for the Repeat button is now cleared on load and on a new game and is
  tagged with its country, so it can no longer show up as a stale disabled button in another game.

### Rules decisions made after the review (2026-10-19)

The three rules questions the review left open were put to Marek, who picked a direction for each, and
he also settled the one open map question. The CHANGELOG has an entry for each, with the tests that
failed first.

- **Replenishment** needs the unit's region to be held by its own country or by a country of its own
  bloc, for the player and the AI (`canReplenishIn` in `playerActions.ts`); enemy- and neutral-held
  regions never qualify, and neutral countries get only their own. The literal own-country-only reading
  was built and measured first: it stopped Russia from restoring its Tiraspol garrison (the region is
  held by Pridnestrovie; 84 of the 91 replenishments the unmodified 10-turn balance sweep made outside a
  unit's own country, the other 7 were Hungary's) and made `npm run balance-check` fail (Slovakia
  eliminated on turn 10), so the bloc reading, which is also what the supply rule treats as friendly,
  shipped. Switching to own-country-only is one line plus a balance retune. Marek saw these numbers
  and confirmed the bloc reading.
- **Cancelling a queued build** refunds everything until the first End Turn after queuing and then
  `floor(committed × turnsRemaining / totalTurns)` per resource (`getCancelRefund` in `buildRefund.ts`);
  the cancel buttons show the share and a toast reports what came back. The AI never cancels.
- **The AI buys a doctrine before the civilian-factory branch**: left as it is, by decision. A pin test
  fails if the purchase moves after the build ladder, so a refactor cannot change the order silently.
- **Odesa–Tokmak**: Marek kept the two-hop chain Odesa–Zaporizhzhia–Tokmak; there is no direct edge and
  `regionGraph.test.ts` forbids one.

Suite after these changes: 452 tests in 54 files; both type checks, `check:layers`, `smoke`,
`balance-check`, `check-war-entry`, `validate-map` and `build` pass.

### Performance and layout

- `scripts/perf/pan-zoom-bench.js`: 200 frames, avg 57.41 ms, p95 66.7 ms, max 66.8 ms, idle 16.7 ms,
  **`mapRenders: 0`**. The absolute times are from `--disable-gpu` headless software rendering and
  are not comparable to the GPU numbers in `docs/superpowers/baselines/perf-legacy.md`; they match
  the previously recorded headless figures (~59 ms average). The constraint that matters —
  zero React map renders on pan/zoom — holds.
- Layout capture at 1440x900 and 1920x1080: **`Layout lock: PASS`** for both baselines. No control
  was moved or regrouped.

### Decisions and limits

- The loss figures are an estimate, not a promise: they use the resolver's band base, ±15%
  variance and clamps, but do not draw the resolver's random number. An individual battle can land
  outside the shown range. The tooltip labels it as an estimate and never states a guaranteed
  outcome.
- The preview covers the player's current selection and the player's pending support orders. It
  does not model AI pending orders, retreats, assault bounces or facility-damage randomness.
- The preview is hover-only. This is a desktop single-player game; there is no touch interaction to
  attach it to.
- The ratio and strength parts are computed from the same exported helpers as the resolver, so a
  future change to combat modifiers must update both. The characterization test guards the resolver
  side; the estimator tests guard the preview side.

## 7. Cross-cutting verification (final tree)

Commands run after `7e01c72` (the documentation commit changes only docs):

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors |
| `npx tsc -p tsconfig.scripts.json --noEmit` | 0 errors |
| `npm run check:layers` | `Layering: PASS` |
| `npx vitest run` | **410 passed / 410, 52 files** |
| `npm run smoke` | passed for RUSSIA, ROMANIA, AUSTRIA |
| `npm run balance-check` | `Balance check passed for all playable nations` |
| `npm run build` | built successfully (1.33 MB JS, 73.4 kB CSS) |
| `npm run validate-map` | passed for 63 regions |
| `npm run check-war-entry` | `War-entry simulation checks passed` |
| Browser layout lock, 1440x900 and 1920x1080 | `Layout lock: PASS` |
| Browser pan/zoom benchmark | 200 frames, `mapRenders: 0` |

Test files touched by this batch and their test counts:

| File | Tests |
|---|---|
| `src/game/ai/aiEconomyTurn.test.ts` | 12 |
| `src/game/rules/combatEstimate.test.ts` | 21 |
| `src/game/rules/orderResolution.test.ts` | 1 |
| `src/game/state/regionGraph.test.ts` | 6 |
| `src/game/state/migrateSaveAdjacency.test.ts` | 4 |
| `src/ui/panels/buildOrderText.test.ts` | 6 |
| `src/ui/session/lastFacilityBuild.test.ts` | 5 |
| `src/ui/map/tooltip.test.ts` | 18 total (4 preview-specific) |
| `src/ui/map/mapViewProps.test.ts` | 7 total (1 preview-specific) |
| `src/game/rules/economyEngine.test.ts` | 2 total (extended) |

## 8. Reviewer checklist

A reviewer can reproduce the result with these steps:

1. **Confirm scope and history.**
   `git log --oneline 7f6fc36..HEAD` — expect the four feature commits, the docs commit, the review
   follow-ups and the rules follow-up (replenishment and refund, section 6). `git status` — expect a
   clean tree. No commit on `legacy`, nothing pushed.
2. **Run the gates** from the table in section 7. The important one is the full suite:
   `npx vitest run` must report all tests passing: 410 tests in 52 files at `7e01c72`, 452 in 54 files
   after the rules follow-up.
3. **Check the resolver was not changed**, only exported:
   `git diff 7f6fc36..7e01c72 -- src/game/rules/orderResolution.ts` — every added line should be an
   `export` keyword on an existing declaration. The characterization test in
   `orderResolution.test.ts` must pass and asserts the exact pre-change battle result.
4. **Check the estimator has no randomness:**
   `grep -n "Math.random\\|combatRandom\\|randomVariance" src/game/rules/combatEstimate.ts` — no
   matches.
5. **Check the map renders once per meaningful change, not on hover:**
   `grep -n "attackPreviews" src/ui/map/mapViewProps.ts src/ui/map/MapController.ts` and re-run the
   pan/zoom benchmark; `mapRenders` must be 0.
6. **Check the graph assertions:**
   `npx vitest run src/game/state/regionGraph.test.ts src/game/state/migrateSaveAdjacency.test.ts`
   — 10 tests; the graph test checks 222 edges, one component, zero bridges, no leaves, the
   articulation points, every must-keep corridor and all cuts/additions.
7. **Check the browser behavior:** `npm run dev`, start as RUSSIA, select a Russian unit in Tiraspol
   (`Units` in the top bar → the Tiraspol row → the player-owned infantry card), hover Odesa. The
   estimate block must appear and change when the armor card is added. Clicking Odesa must still
   issue attack orders and show the same toast.
8. **Check the noding edit list** against the table in section 4. In particular, confirm that
   Sevastopol–Mariupol exists and Odesa–Bucharest does not; the `5281ab3` commit message has these
   two backwards, and the code/tests/CHANGELOG are authoritative.

## 9. Explicitly out of scope

- `implementation_plan.md` TASK 6–9 (three-condition victory, city siege loop, bloc AI strategy,
  difficulty levels) was not started. Marek excluded the spec that would have folded them.
- No multiplayer, tutorial or hosting work.
- No open-field mechanics, no terrain-by-biome combat.
- No control was moved or regrouped; the top bar, bottom tab bar, panel anchors, unit drawer, map
  controls and supply toggle are unchanged (layout lock proves it).
- Nothing was pushed to GitHub.
