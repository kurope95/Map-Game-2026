# Map Game: Europe 2026

Single-player, turn-based grand strategy game that runs in the browser (React 18 + TypeScript + Vite).
Two blocs (BRICS and EU NATO) plus neutral states fight over 103 city-regions in Central and
Eastern Europe. Marek plays it alone on his Windows PC.

## Direction (agreed 2026-10-18)

- Deep grand strategy in the spirit of Hearts of Iron: keep and deepen the economy, production
  chains, diplomacy and doctrines. Long campaigns are fine.
- Stays turn-based and single-player. No multiplayer, tutorial or hosting.
- Regions are strategic city-regions. Do not add open-field mechanics (encirclement pockets,
  terrain-by-biome combat).
- **Keep the main-screen control layout**: top bar, bottom tab bar, where each floating panel
  opens, unit drawer, map controls, supply toggle. Restyling is welcome; moving or regrouping
  controls needs Marek's OK.
- Smooth pan and zoom is a hard requirement. Lag was a long-running problem, so never make the
  map re-render through React on every pan/zoom frame.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on http://127.0.0.1:4173 (preview config `map-game` in `.claude/launch.json`) |
| `launch.bat` | Frees port 4173, starts the dev server, opens the browser |
| `npx tsc -p tsconfig.app.json --noEmit` | Type-check the app |
| `npm run build` | `tsc -b && vite build` into `dist/` |
| `npm run smoke` | 5-turn auto-play for RUSSIA, ROMANIA, AUSTRIA |
| `npm run balance-check` | 10-turn AI auto-play for all 24 nations; must end with "Balance check passed" |
| `npm run check-war-entry` | Scripted war-entry checks |
| `npm run validate-map` | Map adjacency and layout validation |
| `npm test` | Vitest suite; tests live next to the code as `*.test.ts` |
| `npm run check:layers` | Fails when anything under `src/game/` imports `ui`/`app` code or React |

Two checks run in the browser rather than in Node:

- **Layout lock (C1):** `scripts/layout/capture-layout.js` is evaluated in the page (it opens the
  panels through the UI and records 20 probed containers); the result is diffed against
  `docs/superpowers/baselines/layout-<width>x<height>.json` with
  `node scripts/layout/compare-layout.mjs <baseline> <capture>`, which must print `Layout lock: PASS`.
- **Pan/zoom benchmark (C2):** `scripts/perf/pan-zoom-bench.js` is evaluated in the page, drives 180
  scripted pointer frames plus 20 wheel steps and returns frame times, React map renders and the idle
  frame interval. It only measures while the browser pane is visible.

Before every commit, the type check and build must pass. After any change under `src/game/`,
`npm run smoke` and `npm run balance-check` must pass too. UI changes get checked in the browser.

The project path contains spaces (`Marek - Harddisk`), so quote paths in shell commands.

## Code layout

```
src/
  app/       main.tsx, App.tsx (switches start screen / game screen, hosts SaveLoadWindow)
  game/      Pure rules engine. No React or DOM imports: the scripts run it in Node.
    state/     types.ts (GameState and friends), createInitialState.ts
    content/   Scenario data: countries, regions (and regionGeo.ts map points), units,
               economy, recipes, doctrines, AI goals
    rules/     turnEngine, orderResolution (combat), economyEngine, diplomacy,
               strategicDepot (Pridnestrovie), playerActions
    ai/        heuristicBot (per-nation AI), allyCoordination
    sim/       autoPlay helpers shared by the UI and the harnesses
  ui/        React components and styles:
    session/   GameProvider (useGame) and hooks for turns, selection, UI state, actions, saves
    screens/   game/GameScreen (main screen) and start/StartScreen (+ cards, briefing)
    hud/       TopBar, BottomBar, SupplyToggle, ToastStack
    panels/    the seven bottom-tab panels
    windows/   floating windows and modals (diplomacy, turn report, save/load, facility, stockpile, ...)
    map/       Canvas map: MapView (memo shell) + MapController (imperative),
               render/ (layers), geometry/, layout/ (labels, counters, hit tests), perf/
    kit/       shared UI kit (Window, Button, Badge, Tabs, Pips, Flag, StatRow, ...)
    theme/     tokens.css (design tokens: colors, fonts, sizes, radii)
    format/    formatting helpers such as unitStatus
    dev/       dev-only UI such as the kit gallery
scripts/     Node harnesses, compiled by tsconfig.scripts.json into .tmp-check/
             (layout lock in layout/, benchmark in perf/)
docs/        v1-design.md (original vision), balance-report.md, superpowers/specs and plans
```

## How the game loop works

- `GameState` (`src/game/state/types.ts`) is treated as immutable: rules return a new state.
- The human plays `playerCountryId`. Nations act in `turnOrder`. `advanceTurn` resolves the current
  nation's orders, runs its economy, then hands over to the next nation. The UI calls
  `runUntilPlayerTurn` so every AI nation acts instantly after the player ends the turn.
- Combat randomness is seeded (`setCombatSeed`) so harness runs are reproducible.
- Saves live in browser localStorage: `mapgame_slot_<name>`, `mapgame_autosave`, legacy `mapgame_save`.

## Git

- Repo: https://github.com/kurope95/Map-Game-2026
- `legacy` is a frozen snapshot of the game before the improvement work. Never commit to it.
- `main` holds all improvements. Commit there in small steps that each build and run.
- Line endings are LF, except `.bat`/`.cmd` files which are CRLF (see `.gitattributes`).

## Conventions

- Record every change in `CHANGELOG.md` under `[Unreleased]`, using the format described at the top
  of that file.
- Design specs go in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, implementation plans in
  `docs/superpowers/plans/`.
- `CODEX_PLAN.md` and `implementation_plan.md` are history. Everything in them is done except
  `implementation_plan.md` TASK 6–9 (three-condition victory, city siege loop, bloc AI strategy,
  difficulty levels), which will be folded into a future gameplay spec. Don't start them ad hoc.
- Prefer CSS classes and the shared design tokens over inline `style={{...}}` objects.
- Keep files focused. A component or module growing past roughly 400 lines is a signal to split it.
