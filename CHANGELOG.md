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
- AI pathfinding design [`2026-10-19-ai-pathfinding-design.md`](./docs/superpowers/specs/2026-10-19-ai-pathfinding-design.md)
  and implementation plan [`2026-10-19-ai-pathfinding.md`](./docs/superpowers/plans/2026-10-19-ai-pathfinding.md):
  a recomputed distance field over the existing transit rules so the AI can march toward distant
  national goals, allied shield goals, lost homeland and threatened fronts without replacing the
  hard-coded focus rules. Design only at this point; no AI behavior changed.
  (plan 2026-10-19-ai-pathfinding → Tasks 1–6)
- AI characterization tests before pathfinding: [`heuristicBot.test.ts`](./src/game/ai/heuristicBot.test.ts)
  pins determinism, one action per unit, legal targets, adjacent at-war attacks and the
  lone-defender no-move rule; [`allyCoordination.test.ts`](./src/game/ai/allyCoordination.test.ts)
  pins the ally claim ledger, the 1.5× deferral threshold and same-country accumulation. These
  describe current behavior so the route stages can change scores without silently changing rules.
  (plan 2026-10-19-ai-pathfinding → Task 1)
- AI route-distance field [`pathfinding.ts`](./src/game/ai/pathfinding.ts): multi-source BFS over the
  existing land-transit rule (`buildRouteDistances`, `getRouteDistance`, `getRouteProgress`). Enemy-held
  destinations are attack terminals, stacking is ignored until a move is emitted, and Moldova stays
  closed while neutral. Tests cover the real 103-region map, an enemy border, BFS invariants and the
  progress sign.
  (plan 2026-10-19-ai-pathfinding → Task 2)
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
- Bottom-tab panel components [`RegionPanel`](./src/ui/panels/RegionPanel.tsx),
  [`EconomyPanel`](./src/ui/panels/EconomyPanel.tsx), [`RecruitmentPanel`](./src/ui/panels/RecruitmentPanel.tsx),
  [`OrdersPanel`](./src/ui/panels/OrdersPanel.tsx), [`AiIntelPanel`](./src/ui/panels/AiIntelPanel.tsx),
  [`WarStatusPanel`](./src/ui/panels/WarStatusPanel.tsx) and [`EventLogPanel`](./src/ui/panels/EventLogPanel.tsx).
  They are prop-less, read `useGame()`, render only when their tab is open, and their roots carry `data-layout`
  `panel-region`, `panel-economy`, `panel-recruitment`, `panel-orders`, `panel-aiintel`, `panel-warstatus` and
  `panel-eventlog`. (plan 2026-10-18-visual-overhaul → Task 9)
- Map-side window components [`UnitDrawer`](./src/ui/windows/UnitDrawer.tsx),
  [`UnitCard`](./src/ui/windows/UnitCard.tsx), [`GlobalUnitsPanel`](./src/ui/windows/GlobalUnitsPanel.tsx),
  [`StockpilePopup`](./src/ui/windows/StockpilePopup.tsx) and
  [`FacilityPopup`](./src/ui/windows/FacilityPopup.tsx), each with its own CSS file. They are prop-less
  and read `useGame()`, except `UnitCard`, which takes `{ unit: UnitDefinition }`; their roots carry
  `data-layout` `unit-drawer`, `global-units`, `stockpile` and `facility`.
  (plan 2026-10-18-visual-overhaul → Task 10)
- Modal window components [`DiplomacyWindow`](./src/ui/windows/diplomacy/DiplomacyWindow.tsx) (with
  [`DiplomacyBar`](./src/ui/windows/diplomacy/DiplomacyBar.tsx),
  [`DiplomacyListCard`](./src/ui/windows/diplomacy/DiplomacyListCard.tsx) and
  [`DiplomacyActions`](./src/ui/windows/diplomacy/DiplomacyActions.tsx)),
  [`DoctrineWindow`](./src/ui/windows/DoctrineWindow.tsx),
  [`SaveLoadWindow`](./src/ui/windows/SaveLoadWindow.tsx),
  [`BattleReportWindow`](./src/ui/windows/BattleReportWindow.tsx),
  [`DefeatNotice`](./src/ui/windows/DefeatNotice.tsx) and
  [`VictoryOverlay`](./src/ui/windows/VictoryOverlay.tsx). All are prop-less and read `useGame()`;
  their roots carry `data-layout` `diplomacy`, `doctrines`, `save-load`, `battle-report`,
  `defeat-notice` and `victory`, and the closing backdrops carry `doctrines-backdrop`,
  `save-load-backdrop` and `logic-map-backdrop`.
  (plan 2026-10-18-visual-overhaul → Task 11)
- Split the game controller into focused hooks under [`src/ui/session/`](./src/ui/session/):
  [`useToasts.ts`](./src/ui/session/useToasts.ts), [`useUiState.ts`](./src/ui/session/useUiState.ts),
  [`useGameSession.ts`](./src/ui/session/useGameSession.ts), [`useSelection.ts`](./src/ui/session/useSelection.ts),
  [`useEconomyActions.ts`](./src/ui/session/useEconomyActions.ts), [`useDiplomacy.ts`](./src/ui/session/useDiplomacy.ts)
  and [`useSaveSlots.ts`](./src/ui/session/useSaveSlots.ts), with the shared types in
  [`types.ts`](./src/ui/session/types.ts). The pure save parsing moved to
  [`saveSlots.ts`](./src/ui/session/saveSlots.ts) and is covered by
  [`saveSlots.test.ts`](./src/ui/session/saveSlots.test.ts) (5 tests: envelope, legacy raw state,
  fallback country, invalid JSON, newest-first sort). (plan 2026-10-18-visual-overhaul → Task 12)
- Style C theme foundation: [`tokens.css`](./src/ui/theme/tokens.css) holds the spec 7.1 palette,
  type scale, radii and window shadow verbatim plus the alias block for not-yet-restyled CSS, and
  [`palette.ts`](./src/ui/theme/palette.ts) holds `NATION_COLORS` (spec 7.2), `NON_SCENARIO_LAND`,
  `BLOC_COLORS`, `SHADE_OVERLAYS`, `GEO_NEIGHBORS` and `rgbDistance`, covered by
  [`palette.test.ts`](./src/ui/theme/palette.test.ts) (2 tests: every nation has a color; every
  neighbor pair differs by RGB distance ≥ 40). (plan 2026-10-18-visual-overhaul → Task 13)
- Style C kit under [`src/ui/kit/`](./src/ui/kit/): `Window`, `Button`, `Badge`, `StatRow`,
  `ProgressBar`, `Pips`, `Tabs`, `ResourceIcon`, `ResourceAmount`, `Flag` and `UnitSymbol` with
  their `Window.css`, `Button.css` and `kit.css`; data modules
  [`resources.ts`](./src/ui/kit/resources.ts) (`RESOURCE_META` for all 19 stockpile keys,
  `FACILITY_META` for all 13 facility types), [`flags.ts`](./src/ui/kit/flags.ts) (all 24 flags as
  30x20 SVG, the single source of truth for the map tooltip) and
  [`unitSymbols.ts`](./src/ui/kit/unitSymbols.ts) (NATO symbols in a 24x16 box, used by the map in
  Task 27), covered by [`kit.test.ts`](./src/ui/kit/kit.test.ts) (4 tests).
  (plan 2026-10-18-visual-overhaul → Task 14)
- Dev gallery [`KitGallery.tsx`](./src/ui/dev/KitGallery.tsx) at `?kit` (`import.meta.env.DEV`
  only): all flags, unit symbols, button variants, badges, stats, progress bars, pips, tabs,
  resources, and a panel and a modal `Window`.
  (plan 2026-10-18-visual-overhaul → Task 14)
- Map geometry foundation under [`src/ui/map/geometry/`](./src/ui/map/geometry/):
  [`projection.ts`](./src/ui/map/geometry/projection.ts) reproduces the legacy Mercator fit
  (`WORLD`, `WORLD_CLIP`, `projectGeoPoint`), [`polygon.ts`](./src/ui/map/geometry/polygon.ts) adds
  signed ring area, point-in-polygon, polygon area/bbox, segment distance and `nestRings`, and
  [`countryShapes.ts`](./src/ui/map/geometry/countryShapes.ts) carries the numeric-id tables
  verbatim and builds clipped `CountryShape`s from world-atlas through d3-geo, nesting holes by
  winding. Adds the `polygon-clipping` dependency for Task 21.
  (plan 2026-10-18-visual-overhaul → Task 20)
  Files: [types.ts](./src/ui/map/geometry/types.ts),
  [polygon.test.ts](./src/ui/map/geometry/polygon.test.ts) (5 tests),
  [countryShapes.test.ts](./src/ui/map/geometry/countryShapes.test.ts) (5 tests),
  [package.json](./package.json)
