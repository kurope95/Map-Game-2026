# Implementation plan — AI spending, noding, economy QoL, attack preview

Date: 2026-10-19
Spec: [`2026-10-19-gameplay-qol-batch-design.md`](../specs/2026-10-19-gameplay-qol-batch-design.md)
Status: approved (Marek: "do the mentioned 1, 3, 4 and 5").

Work order is deliberate: noding first (content shift, re-baselines AI balance), then AI
spending, then economy QoL, then attack preview (highest extraction risk), then the report.
Each task ends with its own commit on `main`. Do not push.

## Global constraints

- Quote paths (the project path contains spaces).
- `src/game/` must not import React/DOM/ui/app (`npm run check:layers`).
- Keep the main-screen control layout; no moving panels or tabs.
- Never make the map re-render through React on pan/zoom.
- `git add` explicit paths only; commit on `main`; never `legacy`.
- Type check and build before every commit. After any `src/game/` change also run
  `npm run smoke` and `npm run balance-check`.
- Record every change in `CHANGELOG.md` under `[Unreleased]`.
- Do not start `implementation_plan.md` TASK 6–9.
- Do not push.

---

## Task 1 — Noding cleanup (feature 3)

### Step 1.1 — Failing runtime graph test

Create `src/game/state/regionGraph.test.ts` with tests against
`createInitialState("RUSSIA")`:

- 103 regions; undirected edge count 222; every link symmetric.
- One connected component; no leaves; zero bridges; articulation points exactly
  `["helsinki", "nizhny-novgorod"]`.
- Must-keep links present (Odesa–Tiraspol, Odesa–Zaporizhzhia, Zaporizhzhia–Tokmak,
  Mariupol–Tokmak, Chisinau–Tiraspol, Brest–Warsaw, Brest–Minsk, Odesa–Constanta).
- Cut edges absent; added edges present; no direct Odesa–Tokmak.
- `state.scenario.regions` adjacency equals `state.regions` adjacency for every shared id.

Run: `npm test -- regionGraph` → RED.

### Step 1.2 — Static edits

`src/game/content/regions.ts`:

- Remove `kazan` from `moscow`; remove `moscow` from `kazan`.
- Remove `warsaw` and `bryansk` from `minsk`; remove `minsk` from `warsaw` and `bryansk`.
- Remove `essen` from `berlin`; remove `berlin` from `essen`.
- Remove `bucharest` from `odesa`; remove `odesa` from `bucharest`.
- Add `vilnius` to `minsk`; add `minsk` to `vilnius`.
- Add `kaunas` to `warsaw`; add `warsaw` to `kaunas`.
- Add `hannover` to `berlin`; add `berlin` to `hannover`.
- Add `zagreb` to `belgrade`; add `belgrade` to `zagreb`.
- Add `mariupol` to `sevastopol`; add `sevastopol` to `mariupol`.

### Step 1.3 — Generated-region edits

`src/game/state/createInitialState.ts`:

- `MANUAL_SPLIT_PLANS.kazan[0].linkIds`: `["nizhny-novgorod", "moscow"]` → `["nizhny-novgorod"]`.
- `MANUAL_SPLIT_PLANS["nizhny-novgorod"][0].linkIds`: `["moscow", "kazan"]` → `["kazan"]`.
- `MANUAL_SPLIT_PLANS.minsk[0].linkIds`: `["gomel", "warsaw"]` → `["gomel"]`.
- `MANUAL_SPLIT_PLANS["saint-petersburg"][0].linkIds`: `["tallinn", "moscow"]` → `["moscow"]`.
- `applyGeneratedAdjacencyCorrections`: add `unlinkRegions(regionsById, "tallinn-east", "helsinki")`.

Leave `minsk-western-gate`'s Warsaw link untouched (not part of the tested 15). Record this in
the changelog.

### Step 1.4 — Save migration

Add `src/game/state/migrateSaveAdjacency.ts`:

```ts
export function migrateSaveAdjacency(state: GameState): GameState
```

- Build `createInitialState(state.playerCountryId)` once per call.
- For each id present in both saves and the fresh state, replace `adjacentRegionIds` with the
  fresh graph filtered to ids present in the save. Apply to `state.regions` and
  `state.scenario.regions`.
- Leave every other field untouched. Return the same object if nothing changed (optional check).

Wire it into `GameProvider.loadStateFromSave` (call before `session.setGameState(nextState)`), and
also into `handleLoadLegacyQuickSave` through the same `onLoad` path (it already funnels through
`loadStateFromSave`).

