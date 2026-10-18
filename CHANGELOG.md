# Changelog

All notable changes to **Map Game** are recorded here.

This project's planning lives in:
- [`CLAUDE.md`](./CLAUDE.md) — project guide for agents: direction, commands, layout, git rules.
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — current design specs.
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — current implementation plans (cite their
  task numbers, e.g. `(plan 2026-10-18-visual-overhaul → Task 3)`).
- [`docs/v1-design.md`](./docs/v1-design.md) — the original product/design vision.
- History: [`CODEX_PLAN.md`](./CODEX_PLAN.md) (original roadmap, done) and
  [`implementation_plan.md`](./implementation_plan.md) (TASK 1–5 done; TASK 6–9 not started and
  due to be folded into a future gameplay spec).

## How to use this file (instructions for the implementing agent)

Every time you make a change to the project, add an entry under **[Unreleased]** using the
conventions below. **Do not skip this.**

- Group entries with these headings: `Added`, `Changed`, `Fixed`, `Removed`, `Verified`,
  `Decision`.
- **Reference the work item** it implements: cite the plan and task, e.g.
  `(implementation_plan.md → TASK 2)` or `(CODEX_PLAN.md → Phase 4A)`.
- **Reference the files** you touched using inline code links, e.g.
  `[heuristicBot.ts](./src/game/ai/heuristicBot.ts)`.