- Region polygon builder [`regionShapes.ts`](./src/ui/map/geometry/regionShapes.ts): groups the 103
  runtime regions by clip country, gives single-region countries their own country polygon, and
  splits multi-region countries with a d3-delaunay Voronoi clipped by `polygon-clipping` (bbox
  intersection fallback if the clip throws). Covered by
  [`regionShapes.test.ts`](./src/ui/map/geometry/regionShapes.test.ts) (5 tests: 103 positive-area
  shapes, every city point inside its own polygon, no fallback, per-country area within 1%, build
  under 600 ms). (plan 2026-10-18-visual-overhaul → Task 21)
  Files: [regionShapes.test.ts](./src/ui/map/geometry/regionShapes.test.ts),
  [countryShapes.ts](./src/ui/map/geometry/countryShapes.ts),
  [regionGeo.ts](./src/game/content/regionGeo.ts)
- Map hit-testing and boundary geometry for the canvas map: [`regionLookup.ts`](./src/ui/map/geometry/regionLookup.ts)
  answers `regionAt`/`landAt` through banded even-odd point indexes,
  [`boundaries.ts`](./src/ui/map/geometry/boundaries.ts) walks each region ring once into typed
  border polylines (`internal`/`national`/`coast`/`foreign`, deduplicated per shared border) and
  derives neighbors plus a proper four-variant shade coloring, [`labelPoints.ts`](./src/ui/map/geometry/labelPoints.ts)
  picks an interior label point per region and per starting nation,
  [`startingControllers.ts`](./src/ui/map/startingControllers.ts) exposes the pre-war controller map,
  and [`buildMapGeometry.ts`](./src/ui/map/geometry/buildMapGeometry.ts) assembles all of it
  (shapes, edges, shades, labels, graticule, bounds) in one memoized build.
  (plan 2026-10-18-visual-overhaul → Task 22)
  Files: [regionLookup.test.ts](./src/ui/map/geometry/regionLookup.test.ts) (3 tests),
  [boundaries.test.ts](./src/ui/map/geometry/boundaries.test.ts) (7 tests),
  [palette.geometry.test.ts](./src/ui/theme/palette.geometry.test.ts) (1 test)
- Camera math [`camera.ts`](./src/ui/map/camera.ts): world/screen transforms, `fitCamera`,
  pointer-anchored `zoomAt`, `clampCamera` (at least 25% of the world stays visible) and the
  `zoomScaleAtProgress`/`easeOutCubic` easing pair, plus the `MIN_ZOOM`/`MAX_ZOOM` range
  (0.6x-24x of the fit scale) from spec 11.3. Covered by
  [`camera.test.ts`](./src/ui/map/camera.test.ts) (9 tests).
  (plan 2026-10-18-visual-overhaul → Task 23)
- Per-state map data [`derive.ts`](./src/ui/map/derive.ts): controller fills, occupied regions against
  the pre-war baseline, front-edge indexes (`isFrontPair` = different blocs, both controllers at
  war), unit stacks with a majority/secondary country, merged order arrows plus hold unit ids, and
  the player supply overlay, all cached in a `WeakMap` keyed by `GameState` and `showSupply`.
  Covered by [`derive.test.ts`](./src/ui/map/derive.test.ts) (9 tests).
  (plan 2026-10-18-visual-overhaul → Task 24)
- Screen-space map layout under [`src/ui/map/layout/`](./src/ui/map/layout/):
  [`labels.ts`](./src/ui/map/layout/labels.ts) places label candidates greedily (forced first,
  priority, then id; normal labels drop instead of overlapping, forced ones take the least-overlap
  slot), [`counters.ts`](./src/ui/map/layout/counters.ts) sizes unit/stack counters and expands a
  stack into rows of four, [`pills.ts`](./src/ui/map/layout/pills.ts) anchors off-screen link pills
  with Liang-Barsky clipping and the 48/12/46/12 inset rect, and
  [`hitTest.ts`](./src/ui/map/layout/hitTest.ts) resolves clicks in drawing order (counters, pills,
  nearest city, region, sea). 18 tests in four files, including Review Focus 2 (CSS pixels, no DPR
  input), 3 (8 expanded units never overlap) and 4 (pills stay clear of the bars in all eight
  directions). (plan 2026-10-18-visual-overhaul → Task 25)
- Canvas map skeleton (opt-in through `http://127.0.0.1:4173/?map=new` until Task 28):
  [`MapView.tsx`](./src/ui/map/MapView.tsx) (canvas, zoom buttons with the layout-lock keys, `React.memo`),
  [`MapController.ts`](./src/ui/map/MapController.ts) (camera, 140 ms easing, drag with a 5 px threshold, wheel
  zoom anchored at the cursor, click resolution in spec order, `requestAnimationFrame` coalescing, canvas sized
  by `devicePixelRatio`, geometry built after the first paint of "Preparing map…"; it never calls React
  `setState`), [`renderFrame.ts`](./src/ui/map/render/renderFrame.ts) with the first layers
  ([`layers/base.ts`](./src/ui/map/render/layers/base.ts): sea, background land, controller-colored region
  fills, city dots), a `Path2D` cache ([`paths.ts`](./src/ui/map/render/paths.ts)) and the dev frame meter
  [`frameStats.ts`](./src/ui/map/perf/frameStats.ts) (`window.__mapStats`).
  (plan 2026-10-18-visual-overhaul → Task 26)
- Canvas map, all layers of spec 11.4 plus hover and the dev meter (Task 27; still opt-in at `?map=new` until Task 28
  switches over). Layers 1-9: sea with vignette, noise and graticule ([`sea.ts`](./src/ui/map/render/layers/sea.ts)), coast
  halo and background land ([`land.ts`](./src/ui/map/render/layers/land.ts)), controller-colored region fills with shade
  variants and occupation stripes ([`regions.ts`](./src/ui/map/render/layers/regions.ts),
  [`patterns.ts`](./src/ui/map/render/patterns.ts)), borders, the gold front line, the highlight stack and the supply
  overlay. Layers 10-16: the faint link network and the gold selection and hover links with clickable edge pills that
  slide apart along a shared edge ([`links.ts`](./src/ui/map/render/layers/links.ts)), city markers
  ([`cities.ts`](./src/ui/map/render/layers/cities.ts)), order arrows ([`arrows.ts`](./src/ui/map/render/layers/arrows.ts)),
  unit counters and stacks ([`units.ts`](./src/ui/map/render/layers/units.ts)), the DEPOT badge and deposit chips
  ([`extras.ts`](./src/ui/map/render/layers/extras.ts)), and nation names and collision-avoided city labels
  ([`labels.ts`](./src/ui/map/render/layers/labels.ts)), with the zoom thresholds of spec 11.5 in one place
  ([`lod.ts`](./src/ui/map/render/lod.ts)). [`renderFrame.ts`](./src/ui/map/render/renderFrame.ts) draws them in order and
  returns the clickable boxes. Interaction: hover is hit-tested once per frame; a DOM tooltip
  ([`tooltip.ts`](./src/ui/map/tooltip.ts), [`TooltipView.ts`](./src/ui/map/TooltipView.ts)) shows the region, its
  controller, occupation, units by side, fort and stability; F3 toggles a frame meter in dev builds
  ([`PerfMeter.ts`](./src/ui/map/perf/PerfMeter.ts)). `MapController.ts` was split so that gestures
  ([`MapPointerInput.ts`](./src/ui/map/MapPointerInput.ts)), easing ([`cameraTween.ts`](./src/ui/map/cameraTween.ts)), the
  tooltip and the meter live in their own modules (565 -> 370 lines). `derive.ts` gained `orderedUnitIds`. 103 new
  tests. **Not done in Task 27 or 28: the benchmark with real requestAnimationFrame deltas (the pane only draws while
  the Claude window is in front); see the Task 28 Verified entry.**
  (plan 2026-10-18-visual-overhaul → Task 27)
- Nation briefing logic for the start screen ([`briefing.ts`](./src/ui/screens/start/briefing.ts)):
  `getNationBriefing` reads a nation's bloc, tier, difficulty pips, opening status, capital, region
  and key-city counts, units by type and war-entry text from the game state; `getStartingStatus` and
  `getDifficulty` moved out of `LandingPage.tsx` unchanged. 4 tests.
  (plan 2026-10-18-visual-overhaul → Task 29)
- Autosave parsing ([`autosave.ts`](./src/ui/session/autosave.ts)): `AUTOSAVE_KEY` and `parseAutosave`
  validate the stored JSON (turn, playerCountryId, regions, units) before the start screen offers
  Continue; `useGameSession` writes through the same constant. 4 tests.
  (plan 2026-10-18-visual-overhaul → Task 29)
