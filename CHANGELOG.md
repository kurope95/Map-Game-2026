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

### Decision
- Spec refinements made while planning: the layout lock compares bar controls by order and row (so
  icons may be added beside labels) instead of exact x-positions; the zoom range is defined
  relative to the default fit (0.6x-24x) because canvas scale differs from the old SVG viewBox
  scale; region shade variants use greedy neighbor coloring instead of a hash so same-owner
  neighbors never share a shade.

### Changed
- This changelog's planning links now point at `CLAUDE.md` and `docs/superpowers/`; the earlier
  entries are filed under the `0.1.0` legacy release below.

### Verified
- Baseline on `main` before improvements: `npx tsc -p tsconfig.app.json --noEmit` 0 errors,
  `npm run build` OK (1.2 MB JS bundle), `npm run smoke` passed, `npm run balance-check` passed
  for all 24 nations.
- Task 1: `npm test` 1/1 passed (scenario baseline holds, regions do change hands),
  `npx tsc -p tsconfig.app.json --noEmit` 0 errors, `npm run smoke` passed.
  (plan 2026-10-18-visual-overhaul → Task 1)

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