- Keep each entry to one or two lines; explain the *why*, not just the *what*.
- For verification work, record the command(s) run and the result under `Verified`.
- For design deviations from the plan, record them under `Decision` with a short rationale.
- When you cut a release, move everything from **[Unreleased]** into a new dated version
  section (e.g. `## [0.2.0] - 2026-06-15`) and start a fresh empty **[Unreleased]`.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Standalone git repo pushed to https://github.com/kurope95/Map-Game-2026: `legacy` branch freezes
  the pre-improvement game, `main` carries all improvements. Added [`.gitignore`](./.gitignore)
  (node_modules, dist, .tmp-check, local settings) and [`.gitattributes`](./.gitattributes)
  (LF everywhere, CRLF for `.bat` so `launch.bat` labels keep working).
- [`CLAUDE.md`](./CLAUDE.md): agreed direction (deep grand strategy, turn-based, single player,
  keep main-screen control layout, smooth pan/zoom), commands, code layout, git and changelog rules.
- Round 1 design spec [`2026-10-18-visual-overhaul-design.md`](./docs/superpowers/specs/2026-10-18-visual-overhaul-design.md):
  split `App.tsx`/`styles.css`, style C ("painted strategy map") restyle with frozen main-screen
  layout, new start screen and turn report, Canvas 2D map with per-region controller colors,
  occupation stripes, front line, link lines, NATO counters and a ≤ 8 ms frame budget.
- Round 1 implementation plan [`2026-10-18-visual-overhaul.md`](./docs/superpowers/plans/2026-10-18-visual-overhaul.md):
  30 tasks in 6 phases (safety net, restructure, look, canvas map, start screen, wrap-up), each
  with exact files, interfaces, tests and checks, ready for a Sonnet 5.5 implementation session.
- `npm test` (Vitest 3.2, Node environment, tests live next to the code as `*.test.ts`) and the
  characterization test [`scenarioBaseline.test.ts`](./src/game/state/scenarioBaseline.test.ts): after
  10 auto-played turns `state.scenario.regions` still holds the pre-war controllers while regions
  have changed hands, so the occupation stripes can use it as their baseline.
  (plan 2026-10-18-visual-overhaul → Task 1)
  Files: [package.json](./package.json), [vite.config.ts](./vite.config.ts),
  [tsconfig.scripts.json](./tsconfig.scripts.json) (excludes `*.test.ts` from the harness compile)
- Layout lock (constraint C1): browser snippet [`capture-layout.js`](./scripts/layout/capture-layout.js)
  opens 20 probed containers through the UI and records their boxes plus the order and row of the
  top-bar, bottom-bar and map controls; [`compareLayout.mjs`](./scripts/layout/compareLayout.mjs) and the
  CLI [`compare-layout.mjs`](./scripts/layout/compare-layout.mjs) check two captures within 4 px and
  print `Layout lock: PASS` / `FAIL`. Baselines captured on the untouched legacy UI:
  [`layout-1440x900.json`](./docs/superpowers/baselines/layout-1440x900.json) and
  [`layout-1920x1080.json`](./docs/superpowers/baselines/layout-1920x1080.json).
  (plan 2026-10-18-visual-overhaul → Task 2)
  Files: [compareLayout.test.mjs](./scripts/layout/compareLayout.test.mjs) (11 tests)
- Pan/zoom benchmark (constraint C2): browser snippet [`pan-zoom-bench.js`](./scripts/perf/pan-zoom-bench.js)
  drives 180 scripted `pointermove` frames in an ellipse plus 20 `wheel` steps on the map element
  and returns `{ avgMs, p95Ms, maxMs, frames, mapRenders, idleMs }` (`idleMs` = idle frame interval,
  the display's floor). It returns `{ error }` instead of hanging when the browser pane is hidden.
  (plan 2026-10-18-visual-overhaul → Task 3)
- Layering check (constraint C6): `npm run check:layers` ([`check-layers.mjs`](./scripts/check-layers.mjs))
  fails when anything under `src/game/` imports a `ui`/`app` path or React; it is also a unit test
  ([`check-layers.test.mjs`](./scripts/check-layers.test.mjs), 15 tests). New game-layer module
  [`regionGeo.ts`](./src/game/content/regionGeo.ts) adds `MAP_POINT_OVERRIDES` (display-only map
  point fixes, empty until Task 21) and `getRegionGeoPoint()`; tested in
  [`regionGeo.test.ts`](./src/game/content/regionGeo.test.ts).
  (plan 2026-10-18-visual-overhaul → Task 4)
- [`strategicDepot.ts`](./src/game/rules/strategicDepot.ts): the single home of `hasBlocPathToRegion` and
  `getPridnestrovieDepotStatus` (with its `detail` text), covered by
  [`strategicDepot.test.ts`](./src/game/rules/strategicDepot.test.ts) (9 tests: locked, claimed,
  bridge needed, claimable, unavailable, claimant mismatch, path search).
  (plan 2026-10-18-visual-overhaul → Task 5)
- [`playerActions.ts`](./src/game/rules/playerActions.ts): the player's economy and doctrine actions as pure
  functions (`queueFacilityBuild/Upgrade/Repair`, `queueFortificationBuild/Upgrade/Repair`,
  `demolishFacility`, `queueUnitRecruit`, `queueUnitReplenish`, `cancelBuildOrder`, `purchaseDoctrine`,
  `toggleChemicalMode`, plus `canAfford`, `getMissingResources`, `getOperationalFacilities`,
  `getBestOperationalFacility`); guards, order shapes and toast texts are moved verbatim from the
  `App.tsx` handlers, silent failures stay silent. 41 tests in
  [`playerActions.test.ts`](./src/game/rules/playerActions.test.ts).
  (plan 2026-10-18-visual-overhaul → Task 6)
- [`GameProvider.tsx`](./src/ui/session/GameProvider.tsx): `GameProvider` and `useGame()` (throws
  "useGame must be used inside GameProvider" outside a provider), tested by
  [`GameProvider.test.ts`](./src/ui/session/GameProvider.test.ts) (2 tests, server-side render).
  (plan 2026-10-18-visual-overhaul → Task 7)
- HUD components [`TopBar`](./src/ui/hud/TopBar.tsx), [`BottomBar`](./src/ui/hud/BottomBar.tsx),
  [`SupplyToggle`](./src/ui/hud/SupplyToggle.tsx) and [`ToastStack`](./src/ui/hud/ToastStack.tsx) (prop-less,
  they read `useGame()`), each with its own CSS file, plus
  [`GameScreen.css`](./src/ui/screens/game/GameScreen.css). They carry the layout-lock attributes
  `data-layout` (`top-bar`, `bottom-bar`, `map-stage`, `supply-toggle`) and `data-layout-key` on every top-bar
  and bottom-tab control, with the exact keys the legacy capture produced.
  (plan 2026-10-18-visual-overhaul → Task 8)

### Decision
- Spec refinements made while planning: the layout lock compares bar controls by order and row (so
  icons may be added beside labels) instead of exact x-positions; the zoom range is defined
  relative to the default fit (0.6x-24x) because canvas scale differs from the old SVG viewBox
  scale; region shade variants use greedy neighbor coloring instead of a hash so same-owner
  neighbors never share a shade.
- **Legacy frame-time numbers are pending (Task 3 step 2).** The built-in browser pane was hidden
  while Tasks 1-3 ran (`requestAnimationFrame` delivered no frames in 5 s although the app listed the
  session on screen), and C2 numbers only count with a visible pane. `docs/superpowers/baselines/perf-legacy.md`
  is added once they can be measured. (plan 2026-10-18-visual-overhaul → Task 3)
- Task 4 also updates [`validate-map.mjs`](./scripts/validate-map.mjs), which read `src/ui/mapLayout.ts`
  by path and broke when the file moved (the plan did not list it). It now reads only the
  `theaterMapLayout` block of `regionGeo.ts`, so the `MAP_POINT_OVERRIDES` entries added in Task 21
  are not mistaken for orphan layout ids. (plan 2026-10-18-visual-overhaul → Task 4)

### Changed
- This changelog's planning links now point at `CLAUDE.md` and `docs/superpowers/`; the earlier
  entries are filed under the `0.1.0` legacy release below.
- Map points moved verbatim from `src/ui/mapLayout.ts` to
  [`src/game/content/regionGeo.ts`](./src/game/content/regionGeo.ts), so the rules engine no longer
  imports UI code ([`createInitialState.ts`](./src/game/state/createInitialState.ts) and
  [`TheaterMap.tsx`](./src/ui/TheaterMap.tsx) now import it from there).
  (plan 2026-10-18-visual-overhaul → Task 4)
- The depot path and status code that was copied three times ([`turnEngine.ts`](./src/game/rules/turnEngine.ts),
  [`App.tsx`](./src/app/App.tsx), [`TheaterMap.tsx`](./src/ui/TheaterMap.tsx)) now imports the one copy in
  `strategicDepot.ts`; behavior is unchanged (the map's copy only differed in label wording, and the map
  reads just `.tone`). (plan 2026-10-18-visual-overhaul → Task 5)
- [`App.tsx`](./src/app/App.tsx): the build, upgrade, repair, fortification, demolish, recruit, replenish,
  cancel, doctrine and chemical-mode handlers now call the pure actions in `playerActions.ts` through one
  `applyAction` helper (set state, then show the action's toast); `canAfford`, `getMissingResources` and the
  facility lookups are thin wrappers that pass `gameState`. The facility pop-up's inline chemical-mode toggle
  calls the new `handleToggleChemicalMode`. (plan 2026-10-18-visual-overhaul → Task 6)
- [`unitStatus.ts`](./src/ui/format/unitStatus.ts): `getSupplyStatus`, `getVeterancyLevel` and
  `getEntrenchmentBonus` moved verbatim out of `App.tsx`, covered by
  [`unitStatus.test.ts`](./src/ui/format/unitStatus.test.ts) (5 tests).
  (plan 2026-10-18-visual-overhaul → Task 7)
- `App.tsx` (2,300 lines) is split mechanically and verbatim: every `useState`, `useMemo`, `useEffect` and
  handler moved into [`useGameController.ts`](./src/ui/session/useGameController.ts) (returns all of them in
  one object, shared through the new [`GameProvider.tsx`](./src/ui/session/GameProvider.tsx) context and
  `useGame()`); the main-screen JSX and the two diplomacy renderers moved into
  [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx), which starts with `const { ... } = useGame();`.
  [`App.tsx`](./src/app/App.tsx) is now 25 lines: `GameProvider` around `AppScreens`, which shows `GameScreen`
  or the landing page. Behavior is unchanged. (plan 2026-10-18-visual-overhaul → Task 7)
- [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx) now composes `TopBar`, `BottomBar`, `SupplyToggle` and
  `ToastStack`; their JSX moved verbatim. The `.top-bar*`, `.bottom-bar*`, `.game-shell` and `.map-stage` CSS
  (199 lines) moved verbatim out of [`styles.css`](./src/ui/styles.css) into the component CSS files, and the
  inline styles of the supply toggle and the toasts became the classes `.supply-toggle(--on)` and
  `.toast-stack` / `.toast--info|success|warning|danger` with identical values. (The `@media (max-width: 1100px)`
  block holds only landing-page rules, so it has no shell part to move.)
  (plan 2026-10-18-visual-overhaul → Task 8)
- **Task 9 STATUS: PARTIAL (part a of 2 done, part b NOT started).** Part a: the `.float-panel*`, `.panel-grid`,
  `.panel-card`, `.war-dot` and `.region-strip` rules ([`FloatPanel.css`](./src/ui/panels/FloatPanel.css), 190
  lines) and the `.economy-*`, `.deposit-*`, `.facility-item*`/`.facility-list`, `.build-*` and `.capture-*`
  rules ([`EconomyPanels.css`](./src/ui/panels/EconomyPanels.css), 262 lines) moved verbatim out of
  [`styles.css`](./src/ui/styles.css) (445 lines; a chunk-level check against git found nothing lost or added);
  `GameScreen.tsx` imports both files for now. Part b (extract `RegionPanel`, `EconomyPanel`,
  `RecruitmentPanel`, `OrdersPanel`, `AiIntelPanel`, `WarStatusPanel`, `EventLogPanel` into `src/ui/panels/`
  with `data-layout="panel-*"`) is NOT started. Browser verification of part a (style fingerprint, layout lock)
  was not run before the session hit its usage limit. (plan 2026-10-18-visual-overhaul → Task 9)

### Verified
- Baseline on `main` before improvements: `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build` OK (1.2 MB JS bundle), `npm run smoke` passed, `npm run balance-check` passed
  for all 24 nations.
- Task 1: `npm test` 1/1 passed (scenario baseline holds, regions do change hands),
  `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run smoke` passed.
  (plan 2026-10-18-visual-overhaul → Task 1)
- Task 2: `npm test` 12/12 passed. Both legacy baselines have `missing: []` (20 probes) and pass
  `node scripts/layout/compare-layout.mjs <baseline> <second capture>` with `Layout lock: PASS` at
  1440x900 and 1920x1080; the legacy keys captured for the top bar, bottom bar and map controls equal
  the `data-layout-key` lists planned for Task 8. (plan 2026-10-18-visual-overhaul → Task 2)
- Task 3: C7 checks pass (`npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build` OK,
  `npm test` 12/12, `npm run smoke`, `npm run balance-check` "Balance check passed"; `check:layers`
  does not exist before Task 4). The benchmark flow was exercised end to end on the legacy map with a
  MessageChannel stand-in for `requestAnimationFrame` (200 frames, pan and zoom took effect). That
  run is script-only and NOT a C2 measurement. (plan 2026-10-18-visual-overhaul → Task 3)
- Task 4: `npm test` 31/31, `npm run check:layers` "Layering: PASS", `npx tsc -p tsconfig.app.json --noEmit`
  0 errors, `npm run build` OK, `npm run smoke` and `npm run balance-check` passed, `npm run validate-map`
  "Map validation passed for 63 regions", layout lock PASS at 1440x900 (full reload; the dev server's
  hot reload of the moved module threw a transient `lon` error that a reload clears).
  (plan 2026-10-18-visual-overhaul → Task 4)
- Task 5: `npm test` 40/40, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`,
  `npm run check:layers`, `npm run smoke` and `npm run balance-check` passed; layout lock PASS at 1440x900;
  browser walk-through (start, move order, End Turn and report, all 8 tabs, no console errors) passed and
  the Region panel for Tiraspol still shows `Depot: Locked` with its detail text.
  (plan 2026-10-18-visual-overhaul → Task 5)