- Showcase mode on the canvas map ([`showcase.ts`](./src/ui/map/render/layers/showcase.ts)):
  `getShowcaseHighlight` marks the hovered nation's starting territory (from the scenario controllers)
  and dims every other region; the frame draws a 2 px `#f6e7b0` outline over the highlight and an
  `rgba(0,0,0,.35)` wash elsewhere, and nation labels stay on at every zoom. 2 tests.
  (plan 2026-10-18-visual-overhaul → Task 29)
- Start screen ([`StartScreen.tsx`](./src/ui/screens/start/StartScreen.tsx)): the canvas map runs in
  showcase mode as a background under a `rgba(9,11,13,.62)` overlay, with BRICS (6), Neutral (11) and
  EU NATO (7) columns of nation cards and a 300 px briefing panel (difficulty, capital, territory,
  starting forces, war entry). Hovering a card highlights that nation on the map; Start begins a new
  game, Continue loads the autosave, and Load game opens the save window before a game starts
  (`SaveLoadWindow` now renders from `App`, so it also works pre-game).
  (plan 2026-10-18-visual-overhaul → Task 29)
- Start-screen scenario summary ([`scenarioOverview.ts`](./src/ui/screens/start/scenarioOverview.ts)):
  `getScenarioOverview` counts nations, city-regions (by starting controller) and nations at war per
  bloc, so the masthead and the columns share one source of truth. 3 tests.
- Start-screen polish spec [`2026-10-19-start-screen-polish-design.md`](./docs/superpowers/specs/2026-10-19-start-screen-polish-design.md):
  records the six review changes (content-height columns, scroll fade, rail composition, key
  cities/borders, selected-map highlight, unit-symbol force counts), their rationale and the
  browser verification, so a later agent can tell what was intentional.
- Noding analysis [`2026-10-19-noding-reshuffle-analysis.md`](./docs/superpowers/specs/2026-10-19-noding-reshuffle-analysis.md):
  graph facts (103 regions, 227 edges, one component, one bridge), the generator cause of the
  redundant links, the tested 15-edit core reshuffle and the wider probe. **Analysis only: no
  adjacency was changed and no stage is approved.**

### Decision
- AI route BFS expands each destination one step even when the destination itself is enemy-held, so
  its friendly neighbours get distance 1; every region reached at distance > 0 must be legal transit.
  This keeps an enemy-held national goal as an attack terminal instead of a corridor.
  (plan 2026-10-19-ai-pathfinding → Task 2)
- Task 27 (map labels and extras), choices where the spec or plan left room (plan 2026-10-18-visual-overhaul → Task 27):
  deposit chips sit above the city marker (plan: 16 px above), not below as spec 11.4 #15 words it, because the counters
  occupy the space under the city; nation names are drawn beneath the link network, markers and counters (not on top
  at layer 16) so those stay crisp; every other city's marker counts as an obstacle for city labels, so a label never
  covers another city's dot; the nation-name anchor is computed from the part of the nation's largest region inside
  the default view ([`labelPoints.ts`](./src/ui/map/geometry/labelPoints.ts), 3 tests), because the spec's rule put
  Russia's name in Siberia, far off the default view; pills on the same screen edge slide apart.
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
- `styles.css` held no scrollbar rules and no shared `@keyframes`; the two target-pulse animations
  are map-specific, so they moved to [`TheaterMap.css`](./src/ui/TheaterMap.css) and
  [`base.css`](./src/ui/theme/base.css) holds only the resets, `body` and `button`/`select`.
  (plan 2026-10-18-visual-overhaul → Task 11)
- Spec 6.4 describes the context in groups (`session`, `selection`, `ui`, `economy`, `toasts`).
  This plan implements those groups as separate hooks but keeps the context value **flat**, so the
  JSX moved in Tasks 7-11 stays unchanged. (plan 2026-10-18-visual-overhaul → Task 12)
- Task 12 Step 4's 400-line check also lists [`diplomacy.css`](./src/ui/windows/diplomacy/diplomacy.css)
  (545 lines). It is a stylesheet, not a component or module, and Task 11 deliberately consolidated the
  diplomacy rules into that one owner file; splitting it now would be off-plan and would change CSS
  order. Task 30's file-size check will need to account for stylesheets.
  (plan 2026-10-18-visual-overhaul → Task 12)
- Every icon name in the spec exists in the installed `lucide-react`; no close-match swaps were
  needed. The gallery renders its modal `Window` in normal page flow through a gallery-scoped rule
  (`.kit-gallery__modal-flow .win-backdrop { position: static; ... }`) so both window variants are
  visible on one page; the kit itself keeps the fixed backdrop.
  (plan 2026-10-18-visual-overhaul → Task 14)
- Task 21 map-point overrides (display-only, C3): generated points that landed outside their clip
  country now sit on their named city — `berlin-brandenburg-belt` → Potsdam (13.0645, 52.3906),
  `essen-ruhr-corridor` → Duisburg (6.7623, 51.4344), `riga-north` → Daugavpils (26.535, 55.877),
  `tallinn-east` → Narva (28.05, 59.4; the exact centre falls just outside the 50m river border, so
  the point is nudged inland), `novi-sad-vojvodina` → Subotica (19.6647, 46.1003),
  `sarajevo-northern-bosnia` → Banja Luka (17.191, 44.7722), `podgorica-adriatic-gate` → Bar
  (19.0983, 42.0931), `pristina-dukagjin` → Prizren (20.741, 42.213), `tirana-durres-coast` →
  Durres (19.4565, 41.3231), `skopje-pelagonia` → Bitola (21.3347, 41.0328). Rules never read
  these. (plan 2026-10-18-visual-overhaul → Task 21)
- world-atlas omits the numeric id on the Kosovo feature, so
  [`countryShapes.ts`](./src/ui/map/geometry/countryShapes.ts) gives it the synthetic id 983 (no ISO
  collision) and finds it by `properties.name === "Kosovo"`; `CLIP_ID_BY_REGION` also pins the
  generated Baltic regions to their real countries (`riga-north` → 428, `tallinn-east` → 233)
  because the country fallback resolves `BALTIC_FEDERATION` to Lithuania's 440.
  (plan 2026-10-18-visual-overhaul → Task 21)
- Task 22 boundary probing decides inside/outside from ring winding (the exterior ring encloses on
  its winding side, a hole on the opposite side) instead of a `pointInMultiPolygon` call per probe.
  It is equivalent for valid polygons and cut the edge walk from ~1.4 s to ~34 ms; degenerate
  zero-area rings fall back to point-in-polygon. [`regionLookup.ts`](./src/ui/map/geometry/regionLookup.ts)
  likewise uses latitude-banded even-odd indexes: equivalence to `pointInMultiPolygon` was checked
  on 4000 deterministic random points over the whole theatre with 0 mismatches for both `regionAt`
  and `landAt`. (plan 2026-10-18-visual-overhaul → Task 22)
- Sorted greedy shade coloring left Voronezh sharing variant 0 with Bryansk (its neighbors already
  used all four variants), which would fail the plan's own "neighbors differ" test. `computeShadeVariants`
  now falls back to DSATUR-ordered backtracking, which finds a conflict-free four-coloring (105
  steps on the shipped map) before ever giving up. (plan 2026-10-18-visual-overhaul → Task 22)
- `buildMapGeometry` measures ~563-610 ms in Node/Vitest (shapes ~146 ms, region shapes ~344 ms,
  edges ~34 ms, labels ~43 ms), above the spec's ≤300 ms browser budget. The budget check belongs
  to Task 26, where the build is timed in the browser; the 4-color fallback and label sampling are
  the likely levers if it misses. (plan 2026-10-18-visual-overhaul → Task 22)

- **Geometry build time (spec 11.2 budget: 300 ms).** The cold `buildMapGeometry` took 560-610 ms in Node and
  about 1,500 ms in the hidden dev browser. Profiling found Russia (17 regions against a 7,300-vertex, 101-part
  country polygon) at 366 of the 428 ms of clipping, and string-keyed ring checks in `nestRings`. Changes, none
  of which alters the result: each cell is clipped only against the parts of its country near it, with
  Sutherland-Hodgman cut to the cell's box ([`regionShapes.ts`](./src/ui/map/geometry/regionShapes.ts); a test
  compares every Russian region's area with the plain intersection); world-atlas features outside the clip window
  are skipped before projection ([`countryShapes.ts`](./src/ui/map/geometry/countryShapes.ts); a test compares the
  ids and areas with the unfiltered run); `nestRings` no longer builds a string set per point and prefilters
  holes by box ([`polygon.ts`](./src/ui/map/geometry/polygon.ts)); the nation label sampler scores a thinned
  copy of long rings ([`labelPoints.ts`](./src/ui/map/geometry/labelPoints.ts), tested in
  `labelPoints.test.ts`). Result: ~270 ms cold in Node (three runs: 271, 267, 274) and 188-230 ms in the
  unthrottled dev browser (headless Chrome with `document.visibilityState === "visible"`, 1440x900, three
  page loads; the earlier ~600-710 ms came from a hidden pane, where background throttling inflates the
  build). Both are within the 300 ms budget; the production build draws the first map frame within ~115 ms of
  pressing Start. (plan 2026-10-18-visual-overhaul → Task 26)