Test in `src/game/state/migrateSaveAdjacency.test.ts`: take a fresh state, strip the new
`minsk`–`vilnius` edge and re-add `moscow`–`kazan` in both graphs, run the migration, assert the
new graph is restored and unrelated state (turn, units, stockpiles) is unchanged by identity or
value.

Run: `npm test -- regionGraph migrateSaveAdjacency` → GREEN.

### Step 1.5 — Gates and commit

```
npx tsc -p tsconfig.app.json --noEmit
npm test
npm run validate-map
npm run check-war-entry
npm run smoke
npm run balance-check
npm run build
```

Browser: load the map, confirm the reshuffled links render and no region is stranded. Run the
layout capture/compare if a browser session is available (layout did not change, so expect PASS).

Commit: `Apply core noding reshuffle` (+ changelog in the same commit).

---

## Task 2 — AI spending (feature 1)

### Step 2.1 — Failing tests

Add cases to `src/game/ai/heuristicBot.test.ts` (or a focused new file if it grows past ~400
lines):

- Slot accounting: region with `facilities.length === buildingSlots` and a pending build is not
  chosen; `aiEconomyTurn` queues nothing new in it.
- Replenishment: damaged unit + operational required facility → exactly one `replenishUnit` order
  with `unitId` and positive committed cost; without facility → none; second call while pending →
  none.
- Civilian repair: damaged farm with no military damage → `repairFacility`; damaged barracks +
  damaged farm → barracks repair first.
- Upgrade: level-1 barracks/eligible facility and enough resources → `upgradeFacility`; level 3 or
  damaged → none.
- Doctrine: stockpile raised to 200 trade points → exactly one new doctrine; second call with the
  same state shape → no duplicate; with 15 trade points and no doctrine costing ≤ 5 → none.
- Determinism: two identical runs return the same order types/regions.

Run each new test and confirm RED for the missing behavior.

### Step 2.2 — Implementation in `aiEconomyTurn`

- Fix `findBuildRegion` and `totalSlotsRemaining` to add pending `buildFacility` orders in the
  same region.
- Add helpers: `pendingReplenishUnitIds`, `replenishUnit(unitId, regionId, facilityLevel)`,
  `upgradeFacility(regionId, facility)`, `tryPurchaseDoctrine()`.
- Insert doctrine purchase before the loop (one per call).
- Insert replenishment branch before `needsImmediateFrontlineReinforcement` recruitment.
- Insert civilian-repair branch immediately after the military-facility repair branch.
- Insert upgrade branch after the infantry/armor/MLRS/fighter recruitment blocks and before the
  civilian-factory branch, capped at one upgrade per `aiEconomyTurn`. Both guards are required for
  the balance sweep: upgrades placed before recruitment (or uncapped) starve unit production and
  eliminated a nation in the 10-turn run. (Ruling recorded during execution.)
- Keep all existing branches and their order otherwise unchanged.

### Step 2.3 — Gates and commit

Type check, `npm test`, `npm run smoke`, `npm run balance-check`, build. Add changelog entries.

Commit: `Let the AI spend on replenishment, upgrades and doctrines`.

---

## Task 3 — Economy QoL (feature 4)

### Step 3.1 — Repeat-last-build state

- `src/ui/session/useUiState.ts`: add `lastFacilityBuild` state and setter.
- `src/ui/session/useEconomyActions.ts`: on successful `handleBuildFacility`, call
  `rememberFacilityBuild({ regionId, facilityType })`.
- Test the pure/recorded behavior where feasible (hook-level tests are not currently set up; if no
  harness exists, verify in the browser and keep the rule engine tests as the safety net).

### Step 3.2 — Repeat button

`src/ui/panels/EconomyPanel.tsx`:

- Add a `Repeat: <label> (<region name>)` secondary button in the Construct column above the
  recipe list.
- Disabled when no last build or when the remembered region is no longer player-controlled /
  turn inactive; clicking calls `handleBuildFacility(last.regionId, last.facilityType)`.
- No new mechanics; the pure action still validates slots and affordability.

### Step 3.3 — Global construction queue

`src/ui/panels/OrdersPanel.tsx`:

- Add a "Construction queue (N)" section beneath the unit orders, listing
  `gameState.economyBuildOrders[playerCountryId]`.
- Describe each order type; show `region.name`, `turnsRemaining/totalTurns`, committed cost and a
  cancel button wired to the existing `handleCancelBuildOrder`.
- Keep the existing last-turn-events block.