- Task 6: `npm test` 81/81 (41 new in `playerActions.test.ts`), `npx tsc -p tsconfig.app.json --noEmit` 0
  errors, `npm run build`, `npm run check:layers`, `npm run smoke` and `npm run balance-check` passed; layout
  lock PASS at 1440x900; browser walk-through passed (19 steps) and the economy flow passed through the
  rewired handlers (smelter queued: iron and coal -2; cancel refunds both; farm queue and cancel; infantry
  recruit costs steel). The "already at full strength" replenish toast is unit-tested only, because the UI
  hides the Replenish button at full strength. (plan 2026-10-18-visual-overhaul → Task 6)
- Task 7: `npm test` 88/88, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`,
  `npm run check:layers`, `npm run smoke` and `npm run balance-check` passed; browser walk-through (19
  steps), economy flow (12 steps) and layout lock at 1440x900 all pass after each of the three commits.
  A mutation check (removing the throw in `useGame`) made the `GameProvider` test fail, as it should.
  (plan 2026-10-18-visual-overhaul → Task 7)
- Task 8: `npm test` 88/88, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build` and
  `npm run check:layers` pass; layout lock PASS at 1440x900 (top-bar keys `mapgame … loadgame` and bottom-tab
  keys `region … eventlog` as planned); browser walk-through (19 steps) and economy flow (12 steps) pass. A
  computed-style and box fingerprint of 18 UI states (3,392 elements, taken before and after) is identical; the
  only differences are the 20 class renames of the supply toggle and the toast. (The fingerprint tool lives in
  the session notes folder, not in the repo.) (plan 2026-10-18-visual-overhaul → Task 8)