- **Benchmark run headless (Task 30).** The visible-window run still cannot be made from this
  environment: `pan-zoom-bench.js` needs the Claude window in front for about a minute, a hidden pane
  returns `{ error }`, and a stand-in `requestAnimationFrame` measures no presentation at all. The C2
  numbers were therefore taken in a GPU-enabled headless Chrome, where real frames arrive at 120 Hz,
  and the same environment was used for the legacy build, so the comparison is like-for-like; the
  absolute budget check (`average <= idle + 1 ms`, provisional for 120 Hz) stays open for Marek's
  visible-window run. Cost if wrong: the recorded table is a relative result, not a pass/fail at 8 ms.
  (plan 2026-10-18-visual-overhaul → Task 30)
- **Start-screen short-height policy:** hide the theatre panel below 900 px of viewport height
  instead of letting the right rail scroll. The clipped panel was the defect; its 35/25/43 bloc
  totals are already in the three column footers, and hiding it keeps the briefing's actions
  fully visible at 1335x747. Cost if wrong: a purely informational overview is lost on short
  screens, with no action affected.
  (2026-10-19-start-screen-polish-design.md)

### Changed
- [`orderResolution.ts`](./src/game/rules/orderResolution.ts): extracted the country-level transit
  predicate as exported `isRegionOpenForCountryTransit` with an `ignoreStacking` option;
  `isRegionOpenForTransit` delegates to it. Pure refactor, no unit movement change.
  (plan 2026-10-19-ai-pathfinding → Task 2)
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
- Task 9 moved the bottom-tab panels out of [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx) in two steps.
  First the `.float-panel*`, `.panel-grid`, `.panel-card`, `.war-dot` and `.region-strip` rules
  ([`FloatPanel.css`](./src/ui/panels/FloatPanel.css), 190 lines) and the `.economy-*`, `.deposit-*`,
  `.facility-item*`/`.facility-list`, `.build-*` and `.capture-*` rules
  ([`EconomyPanels.css`](./src/ui/panels/EconomyPanels.css), 262 lines) moved verbatim out of
  [`styles.css`](./src/ui/styles.css) (445 lines; a chunk-level check against git found nothing lost or added).
  Then the seven IIFE blocks (465 lines) became the component calls listed above, and `GameScreen.tsx` dropped
  the imports and `useGame()` names that only the panels used; each panel imports the CSS it needs. The JSX
  moved verbatim — a line-by-line comparison against the previous commit found no differences apart from
  indentation and the new `data-layout` attributes.
  (plan 2026-10-18-visual-overhaul → Task 9)
- Task 10 moved the four map-side windows out of [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx)
  (1,023 → 651 lines) and the `.unit-drawer*`, `.unit-card*`, `.global-units-panel*`, `.global-unit-row*`,
  `.stockpile-*` and `.facility-popup*` rules into the five component CSS files (588 lines);
  [`styles.css`](./src/ui/styles.css) is down 601 lines to 1,267. The JSX moved verbatim — a normalized
  comparison of all five blocks against the removed code found no differences apart from indentation and
  the new `data-layout` attributes. `FacilityPopup` is 211 lines, below the 400-line split threshold, so
  the planned production/recruit split was not needed. (plan 2026-10-18-visual-overhaul → Task 10)
- Task 11 retired [`styles.css`](./src/ui/styles.css): its 1,267 lines moved verbatim into
  [`theme/base.css`](./src/ui/theme/base.css) (32), [`LandingPage.css`](./src/ui/LandingPage.css) (197),
  [`TheaterMap.css`](./src/ui/TheaterMap.css) (216), [`diplomacy.css`](./src/ui/windows/diplomacy/diplomacy.css)
  (528), [`EconomyLogicMap.css`](./src/ui/windows/EconomyLogicMap.css) (123) and
  [`SaveLoadWindow.css`](./src/ui/windows/SaveLoadWindow.css) (164), each imported by its owner;
  [`main.tsx`](./src/app/main.tsx) now imports `theme/base.css`. `GameScreen.tsx` fell from 651 to
  102 lines and only composes components. The inline styles of the defeat notice, battle report,
  victory overlay and doctrine window became classes in [`windows.css`](./src/ui/windows/windows.css),
  and the diplomacy panel's inline placement became `.diplomacy-window` with the specified
  `top: 52px; bottom: auto; left: 50%; transform: translateX(-50%)`, `min(1380px, calc(100vw - 20px))`,
  `max-width: 1380px`, `min-width: 980px`, `z-index: 42`, `max-height: 84vh` and a 80vh body.
  [`EconomyLogicMap.tsx`](./src/ui/windows/EconomyLogicMap.tsx) moved into `windows/`.
  (plan 2026-10-18-visual-overhaul → Task 11)
- [`useGameController.ts`](./src/ui/session/useGameController.ts) (716 lines) is deleted; its state,
  derived values and handlers moved verbatim into the seven hooks, and
  [`GameProvider.tsx`](./src/ui/session/GameProvider.tsx) now composes them (useToasts → useUiState →
  useGameSession → useSelection → useEconomyActions → useDiplomacy → useSaveSlots), defines
  `loadStateFromSave` (old App 419-436 plus `setGameStarted(true)`, so loading works from the start
  screen) and `handleStartGame` (old App 1201-1219), and spreads the hooks into the same flat
  `GameContextValue`. The three forward references (the toast getter reading the session turn,
  `clearSelection` used by the turn handlers, `onLoad` used by the save slots) are deferred closures
  that only run from events after initialization. No component changed.
  (plan 2026-10-18-visual-overhaul → Task 12)
- [`base.css`](./src/ui/theme/base.css) now takes its page background (`--bg-app`), text color and
  body font from the tokens and styles scrollbars with `--line-strong` / `--surface-inset`; it adds
  the `.tabular` utility. [`main.tsx`](./src/app/main.tsx) imports the bundled Oswald (400/500/600)
  and Inter (400/500/600) faces before `tokens.css` and `base.css`. Dependencies added:
  `@fontsource/oswald`, `@fontsource/inter` and `lucide-react` (used from Task 14).
  (plan 2026-10-18-visual-overhaul → Task 13)
- [`App.tsx`](./src/app/App.tsx) renders `KitGallery` when the URL has `?kit` in dev; the normal
  screen and its providers are unchanged. Added [`vite-env.d.ts`](./src/vite-env.d.ts) so the type
  check knows `import.meta.env`.
  (plan 2026-10-18-visual-overhaul → Task 14)
- HUD restyled in style C: [`TopBar`](./src/ui/hud/TopBar.tsx) is a `#14181c` band with a gold
  hairline, dim labels with Oswald values, a nation `Flag`, kit buttons (primary End Turn, icon
  secondary Diplomacy/Doctrines, ghost icon Save/Load) and an inset select;
  [`BottomBar`](./src/ui/hud/BottomBar.tsx) shows the spec 7.3 icon plus label per tab with a 2 px
  gold underline on the active tab; [`SupplyToggle`](./src/ui/hud/SupplyToggle.tsx) is a `Network`
  pill that fills gold when on; [`ToastStack`](./src/ui/hud/ToastStack.tsx) uses `--surface-1`
  cards with a 3 px tone edge and a tone icon; the map buttons in
  [`TheaterMap.css`](./src/ui/TheaterMap.css) are 30 px squares. The Recruitment tab label lost its
  emoji (spec 7.3 removes emoji) and kit `Button` labels no longer wrap, which the dense top bar
  needs. All positioning, order and behavior are unchanged.
  (plan 2026-10-18-visual-overhaul → Task 15)
- Bottom-tab panels restyled in style C: all seven use the kit `Window` (positioning classes kept,
  `panel-*` layout probes) in [`panels/`](./src/ui/panels/). The Region panel gets a controller row
  (`Flag`, name, bloc `Badge`), toned stability and deposits drawn with `ResourceIcon` + `Pips`;
  Economy and Recruitment rows use the `FACILITY_META` icon, `Lv.n`, tone `Badge`s and right-aligned
  Demolish, build options are kit `Button`s and queues use `ProgressBar`; Orders chips pair a
  `UnitSymbol` with the order type and route; War Status cards show a `Flag` + status `Badge`; AI
  Intel and Event Log use `--surface-2` cards. [`FloatPanel.css`](./src/ui/panels/FloatPanel.css)
  now holds only the frozen positioning plus the card/chip styles (legacy shell kept for the
  Diplomacy and Save/Load windows until their tasks), and
  [`EconomyPanels.css`](./src/ui/panels/EconomyPanels.css) drops the unused stat, capture and old
  queue-bar rules. No control moved or changed behavior.
  (plan 2026-10-18-visual-overhaul → Task 16)