Style with existing classes in `EconomyPanels.css` / `FloatPanel.css`; avoid inline styles.

### Step 3.4 — Browser verification

- Build a facility, verify the Repeat button appears and queues the same build in the same region.
- Cancel an order from the Orders panel and confirm the refund toast/stockpile.
- Run layout capture + compare → `Layout lock: PASS`.
- Confirm bottom tabs and panel positions unchanged.

Commit: `Add repeat-last-build and a visible construction queue`.

---

## Task 4 — Attack odds preview (feature 5)

### Step 4.1 — Export shared modifiers

In `src/game/rules/orderResolution.ts`, export the pure helpers needed by the estimator
(`getSupplyCombatModifier`, `getVeterancyModifier`, `getEntrenchmentModifier`,
`getAntiFortModifier`, `countryHasDoctrine`, and the fort constants used in the formula) without
changing resolver behavior. Alternatively move them to a new `combatMath.ts` and import from both;
choose the smaller diff. Add a characterization test that a fixed-seed battle still resolves to
the same result before/after the export.

### Step 4.2 — Estimator tests first

Create `src/game/rules/combatEstimate.test.ts` with the band-boundary, modifier, support and clamp
cases listed in the spec. Run → RED.

### Step 4.3 — Implement `combatEstimate.ts`

- Include pending player air support, bombard and missile strikes targeting the region.
- Apply pre-combat damage deterministically to defender strengths and fort health.
- Compute ratio, band, loss ranges and notes. Never touch the seeded RNG.
- Export `estimateAttack` and its types.

### Step 4.4 — Tooltip plumbing

- `src/ui/map/MapView.tsx`: add `attackPreviews?: Record<string, AttackEstimate>`.
- `src/ui/map/mapViewProps.ts`: compare by reference.
- `src/ui/screens/game/GameScreen.tsx`: memo-build the map for `validTargets.attacks`.
- `src/ui/map/MapController.ts`: pass `this.props?.attackPreviews?.[regionId]` into
  `this.tooltip.update`.
- `src/ui/map/TooltipView.ts`: cache/recompute on state, region or estimate reference change.
- `src/ui/map/tooltip.ts`: add the estimate to `TooltipModel` and render it in `tooltipHtml`.
- CSS for `.map-tooltip__estimate`.

### Step 4.5 — Tests

- `tooltip.test.ts`: estimate present/absent, escaped text.
- `mapViewProps.test.ts`: reference comparison.
- Existing tests: full suite green.

### Step 4.6 — Browser and performance

- Hover a valid attack target with units selected; confirm the estimate appears and updates when
  the selection changes.
- Confirm clicking still commits the attack exactly as before.
- Run `scripts/perf/pan-zoom-bench.js`; record frame times and confirm `mapRenders: 0`.
- Run layout capture/compare if any panel content shifted (it should not).

### Step 4.7 — Gates and commit

Type check, full tests, smoke, balance-check (the estimator is UI-only but the helper exports touch
`rules/`), build.

Commit: `Preview attack odds in the hover tooltip`.

---

## Task 5 — Final documentation and handoff report

- Update `CHANGELOG.md` with all four features under `Added` / `Changed` / `Decision` / `Verified`.
- Update the noding analysis spec status line from "analysis only" to "core edits implemented",
  noting the save migration and the `minsk-western-gate` ruling.
- Write `docs/superpowers/reports/2026-10-19-feature-batch-report.md` for external review:
  per-feature goals, files changed, exact behavior, commands run with results, known limitations,
  test inventory, and a checklist an external agent can use to verify the work independently.
- Final `git status` must list only intended files; no `.tmp-check/` or `dist/` tracked.

Commit: `Document the AI, noding, economy and preview batch`.

---

## Completion checklist

- [x] Core 15 noding edits applied exactly; graph test asserts 222 edges, no leaves/bridges.
- [x] Save migration restores the new graph on load; old fields untouched.
- [x] AI replenishes, repairs civilians, upgrades and buys doctrines; slot accounting matches the
      player rule.
- [x] Repeat-last-build works in the Economy panel; Orders panel lists the construction queue and
      supports cancel/refund.
- [x] Attack estimate visible in the tooltip, deterministic, includes pending support; click flow
      unchanged.
- [x] `mapRenders: 0` in the pan/zoom benchmark.
- [x] Type check, build, full tests, validate-map, check-war-entry, smoke, balance-check pass.
- [x] Layout lock passes.
- [x] CHANGELOG and report written; nothing pushed.