## [0.1.0] - 2026-10-18 (legacy snapshot, `legacy` branch)

### Added
- `implementation_plan.md` — detailed plan for the remaining `CODEX_PLAN.md` work (TASK 1–5).
  (implementation_plan.md)
- `implementation_plan.md` Wave 2 (TASK 6–9): greenlit warfare & AI improvements. TASK 6–7
  revised after feedback — replaced encirclement/terrain/combined-arms with v1 victory conditions
  and city siege loop (fort → bombard → assault). TASK 8–9 unchanged in intent. Specs only.
  (implementation_plan.md → TASK 6–9)
- This `CHANGELOG.md` with logging conventions linking changes back to the plans.
- Balance harness [`scripts/balanceCheck.ts`](./scripts/balanceCheck.ts) with per-nation progress
  logging and deterministic RNG; results table in [`docs/balance-report.md`](./docs/balance-report.md).
  (implementation_plan.md → TASK 1)
- Smoke harness [`scripts/smokeTest.ts`](./scripts/smokeTest.ts) and npm scripts `balance-check` /
  `smoke`. (implementation_plan.md → TASK 5)
- Shared turn-flow helpers in [`src/game/sim/autoPlay.ts`](./src/game/sim/autoPlay.ts) used by the
  harness and UI. (implementation_plan.md → TASK 1, TASK 5)