- Unit drawer and map-side pop-ups restyled in style C: [`UnitCard`](./src/ui/windows/UnitCard.tsx)
  now shows a `UnitSymbol`, a 3 px nation-color edge, a strength `ProgressBar` toned at 66%/33% of
  the type maximum, and `Badge`s for supply, veterancy, entrenchment, Ally and Enemy; the order
  chip and the Hold/Replenish/Cancel buttons are unchanged. [`UnitDrawer`](./src/ui/windows/UnitDrawer.tsx)
  gained a gold Oswald toggle label with a chevron. The all-units panel
  ([`GlobalUnitsPanel`](./src/ui/windows/GlobalUnitsPanel.tsx)) uses the same unit line with a
  strength bar and stat badges, [`StockpilePopup`](./src/ui/windows/StockpilePopup.tsx) groups its
  19 resources into four `ResourceAmount` sections behind a secondary Logic Map button (the weed
  line keeps its text), and [`FacilityPopup`](./src/ui/windows/FacilityPopup.tsx) is a
  `Window variant="popup"` whose production rows use `ResourceIcon` and whose recruit/upgrade/repair
  `Button`s keep every original `title`. All frozen geometry is unchanged.
  (plan 2026-10-18-visual-overhaul → Task 17)
- Modal windows restyled in style C: [`DiplomacyWindow`](./src/ui/windows/diplomacy/DiplomacyWindow.tsx)
  is a `Window variant="panel"` at its old 1380 px / top 52 box with counted `Tabs`, a `Flag` and
  `Badge` on every country card, and kit action tiles whose costs read as `ResourceAmount`s (every
  support-bar marker kept); [`DoctrineWindow`](./src/ui/windows/DoctrineWindow.tsx),
  [`SaveLoadWindow`](./src/ui/windows/SaveLoadWindow.tsx), [`DefeatNotice`](./src/ui/windows/DefeatNotice.tsx)
  and [`VictoryOverlay`](./src/ui/windows/VictoryOverlay.tsx) are kit modals with their old width,
  z-order (200 / 210 / 80 / 150) and texts, plus the defeated nation's flag and the player's flag;
  [`EconomyLogicMap`](./src/ui/windows/EconomyLogicMap.tsx) replaces all emoji with
  `ResourceIcon`/`FACILITY_META`/`UnitSymbol` icons. [`Window`](./src/ui/kit/Window.tsx) gains an
  optional `backdropClassName`, and [`FloatPanel.css`](./src/ui/panels/FloatPanel.css) drops the last
  legacy `.float-panel` shell. No control moved or changed behavior.
  (plan 2026-10-18-visual-overhaul → Task 18)
- Grouped turn report replaces the flat battle report: [`parseTurnReport.ts`](./src/ui/windows/turnReport/parseTurnReport.ts)
  segments the end-of-turn log by nation and world event, categorizes and tones each line, merges
  supply attrition per region and moves per nation, turns unit ids into readable names, and orders
  sections WORLD, you, allies, enemies, neutrals; [`TurnReportWindow`](./src/ui/windows/turnReport/TurnReportWindow.tsx)
  renders it as a 720 px kit modal (`z 90`) with summary chips, flags, relation badges, category
  icons and expandable move rows. `handleAdvanceTurn` stores the log diff with the states before and
  after, the Orders panel keeps its last-turn list from the same data, and `BattleReportWindow` and
  its CSS are deleted. (plan 2026-10-18-visual-overhaul → Task 19)
  Files: [useGameSession.ts](./src/ui/session/useGameSession.ts),
  [GameProvider.tsx](./src/ui/session/GameProvider.tsx),
  [GameScreen.tsx](./src/ui/screens/game/GameScreen.tsx),
  [TurnReportWindow.css](./src/ui/windows/turnReport/TurnReportWindow.css),
  [parseTurnReport.test.ts](./src/ui/windows/turnReport/parseTurnReport.test.ts) (10 tests),
  [fixtures.ts](./src/ui/windows/turnReport/fixtures.ts), [windows.css](./src/ui/windows/windows.css)
- The `.map-controls` and `.map-control-button` rules moved from [`TheaterMap.css`](./src/ui/TheaterMap.css) into
  [`MapView.css`](./src/ui/map/MapView.css) (the legacy `TheaterMap.tsx` imports it until Task 28);
  [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx) renders `MapView` instead of `TheaterMap` when the URL
  has `?map=new`. (plan 2026-10-18-visual-overhaul → Task 26)

- The game now draws the canvas map by default: [`GameScreen.tsx`](./src/ui/screens/game/GameScreen.tsx) always renders
  [`MapView`](./src/ui/map/MapView.tsx), passing the selected unit ids, the move and attack target lists and stable
  callbacks ([`useStableCallback.ts`](./src/ui/session/useStableCallback.ts)); `MapView` is `React.memo` with a props
  comparator ([`mapViewProps.ts`](./src/ui/map/mapViewProps.ts), 6 tests) so re-renders caused by anything but the map's own
  inputs do not redraw it. The `?map=new` switch is gone. (plan 2026-10-18-visual-overhaul → Task 28)
- [`diplomacy.css`](./src/ui/windows/diplomacy/diplomacy.css) was 427 lines, over the ~400-line signal; the
  action-tile rules moved verbatim to [`diplomacy-actions.css`](./src/ui/windows/diplomacy/diplomacy-actions.css),
  imported next to it from [`DiplomacyWindow.tsx`](./src/ui/windows/diplomacy/DiplomacyWindow.tsx). The
  styleprint is IDENTICAL (17 states, 6234 elements) and the layout lock passes at both sizes.
  (plan 2026-10-18-visual-overhaul → Task 30)
- Start screen redesigned for legibility and game feel while keeping its three-column structure: the
  masthead now carries the scenario summary (24 nations, 103 city-regions, 8 at war) from
  [`scenarioOverview.ts`](./src/ui/screens/start/scenarioOverview.ts); each bloc column has a
  bloc-coloured top rule and a footer with its region and at-war counts; the right rail stacks the
  gold-accented campaign briefing over a new starting-control panel with a bloc share bar; the
  briefing is content-height (the actions no longer sit below a large void), has a "Campaign
  briefing" kicker, bloc and difficulty badges, a stacked starting-forces row and war-entry details
  naming the enemy bloc, its belligerent count and its majors; the selected nation card uses a gold
  edge and gradient; cards trade the unlabelled difficulty pips for tier + region counts, reserves
  use the amber "will join" tone, and the Continue button is labelled as the autosave; Neutral
  statuses lost their repeated grey pill; and the showcase map is calmer (lower saturation and
  brightness) under a masthead scrim.
  Files: [StartScreen.tsx](./src/ui/screens/start/StartScreen.tsx),
  [StartScreen.css](./src/ui/screens/start/StartScreen.css),
  [BriefingPanel.tsx](./src/ui/screens/start/BriefingPanel.tsx),
  [BriefingPanel.css](./src/ui/screens/start/BriefingPanel.css),
  [NationColumn.tsx](./src/ui/screens/start/NationColumn.tsx),
  [NationCard.tsx](./src/ui/screens/start/NationCard.tsx),
  [TheatrePanel.tsx](./src/ui/screens/start/TheatrePanel.tsx),
  [TheatrePanel.css](./src/ui/screens/start/TheatrePanel.css)
- Shared kit support for the start screen: [`tokens.css`](./src/ui/theme/tokens.css) gains the
  `--fs-4xl` (40 px) display step, [`Button`](./src/ui/kit/Button.tsx) gains an `lg` size, and
  [`StatRow`](./src/ui/kit/StatRow.tsx) accepts a `className` for the stacked starting-forces row.
  Briefing styles moved out of `StartScreen.css` (424 lines) into
  [`BriefingPanel.css`](./src/ui/screens/start/BriefingPanel.css), keeping both files well under the
  400-line signal.
- Start-screen briefing now names the nation's key cities and lists every bordering country as a
  bloc-toned chip, with a red ring on at-war borders. Borders come from the scenario's starting
  controllers and are sorted at-war first, so they describe the start of the campaign, not later
  occupations. Starting forces render as `UnitSymbol` icons with counts instead of a sentence.
  (2026-10-19-start-screen-polish-design.md)
  Files: [briefing.ts](./src/ui/screens/start/briefing.ts),
  [BriefingPanel.tsx](./src/ui/screens/start/BriefingPanel.tsx),
  [BriefingPanel.css](./src/ui/screens/start/BriefingPanel.css),
  [briefing.test.ts](./src/ui/screens/start/briefing.test.ts) (4 tests)
- Start-screen columns size to their content instead of stretching to the tallest column; the
  Neutral column gets a gradient scroll fade while more cards remain. The right rail uses
  `space-between` so the theatre panel sits on the bottom edge on tall screens. The selected
  nation's showcase highlight gets a stronger dim, a cream fill and a `2.5 / scale` outline.
  `selectedBriefing` is memoized so hovering does not rebuild every briefing.
  (2026-10-19-start-screen-polish-design.md)
  Files: [StartScreen.css](./src/ui/screens/start/StartScreen.css),
  [StartScreen.tsx](./src/ui/screens/start/StartScreen.tsx),
  [NationColumn.tsx](./src/ui/screens/start/NationColumn.tsx),
  [TheatrePanel.css](./src/ui/screens/start/TheatrePanel.css),
  [showcase.ts](./src/ui/map/render/layers/showcase.ts)

### Fixed
- `npm run check-war-entry` expected one lost Polish key city for the Czech Republic to join, but the
  shipped rule (unchanged since the original game) needs Poland's capital or two key cities, so the
  check was red on `legacy` and `main`. The check now tests one city (no entry), two (entry) and the
  capital (entry), and `docs/v1-design.md` says two. No rule or game code changed.
  (housekeeping, found during the C3 rules-unchanged check)