- Allied attack coordination via [`src/game/ai/allyCoordination.ts`](./src/game/ai/allyCoordination.ts)
  and `GameState.allyTargetClaims`. (implementation_plan.md → TASK 2)
- Exported `setCombatSeed()` in [`orderResolution.ts`](./src/game/rules/orderResolution.ts) for
  reproducible balance runs. (implementation_plan.md → TASK 1)

### Changed
- Per-nation balance minimums, at-war food buffers, scripted-entry stockpile bonuses, and capital
  fortifications for late-war minors in [`createInitialState.ts`](./src/game/state/createInitialState.ts).
  (implementation_plan.md → TASK 1)
- Expanded starting units for frontline / late-entry nations in [`units.ts`](./src/game/content/units.ts).
  (implementation_plan.md → TASK 1)
- Pridnestrovie now receives seeded starter facilities like other nations.
  [`createInitialState.ts`](./src/game/state/createInitialState.ts)
- `App.tsx` turn handlers now use safe auto-play helpers instead of unbounded `while` loops.
  (implementation_plan.md → TASK 1)

### Fixed
- **Infinite-loop hang in balance check / auto-play**: when the player nation was defeated it was
  removed from `turnOrder`, but the loop kept waiting for `currentActorId === playerCountryId` forever.
  Fixed by detecting elimination and capping steps in [`autoPlay.ts`](./src/game/sim/autoPlay.ts).
  (implementation_plan.md → TASK 1)

### Decision
- **Captured-facility damage policy (TASK 3):** keep chance-based damage on capture/combat rather than
  always damaging all facilities. Rationale: the existing system in [`orderResolution.ts`](./src/game/rules/orderResolution.ts)
  already scales with battle intensity; always-damage would be overly punitive. Repair confirmed via
  `repairFacility` orders in [`economyEngine.ts`](./src/game/rules/economyEngine.ts) (~1 turn).
  (implementation_plan.md → TASK 3, CODEX_PLAN.md → Phase 4B)
- **AI-turn progress overlay (TASK 4):** not implemented. Option A (instant resolve + combat report)
  is sufficient; full multi-nation resolution completes in milliseconds after the auto-play fix.
  (implementation_plan.md → TASK 4, CODEX_PLAN.md → Phase 4D)

### Verified
- `npm run balance-check` — all 24 playable nations pass 10-turn AI auto-play (~5s total).
  See [`docs/balance-report.md`](./docs/balance-report.md). (implementation_plan.md → TASK 1)
- `npm run smoke` — RUSSIA, ROMANIA, AUSTRIA each survive 5-turn auto-play. (implementation_plan.md → TASK 5)
- `npx tsc --noEmit` and `npm run build` — 0 errors. (implementation_plan.md → TASK 5)
- Allied unit stacking into friendly allied regions already allowed via `isRegionOpenForTransit` in
  [`orderResolution.ts`](./src/game/rules/orderResolution.ts); no change required. (implementation_plan.md → TASK 2)

<!--
Template for new entries — copy under [Unreleased]:

### Added | Changed | Fixed | Removed | Verified | Decision
- <one-line description of the change and why>.
  (implementation_plan.md → TASK N  /  CODEX_PLAN.md → Phase X)
  Files: [file.ts](./src/path/file.ts), [other.tsx](./src/path/other.tsx)
-->