- Turn report relations: [`parseTurnReport.ts`](./src/ui/windows/turnReport/parseTurnReport.ts) treated the
  `NEUTRAL` bloc as a bloc of its own, so for a BRICS player every neutral nation (Austria, Serbia, ...) was
  tagged "enemy", for a neutral player other neutrals were tagged "ally", and a capture by a neutral nation
  could score "good". Only BRICS and EU NATO now count as blocs (plan Task 19: "same non-neutral bloc →
  ally, both in different non-neutral blocs → enemy, otherwise neutral"). Three new tests in
  [`parseTurnReport.test.ts`](./src/ui/windows/turnReport/parseTurnReport.test.ts) failed first.
  (plan 2026-10-18-visual-overhaul → Task 19, found in the review of Tasks 9-25)

- `vite build` failed as soon as the map code was imported by the app: `polygon-clipping`'s ESM build only has a
  default export, so `import { intersection }` worked in Node and Vitest but not in the production bundle.
  [`clipping.ts`](./src/ui/map/geometry/clipping.ts) reads the default export first (typed named exports as
  fallback) and [`regionShapes.ts`](./src/ui/map/geometry/regionShapes.ts) imports it from there; the production
  build renders the map. (plan 2026-10-18-visual-overhaul → Task 26, found when the map was first imported)
- The default view was fitted to the bounding boxes of the region polygons, which run across all of Russia, so the
  theatre showed as a small patch; `regionBounds` in
  [`buildMapGeometry.ts`](./src/ui/map/geometry/buildMapGeometry.ts) now bounds the region POINTS (spec 11.3),
  guarded by [`buildMapGeometry.test.ts`](./src/ui/map/geometry/buildMapGeometry.test.ts) (failed first).
  (plan 2026-10-18-visual-overhaul → Task 26)

### Removed
- Dead code from the old map and the un-restyled CSS: the seven alias custom properties in
  [`tokens.css`](./src/ui/theme/tokens.css) (zero `var(--...)` uses) and the unused
  `handleSelectFacilityFromMap` in [`useSelection.ts`](./src/ui/session/useSelection.ts), together with the
  three setters only it consumed. The 12 remaining `style={{...}}` hits in `src/` are all runtime values
  (sizes, percentages, `--unit-color`). (plan 2026-10-18-visual-overhaul → Task 30)
- The old landing page: `src/ui/LandingPage.tsx` and `LandingPage.css`, replaced by the start screen;
  the `landingNations` list in `useGameSession` went with it. The `.nation-card` class is kept in
  `StartScreen.css` for the parity tooling. (plan 2026-10-18-visual-overhaul → Task 29)
- The SVG map: `src/ui/TheaterMap.tsx` (1206 lines) and `src/ui/TheaterMap.css`. Its `onSelectFacility` prop was declared
  but never called, so no behavior is lost with it. (plan 2026-10-18-visual-overhaul → Task 28)

### Verified
- AI pathfinding groundwork (Tasks 1–2): `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm test -- --run` 341/341 in 44 files, `npm run smoke` passed for RUSSIA, ROMANIA and AUSTRIA,
  `npm run balance-check` passed for all 24 nations. No AI behavior changed.
  (plan 2026-10-19-ai-pathfinding → Tasks 1–2)
- Task 29 start screen, checked in headless Chrome at 1440x900 and 1920x1080: 24 cards in columns of
  6/11/7, Start as Russia enters the game, hovering Austria switches the showcase highlight, End Turn
  writes the autosave, reloading shows "Continue · Russia, turn 2" (resumes on turn 2), and Load game
  opens the save window from the start screen and loads the saved slot. Layout lock PASS at both sizes;
  `npm run smoke`, `npm run balance-check`, `npm run check:layers` and `npm run validate-map` pass.
  (plan 2026-10-18-visual-overhaul → Task 29)
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
- Task 9: `npm test` 88/88, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`,
  `npm run check:layers`, `npm run smoke` and `npm run balance-check` ("Balance check passed") all pass.
  Layout lock PASS at 1440x900 (20 probes, `missing: []`). The extraction was also checked mechanically: the
  seven extracted JSX bodies match the removed blocks line for line. A headless-Chrome walk-through started as
  Russia, selected a Moscow infantry (9 move targets), ordered a move to Saint Petersburg (toast shown, Orders
  panel showed the order and its cancel cleared it), pressed End Turn (turn 2, battle report opened and
  dismissed), and opened all seven tabs with their expected headers and no console errors (only the
  pre-existing `favicon.ico` 404). (plan 2026-10-18-visual-overhaul → Task 9)
- Task 10: `npm test` 88/88, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`
  (CSS 38.79 kB / JS 1,209.67 kB) and `npm run check:layers` pass. Layout lock PASS at 1440x900
  (20 probes, `missing: []`). A headless-Chrome walk-through opened the unit drawer and toggled it,
  listed 9 units in the all-units panel and selected Smolensk from it, clicked Replenish on the Smolensk
  bomber (button showed the `1ste+1fue+1tun` cost and the toast said `Requires a airFactory in Smolensk`),
  opened the stockpile pop-up (19 items, Logic Map button) and a Moscow facility pop-up (`powerPlant —
  Lv.1`), closing both; the only console error was the pre-existing `favicon.ico` 404.
  (plan 2026-10-18-visual-overhaul → Task 10)
- Task 11: `npm test` 88/88, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`
  (CSS 44.54 kB / JS 1,207.15 kB) and `npm run check:layers` pass. Layout lock PASS at 1440x900 and
  1920x1080 (20 probes, `missing: []` at both sizes). A headless-Chrome walk-through opened Diplomacy
  (Neutral tab: 11 cards, 3 of 5 action tiles enabled; one action left the "already used a diplomacy
  action" note and no enabled tiles), opened Doctrines (after Auto x6, 22 TP; bought Infantry Drill for
  20 TP → 1 owned and the toast `Doctrine unlocked: Infantry Drill`), saved and loaded a slot
  (`Saved to slot: verify-task11`, `Loaded slot: verify-task11`), opened the logic map from the
  stockpile pop-up (5 flows, 45 nodes) and closed it through `logic-map-backdrop`, and ended the turn
  (1 → 2) with the battle report showing 42 events and dismissing cleanly. A fresh load with a cleared
  cache requests only the new CSS files and fails only on the pre-existing `favicon.ico` 404.
  (plan 2026-10-18-visual-overhaul → Task 11)
- Task 12: `npm test` 93/93 (5 new in `saveSlots.test.ts`), `npx tsc -p tsconfig.app.json --noEmit`
  0 errors, `npm run build` OK (252 modules; CSS 44.54 kB, JS 1,208.55 kB), `npm run check:layers`
  "Layering: PASS", `npm run smoke` and `npm run balance-check` ("Balance check passed") all pass.
  Layout lock PASS at 1440x900 and 1920x1080 (20 probes, `missing: []` at both sizes). A
  headless-Chrome pass covered the full manual list: start, save slot `task12-check`, End Turn
  (1 → 2, 42-event report), load restores turn 1, a raw-`GameState` slot under
  `mapgame_slot_legacy-check` shows "- Legacy Slot" and loads, the legacy quick save loads, Auto x6
  reaches turn 7 (22 TP), a diplomacy action shows the "already used" note, a doctrine purchase
  (Infantry Drill, 20 TP) succeeds, a mine build queues (2 turns), and End Turn reaches turn 8
  (47-event report) with no console errors. The Step 4 size check lists only `TheaterMap.tsx` (1,205
  lines, deleted in Task 28) and `diplomacy.css` (545; see Decision).
  (plan 2026-10-18-visual-overhaul → Task 12)
- Task 13: `npm test` 95/95 (2 new palette tests), `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build` OK (CSS 63.06 kB, JS 1,208.55 kB, font assets emitted), layout lock PASS at
  1440x900 and 1920x1080 (20 probes, `missing: []` at both sizes). In the browser the body computes
  `font-family: Inter, "Segoe UI", sans-serif` and `background: rgb(14, 17, 20)` (`#0e1114`); the
  Oswald and Inter faces are registered and load on use (Inter on the page, Oswald when an element
  first uses it). Typography per element is applied in Tasks 15-18.
  (plan 2026-10-18-visual-overhaul → Task 13)
- Task 14: `npm test` 99/99 (4 new kit tests), `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build` OK. `http://127.0.0.1:4173/?kit` renders 24 flags, 7 unit symbols, 19 resources,
  8 buttons, 8 badges, 6 stat rows, 4 progress bars, 2 pips groups, a tab strip, and the panel and
  modal windows, with the title in Oswald and no console errors. The normal game still loads and
  the layout lock passes at 1440x900 after the `App.tsx` change.
  (plan 2026-10-18-visual-overhaul → Task 14)
- Task 15: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build` OK (CSS 70.64 kB).
  Layout lock PASS at 1440x900 and 1920x1080 (20 probes, `missing: []`); the top bar is 36 px and
  the bottom bar 33 px at both sizes, and the eight tabs keep their order and rows. In the browser:
  top bar `rgb(20,24,28)` with a 1 px gold bottom border; 8 tabs each with one icon; supply toggle
  centerX at the viewport centre and top 50, `rgb(212,165,55)` fill with `rgb(29,22,6)` text when
  on; map buttons 30x30; toasts 3 px tone edges and tone icons; no console errors.
  (plan 2026-10-18-visual-overhaul → Task 15)
- Task 16: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 99/99,
  `npm run build` OK (CSS 71.94 kB), `npm run check:layers` "Layering: PASS". Layout lock PASS at
  1440x900 and 1920x1080 (20 probes, `missing: []`). In headless Chrome each of the seven tabs was
  opened and screenshotted at 1440x900: every panel is bottom-anchored at 862, the wide panels are
  720 px, no panel overflows horizontally, and there are no console errors. A real hold order
  produced one chip (16 px `UnitSymbol`, `--surface-2` fill, `--line` border) whose cancel cleared
  it, and the facility rows right-align `Lv.n` and Demolish after the layout fix.
  (plan 2026-10-18-visual-overhaul → Task 16)
- Task 17: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 99/99, `npm run build`
  OK (CSS 69.63 kB). Layout lock PASS at 1440x900 and 1920x1080 (20 probes, `missing: []`). In
  headless Chrome at 1440x900 the drawer sits at right 12 / bottom 867 / width 220 with cards
  showing symbols, badges and strength bars; the all-units panel spans left 0 / top 36 / bottom 900 /
  width 240 with 9 unit rows; the stockpile is 501 px wide, centered at centerX 720, bottom 862,
  with 4 sections and 19 `ResourceAmount`s; the facility pop-up is centered, bottom 862, has no
  horizontal overflow and keeps its upgrade title; no console errors.
  (plan 2026-10-18-visual-overhaul → Task 17)
- Task 18: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 99/99, `npm run build`
  OK (CSS 65.97 kB). Layout lock PASS at 1440x900 and 1920x1080 (20 probes, `missing: []`). In
  headless Chrome at 1440x900 the diplomacy panel keeps its 1380 px / top 52 box (11 neutral cards,
  3 counted tabs, 5 action tiles), doctrines 680 px in two columns with 18 cards, save/load 980 px
  (`z 210`), the logic map 800 px (`z 10000`; 5 flows, 28 resource icons, 3 unit symbols, no emoji),
  the defeat notice 540 px (`z 80`, Romania's flag) and a crafted save forced the victory overlay
  520 px (`z 150`, Russia's flag); no console errors.
  (plan 2026-10-18-visual-overhaul → Task 18)
- Task 19: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 109/109 (10 new parser tests),
  `npm run build` OK (CSS 66.84 kB, JS 1,243.86 kB), `npm run check:layers` "Layering: PASS",
  `npm run smoke` and `npm run balance-check` ("Balance check passed") pass. Layout lock PASS at
  1440x900 and 1920x1080 (20 probes, `missing: []`). In headless Chrome at 1440x900 End Turn opened
  "Turn 1 report" at 720x738 (`z 90`) with 4 battles / 0 captures / 24 moves, 7 nation sections,
  14 rows with 14 category icons, 6 expandable move rows and the first child "armor moved from
  Mariupol to Tokmak."; Dismiss closed it, the Orders tab kept 8 events, a second End Turn titled the
  report "Turn 2 report" and a backdrop click closed it. Every bottom panel, the all-units panel,
  diplomacy, doctrines and save/load were screenshotted with no console errors.
  (plan 2026-10-18-visual-overhaul → Task 19)
- Task 20: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 119/119 (10 new geometry
  tests), `npm run build` OK. The shape suite clipped every world-atlas feature to `WORLD_CLIP`:
  all 23 theatre numeric ids map to their scenario country, Russia's bbox stays inside the clip,
  all coordinates are finite, Warsaw falls inside Poland and Italy inside a background shape with
  `countryId: null`. (plan 2026-10-18-visual-overhaul → Task 20)
- Task 21: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 124/124 (5 new region-shape
  tests), `npm run build` OK (CSS 66.84 kB, JS 1,243.86 kB), `npm run check:layers` "Layering:
  PASS", `npm run smoke` and `npm run balance-check` ("Balance check passed") pass. The builder
  returns a positive-area polygon for all 103 runtime regions, no city point falls outside its own
  polygon, no shape needs the bbox fallback, and every clip group sums to its country area within
  1%. (plan 2026-10-18-visual-overhaul → Task 21)
- Task 22: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 135/135 (11 new tests),
  `npm run build` OK (CSS 66.84 kB, JS 1,243.86 kB), `npm run check:layers` "Layering: PASS".
  The lookup returns the right region at every city point (Baltic Sea → `sea`, Italy → `foreign`);
  neighbor sets are symmetric, every region has a neighbor or coast edge, Pridnestrovie touches
  Chisinau, Gdansk has a coast edge, every edge holds ≥2 points, no same-controller neighbors share
  a shade variant, all 24 nation labels sit inside one of that nation's starting regions, and every
  geometrically adjacent pair of starting controllers has `rgbDistance ≥ 40`.
  (plan 2026-10-18-visual-overhaul → Task 22)
- Task 23: `npm test` 144/144 (9 new camera tests), `npx tsc -p tsconfig.app.json --noEmit`
  0 errors, `npm run build` OK. The transform round-trips within 1e-9, zooming holds the anchor
  point within 1e-6 and clamps to the given range, fitting centers the bounds with padding,
  clamping restores at least a quarter of the world from every direction, and the zoom easing hits
  its endpoints while staying monotonic. (plan 2026-10-18-visual-overhaul → Task 23)
- Task 24: `npm test` 153/153 (9 new derive tests), `npx tsc -p tsconfig.app.json --noEmit`
  0 errors, `npm run build` OK. No region starts occupied; capturing Lublin makes it occupied by
  POLAND and paints it with Russia's color; all front edges join different blocs whose controllers
  are at war; Belarus never appears on a turn-1 front edge while Novorossia and Ukraine do meet on
  one; stacks report Russia/Belarus majority and secondary; two orders merge into one count-2 arrow
  and a hold lands in `holdUnitIds`; supply is null without the overlay and reaches the capital
  with it; repeated calls return the cached object.
  (plan 2026-10-18-visual-overhaul → Task 24)
- Task 25: `npm test` 171/171 (18 new layout tests), `npx tsc -p tsconfig.app.json --noEmit`
  0 errors, `npm run build` OK. Placed labels never overlap; blocked forced labels still appear;
  priority claims the preferred side. Counters are 30x18 CSS px at z = 1 (city at 100,100 → box at
  85,107), 30x1.35 at z = 4, and 8 expanded units form two non-overlapping rows. Pill anchors land
  inside `[12,1428] × [48,854]` in all eight directions and are null for on-screen targets. A
  counter beats a city within 9 px, pills beat regions, and empty sea returns `sea`.
  (plan 2026-10-18-visual-overhaul → Task 25)
- Task 26: `npm test` 182/182, `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run build`,
  `npm run check:layers`, `npm run smoke` and `npm run balance-check` pass. A browser check of the canvas map at
  `?map=new` (dev build, 18 steps, run with a MessageChannel stand-in for `requestAnimationFrame` because the pane
  is hidden) passed: the default view is the fit (z = 1); wheel zoom anchors at the cursor (drift < 1.5 px) and stops
  at 24x and 0.6x; +, - and Reset behave (1.6x steps, Reset back to the fit); a move under 5 px does not pan and a
  drag does; clicking the map selects a region (the Region panel follows); `window.__mapStats.renders` stayed
  constant over the zooms, 40 drag moves and the button presses. The production build was served and drew the
  expected region colors. A script-only run of `pan-zoom-bench.js` on the canvas map (stand-in `requestAnimationFrame`,
  1920x1080, three runs) gave average 5.9-6.5 ms, p95 15.8-18.2 ms and `mapRenders: 0`, against ~45 ms average on the
  SVG map in the same mode. This is NOT a C2 measurement (hidden pane, no paint); real numbers need the pane visible.
  (plan 2026-10-18-visual-overhaul → Task 26)
- Task 27 (layers 10-16, tooltip, hover, F3, controller split): `npm test` 285/285, `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build`. Browser checks of the canvas map at `?map=new` (dev build, MessageChannel stand-in for
  `requestAnimationFrame`; canvas screenshots saved through a helper): at z 1 the link network, capital stars,
  forced gold labels for the selection and its links, nation names (Russia's inside the view) and capital labels
  show; at z 2.6 every city is labeled without collisions and the Moscow links' pills sit on the screen edge without
  overlapping, clicking one pans the camera and keeps the selection; at z 5 the deposit chips with richness pips and
  the grey DEPOT badge show above Tiraspol; counters, stacks (×N with a shadow card and a second-nation dot), the
  gold and white edges, hold shield, supply dots (amber and red sampled at pixel level) and strength bars draw as
  specified; all five order-arrow styles and the ×N badge draw; hovering a region, a city or a counter shows the
  tooltip (14 px from the cursor), the sea and dragging hide it, F3 toggles the meter, and none of it re-renders
  React (`__mapStats.renders` delta 0). Draw time (JS side only, 1920x1011, same gestures as `pan-zoom-bench.js`,
  two runs): average 1.4-1.5 ms, p95 2.1-2.4 ms, 0 React renders. The real C2 numbers (rAF deltas) still need the
  window in view: the pane was shown but `requestAnimationFrame` did not fire (Claude window not in front).
  (plan 2026-10-18-visual-overhaul → Task 27)
- Task 28 (switch to the canvas map): `npm test` 291/291, `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build`, `npm run check:layers`, `npm run validate-map`, `npm run smoke` and `npm run balance-check` pass, and
  searching `src` for `TheaterMap` finds nothing. Layout lock: PASS at 1440x900 and at 1920x1080, with the `map-controls`
  keys `zoomin`, `zoomout` and `reset`. The quick manual run (walk, 20 steps) and the economy flow (12 steps) pass on the
  canvas map (the walk script now clicks the move target on the canvas). Parity checklist of spec 12.4, run in the browser on the
  default map (dev build, stand-in `requestAnimationFrame`, scripts kept outside the repo):
  - [x] Select regions (a city and a bare polygon), units (a counter) and stacks (expand, collapse on a sea click).
  - [x] Orders issued by clicking the canvas: move (the Orders tab counts 1), attack (infantry and armor), air support
    (fighter) and bombard (bomber) each draw an arrow of the right type; Cancel removes it; Hold shows as a hold order and
    Cancel clears it. [ ] Missile strike was not issued in a live game (Germany's strategic missile has no target in range
    at the start); its arrow was checked with a synthetic arrow and the order logic is covered by the unit tests.
  - [x] Supply overlay on and off; depot badge and deposit chips at z 5; + and Reset buttons.
  - [x] End Turn, then the turn report.
  - [x] Save a slot, End Turn (autosave written), load the slot: the turn, the unit positions and the map follow.
  - [ ] Continue from the start screen: the start screen with Continue arrives in Task 29.
  - [x] The Diplomacy and Doctrines windows open, the facility popup opens from the Economy panel, build, cancel and
    recruit work. [ ] Diplomacy actions, doctrine purchase, repair and demolish were not re-run here: this task did not
    touch them and their logic is covered by the unit tests.
  - [x] Victory and defeat overlays, forced through crafted save slots.
  **Not done: the benchmark (step 3).** The Browser pane was shown, but `requestAnimationFrame` only fired intermittently
  (the Claude window has to be in front of every other window); three runs of `pan-zoom-bench.js` need about a minute of
  that, and the legacy numbers of Task 3 (`perf-legacy.md`) need the same. JS draw time is 1.4-1.5 ms on average (p95
  2.1-2.4 ms) with 0 React renders during the benchmark gestures. (plan 2026-10-18-visual-overhaul → Task 28)
- C3 (no rule changes), checked against the `legacy` branch after Task 28: `git diff legacy main -- src/game` shows only new files
  (`regionGeo`, `strategicDepot`, `playerActions` with tests, `scenarioBaseline.test.ts`) and two edits to existing files:
  `turnEngine.ts` lost `hasBlocPathToRegion` (moved verbatim to `strategicDepot.ts`) and `createInitialState.ts` imports the map
  points from their new file. `countries.ts` (the war-entry data), `diplomacy.ts`, `src/game/ai` and `src/game/sim` are identical.
  The same fingerprint script run on the legacy tree and on `main` printed identical output (37 lines): Slovakia and Hungary join on
  turn 5; Belarus joins after a major capital falls, after two key cities of one major power, or after one key city each of two major
  powers (not after one); the Czech Republic after two Polish key cities or Warsaw (not after one); Finland when the Baltic Federation
  is overrun (not when only its capital falls); neutral nations start at 0/0 support, diplomacy actions move it, one action per
  target per turn, and fixed members and nations at war cannot be targeted. `npm run balance-check` printed the same table on both
  trees. Pre-existing mismatch, now fixed (see Fixed): Marek kept the shipped rule, so the check and the design doc
  were aligned to it.
- Task 30 (final verification and docs): `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test`
  301/301 (40 files), `npm run build` OK (CSS 66.67 kB, JS 1,311.18 kB), `npm run check:layers`
  "Layering: PASS", `npm run validate-map` (63 regions), `npm run check-war-entry`, `npm run smoke`
  (RUSSIA, ROMANIA, AUSTRIA) and `npm run balance-check` ("Balance check passed"). The 400-line check
  prints nothing; the 11 remaining `style={{` hits in `src/` all carry runtime values (a flag's size,
  a progress width, a unit color variable and the diplomacy marker positions). The CSS split of Task
  30a is lossless (68 chunks, none lost or added) and its styleprint is IDENTICAL (17 states, 6,234
  elements); a final pass over the `style={{` audit moved the one static value (`left: 50%` on the
  diplomacy center marker) into its CSS class, and the styleprint stayed IDENTICAL.
  Layout lock: PASS at 1440x900 and at 1920x1080.
  (plan 2026-10-18-visual-overhaul → Task 30)
- Task 30 parity checklist (spec 12.4), every script run in the browser on the default map: walk 20/20,
  economy 12/12, map-check 18/18, parity 23/23, save-load 12/12, windows 9/9 and 3/3. Screenshots of
  the start screen, the main screen, the eight tabs, the stockpile popup, the facility popup, the logic
  map, global units, Diplomacy, Doctrines, Save/Load, the turn report, victory and defeat were taken at
  1440x900 and 1920x1080 and reviewed.
  (plan 2026-10-18-visual-overhaul → Task 30)
- Task 30 benchmark (C2), the same GPU-enabled headless Chrome for both builds
  ([perf-legacy.md](./docs/superpowers/baselines/perf-legacy.md)): three runs each with real
  `requestAnimationFrame` at 120 Hz (idle 8.3-8.4 ms). Canvas map 42.75 ms average / 50.10 ms p95,
  legacy SVG 71.71 ms / 91.60 ms, `mapRenders` 0 in every canvas run (1.7x faster average, 1.8x lower
  p95). The absolute C2 verdict still needs one visible-window run (see Decision).
  (plan 2026-10-18-visual-overhaul → Task 30)
- Start-screen redesign: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test` 307/307
  (41 files, including the 3 new `getScenarioOverview` tests and 3 new enemy-summary briefing tests)
  and `npm run build` OK (CSS 70.63 kB, JS 1,314.68 kB). Screenshots at 1440x900 and 1920x1080
  checked: masthead stats, bloc rules and footers, compact briefing, enemy details, theatre share
  bar and column accents all render; the selected card, badges and start button use the kit tokens.
- Start-screen polish: `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm test -- --run`
  311/311 (41 files, including the 4 new briefing tests), `npm run build` OK (CSS 72.26 kB,
  JS 1,317.74 kB). Headless Chrome at 1335x747, 1440x900 and 1920x1080 reports no console errors;
  the right rail fits at every size (594/594, 747/747, 927/927 px), the theatre panel is hidden
  only at 1335x747, and the Neutral column scrolls with its fade only at that size.
  `npm run smoke` and `npm run balance-check` were not run because nothing under `src/game/`
  changed. (2026-10-19-start-screen-polish-design.md)

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
