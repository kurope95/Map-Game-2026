# Visual Overhaul and Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 2,700-line `App.tsx` into small modules, restyle the whole interface in style C
without moving any main-screen control, and replace the SVG map with a smooth Canvas 2D renderer.

**Architecture:**
- **State:** a `GameProvider` context owns game and UI state; components read it with `useGame()`.
- **Player actions:** become pure functions in `src/game/rules/playerActions.ts`.
- **Map:** an imperative `MapController` draws on a `<canvas>` from geometry computed once
  (`d3-delaunay` + `polygon-clipping`) and from per-state derived data. React only passes props, so
  pan and zoom never trigger React renders.

**Tech Stack:** React 18.3, TypeScript 5.9, Vite 6.4, d3-geo, d3-delaunay, topojson-client,
world-atlas 50m. New: `polygon-clipping` 0.15, `lucide-react` 1.x, `@fontsource/oswald` and
`@fontsource/inter` 5.x, `vitest` 3.2.

**Spec:** `docs/superpowers/specs/2026-10-18-visual-overhaul-design.md` (read it before Task 1;
section numbers like "spec 11.4" refer to it).

## Global Constraints

- **C1 Layout lock:** same main-screen controls, same order, same container and alignment group.
  - The anchored edges of bars, panels, pop-ups, the unit drawer and windows move at most 4 px.
  - Controls inside the top and bottom bars keep their order and row (vertical center within 4 px).
  - Checked by `scripts/layout/compare-layout.mjs` (Task 2) at 1440x900 and 1920x1080.
- **C2 Speed:** during continuous pan and zoom at 1920x1080, average frame ≤ 8 ms, p95 ≤ 12 ms,
  and `window.__mapStats.renders` must not increase.
- **C3 No rule changes:** `src/game/` may only change through the extractions in Tasks 4-6 and the
  display-only `MAP_POINT_OVERRIDES` (Task 21).
- **C4 Old saves load:** the `GameState` shape does not change.
- **C5 Offline:** fonts and icons come from npm packages; no CDN URLs at runtime.
- **C6 Layering:** nothing under `src/game/` imports from `src/ui/`, `src/app/` or `react`. Enforced by
  `npm run check:layers` (Task 4).
- **C7 Phase-end checks:** all of these pass:
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npm run build`
  - `npm test`
  - `npm run check:layers`
  - `npm run smoke`
  - `npm run balance-check` (must end with "Balance check passed")
- **Git:**
  - Commit on `main` only; never touch `legacy`.
  - Push `origin main` at the end of Tasks 3, 12, 19, 28, 29 and 30.
  - Commit messages are short and imperative.
- **Changelog:** every task's commit includes a `CHANGELOG.md` entry under `[Unreleased]` in the
  format at the top of that file, citing `(plan 2026-10-18-visual-overhaul → Task N)` and the files
  touched. Verification numbers go under `Verified`.
- **Line endings:** LF, except `.bat` files (CRLF). The project path contains spaces, so quote it.
- **Typography:** minimum font size 11 px. Display font Oswald, body font Inter. Colors and sizes
  come only from the spec section cited in each task.
- **Browser checks:**
  - Use the preview server `map-game` (`.claude/launch.json`, port 4173) with the built-in
    browser tools.
  - Performance numbers count only when `document.visibilityState === "visible"`. Show the pane
    first with the `mcp__ccd_view__show_pane` tool (load it via ToolSearch
    `select:mcp__ccd_view__show_pane`).
- **Behavior parity:** keep every guard, toast text and side effect of the code you move.
  `window.confirm` for slot deletion stays.

## Review Focus

1. **Saves from the legacy game:**
   - Envelope slots, raw-`GameState` legacy slots and `mapgame_autosave` must still load after the
     restructure.
   - Pinned by `parseSaveSlot` tests in Task 12 and `parseAutosave` tests in Task 29.
2. **Windows display scaling of 125% or 150% (`devicePixelRatio` ≠ 1):**
   - A click must hit the counter or city under the cursor.
   - All hit boxes are in CSS pixels, never device pixels. Pinned in Task 25.
3. **Crowded regions** (allied stacking, up to 8 units in one region):
   - Expanded counters must not overlap each other. Pinned in Task 25.
4. **Zoomed-in selection whose linked cities are off-screen in any direction:**
   - Edge pills stay inside the viewport and clear of the top bar (48 px) and the bottom tab bar
     (46 px). Pinned in Task 25.
5. **Late-game turn reports:**
   - Many nations and hundreds of lines, or the player's nation missing because it was defeated.
   - The parser must stay fast and account for every line. Pinned in Task 19.

---

## Browser check recipe (used by many tasks)

1. `preview_start` with `name: "map-game"`.
2. `resize_window` 1440x900 (or 1920x1080).
3. Reload, then click "Start as Russia":
   - before Task 29: `.landing-hero__start`;
   - after Task 29: `[data-layout="start-button"]`.
4. For a layout capture:
   - pass the contents of `scripts/layout/capture-layout.js` to `javascript_tool`;
   - save the returned JSON to a file in the scratchpad;
   - run `node scripts/layout/compare-layout.mjs docs/superpowers/baselines/layout-1440x900.json <that file>`;
   - expect `Layout lock: PASS`.
5. Reset the viewport with `resize_window preset: "desktop"` when done.

---

## Phase 1: Safety net

### Task 1: Test runner and occupation-baseline test

**Files:**
- Modify: `package.json`: devDependency `vitest@^3.2`, scripts `"test": "vitest run"` and
  `"test:watch": "vitest"`
- Modify: `vite.config.ts`: add `/// <reference types="vitest/config" />` and
  `test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"] }`
- Modify: `tsconfig.scripts.json`: add `"exclude": ["**/*.test.ts"]` (the harness compile must not
  see tests)
- Test: `src/game/state/scenarioBaseline.test.ts`

**Interfaces:**
- Produces: `npm test`. Tests live next to code as `*.test.ts` and run in a Node environment.

- [x] **Step 1: Install and configure.** Run `npm install -D vitest@^3.2`, then apply the three file
  changes above.
- [x] **Step 2: Write the characterization test** (spec 11.4 #5 relies on it):

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "./createInitialState";
import { evaluateWarEntryRules } from "../rules/turnEngine";
import { setCombatSeed } from "../rules/orderResolution";
import { autoPlayTurns } from "../sim/autoPlay";

describe("scenario baseline", () => {
  it("keeps state.scenario.regions at their pre-war controllers while regions change hands", () => {
    setCombatSeed(20261018);
    const initial = evaluateWarEntryRules(createInitialState("RUSSIA"));
    const baseline = Object.fromEntries(initial.scenario.regions.map((r) => [r.id, r.controllerCountryId]));
    const after = autoPlayTurns(initial, "RUSSIA", 10);
    for (const region of after.scenario.regions) {
      expect(region.controllerCountryId).toBe(baseline[region.id]);
    }
    const changed = Object.values(after.regions).filter((r) => r.controllerCountryId !== baseline[r.id]);
    expect(changed.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 3: Run `npm test`.** Expect PASS.
  - If the controllers assertion fails, `scenario.regions` is being mutated somewhere. STOP and report
    to Marek, because the occupation-stripe design depends on it.
  - If `changed.length` is 0, raise the turn count to 20.
- [x] **Step 4: Run** `npx tsc -p tsconfig.app.json --noEmit` and `npm run smoke`. Expect both to pass.
- [x] **Step 5: Changelog, then commit** with the message `Add vitest and scenario baseline test`.

### Task 2: Layout lock tooling and legacy baseline

**Files:**
- Create: `scripts/layout/capture-layout.js`. A browser snippet: one async IIFE that returns a JSON
  object.
- Create: `scripts/layout/compareLayout.mjs`, which exports
  `compareLayout(baseline, candidate) -> { ok: boolean, failures: string[] }` and `PROBE_FIELDS`.
- Create: `scripts/layout/compare-layout.mjs`, a CLI: `node scripts/layout/compare-layout.mjs <baseline> <candidate>`.
  It prints `Layout lock: PASS` and exits 0, or prints `Layout lock: FAIL` plus one failure per line
  and exits 1.
- Test: `scripts/layout/compareLayout.test.mjs`
- Create: `docs/superpowers/baselines/layout-1440x900.json` and `layout-1920x1080.json`

**Interfaces:**
- Produces:
  - **Capture format:**

    ```
    { viewport: {width, height},
      probes: { [name]: { rect: {left, top, right, bottom, width, height, centerX, centerY},
                          items?: [{key, centerY}] } },
      missing: string[] }
    ```

  - **Convention for all later tasks:** new code puts `data-layout="<probe name>"` on every probed
    element, `data-layout-key="<key>"` on every top-bar and bottom-bar control, and on map controls.
    Modal backdrops get `data-layout="<probe>-backdrop"`.

**Key rule.** A control's key is the first non-empty value from this list:
1. its `data-layout-key`;
2. `"spacer"` or `"divider"` if its class contains that word;
3. `"select"` for a `<select>`;
4. its first direct text node, normalized;
5. its `title`, normalized;
6. its full `textContent`, normalized.

`normalize(s) = s.toLowerCase().replace(/[^a-z]/g, "")`. Map-control text maps as
`"+" → "zoomin"`, `"-" → "zoomout"`, `"Reset" → "reset"`.

**Probe table.** Each probe lists how to open it, its legacy selector and the fields compared within
±4 px. "Tab X" means click the bottom-bar control with key X. "Top X" means click the top-bar
control with key X. "Again" means repeat the same click.

| Probe | Open | Close | Legacy selector | Fields |
|---|---|---|---|---|
| top-bar | always | | `.top-bar`, items = direct children | left, top, width, height, plus items |
| bottom-bar | always | | `.bottom-bar`, items = `button` descendants | left, bottom, width, height, plus items |
| map-stage | always | | `.map-stage` | left, top, right, bottom |
| map-controls | always | | `.map-controls`, items = buttons | right, top, plus items |
| supply-toggle | always | | `button` whose text includes `SUPPLY LINES` | centerX, top |
| unit-drawer | always (Moscow is selected at start) | | `.unit-drawer` | right, bottom, width |
| panel-region | tab region, only if not already open | tab region | `.float-panel--bottom-left` | left, bottom |
| panel-economy | tab economy | again | `.float-panel--bottom-center` | centerX, bottom |
| panel-recruitment | tab recruitment | again | same | centerX, bottom |
| panel-orders | tab orders | again | same | centerX, bottom |
| panel-aiintel | tab aiintel | again | same | centerX, bottom |
| panel-warstatus | tab warstatus | again | same | centerX, bottom |
| panel-eventlog | tab eventlog | again | same | centerX, bottom |
| stockpile | tab stockpile | again | `.stockpile-popup` | centerX, bottom |
| facility | tab economy, then the first `.facility-item--clickable` | click it again, then tab economy | `.facility-popup` | centerX, bottom |
| global-units | top units | again | `.global-units-panel` | left, top, bottom, width |
| diplomacy | top diplomacy | again | the `.float-panel` whose header text starts with `Diplomacy` | centerX, top, width |
| doctrines | top doctrines | again | the first child of the fixed overlay containing `DOCTRINE UPGRADES` | centerX, width |
| save-load | top savegame | click the `.save-modal-overlay` element | `.save-modal` | centerX, width |
| logic-map | tab stockpile, then the button with key `logicmap` | click `.logic-map-overlay`, then tab stockpile | `.logic-map-modal` | centerX, width |

- **Items rule.** If the bar has `[data-layout-key]` descendants, use those in DOM order. Otherwise
  use the legacy rule from the table.
- **Comparison.** Compare key sequences with `"divider"` keys removed; they must be equal. Each
  item's `centerY` must be within 4 px.
- **Selectors and timing.** The capture prefers `[data-layout="<probe>"]` and falls back to the
  legacy selector.
- After each open or close click, yield with two `MessageChannel` ticks
  (`await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); })`).
  Don't use `requestAnimationFrame` or `setTimeout`: both are throttled when the browser pane is
  hidden.

- [x] **Step 1: Write the failing tests** in `compareLayout.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { compareLayout } from "./compareLayout.mjs";

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, centerX: left + width / 2, centerY: top + height / 2 });
const base = { viewport: { width: 1440, height: 900 }, missing: [], probes: {
  "top-bar": { rect: rect(0, 0, 1440, 36), items: [{ key: "mapgame", centerY: 18 }, { key: "divider", centerY: 18 }, { key: "nation", centerY: 18 }] },
  "panel-region": { rect: rect(8, 500, 400, 362) } } };

describe("compareLayout", () => {
  it("passes identical captures", () => expect(compareLayout(base, base)).toEqual({ ok: true, failures: [] }));
  it("fails a panel moved by 6 px", () => {
    const moved = structuredClone(base); moved.probes["panel-region"].rect = rect(14, 500, 400, 362);
    const r = compareLayout(base, moved);
    expect(r.ok).toBe(false);
    expect(r.failures).toContain("panel-region.left: 8 -> 14");
  });
  it("ignores content-sized height on bottom-anchored panels", () => {
    const taller = structuredClone(base); taller.probes["panel-region"].rect = rect(8, 450, 400, 412);
    expect(compareLayout(base, taller).ok).toBe(true);
  });
  it("fails reordered bar items but ignores dividers", () => {
    const re = structuredClone(base); re.probes["top-bar"].items = [{ key: "nation", centerY: 18 }, { key: "mapgame", centerY: 18 }];
    expect(compareLayout(base, re).ok).toBe(false);
    const noDiv = structuredClone(base); noDiv.probes["top-bar"].items = [{ key: "mapgame", centerY: 18 }, { key: "nation", centerY: 19 }];
    expect(compareLayout(base, noDiv).ok).toBe(true);
  });
  it("fails a probe missing from the candidate", () => {
    const gone = structuredClone(base); delete gone.probes["panel-region"];
    expect(compareLayout(base, gone).failures).toContain("panel-region: missing");
  });
});
```

- [x] **Step 2: Run `npm test`.** Expect FAIL: module not found.
- [x] **Step 3: Implement `compareLayout.mjs` and the CLI.**
  - `PROBE_FIELDS` is the "Fields" column of the probe table above.
  - The failure format is `"<probe>.<field>: <base> -> <candidate>"` (rounded to integers),
    `"<probe>: missing"`, `"<probe>.items: <baseKeys> -> <candKeys>"` and
    `"<probe>.items[<key>].centerY: a -> b"`.
- [x] **Step 4: Run `npm test`.** Expect PASS.
- [x] **Step 5: Implement `capture-layout.js`** as described in the probe table, then capture the
  baselines.
  - Follow the browser check recipe at 1440x900 and at 1920x1080.
  - Save the JSON outputs to the two baseline files. `missing` must be `[]`.
  - Compare each baseline against a second capture of itself. Expect `Layout lock: PASS`.
- [x] **Step 6: Changelog, then commit** with the message `Add layout lock capture and comparison`.

### Task 3: Performance benchmark and legacy numbers

**Files:**
- Create: `scripts/perf/pan-zoom-bench.js`. A browser snippet that returns
  `{ avgMs, p95Ms, maxMs, frames, mapRenders }` or `{ error }`.
- Create: `docs/superpowers/baselines/perf-legacy.md`

**Interfaces:**
- Produces: the benchmark used again in Tasks 26 and 28.
  - Target element: `[data-layout="map-canvas"]`, falling back to `.theater-map-shell`.
  - `mapRenders` is `window.__mapStats.renders` after minus before, or `null` when `__mapStats` is
    missing.

- [x] **Step 1: Write the snippet.**
  1. If `document.visibilityState !== "visible"`, return
     `{ error: "Browser pane hidden: show it and rerun" }`.
  2. Record frame deltas with `requestAnimationFrame`.
  3. Dispatch `pointerdown` at the target's center (`pointerId: 7`, `pointerType: "mouse"`,
     `button: 0`, `bubbles: true`).
  4. Send 180 `pointermove` events, one per frame, along an ellipse with radii 200x120 px around the
     center.
  5. Dispatch `pointerup`.
  6. Send 20 `wheel` events, one per frame: `deltaY: -100` for the first 10, then `+100`, at the
     center, with `cancelable: true`.
  7. Drop the first frame, then compute avg, p95 and max.
- [ ] **Step 2: Measure.** Show the browser pane, run the recipe at 1920x1080, and run the snippet
  three times.
  - Write the median of each metric to `perf-legacy.md` with date, viewport and `devicePixelRatio`.
  - Expect frame times far above C2 on legacy. Record them, don't fix them.
- [ ] **Step 3: Run the C7 phase-end checks.** Changelog, commit `Add pan/zoom benchmark and legacy
  numbers`, then `git push origin main`.

---

## Phase 2: Restructure (no visible change)

Every task in this phase ends with a layout capture at 1440x900, compared against the baseline (it
must PASS), and a quick manual run:
1. Start as Russia.
2. Select a unit and order a move.
3. Press End Turn; the battle report opens.
4. Open each tab.

### Task 4: Move map points into the game layer, plus the layering check

**Files:**
- Create: `src/game/content/regionGeo.ts`, holding the content of `src/ui/mapLayout.ts` verbatim
  plus the additions below
- Modify: `src/game/state/createInitialState.ts:4` and `src/ui/TheaterMap.tsx:7` (import paths)
- Delete: `src/ui/mapLayout.ts`
- Create: `scripts/check-layers.mjs`. It scans `src/game/**/*.ts` for import specifiers matching
  `/\/ui\/|\/app\/|^react/`, then prints the offenders and exits 1, or prints `Layering: PASS`.
- Modify: `package.json`, adding the script `"check:layers": "node scripts/check-layers.mjs"`
- Test: `src/game/content/regionGeo.test.ts`

**Interfaces:**
- Produces (in `regionGeo.ts`):

```ts
export interface GeoPoint { lon: number; lat: number }
export const theaterMapSize: { width: number; height: number }; // unchanged: 1600 x 980
export const europeCountryIds: number[];                         // unchanged
export const theaterMapLayout: Record<string, GeoPoint>;         // unchanged; createInitialState still adds generated regions
export const MAP_POINT_OVERRIDES: Record<string, GeoPoint>;      // display-only fixes; starts as {} (filled in Task 21)
export function getRegionGeoPoint(regionId: string): GeoPoint | undefined; // MAP_POINT_OVERRIDES[id] ?? theaterMapLayout[id]
```

- [x] **Step 1: Write the tests.**
  - "has a map point for every region after createInitialState": call
    `createInitialState("RUSSIA")`; the ids where `getRegionGeoPoint(id)` is `undefined` equal `[]`.
  - "prefers MAP_POINT_OVERRIDES": for every override entry, `getRegionGeoPoint(id)` equals the
    override.
- [x] **Step 2: Run `npm test`.** Expect FAIL: module not found.
- [x] **Step 3: Move the file, add the two exports, fix the imports and write `check-layers.mjs`.**
- [x] **Step 4: Run** `npm test`, `npm run check:layers` (expect `Layering: PASS`), `npm run smoke`
  and `npm run balance-check`. Expect all to pass.
- [x] **Step 5: Run the layout capture and compare.** Expect PASS. Then changelog, then commit
  `Move map points into src/game/content/regionGeo.ts`.

### Task 5: One depot-status module

**Files:**
- Create: `src/game/rules/strategicDepot.ts`
- Modify:
  - `src/game/rules/turnEngine.ts`: delete the private `hasBlocPathToRegion` (256-280) and import
    it instead.
  - `src/app/App.tsx`: delete 90-145 and import.
  - `src/ui/TheaterMap.tsx`: delete 227-282 and import; the map only uses `.tone`.
- Test: `src/game/rules/strategicDepot.test.ts`

**Interfaces:**
- Produces:

```ts
export interface DepotStatus { tone: "claimed" | "claimable" | "locked"; label: string; detail: string }
export function hasBlocPathToRegion(state: GameState, countryId: CountryId, targetRegionId: string): boolean;
export function getPridnestrovieDepotStatus(state: GameState): DepotStatus; // labels and details exactly as App.tsx:116-145
```

- [x] **Step 1: Write the failing tests.**
  - "locked at start": expect
    `{ tone: "locked", label: "Locked", detail: "One bloc must control both Tiraspol and Odesa." }`.
  - "claimed once seized": push `"pridnestrovie-depot"` to `history.claimedStrategicDepots`, then
    expect `{ tone: "claimed", label: "Claimed", detail: "The depot has already been seized." }`.
  - "bridge needed without a land path": set `odesa` to `RUSSIA`/`BRICS` and `moscow` to
    `GERMANY`/`EU_NATO`, then expect label `"Bridge Needed"` and detail
    `"A land path from the claimant capital to Tiraspol is required."`.
  - "claimable with a land path": set every region to `RUSSIA`/`BRICS`, then expect
    `{ tone: "claimable", label: "Claimable", detail: "Russia can now seize the depot." }`.
- [x] **Step 2: Run `npm test`.** Expect FAIL.
- [x] **Step 3: Implement** by moving `App.tsx:90-145`, then remove the three old copies.
- [x] **Step 4: Run** `npm test`, `npm run smoke` and `npm run balance-check`. Expect PASS.
- [x] **Step 5: Run the layout compare.** Expect PASS. Then changelog, then commit
  `Extract strategic depot status into one module`.

### Task 6: Pure player actions

**Files:**
- Create: `src/game/rules/playerActions.ts`
- Modify: `src/app/App.tsx`. The handlers at 608-700 and 780-1101 and the chemical-mode toggle at
  1814-1820 now call the pure functions through `applyAction`.
- Test: `src/game/rules/playerActions.test.ts`

**Interfaces:**
- Produces:

```ts
export type ToastTone = "info" | "success" | "warning" | "danger";
export interface ActionToast { message: string; tone: ToastTone }
export type ActionResult = { ok: true; state: GameState; toast?: ActionToast } | { ok: false; toast?: ActionToast };
export type IdFactory = (prefix: string) => string; // default: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
export function canAfford(stockpile: CountryStockpile | undefined, cost: Partial<Record<StockpileKey, number>>): boolean;
export function getMissingResources(stockpile: CountryStockpile | undefined, cost: Partial<Record<StockpileKey, number>>): string[]; // `${need - have} ${key}`
export function getOperationalFacilities(state: GameState, regionId: string, type: FacilityType): Facility[]; // not damaged, level desc
export function getBestOperationalFacility(state: GameState, regionId: string, type: FacilityType): Facility | null;
export function queueFacilityBuild(state: GameState, countryId: CountryId, regionId: string, facilityType: FacilityType, makeId?: IdFactory): ActionResult;   // prefix "build"
export function queueFacilityUpgrade(state: GameState, countryId: CountryId, regionId: string, facilityId: string, makeId?: IdFactory): ActionResult;        // prefix "upgrade"
export function queueFacilityRepair(state: GameState, countryId: CountryId, regionId: string, facilityId: string, makeId?: IdFactory): ActionResult;         // prefix "repair"
export function queueFortificationBuild(state: GameState, countryId: CountryId, regionId: string, makeId?: IdFactory): ActionResult;                        // prefix "fort-build"
export function queueFortificationUpgrade(state: GameState, countryId: CountryId, regionId: string, makeId?: IdFactory): ActionResult;                      // prefix "fort-upgrade"
export function queueFortificationRepair(state: GameState, countryId: CountryId, regionId: string, makeId?: IdFactory): ActionResult;                       // prefix "fort-repair"
export function demolishFacility(state: GameState, countryId: CountryId, regionId: string, facilityId: string): ActionResult;
export function queueUnitRecruit(state: GameState, countryId: CountryId, regionId: string, unitType: UnitType, makeId?: IdFactory): ActionResult;           // prefix "recruit"
export function queueUnitReplenish(state: GameState, countryId: CountryId, unitId: string, makeId?: IdFactory): ActionResult;                              // prefix "replenish"
export function cancelBuildOrder(state: GameState, countryId: CountryId, orderId: string): ActionResult;
export function purchaseDoctrine(state: GameState, countryId: CountryId, doctrineId: DoctrineUpgradeId): ActionResult;
export function toggleChemicalMode(state: GameState, regionId: string, facilityId: string): ActionResult;
```

**Guards.** Port each handler's guards in the same order.
- "Player turn active" becomes `state.currentActorId === countryId`. It is checked by every build,
  upgrade, repair, fortification, demolish and recruit function. It is NOT checked by replenish,
  doctrine, cancel or chemical toggle, matching the old handlers.
- Failures are `{ ok: false }` with no toast, except where the old handler called `addToast`.

**Toast texts** (copied from the old handlers):

| Function | Situation | Tone | Text |
|---|---|---|---|
| `queueUnitReplenish` | unit at full strength | info | `Unit is already at full strength` |
| `queueUnitReplenish` | no facility in the unit's region | warning | `Requires a ${requiredFacility} in ${regionName}` |
| `queueUnitReplenish` | cannot afford (first short resource) | warning | `Not enough ${key} (need ${amount}, have ${have})` |
| `queueUnitReplenish` | already queued | info | `This unit is already being replenished` |
| `queueUnitReplenish` | success | success | `Replenishing ${unit.type} (${turns} turns, cost: ${costStr})`, where `costStr` is `${v} ${k}` joined by `", "` |
| `purchaseDoctrine` | already owned | info | `Doctrine already unlocked` |
| `purchaseDoctrine` | missing prerequisite | warning | `Requires: ${reqDef?.name ?? req}` |
| `purchaseDoctrine` | not enough trade points | warning | `Insufficient trade points (need ${def.cost}, have ${Math.floor(tradePoints)})` |
| `purchaseDoctrine` | success | success | `Doctrine unlocked: ${def.name}` |

- [x] **Step 1: Write the failing tests.**
  - Helpers:

    ```ts
    const RU = "RUSSIA" as const;
    const ids: IdFactory = (p) => `${p}-test`;
    const fresh = () => evaluateWarEntryRules(createInitialState(RU)); // Russia acts first
    function withStockpile(s: GameState, c: CountryId, n: number): GameState {
      const sp = Object.fromEntries(Object.keys(s.countryStockpiles[c]).map((k) => [k, n])) as CountryStockpile;
      return { ...s, countryStockpiles: { ...s.countryStockpiles, [c]: sp } };
    }
    ```

  - Tests, with values computed from the recipe helpers so nothing is hard-coded:
    - **queueFacilityBuild:**
      - success on `moscow`/`farm` with stockpile 999: the order matches
        `{ id: "build-test", type: "buildFacility", facilityType: "farm", regionId: "moscow", turnsRemaining: recipe.turns, totalTurns: recipe.turns, committed: recipe.cost }`
        and every cost key equals `999 - cost`;
      - `{ ok: false }` when `currentActorId` is `"GERMANY"`;
      - `{ ok: false }` for `berlin` (not controlled by Russia);
      - `{ ok: false }` when moscow's `buildingSlots` equals its facility count.
    - **queueFacilityUpgrade:** success on moscow's farm (cost from `getFacilityUpgradeCost("farm", level)`);
      `{ ok: false }` when the farm is damaged.
    - **queueFacilityRepair:** `{ ok: false }` when the farm is not damaged; success when damaged
      (`getFacilityRepairProfile`).
    - **Fortifications:**
      - build success on moscow after setting `fortification: undefined`;
      - upgrade success at level 1;
      - upgrade `{ ok: false }` at `FORTIFICATION_MAX_LEVEL`;
      - repair success when health is below max.
    - **demolishFacility:** removes the farm; `{ ok: false }` when it is not Russia's turn.
    - **queueUnitRecruit:** infantry in moscow; `turnsRemaining` equals
      `getMilitaryProductionTurns(recipe.turns, barracks.level)`.
    - **queueUnitReplenish:** each toast in the table above, triggered as follows:
      - at full strength: use the Moscow infantry `ru-inf-2` with strength set to
        `MAX_UNIT_STRENGTH.infantry` (8);
      - no facility: set strength 3 and moscow `facilities: []`; expect
        `Requires a barracks in Moscow`;
      - cannot afford: set strength 3 and stockpile 0;
      - success: set strength 3 and stockpile 999, and expect a `replenishUnit` order;
      - already queued: a second call after the success.
    - **purchaseDoctrine:**
      - `withReq = DOCTRINE_DEFINITIONS.find(d => d.requires?.length)` without its prerequisite
        gives the `Requires:` toast;
      - a doctrine without prerequisites with `tradePoints: 0` gives the trade points toast;
      - with `tradePoints: 999` it succeeds and deducts `def.cost`;
      - buying it again gives `Doctrine already unlocked`.
    - **cancelBuildOrder:** after a build and then a cancel, the stockpile equals the pre-build
      stockpile and the order is gone.
    - **toggleChemicalMode:** an undefined mode becomes `"explosives"`, and toggling again gives
      `"fertilizer"`.
- [x] **Step 2: Run `npm test`.** Expect FAIL.
- [x] **Step 3: Implement `playerActions.ts`**, then rewire the App handlers.
  - Add a local helper in App:
    `const applyAction = (r: ActionResult) => { if (r.ok) setGameState(r.state); if (r.toast) addToast(r.toast.message, r.toast.tone); };`
  - Example rewire:
    `function handleBuildFacility(regionId, type) { applyAction(queueFacilityBuild(gameState, playerCountryId, regionId, type)); }`
  - `canAfford`, `getMissingResources` and `getBestOperationalFacility` in App become thin wrappers
    that pass `gameState`.
- [x] **Step 4: Run** `npm test`, `npm run smoke` and `npm run balance-check`. Expect all to pass.
  Then in the browser:
  - build a farm in Moscow, then cancel it (the stockpile is refunded);
  - recruit infantry;
  - check the replenish toast at full strength.
- [x] **Step 5: Run the layout compare.** Expect PASS. Then changelog, then commit
  `Extract player economy and doctrine actions as pure functions`.

### Task 7: GameProvider, moving App's state and handlers verbatim

**Files:**
- Create: `src/ui/session/useGameController.ts`.
  - It holds `App.tsx` lines 45-1219 moved verbatim: `createSessionState`, the save constants and
    types, every `useState`, `useMemo`, `useEffect` and handler.
  - Not included: the two JSX helpers `renderDiplomacyBar` and `renderDiplomacyListCard`, and the
    `if (!gameStarted)` branch.
  - It returns one object containing every identifier the JSX uses.
- Create: `src/ui/session/GameProvider.tsx`
- Create: `src/ui/format/unitStatus.ts`, holding `getSupplyStatus`, `getVeterancyLevel` and
  `getEntrenchmentBonus` (App.tsx 66-88, verbatim), plus `src/ui/format/unitStatus.test.ts`.
- Create: `src/ui/screens/game/GameScreen.tsx`.
  - It holds `App.tsx` JSX 1232-2726 verbatim, plus the two JSX helpers as local functions.
  - It starts with `const { ...every name used } = useGame();`.
- Modify: `src/app/App.tsx`, down to about 30 lines.

**Interfaces:**
- Produces:

```ts
// GameProvider.tsx
export type GameContextValue = ReturnType<typeof useGameController>;
export function GameProvider(props: { children: React.ReactNode }): JSX.Element;
export function useGame(): GameContextValue; // throws Error("useGame must be used inside GameProvider") outside a provider

// App.tsx
export function App(): JSX.Element; // <GameProvider><AppScreens /></GameProvider>
// AppScreens: gameStarted ? <GameScreen /> : <LandingPage nations={landingNations} selectedCountryId={playerCountryId}
//   onSelectCountry={setPlayerCountryId} onStartGame={handleStartGame} />
```

- [x] **Step 1: Write `unitStatus.test.ts`.**
  - A fighter gives `{ tone: "air", label: "Not affected" }`.
  - Infantry with supply 0, 1, 2 and 3 gives `cutoff`/"Cut off", `critical`/"Critical", `low`/"Low"
    and `good`/"Supplied".
  - `getVeterancyLevel({ battlesWon: 5 })` is 3.
  - `getEntrenchmentBonus({ entrenchmentTurns: 9 })` is 25.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Create `unitStatus.ts`, then run again and expect PASS.
- [x] **Step 3: Do the verbatim move.**
  - GameScreen JSX must stay character-for-character identical apart from where values come from.
  - The type checker finds any name you forgot to return.
- [x] **Step 4: Run** `npx tsc -p tsconfig.app.json --noEmit` and `npm run build`. Expect both to pass.
  Then run the manual run and the layout compare (PASS).
- [x] **Step 5: Changelog, then commit** with the message
  `Move App state into GameProvider and JSX into GameScreen`.

### Task 8: Split the HUD out of GameScreen

**Files:**
- Create: `src/ui/hud/TopBar.tsx` + `TopBar.css`, `BottomBar.tsx` + `BottomBar.css`,
  `SupplyToggle.tsx` + `SupplyToggle.css`, `ToastStack.tsx` + `ToastStack.css`
- Create: `src/ui/screens/game/GameScreen.css`, holding `.game-shell`, `.map-stage` and the shell
  parts of `@media (max-width: 1100px)`
- Modify: `GameScreen.tsx` and `src/ui/styles.css` (delete the moved rules)

**Interfaces:**
- Consumes: `useGame()`.
- Produces: `TopBar()`, `BottomBar()`, `SupplyToggle()` and `ToastStack()`, all prop-less, each
  returning `JSX.Element | null`.

**CSS move rule (all of Phase 2):**
- Cut every rule of the moved class families, including rules inside `@media` blocks; recreate the
  `@media` wrapper in the new file.
- Inline `style={{...}}` objects become classes with identical values. This task covers:
  - supply toggle (App 2620-2640): `.supply-toggle` and `.supply-toggle--on`;
  - toasts (2529-2561): `.toast-stack`, `.toast` and `.toast--info|success|warning|danger`.

**Data attributes:**
- `data-layout`: `top-bar`, `bottom-bar`, `map-stage`, `supply-toggle`.
- Top-bar `data-layout-key` values, in order: `mapgame`, `nation`, `turn`, `bloc`, `active`,
  `nationalunits`, `trade`, `units`, `select`, `spacer`, `endturn`, `runai`, `autox`, `diplomacy`,
  `doctrines`, `savegame`, `loadgame`. Dividers stay plain.
- Bottom-tab `data-layout-key` values: `region`, `stockpile`, `economy`, `recruitment`, `orders`,
  `aiintel`, `warstatus`, `eventlog`.

- [x] **Step 1: Extract the components and move their CSS.**
- [x] **Step 2: Run** `npx tsc -p tsconfig.app.json --noEmit` and `npm run build`, then the manual
  run and the layout compare. Expect PASS.
- [x] **Step 3: Check visuals.** Screenshot the main screen; it must look identical to the
  pre-task screenshot.
- [x] **Step 4: Changelog, then commit** with the message `Split HUD components out of GameScreen`.

### Task 9: Split the bottom-tab panels

**Files:**
- Create in `src/ui/panels/`: `RegionPanel.tsx`, `EconomyPanel.tsx`, `RecruitmentPanel.tsx`,
  `OrdersPanel.tsx`, `AiIntelPanel.tsx`, `WarStatusPanel.tsx` and `EventLogPanel.tsx`.
- Create the CSS:
  - `FloatPanel.css`: `.float-panel*`, `.panel-grid`, `.panel-card`, `.war-dot`, `.region-strip`.
  - `EconomyPanels.css`: `.economy-*`, `.deposit-*`, `.facility-item*`, `.build-*`,
    `.build-queue*`, `.capture-*`.
- Modify: `GameScreen.tsx` and `styles.css`.

**Interfaces:**
- Produces: each panel is a prop-less function returning `JSX.Element | null`, and renders only
  when `bottomOpen && activeTab === "<tab id>"`.
- Its root gets `data-layout` set to one of: `panel-region`, `panel-economy`, `panel-recruitment`,
  `panel-orders`, `panel-aiintel`, `panel-warstatus`, `panel-eventlog`.

- [x] **Step 1: Extract the panels and move their CSS.**
- [x] **Step 2: Run the type check, build, manual run** (open every tab) **and the layout compare.**
  Expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Split bottom-tab panels`.

### Task 10: Split the map-side windows

**Files:**
- Create in `src/ui/windows/`: `UnitDrawer.tsx`, `UnitCard.tsx`, `GlobalUnitsPanel.tsx`,
  `StockpilePopup.tsx` and `FacilityPopup.tsx`. Split `FacilityPopup` into
  `FacilityProductionSection.tsx` and `FacilityRecruitSection.tsx` if it passes 400 lines.
- Create the matching CSS files, holding the `.unit-drawer*`, `.unit-card*`,
  `.global-units-panel*`, `.global-unit-row*`, `.stockpile-*` and `.facility-popup*` rules.
- Modify: `GameScreen.tsx` and `styles.css`.

**Interfaces:**
- Produces: prop-less components with `data-layout` values `unit-drawer`, `global-units`,
  `stockpile` and `facility`. `UnitCard` takes `{ unit: UnitDefinition }`.

- [x] **Step 1: Extract the windows and move their CSS.**
- [x] **Step 2: Run the type check, build, manual run** (replenish button, stockpile pop-up,
  facility pop-up, all-units list) **and the layout compare.** Expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Split unit drawer and map-side pop-ups`.

### Task 11: Split the modal windows and retire `styles.css`

**Files:**
- Create in `src/ui/windows/`:
  - `diplomacy/DiplomacyWindow.tsx`, `diplomacy/DiplomacyBar.tsx` (was `renderDiplomacyBar`),
    `diplomacy/DiplomacyListCard.tsx` (was `renderDiplomacyListCard`),
    `diplomacy/DiplomacyActions.tsx` and `diplomacy/diplomacy.css` (`.diplo-*`, `.diplomacy-*`).
  - `DoctrineWindow.tsx`, `SaveLoadWindow.tsx` + `.css` (`.save-*`), `BattleReportWindow.tsx`
    (the current report; replaced in Task 19), `DefeatNotice.tsx`, `VictoryOverlay.tsx`, and
    `windows.css` for the classes that replace their inline styles.
- Move: `src/ui/EconomyLogicMap.tsx` to `src/ui/windows/EconomyLogicMap.tsx`, plus
  `EconomyLogicMap.css` (`.logic-map-*`, `.logic-flow`, `.flow-col`, `.arrow`, `.node*`,
  `.divider`).
- Create:
  - `src/ui/TheaterMap.css`: `.theater-map*`, `.theater-map-shell`, `.map-controls`,
    `.map-control-button`, imported by `TheaterMap.tsx`.
  - `src/ui/LandingPage.css`: `.landing-*`, `.nation-card*`, imported by `LandingPage.tsx`.
  - `src/ui/theme/base.css`: resets, `body`, `button`/`select`, scrollbar, shared `@keyframes`.
- Delete: `src/ui/styles.css`. Then update `src/app/main.tsx` to import `../ui/theme/base.css`.

**Interfaces:**
- Produces: `data-layout` values `diplomacy`, `doctrines` (+ `doctrines-backdrop`), `save-load`
  (+ `save-load-backdrop`), `logic-map` (+ `logic-map-backdrop`), `battle-report`,
  `defeat-notice` and `victory`.
- The diplomacy panel's inline style becomes `.diplomacy-window` with exactly:
  - `top: 52px; bottom: auto; left: 50%; transform: translateX(-50%);`
  - `width: min(1380px, calc(100vw - 20px)); max-width: 1380px; min-width: 980px;`
  - `z-index: 42; max-height: 84vh;`
  - body `max-height: 80vh`.

- [x] **Step 1: Extract, move and delete as listed.** `GameScreen.tsx` should now only compose
  components (≤ 150 lines).
- [x] **Step 2: Run the type check, build, manual run** (Diplomacy action, Doctrines, Save and
  Load, logic map, End Turn report) **and the layout compare at both sizes.** Expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Split modal windows and retire styles.css`.

### Task 12: Carve the controller into focused hooks

**Files:**
- Create in `src/ui/session/`:
  - `types.ts`: `BottomTab`, `DiplomacyTab`, `SaveLoadMode`, `SaveSlotEnvelope`,
    `SaveSlotEntry`, `ValidTargets` (moved from the controller).
  - `useToasts.ts`, `useUiState.ts`, `useGameSession.ts`, `useSelection.ts`,
    `useEconomyActions.ts`, `useDiplomacy.ts` and `useSaveSlots.ts`.
  - `saveSlots.ts`, the pure save parsing, plus `saveSlots.test.ts`.
- Modify: `GameProvider.tsx`, which composes the hooks.
- Delete: `useGameController.ts`.

**Interfaces:**
- Produces: `GameContextValue` stays one **flat** object with **exactly the same member names** as
  in Task 7, so no component changes. Group membership (names from the old App):
  - **useToasts:** `toasts`, `addToast`.
  - **useUiState:**
    - panel flags and setters: `bottomOpen`, `activeTab`, `unitDrawerOpen`, `globalUnitsOpen`,
      `stockpileOpen`, `diplomacyOpen`, `doctrineOpen`, `logicMapOpen`, `showSupplyOverlay`;
    - `tabs`, which takes the order count as a parameter.
  - **useGameSession:**
    - core state: `gameState`/`setGameState`, `gameStarted`/`setGameStarted`,
      `playerCountryId`/`setPlayerCountryId`;
    - derived values: `playerCountry`, `playerBlocId`, `playerTurnActive`, `playerCountryUnits`,
      `allPlayerUnits`, `landingNations`, `victoryStatus`, `currentOrders`,
      `currentRecommendation` (takes `activeTab`), `quickJumpRegions`, `pridnestrovieDepotStatus`;
    - AI and report state: `lastBotDecision`, `combatReportOpen`, `lastEventLogSnapshot`,
      `latestDefeatAnnouncement`, `dismissedDefeatAnnouncement`, each with its setter;
    - turn handlers: `handleAdvanceTurn`, `handleRunAiTurn`, `handleAutoPlay`;
    - the autosave effect.
  - **useSelection:**
    - state: `selectedRegionId`, `selectedUnitIds`, `selectedFacilityId` and their setters;
    - derived values: `selectedUnitId`, `selectedRegion`, `selectedCountry`, `controllerCountry`,
      `unitsInRegion`, `validTargets`, `regionBuildOrders`;
    - handlers: `handleSelectRegion`, `handleSelectUnit`, `handleSelectUnitFromMap`,
      `handleSelectFacilityFromMap`, `handleHoldUnit`, `handleCancelOrder`,
      `handleClearAllOrders`, `getUnitOrder`.
  - **useEconomyActions:**
    - helpers: `canAfford`, `getMissingResources`, `getOperationalFacilities`,
      `getBestOperationalFacility`;
    - build handlers: `handleBuildFacility`, `handleUpgradeFacility`, `handleRepairFacility`,
      `handleBuildFortification`, `handleUpgradeFortification`, `handleRepairFortification`,
      `handleRemoveFacility`, `handleRecruitUnit`;
    - other handlers: `handleCancelBuildOrder`, `handleReplenishUnit`, `handlePurchaseDoctrine`,
      `handleToggleChemicalMode` (the facility pop-up's inline toggle now calls this).
  - **useDiplomacy:**
    - state: `diplomacyTab`, `selectedDiplomacyCountryId` and `diplomacyIntensity`, each with its
      setter;
    - target lists: `diplomacyTargets`, `diplomacyAlliesTargets`, `diplomacyEnemyTargets`,
      `diplomacyNeutralTargets`, `visibleDiplomacyTargets`;
    - details: `diplomacySnapshot`, `selectedDiplomacyCountry`, `selectedDiplomacyState`;
    - `handleDiplomacyAction` and the selection-sync effect.
  - **useSaveSlots:**
    - state: `saveLoadOpen`/set, `saveLoadMode`, `saveSlots`, `selectedSaveSlotName`/set,
      `saveSlotInput`/set, `selectedSaveSlot`;
    - handlers: `refreshSaveSlots`, `openSaveLoadPanel`, `saveToSlot`, `handleSaveGame`,
      `handleLoadGame`, `handleLoadSelectedSlot`, `handleLoadLegacyQuickSave`,
      `handleDeleteSelectedSlot`.
  - **Composed in GameProvider** (they touch several hooks):
    - `loadStateFromSave(next, label)`. It runs the old App 419-436 logic, then also calls
      `setGameStarted(true)` so loading works from the start screen in Task 29. It is passed into
      `useSaveSlots` as `onLoad`.
    - `handleStartGame()`: the old App 1201-1219.
- Pure save parsing (`saveSlots.ts`):

```ts
export const SAVE_SLOT_PREFIX = "mapgame_slot_";
export function parseSaveSlot(name: string, raw: string, fallbackCountryId: CountryId): SaveSlotEntry | null; // App 350-369 logic
export function sortSaveSlots(slots: SaveSlotEntry[]): SaveSlotEntry[]; // newest savedAt first
```

**Hook call order in GameProvider:** useToasts → useUiState → useGameSession → useSelection (gets
the UI setters and `addToast`) → useEconomyActions → useDiplomacy → `loadStateFromSave` definition
→ useSaveSlots.

**Decision to record in the changelog:**
- Spec 6.4 describes the context in groups (`session`, `selection`, `ui`, `economy`, `toasts`).
- This plan implements those groups as separate hooks but keeps the context value **flat**, so the
  JSX moved in Tasks 7-11 stays unchanged.
- Log this under `Decision`.

- [x] **Step 1: Write `saveSlots.test.ts`** (Review Focus 1).
  - An envelope payload gives `isLegacyPayload: false` and keeps `savedAt`, `turn` and `countryId`.
  - A raw `GameState` JSON (from `createInitialState("POLAND")`, `turn: 7`) gives
    `isLegacyPayload: true`, `savedAt: new Date(0).toISOString()`, `turn: 7` and
    `countryId: "POLAND"`.
  - A raw state without `playerCountryId` uses the fallback country.
  - `"{not json"` gives `null`.
  - `sortSaveSlots` puts the newest first and epoch-0 legacy slots last.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement `saveSlots.ts`; expect PASS.
- [x] **Step 3: Carve the hooks** as listed, then delete `useGameController.ts`.
- [x] **Step 4: Check file sizes.** Run
  `node -e "const fs=require('fs'),p=require('path');const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(d,e.name)):[p.join(d,e.name)]);for(const f of [...w('src/app'),...w('src/ui')]){const n=fs.readFileSync(f,'utf8').split('\n').length;if(n>400)console.log(n,f)}"`.
  Expect the output to list only `src/ui/TheaterMap.tsx` (deleted in Task 28).
- [x] **Step 5: Run the C7 phase-end checks and the layout compare at both sizes.** Expect PASS.
  Then do the full manual pass:
  - start, then save a slot, then load it;
  - load a slot saved on `legacy` (create one by checking out `legacy` in a temporary worktree,
    or reuse an existing browser save);
  - diplomacy action, doctrine purchase, build, End Turn.
- [x] **Step 6: Changelog, commit** `Carve game controller into focused hooks`. (Commit made; the
  `git push origin main` is withheld: Marek instructed on 2026-10-18 not to push unless he says so.)

---

## Phase 3: Look

Each restyle task applies spec section 7 (tokens, kit) and section 8 (per-element rules), then
checks:
- the layout compare at **both** sizes (PASS);
- screenshots of the restyled elements at 1440x900, compared against the spec bullets for those
  elements;
- the type check and build.

Layout declarations (`position`, `top`, `right`, `bottom`, `left`, `width`, `height`, `min-*`,
`max-*`, `transform`, `z-index`, `display`, `grid-*`) stay verbatim. Bars keep their heights
(top bar 36 px).

Every restyled component also loses its remaining inline `style={{...}}` objects, which become CSS
classes using the tokens. The only inline styles allowed are runtime-dynamic values: nation color
swatches, progress widths, diplomacy marker positions and similar.

### Task 13: Theme foundation (fonts, tokens, palette)

**Files:**
- Modify: `package.json`. Run `npm install @fontsource/oswald @fontsource/inter lucide-react`.
- Create: `src/ui/theme/tokens.css`, with the spec 7.1 table verbatim plus this alias block:

```css
:root { /* aliases for CSS not yet restyled; unused ones are removed in Task 30 */
  --bg: var(--bg-app); --panel: var(--surface-1); --panel-soft: var(--surface-2);
  --border: var(--line-strong); --muted: var(--text-dim); --accent: var(--gold); --eu: var(--nato);
}
```

- Modify: `src/ui/theme/base.css`.
  - `body` gets `background: var(--bg-app)`, `color: var(--text)` and
    `font-family: var(--font-body)`.
  - Scrollbars use `--line-strong` and `--surface-inset`.
  - Add a `.tabular` utility class with `font-variant-numeric: tabular-nums`.
- Modify: `src/app/main.tsx`. Import `@fontsource/oswald/{400,500,600}.css` and
  `@fontsource/inter/{400,500,600}.css`, then `tokens.css`, then `base.css`.
- Create: `src/ui/theme/palette.ts` + `palette.test.ts`

**Interfaces:**
- Produces:

```ts
export const NATION_COLORS: Record<CountryId, string>;   // spec 7.2 table verbatim
export const NON_SCENARIO_LAND = "#3a3f45";
export const BLOC_COLORS: Record<BlocId, string>;       // { BRICS: "#b8423f", EU_NATO: "#3f72b8", NEUTRAL: "#8b8667" }
export const SHADE_OVERLAYS: readonly [string, null, string, string]; // ["rgba(255,255,255,0.06)", null, "rgba(0,0,0,0.07)", "rgba(255,255,255,0.03)"]
export const GEO_NEIGHBORS: ReadonlyArray<readonly [CountryId, CountryId]>; // list below
export function rgbDistance(hexA: string, hexB: string): number;
```

`GEO_NEIGHBORS` (land neighbors, verbatim):

```
RUSSIA-BELARUS RUSSIA-UKRAINE RUSSIA-NOVOROSSIA RUSSIA-BALTIC_FEDERATION RUSSIA-FINLAND RUSSIA-POLAND
BELARUS-POLAND BELARUS-UKRAINE BELARUS-BALTIC_FEDERATION NOVOROSSIA-UKRAINE PRIDNESTROVIE-MOLDOVA
PRIDNESTROVIE-UKRAINE SLOVAKIA-POLAND SLOVAKIA-CZECH_REPUBLIC SLOVAKIA-AUSTRIA SLOVAKIA-HUNGARY
SLOVAKIA-UKRAINE HUNGARY-AUSTRIA HUNGARY-SLOVENIA HUNGARY-CROATIA HUNGARY-SERBIA HUNGARY-ROMANIA
HUNGARY-UKRAINE GERMANY-POLAND GERMANY-CZECH_REPUBLIC GERMANY-AUSTRIA GERMANY-SWITZERLAND
POLAND-CZECH_REPUBLIC POLAND-UKRAINE POLAND-BALTIC_FEDERATION UKRAINE-ROMANIA UKRAINE-MOLDOVA
ROMANIA-MOLDOVA ROMANIA-SERBIA CZECH_REPUBLIC-AUSTRIA AUSTRIA-SWITZERLAND AUSTRIA-SLOVENIA
SLOVENIA-CROATIA CROATIA-BOSNIA_AND_HERZEGOVINA CROATIA-SERBIA CROATIA-MONTENEGRO
BOSNIA_AND_HERZEGOVINA-SERBIA BOSNIA_AND_HERZEGOVINA-MONTENEGRO SERBIA-MONTENEGRO SERBIA-KOSOVO
SERBIA-NORTH_MACEDONIA MONTENEGRO-KOSOVO MONTENEGRO-ALBANIA KOSOVO-ALBANIA KOSOVO-NORTH_MACEDONIA
ALBANIA-NORTH_MACEDONIA FINLAND-BALTIC_FEDERATION
```

- [x] **Step 1: Write `palette.test.ts`.**
  - "every nation has a color": the keys of `createInitialState().countries` are all in
    `NATION_COLORS`.
  - "neighbors are distinct": collect `GEO_NEIGHBORS`, plus every pair of different
    `controllerCountryId` values across `adjacentRegionIds` in `createInitialState("RUSSIA")`.
    Every pair has `rgbDistance ≥ 40` (closest expected: Austria and Slovakia at 41.5).
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement, then expect PASS.
- [x] **Step 3: Install packages, write the tokens and wire the fonts.** Run the browser check:
  the whole interface now uses Oswald and Inter and the new background. Run the layout compare at
  both sizes; expect PASS.
- [x] **Step 4: Changelog, then commit** with the message `Add style C tokens, fonts and nation palette`.

### Task 14: Kit components and the dev gallery

**Files:**
- Create in `src/ui/kit/`:
  - components: `Window.tsx`, `Button.tsx`, `Badge.tsx`, `StatRow.tsx`, `ProgressBar.tsx`,
    `Pips.tsx`, `Tabs.tsx`, `ResourceIcon.tsx`, `ResourceAmount.tsx`, `Flag.tsx`, `UnitSymbol.tsx`;
  - styles: `Window.css`, `Button.css`, `kit.css` (badge, stat row, progress, pips, tabs, flag,
    resource);
  - data modules: `resources.ts`, `flags.ts`, `unitSymbols.ts`;
  - `kit.test.ts`.
- Create: `src/ui/dev/KitGallery.tsx`. Modify `src/app/App.tsx` so that `?kit` in the URL renders
  `KitGallery` in dev (`import.meta.env.DEV`).

**Interfaces:**
- Produces:

```ts
// Window.tsx
interface WindowProps {
  title: React.ReactNode; icon?: LucideIcon; flag?: CountryId; actions?: React.ReactNode;
  onClose?: () => void; onBackdropClick?: () => void; variant?: "panel" | "modal" | "popup";
  className?: string; bodyClassName?: string; footer?: React.ReactNode; layoutId?: string; children: React.ReactNode;
}
// modal: renders <div className="win-backdrop" data-layout={`${layoutId}-backdrop`}> around the window;
// a backdrop click calls onBackdropClick ?? onClose. data-layout={layoutId} goes on the window element.
export function Window(props: WindowProps): JSX.Element;
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; icon?: LucideIcon }): JSX.Element;
export function Badge(props: { tone: "brics" | "nato" | "neutral" | "good" | "warn" | "bad" | "info" | "plain"; children: React.ReactNode }): JSX.Element;
export function StatRow(props: { label: React.ReactNode; value: React.ReactNode; tone?: "good" | "warn" | "bad" }): JSX.Element;
export function ProgressBar(props: { value: number /* 0..1 */; tone?: "good" | "warn" | "bad" | "gold" }): JSX.Element;
export function Pips(props: { count: number; max?: number /* default 4 */ }): JSX.Element;
export function Tabs<T extends string>(props: { tabs: { id: T; label: string; icon?: LucideIcon; count?: number }[]; active: T; onChange: (id: T) => void }): JSX.Element;

// resources.ts
export const RESOURCE_META: Record<StockpileKey, { label: string; Icon: LucideIcon; color: string }>;
export const FACILITY_META: Record<FacilityType, { label: string; Icon: LucideIcon }>;
export function ResourceIcon(props: { resource: StockpileKey; size?: number }): JSX.Element;
export function ResourceAmount(props: { resource: StockpileKey; amount: number; missing?: boolean }): JSX.Element;

// flags.ts: the single source of truth, also used by the map tooltip
export function flagSvgMarkup(countryId: CountryId, width: number, height: number): string; // returns "<svg ...>...</svg>"
// Flag.tsx: <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvgMarkup(id, w, h) }} />
export function Flag(props: { countryId: CountryId; width?: number /* 22 */ }): JSX.Element; // height = width * 2/3

// unitSymbols.ts: also used by the map renderer in Task 27
export const UNIT_TYPE_LABELS: Record<UnitType, string>; // infantry "Infantry", armor "Armor", mlrs "MLRS", fighter "Fighter", bomber "Bomber", tacticalMissile "Tactical missile", strategicMissile "Strategic missile"
export function unitSymbolPaths(type: UnitType): { frame: true; strokes: string[]; fills: string[]; letter?: string }; // SVG path data in a 24x16 box
export function UnitSymbol(props: { type: UnitType; size?: number /* width px, default 24 */; color?: string /* default currentColor */ }): JSX.Element;
```

**Resource data** (spec 7.3 icons). Each entry is label / color:

| Raw resources | Processed goods | Civilian goods and trade |
|---|---|---|
| oil `Oil` `#c9a227` | steel `Steel` `#b6c2cc` | textiles `Textiles` `#c08fb0` |
| coal `Coal` `#6b6f75` | fuel `Fuel` `#e0a040` | electronics `Electronics` `#6ec1d8` |
| iron `Iron` `#9aa7b0` | explosives `Explosives` `#e0605a` | vehicles `Vehicles` `#8fa3c9` |
| tungsten `Tungsten` `#b89d5e` | fertilizer `Fertilizer` `#7cc47c` | pharmaceuticals `Pharma` `#e08fa0` |
| food `Food` `#8fbf5a` | munitions `Munitions` `#d4a537` | luxuryGoods `Luxury` `#c7a2e0` |
| chemicals `Chemicals` `#9b7fd1` | energy `Energy` `#f0d050` | weed `Weed` `#6fbf73` |
| | | tradePoints `Trade` `#f0c75e` |

**Facility data.** Each entry is label / Lucide icon:

| Extraction and processing | Military | Civilian |
|---|---|---|
| mine `Mine` / `Pickaxe` | barracks `Barracks` / `Tent` | civilianFactory `Civilian factory` / `Factory` |
| oilWell `Oil well` / `Droplet` | armorFactory `Armor factory` / `Truck` | |
| farm `Farm` / `Tractor` | airFactory `Air factory` / `Plane` | |
| chemicalPlant `Chemical plant` / `FlaskConical` | munitionsPlant `Munitions plant` / `Bomb` | |
| powerPlant `Power plant` / `Zap` | | |
| smelter `Smelter` / `Flame` | | |
| refinery `Refinery` / `Fuel` | | |
| syntheticRefinery `Synthetic refinery` / `Fuel` | | |

**Flags** (spec 7.4) in a 30x20 viewBox. In this table, `h` means horizontal bands top to bottom
and `v` means vertical bands hoist to fly.

| Nation | Definition |
|---|---|
| RUSSIA | h `#ffffff #1c3f94 #d52b1e` |
| BELARUS | h `#c8313e #4aa657` (weights 2:1), plus a white hoist band 3 wide |
| NOVOROSSIA | `#c8102e` field; saltire as a white stroke 4.2, then a `#2b5fb0` stroke 2.6 |
| PRIDNESTROVIE | h `#c8102e #00843d #c8102e` |
| SLOVAKIA | h `#ffffff #0b4ea2 #ee1c25`, plus a shield at x 6-13 (fill `#ee1c25`, white double cross, white outline) |
| HUNGARY | h `#ce2939 #ffffff #477050` |
| GERMANY | h `#000000 #dd0000 #ffce00` |
| POLAND | h `#ffffff #dc143c` |
| ROMANIA | v `#002b7f #fcd116 #ce1126` |
| CZECH_REPUBLIC | white over `#d7141a`, `#11457e` hoist triangle to the center |
| FINLAND | white field, `#002f6c` cross (vertical bar x 8-13, horizontal bar y 8-12) |
| BALTIC_FEDERATION | h `#0072ce #9e3039 #fdb913` |
| UKRAINE | h `#005bbb #ffd500` |
| AUSTRIA | h `#ed2939 #ffffff #ed2939` |
| SERBIA | h `#c6363c #0c4076 #ffffff` |
| SWITZERLAND | `#d52b1e` field, white cross centered (bars 4 wide, 12 long) |
| BOSNIA_AND_HERZEGOVINA | `#002395` field, `#fecb00` triangle (8,0)-(22,0)-(22,20), seven white dots along the hypotenuse |
| MONTENEGRO | `#c40308` field, `#d4af3a` border 1.4 |
| KOSOVO | `#244aa5` field, six white dots on an arc above the center |
| ALBANIA | `#e41e20` field, black path `M15 4 L19 8 L23 7 L20 11 L22 15 L17 13 L15 16 L13 13 L8 15 L10 11 L7 7 L11 8 Z` |
| NORTH_MACEDONIA | `#d20000` field, `#ffe600` sun (circle r 3 at the center, 8 triangular rays to the edges) |
| CROATIA | h `#ff0000 #ffffff #171796`, plus a centered shield (fill `#ff0000`, white outline) |
| SLOVENIA | h `#ffffff #005da4 #ed1c24`, plus a hoist shield (fill `#005da4`, `#ed1c24` outline) |
| MOLDOVA | v `#0046ae #ffd200 #cc092f`, plus a centered shield (fill `#8a5a2b`) |

**Unit symbols** (spec 7.3) in a 24x16 box. Every symbol has the frame `x 1, y 1, w 22, h 14`.

| Type | Inside the frame |
|---|---|
| infantry | lines (1,1)-(23,15) and (23,1)-(1,15) |
| armor | ellipse center (12,8), radii 7 × 3.8 |
| mlrs | filled dot (12,9) r 1.8, plus an arrow (6,12)→(17,4) |
| fighter | path `M12 2 L13.5 7 L21 9 L13.5 10 L13 13 L15 14 L9 14 L11 13 L10.5 10 L3 9 L10.5 7 Z` |
| bomber | fighter path with wings to x 2 and x 22, plus letter `B` at (20,6) in 6-unit font; the letter is dropped when drawn under 14 px wide |
| tacticalMissile | arrow (5,13)→(19,3) |
| strategicMissile | two parallel arrows, offset 3 units |

- [x] **Step 1: Write `kit.test.ts`.**
  - `flagSvgMarkup` returns a string starting with `<svg` for every `CountryId`.
  - `RESOURCE_META` has every key of a real `CountryStockpile`, each with a defined `Icon`.
  - `FACILITY_META` has every `FacilityType` that appears in `FACILITY_BUILD_COSTS`.
  - `unitSymbolPaths` works for every `UnitType` in `MAX_UNIT_STRENGTH`.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement the data modules and components. If a
  Lucide name doesn't exist, the type check fails: pick the closest icon and note it under
  `Decision` in the changelog. Expect PASS.
- [x] **Step 3: Build `KitGallery`.** It shows:
  - all 24 flags with names;
  - all unit symbols;
  - Button variants and sizes;
  - Badges, StatRow, ProgressBar, Pips, Tabs;
  - all resource icons;
  - a static panel `Window` and a modal `Window`, rendered in normal page flow.

  Check `http://127.0.0.1:4173/?kit` against spec 7.
- [x] **Step 4: Run the type check and build, update the changelog, then commit**
  `Add style C kit components, flags and unit symbols`.

### Task 15: Restyle the HUD

**Files:**
- Modify: `TopBar.tsx/.css`, `BottomBar.tsx/.css`, `SupplyToggle.tsx/.css`,
  `ToastStack.tsx/.css`, and the `.map-control-button` rules in `src/ui/TheaterMap.css`.

**What changes** (spec 8):
- **Top bar:**
  - Dark band `#14181c` with a 1 px `--gold` bottom hairline.
  - Stats render as a `--text-dim` 11 px label plus an Oswald value; the nation stat shows its
    `Flag`.
  - End Turn is `primary`; Run AI, Auto x6, Diplomacy and Doctrines are `secondary`, with icons
    `Handshake` (Diplomacy) and `GraduationCap` (Doctrines).
  - Save and Load are `ghost` icon buttons (`Save`, `FolderOpen`) that keep their `title`s.
  - The `select` is restyled with `--surface-inset`.
- **Bottom bar:** each tab gets its spec 7.3 icon plus its label. The active tab gets a 2 px
  `--gold` underline and `--text`.
- **Supply toggle:** a pill with the `Network` icon and the text "Supply lines". When on: `--gold`
  fill and `--gold-ink` text.
- **Map controls:** square 30 px `--surface-1` buttons with a `--line` border; `+`, `−`, Reset.
- **Toasts:** `--surface-1` cards, a 3 px left edge in the tone color, and an icon per tone (`Info`,
  `CheckCircle2`, `TriangleAlert`, `OctagonAlert`).

- [x] **Step 1: Restyle.**
- [x] **Step 2: Run the layout compare at both sizes** (PASS) **and take screenshots.** Check that
  the bars are 36 px tall and that tab order and positions are unchanged.
- [x] **Step 3: Changelog, then commit** with the message `Restyle top bar, tab bar, supply toggle and toasts`.

### Task 16: Restyle the bottom-tab panels

**Files:**
- Modify: the 7 panels in `src/ui/panels/`, `FloatPanel.css` and `EconomyPanels.css`.

**What changes** (spec 8, "Floating panels"):
- Every panel uses `Window variant="panel"` with its positioning class passed through `className`
  and `layoutId` set to the probe name.
- **Region panel:**
  - The controller row shows `Flag`, the name and a bloc `Badge`.
  - Stability uses tone `good` at ≥ 70, `warn` at ≥ 40, otherwise `bad`.
  - Deposits use `ResourceIcon` plus `Pips max={5}`.
- **Economy and Recruitment:**
  - Facility rows show the `FACILITY_META` icon and label, `Lv.n`, and a `Badge tone="bad"` "Damaged".
  - Build buttons are `Button variant="secondary" size="sm"` with the existing `title` texts.
  - Queue rows use `ProgressBar`.
- **Orders:** chips show `UnitSymbol`, the order type and the target name.
- **War Status:** cards show `Flag` and a status `Badge`.
- **AI Intel and Event Log:** `--surface-2` cards.

- [x] **Step 1: Restyle.**
- [x] **Step 2: Run the layout compare at both sizes** (PASS) **and screenshot each tab.**
- [x] **Step 3: Changelog, then commit** with the message `Restyle bottom-tab panels`.

### Task 17: Restyle the unit drawer and map-side pop-ups

**Files:**
- Modify: `UnitDrawer.tsx`, `UnitCard.tsx`, `GlobalUnitsPanel.tsx`, `StockpilePopup.tsx`,
  `FacilityPopup.tsx` (+ sections) and their CSS.

**What changes:**
- **Unit cards:**
  - `UnitSymbol`, a 3 px left edge in the nation color (`NATION_COLORS`), and `ProgressBar` for
    strength (tones: good above 66% of `MAX_UNIT_STRENGTH`, warn above 33%, otherwise bad).
  - Supply, veterancy and entrenchment shown as small `Badge`s.
  - "Ally" and "Enemy" badges.
  - The order chip and the same buttons.
- **All-units list:** `UnitSymbol` and the same stats.
- **Stockpile pop-up:**
  - Four sections (Raw, Processed, Civilian, Special) of `ResourceAmount`.
  - The Logic Map button becomes `Button secondary`.
  - The weed saturation line keeps its text.
- **Facility pop-up:** `Window variant="popup"`, production rows with `ResourceIcon`, and
  recruit/upgrade/repair as `Button`s that keep their `title`s.

- [x] **Step 1: Restyle.**
- [x] **Step 2: Run the layout compare at both sizes** (PASS) **and take screenshots.**
- [x] **Step 3: Changelog, then commit** with the message `Restyle unit drawer and map-side pop-ups`.

### Task 18: Restyle the modal windows

**Files:**
- Modify: `diplomacy/*`, `DoctrineWindow.tsx`, `SaveLoadWindow.tsx`, `DefeatNotice.tsx`,
  `VictoryOverlay.tsx`, `EconomyLogicMap.tsx` and their CSS.

**What changes:**
- **Diplomacy:**
  - `Window variant="panel"` with class `diplomacy-window`.
  - Country cards get `Flag`.
  - The support bars keep every marker (center, lean and transit) and their positions, restyled
    with tokens.
  - Action tiles use kit styles.
  - The tabs use `Tabs`.
- **Doctrines:**
  - `Window variant="modal"` with `layoutId="doctrines"` and the same width rule
    (`min(680px, calc(100vw - 40px))`).
  - Category colors: military `--bad`, logistics `--warn`, others `--good`.
  - Owned doctrines show `Check`; locked ones show `Lock`. The cost reads "{n} TP".
- **Save and Load:** `Window variant="modal"` with `layoutId="save-load"`; slots become kit cards.
- **Defeat notice:** `Window variant="modal"`, with the `Flag` of the nation whose name begins the
  announcement (match by `countries[*].name`).
- **Victory overlay:** `Window variant="modal"` with the player's `Flag`. Keep its texts and
  buttons.
- **Economy logic map:** emoji become `RESOURCE_META`/`FACILITY_META` icons.

- [x] **Step 1: Restyle.**
- [x] **Step 2: Run the layout compare at both sizes** (PASS) **and take screenshots** of each
  window. Force the victory overlay by loading a crafted save if needed.
- [x] **Step 3: Changelog, then commit** with the message `Restyle diplomacy, doctrines, save/load and notices`.

### Task 19: Turn report

**Files:**
- Create in `src/ui/windows/turnReport/`: `parseTurnReport.ts`, `parseTurnReport.test.ts`,
  `fixtures.ts` (exports `TURN1_RUSSIA_EVENTS`), `TurnReportWindow.tsx` and `TurnReportWindow.css`.
- Modify: `useGameSession.ts`. `handleAdvanceTurn` stores
  `turnReport = { turn: s.turn, events: newEvents, before: s, after: next, playerCountryId }` and
  opens it when `newEvents.length > 0`, as today.
- Modify: `GameScreen.tsx`, which renders `TurnReportWindow`.
- Delete: `BattleReportWindow.tsx`.

**Interfaces:**
- Produces:

```ts
export type ReportCategory = "capture" | "battle" | "air" | "strike" | "move" | "supply" | "diplomacy" | "production" | "warning" | "other";
export interface ReportRow { category: ReportCategory; text: string; tone: "good" | "bad" | "warn" | "neutral"; lines: string[]; children?: string[] }
export interface ReportSection { key: CountryId | "WORLD"; relation: "you" | "ally" | "enemy" | "neutral" | "world"; rows: ReportRow[] }
export interface TurnReportSummary { battles: number; captures: number; moves: number; warEntries: number; defeats: number }
export interface TurnReport { turn: number; sections: ReportSection[]; summary: TurnReportSummary }
export interface TurnReportData { turn: number; events: string[]; before: GameState; after: GameState; playerCountryId: CountryId }
export function parseTurnReport(data: TurnReportData): TurnReport;
```

**Algorithm** (spec 10):
1. **Segment by nation.**
   - `actor` starts as `playerCountryId`.
   - A line matching `/^Turn advanced\. Active country: (.+)\.$/` sets `actor` to the country with
     that `name` and is dropped.
   - Lines matching `/entered the war on turn|has been defeated\.|secured the Pridnestrovie depot/`
     go to `WORLD`.
   - Every other line goes to `actor`.
2. **Categorize** with the regex order in spec 10.
3. **Build rows.**
   - Strip any leading `[...]` prefix and collapse whitespace (`/\s+/g` → `" "`).
   - Battles:
     - Outcome from `/\. (Decisive attacker victory|Attacker victory|Pyrrhic attacker victory|Surprising attacker breakthrough|Narrow defender hold|Defender holds)\./`.
     - The first four outcomes give tone `good`, the last two `bad`.
   - Captures: tone `good` when the new controller (matched by name) is the player or in the
     player's non-neutral bloc, otherwise `bad`.
   - Other tones: strike `warn`, warning `bad`, production `good`, everything else `neutral`.
4. **Aggregate per section.**
   - Lines matching `/^\[[^\]]+\] (\S+) suffers supply attrition in (.+) \(-(\d+) STR\)\.$/` merge
     per region into one row:
     - text: `` `${n} unit${n === 1 ? "" : "s"} lose${n === 1 ? "s" : ""} strength in ${region}: no supply (−${sum})` ``;
     - tone `warn`, category `supply`.
   - All `move` lines merge into one row:
     - text: `` `${n} unit${n === 1 ? "" : "s"} repositioned` ``;
     - `children` holds the cleaned lines.
   - An aggregated row takes the position of its first line within the section.
5. **Readable unit names.** Tokens matching `/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g` that exist in
   `before.units` or `after.units` become `` `${UNIT_TYPE_LABELS[type]} (${countryName})` ``. Apply
   this to `text` and `children`.
6. **Relations and section order.**
   - Relations: player → `you`; same non-neutral bloc → `ally`; both in different non-neutral
     blocs → `enemy`; otherwise `neutral`.
   - Section order: WORLD, you, allies, enemies, neutrals, each group in first-appearance order.
     Drop empty sections.
7. **Summary.**
   - `battles` and `captures` count those lines.
   - `moves` counts move lines.
   - `warEntries` and `defeats` count the matching WORLD lines.
8. **Invariant:** the sum of `row.lines.length` over all sections equals the number of input lines
   that are not "Turn advanced" markers.

**`TURN1_RUSSIA_EVENTS`** (real engine output; note the double space after "Battle of X:"):

```ts
export const TURN1_RUSSIA_EVENTS = [
  "[RUSSIA] pmr-ru-inf-1 suffers supply attrition in Tiraspol (-1 STR).",
  "[RUSSIA] pmr-ru-inf-2 suffers supply attrition in Tiraspol (-1 STR).",
  "[RUSSIA] pmr-ru-arm-1 suffers supply attrition in Tiraspol (-2 STR).",
  "Turn advanced. Active country: Germany.",
  "Germany used Public Campaign (level 2) in Austria. Elite +12, public +40.",
  "[Germany] infantry moved from Berlin to Essen.",
  "[Germany] armor moved from Dresden to Munich.",
  "[Germany] infantry moved from Berlin to Essen.",
  "[Germany] infantry moved from Hannover to Hamburg.",
  "[Germany] infantry moved from Berlin to Hamburg.",
  "Turn advanced. Active country: Novorossia.",
  "[Novorossia] armor moved from Mariupol to Tokmak.",
  "Battle of Odesa:  (2 units coordinated) Ratio 1.19. Attacker victory. [fort -5] [fort held]",
  "Battle of Brovary:  Ratio INF. Decisive attacker victory.",
  "Battle of Dnipro:  Ratio 0.21. Defender holds. [fort -1]",
  "Turn advanced. Active country: Poland.",
  "[Poland] armor moved from Poznan to Gdansk.",
  "[Poland] infantry moved from Warsaw to Gdansk.",
  "[Poland] infantry moved from Warsaw to Gdansk.",
  "[Poland] infantry moved from Warsaw to Gdansk.",
  "Turn advanced. Active country: Pridnestrovie.",
  "Turn advanced. Active country: Romania.",
  "[Romania] infantry moved from Bucharest to Cluj-Napoca.",
  "[Romania] infantry moved from Bucharest to Cluj-Napoca.",
  "[Romania] infantry moved from Constanta to Odesa.",
  "[Romania] infantry moved from Bucharest to Odesa.",
  "[Romania] armor moved from Constanta to Odesa.",
  "[Romania] infantry moved from Constanta to Odesa.",
  "Air combat over Tiraspol: Romania fighter vs 1 enemy interceptor(s).",
  "Turn advanced. Active country: Baltic Federation.",
  "[Baltic Federation] infantry moved from Riga to Tallinn.",
  "[Baltic Federation] infantry moved from Riga to Tallinn.",
  "[Baltic Federation] infantry moved from Riga to Tallinn.",
  "[Baltic Federation] infantry moved from Vilnius to Kaunas.",
  "[Baltic Federation] infantry moved from Vilnius to Kaunas.",
  "[Baltic Federation] armor moved from Vilnius to Kaunas.",
  "Turn advanced. Active country: Ukraine.",
  "[Ukraine] infantry moved from Kyiv to Dnipro.",
  "[Ukraine] infantry moved from Kyiv to Dnipro.",
  "[Ukraine] Bomber sortie on Donetsk: 4 unit damage dealt. Fort hit for 3.",
  "Battle of Brovary:  Ratio 0.82. Pyrrhic attacker victory. [1 retreated] [defenders routed]",
  "Turn advanced. Active country: Russia.",
];
```

- [x] **Step 1: Write the failing tests** using `before = after = createInitialState("RUSSIA")`
  and `playerCountryId: "RUSSIA"`:
  - **Sections:** keys in order `["RUSSIA", "NOVOROSSIA", "GERMANY", "POLAND", "ROMANIA", "BALTIC_FEDERATION", "UKRAINE"]`.
    Relations `you`, `ally`, then `enemy` for the rest. No `PRIDNESTROVIE` section.
  - **Russia's section:** exactly one row, text
    `3 units lose strength in Tiraspol: no supply (−4)`, tone `warn`.
  - **Its children** are not set; instead `lines` has length 3. The row text contains no `pmr-`.
  - **Germany:** one `diplomacy` row and one `move` row `5 units repositioned` with 5 `children`.
    The first child is `infantry moved from Berlin to Essen.`.
  - **Novorossia:** battle tones `["good", "good", "bad"]`, plus `1 unit repositioned`.
  - **Ukraine:** one `strike` row (tone `warn`), one battle with tone `good`, and
    `2 units repositioned`.
  - **Summary:** `{ battles: 4, captures: 0, moves: 24, warEntries: 0, defeats: 0 }`.
  - **No marker leaks:** no row `text` contains `Turn advanced`.
  - **Invariant:** the sum of `row.lines.length` is 34 (42 lines minus 8 markers).
  - **World events:** with
    `["Slovakia entered the war on turn 5: scripted.", "Turn advanced. Active country: Germany.", "Warsaw is now controlled by Russia."]`,
    the first section is `WORLD` and a `capture` row in Germany's section has tone `good`.
  - **Readable unit names:** a line
    `"[RUSSIA] pmr-ru-inf-1 is cut off from the capital supply network in Tiraspol."` becomes text
    `Infantry (Russia) is cut off from the capital supply network in Tiraspol.`.
  - **Review Focus 5:** 2,000 synthetic lines spread over 15 nation markers parse in under 50 ms
    (`performance.now()`) and keep the invariant. With `playerCountryId` set to `"BELARUS"` (absent
    from every marker), there is no `you` section and no throw.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement the parser; expect PASS.
- [x] **Step 3: Build `TurnReportWindow`** (spec 10 "Layout"):
  - `Window variant="modal"` with `layoutId="turn-report"` and title `Turn {turn} report`.
  - A summary chip row (only non-zero war entries and defeats).
  - Section headers with `Flag`, the name and a relation `Badge` ("you", "ally", "enemy",
    "neutral").
  - Rows with a category icon: battle `Swords`, capture `Flag`, strike `Bomb`, air `Plane`,
    move `Route`, supply `TriangleAlert`, diplomacy `Handshake`, production `Factory`,
    warning `OctagonAlert`, other `Info`.
  - The move row expands to show its `children`.
  - The footer has a `Dismiss` primary button. A backdrop click closes the window, as today.
- [x] **Step 4: Browser check:** End Turn opens the new report. Then run the C7 phase-end checks,
  the layout compare at both sizes (PASS) and screenshots of the main screen with every
  window/panel open.
- [x] **Step 5: Changelog, commit** `Add grouped turn report`. (Commit made; the
  `git push origin main` is withheld: Marek instructed on 2026-10-18 not to push unless he says so.)

---

## Phase 4: New map

### Task 20: Geometry foundation (projection, country shapes, polygon utilities)

**Files:**
- Modify: `package.json`. Run `npm install polygon-clipping`. If its package has no typings, add
  `src/types/polygon-clipping.d.ts` declaring `intersection(...geoms): MultiPolygon` with the
  types below.
- Create in `src/ui/map/geometry/`: `types.ts`, `projection.ts`, `countryShapes.ts`, `polygon.ts`,
  `polygon.test.ts` and `countryShapes.test.ts`.

**Interfaces:**
- Produces:

```ts
// types.ts
export type Point = [number, number]; export type Ring = Point[]; export type Polygon = Ring[]; // [exterior, ...holes]
export type MultiPolygon = Polygon[]; export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

// projection.ts
export const WORLD = { width: 1600, height: 980 } as const;            // = theaterMapSize
export const WORLD_CLIP: [[number, number], [number, number]] = [[-200, -200], [1800, 1180]];
export function createProjection(): GeoProjection;                     // identical to TheaterMap.tsx:133-159
export function projectGeoPoint(p: GeoPoint): Point;                     // uses a module-level createProjection()

// polygon.ts
export function ringArea(r: Ring): number;                               // signed shoelace
export function pointInRing(x: number, y: number, r: Ring): boolean;     // even-odd
export function pointInPolygon(x: number, y: number, p: Polygon): boolean;      // in exterior and in no hole
export function pointInMultiPolygon(x: number, y: number, mp: MultiPolygon): boolean;
export function multiPolygonArea(mp: MultiPolygon): number;              // |exteriors| - |holes|
export function bboxOf(mp: MultiPolygon): BBox;
export function bboxContainsPoint(b: BBox, x: number, y: number): boolean;
export function distanceToSegment(px: number, py: number, a: Point, b: Point): number;
export function nestRings(rings: Ring[]): MultiPolygon;                  // see algorithm below

// countryShapes.ts
export const COUNTRY_ID_BY_NUMERIC: Record<number, CountryId>;          // TheaterMap.tsx:24-48 verbatim
export const CLIP_ID_BY_REGION: Record<string, number>;                 // TheaterMap.tsx:67-78 verbatim
export function getClipNumericId(regionId: string, homeCountryId: CountryId): number | undefined; // TheaterMap.tsx:126-131 logic
export interface CountryShape { numericId: number; countryId: CountryId | null; polygon: MultiPolygon; bbox: BBox }
export function loadCountryShapes(): CountryShape[];                    // every world-atlas feature with area inside WORLD_CLIP
```

**`loadCountryShapes` algorithm:**
1. `const proj = createProjection().clipExtent(WORLD_CLIP)`.
2. For each feature of `feature(countries50m, objects.countries)`, run
   `geoPath(proj, collector)(feature)`. The `collector` implements `moveTo` (starts a ring),
   `lineTo` (appends), `closePath` (closes the ring) and a no-op `arc`. d3 handles antimeridian
   cutting and the rectangle clip.
3. `polygon = nestRings(rings)`. Skip features with zero area. Set
   `countryId = COUNTRY_ID_BY_NUMERIC[numericId] ?? null`.

**`nestRings` algorithm:**
1. Drop rings with fewer than 3 distinct points or `|ringArea| < 0.01`.
2. The sign of the largest-|area| ring marks exteriors; rings with the opposite sign are holes.
3. Each hole goes to the smallest exterior that contains its first vertex. Orphan holes are
   dropped.

- [x] **Step 1: Write the failing tests.**
  - **polygon.ts** on a 10x10 square with a 2x2 hole:
    - `pointInPolygon` gives true at (1,1) and false at (5,5) inside the hole;
    - `multiPolygonArea` is 96;
    - `nestRings([outer, hole])` gives 1 polygon with 1 hole;
    - `distanceToSegment(0,5,[0,0],[10,0])` is 5.
  - **countryShapes.ts:**
    - every id in `europeCountryIds` has a shape with that `countryId`;
    - Russia's bbox lies within `WORLD_CLIP`;
    - all coordinates are finite;
    - `projectGeoPoint({lon: 21.0122, lat: 52.2297})` is inside Poland's polygon;
    - Italy at `{lon: 12.5, lat: 42.5}` is inside a shape with `countryId === null`.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Changelog, then commit** with the message
  `Add map geometry foundation: projection, country shapes, polygon utils`.

### Task 21: Region polygons and map-point fixes

**Files:**
- Create: `src/ui/map/geometry/regionShapes.ts` + `regionShapes.test.ts`
- Modify: `src/game/content/regionGeo.ts`, filling in `MAP_POINT_OVERRIDES` entries (display-only, C3)

**Interfaces:**
- Consumes: `CountryShape`, `getClipNumericId`, `projectGeoPoint`, `getRegionGeoPoint`.
- Produces:

```ts
export interface RegionInput { id: string; homeCountryId: CountryId; point: Point }
export interface RegionShape { id: string; clipNumericId: number; polygon: MultiPolygon; bbox: BBox; point: Point; area: number; usedFallback: boolean }
export function getRegionInputs(regions: Record<string, RegionDefinition>): RegionInput[]; // points via getRegionGeoPoint + projectGeoPoint
export function buildRegionShapes(inputs: RegionInput[], shapes: CountryShape[]): Map<string, RegionShape>;
```

**Algorithm** (spec 11.2.3):
1. Group the inputs by `getClipNumericId`.
2. A group with one region uses the country polygon as its shape.
3. Otherwise build `Delaunay.from(points).voronoi([-200, -200, 1800, 1180])`. For each cell, take
   `polygonClipping.intersection([cellRing], countryPolygon)`.
4. If that throws, use the cell clipped to the country bbox rectangle with
   `polygonClipping.intersection` and set `usedFallback: true`.

- [x] **Step 1: Write the failing tests** on `createInitialState("RUSSIA")`:
  - one shape per region id (103) with `area > 0`;
  - "every city point lies inside its own polygon": the list of violating ids equals `[]`;
  - no shape has `usedFallback`;
  - for each clip group, the sum of region areas is within 1% of the clipped country area;
  - `buildRegionShapes` takes under 600 ms in Node (the browser budget of 300 ms is checked in
    Task 26).
- [x] **Step 2: Run `npm test`.** Expect FAIL: the module is missing. Implement, then run again.
  - The point-inside test now lists the violating regions (for example `kaliningrad-coast`).
  - For each one, add a `MAP_POINT_OVERRIDES` entry with the real coordinates of the region's named
    city, which must lie inside its clip country. For example:
    - `"kaliningrad-coast": { lon: 19.91, lat: 54.65 }` (Baltiysk);
    - `"podgorica-adriatic-gate": { lon: 19.10, lat: 42.09 }` (Bar) if it is listed.
  - Rerun until PASS.
- [x] **Step 3: Run** `npm test`, `npm run smoke` and `npm run balance-check`. Expect all to pass.
- [x] **Step 4: Changelog** (list every override under `Decision`), then commit
  `Build region polygons and fix off-shape map points`.

### Task 22: Region lookup, boundary edges, shade variants, nation label points

**Files:**
- Create in `src/ui/map/geometry/`: `regionLookup.ts`, `boundaries.ts`, `labelPoints.ts`,
  `buildMapGeometry.ts`, plus `regionLookup.test.ts` and `boundaries.test.ts`.
- Create: `src/ui/map/startingControllers.ts` and `src/ui/theme/palette.geometry.test.ts`.

**Interfaces:**
- Produces:

```ts
// startingControllers.ts
export function getStartingControllers(state: GameState): Record<string, CountryId>; // from state.scenario.regions

// regionLookup.ts
export interface RegionLookup { regionAt(x: number, y: number): string | null; landAt(x: number, y: number): "region" | "foreign" | "sea" }
export function createRegionLookup(regions: Map<string, RegionShape>, background: CountryShape[]): RegionLookup; // bbox prefilter + pointInMultiPolygon

// boundaries.ts
export type EdgeKind = "internal" | "national" | "coast" | "foreign";
export interface BoundaryEdge { a: string; b: string | null; kind: EdgeKind; points: Point[] }
export function collectRegionNeighbors(regions: Map<string, RegionShape>, lookup: RegionLookup, step?: number): Map<string, Set<string>>;
export function buildBoundaryEdges(regions: Map<string, RegionShape>, lookup: RegionLookup, step?: number /* 0.6 */): BoundaryEdge[];
export function computeShadeVariants(regionIds: string[], neighbors: Map<string, Set<string>>): Map<string, 0 | 1 | 2 | 3>;

// labelPoints.ts
export function interiorPoint(mp: MultiPolygon, grid?: number /* 24 */): Point;
export function computeNationLabelPoints(regions: Map<string, RegionShape>, startingControllers: Record<string, CountryId>): Map<CountryId, { point: Point; area: number }>;

// buildMapGeometry.ts
export interface MapGeometry {
  regions: Map<string, RegionShape>; edges: BoundaryEdge[]; neighbors: Map<string, Set<string>>;
  background: CountryShape[]; scenarioShapes: CountryShape[]; lookup: RegionLookup;
  shadeVariant: Map<string, 0 | 1 | 2 | 3>; nationLabels: Map<CountryId, { point: Point; area: number }>;
  graticule: Point[][]; regionBounds: BBox; buildMs: number;
}
export function buildMapGeometry(regions: Record<string, RegionDefinition>, startingControllers: Record<string, CountryId>): MapGeometry;
// memoized at module level by the sorted region ids joined with ","
```

**Edge algorithm** (spec 11.2.5):
1. For every ring of every region polygon, and every segment (p, q) of length ≥ 1e-9:
   - `mid = (p+q)/2`; `n` is the unit normal of `q − p`.
   - Probe `s1 = mid + n*step` and `s2 = mid − n*step`.
   - Exactly one probe must be inside the region (`pointInMultiPolygon`); the other is `outside`.
     If neither or both are inside, skip the segment.
2. `b = lookup.regionAt(outside)` (ignore the region itself).
3. Kind:
   - `b` is null: kind is `foreign` if `lookup.landAt(outside) === "foreign"`, otherwise `coast`.
   - Otherwise kind is `internal` when `clipNumericId`s match, else `national`.
4. Merge runs of consecutive segments with the same `b` into one polyline. The ring wraps around:
   a run that crosses the ring's start joins the run at its end.
5. Keep an edge when `b === null || a < b`, so each shared border appears once.

**Shade variants:** greedy over the ids in sorted order. Each region takes the smallest variant in
`[0, 1, 2, 3]` not used by an already-assigned neighbor; if all four are taken, it gets 0.

**Interior point:**
1. Take the polygon with the largest area.
2. Sample a grid of `grid × grid` cell centers over its bbox and keep those inside.
3. Each point's score is its minimum `distanceToSegment` to any ring edge. Return the best.
4. If no sample is inside, return the region point.

**Nation label points:** for each nation that is a starting controller, use the `interiorPoint` of
its largest starting region; `area` is the sum of its starting regions' areas.

**Graticule:** project `geoGraticule10()` with the same collector approach (lines only).

- [x] **Step 1: Write the failing tests.**
  - **Lookup:**
    - `lookup.regionAt(shape.point)` equals the region id for every region;
    - `regionAt(projectGeoPoint({lon: 19.5, lat: 55.6}))` (Baltic Sea) is null and `landAt` is
      `"sea"`;
    - Italy `{12.5, 42.5}` gives `landAt === "foreign"`.
  - **Neighbors:**
    - symmetric: `b ∈ N(a)` implies `a ∈ N(b)` for every pair;
    - every region has ≥ 1 neighbor or coast edge;
    - `N("chisinau-pridnestrovie")` contains `"chisinau"`.
  - **Edges:**
    - some edge with `a` or `b` equal to `"gdansk"` has kind `coast`;
    - every edge has ≥ 2 points.
  - **Shades:** no two neighboring regions with the same starting controller share a variant.
  - **Labels:** a label point exists for each of the 24 nations and lies inside one of that
    nation's starting regions.
  - **`palette.geometry.test.ts`:** every pair of different starting controllers across
    `internal`/`national` edges has `rgbDistance ≥ 40`.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Changelog, then commit** with the message
  `Add region lookup, boundary edges, shades and label points`.

### Task 23: Camera math

**Files:**
- Create: `src/ui/map/camera.ts` + `camera.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Camera { scale: number; offsetX: number; offsetY: number } // screen = world * scale + offset (CSS px)
export interface Viewport { width: number; height: number }
export const MIN_ZOOM = 0.6; export const MAX_ZOOM = 24;                   // multiples of the fit scale (spec 11.3)
export function worldToScreen(c: Camera, x: number, y: number): Point;
export function screenToWorld(c: Camera, sx: number, sy: number): Point;
export function fitCamera(bounds: BBox, viewport: Viewport, padding?: number /* 40 */): Camera;
export function zoomAt(c: Camera, nextScale: number, sx: number, sy: number, minScale: number, maxScale: number): Camera;
export function clampCamera(c: Camera, viewport: Viewport, world: { width: number; height: number }, minVisible?: number /* 0.25 */): Camera;
export function zoomScaleAtProgress(fromScale: number, toScale: number, t: number): number; // fromScale * (toScale/fromScale) ** easeOutCubic(t)
export function easeOutCubic(t: number): number;
```

- [x] **Step 1: Write the failing tests.**
  - `screenToWorld(worldToScreen(p))` round-trips within 1e-9.
  - `zoomAt` keeps the world point under (sx, sy) fixed within 1e-6 and clamps to min and max.
  - `fitCamera` puts the bounds' center at the viewport's center, and both bounds dimensions fit
    within the viewport minus padding.
  - `clampCamera`: after panning the world fully off the right edge, at least 25% of the world's
    width is visible again.
  - `zoomScaleAtProgress(1, 4, 0) === 1`, `(1, 4, 1) === 4`, and it is monotonic.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Add map camera math`.

### Task 24: Derived map data

**Files:**
- Create: `src/ui/map/derive.ts` + `derive.test.ts`

**Interfaces:**
- Consumes: `MapGeometry` (`edges`), `NATION_COLORS`, `getStartingControllers`.
- Produces:

```ts
export interface UnitStackInfo { regionId: string; unitIds: string[]; majorityCountryId: CountryId; secondaryCountryId?: CountryId; majorityType: UnitType }
export interface OrderArrow { fromRegionId: string; toRegionId: string; type: Exclude<OrderType, "hold">; count: number }
export interface DerivedMapData {
  fillByRegion: Map<string, string>;            // NATION_COLORS[controllerCountryId]
  occupiedBy: Map<string, CountryId>;           // only occupied regions → pre-war controller
  frontEdgeIndexes: number[];                   // indexes into geometry.edges
  stacks: Map<string, UnitStackInfo>;           // regions with ≥ 1 unit; majority ties go to the first unit's country
  arrows: OrderArrow[];                         // the player's pending orders except hold, merged by from|to|type
  holdUnitIds: Set<string>;
  supply: { supplied: [string, string][]; unsupplied: [string, string][] } | null; // TheaterMap.tsx:314-361 logic, when showSupply
}
export function isFrontPair(state: GameState, regionA: string, regionB: string): boolean; // controllers' blocs differ and both controllers are at war
export function deriveMapData(state: GameState, geometry: Pick<MapGeometry, "edges">, opts: { playerCountryId: CountryId; showSupply: boolean }): DerivedMapData; // WeakMap cache keyed by state, then by showSupply
```

- [x] **Step 1: Write the failing tests** on `evaluateWarEntryRules(createInitialState("RUSSIA"))`
  and its geometry:
  - **Occupation:**
    - `occupiedBy.size === 0` at the start;
    - after setting `lublin` to `RUSSIA`/`BRICS`, `occupiedBy.get("lublin") === "POLAND"` and
      `fillByRegion.get("lublin") === NATION_COLORS.RUSSIA`.
  - **Front:**
    - every front edge links regions with different blocs whose controllers are both at war;
    - no front edge touches a `BELARUS` region at turn 1 (Belarus is not at war yet);
    - there is at least one front edge between `NOVOROSSIA` and `UKRAINE` regions.
  - **Stacks:** two Russian units and one Belarusian unit in one region give `majorityCountryId`
    `RUSSIA` and `secondaryCountryId` `BELARUS`.
  - **Arrows:** two move orders from moscow to smolensk give one arrow with `count: 2`; a hold order
    puts the unit in `holdUnitIds`.
  - **Supply:** `supply` is null when `showSupply` is false.
  - **Cache:** a second call with the same state returns the same object (`toBe`).
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Add per-state derived map data`.

### Task 25: Screen-space layout: labels, counters, edge pills, hit testing

**Files:**
- Create in `src/ui/map/layout/`: `labels.ts`, `counters.ts`, `pills.ts`, `hitTest.ts`, plus one
  test file for each.

**Interfaces:**
- Produces:

```ts
// labels.ts
export interface Box { x: number; y: number; width: number; height: number }
export interface LabelCandidate { id: string; text: string; x: number; y: number; width: number; height: number; priority: number /* 1 = highest */; forced: boolean; markerRadius: number }
export interface PlacedLabel extends Box { id: string; text: string; position: "right" | "left" | "above" | "below" }
export function placeLabels(candidates: LabelCandidate[], obstacles: Box[]): PlacedLabel[];

// counters.ts
export interface CounterBox extends Box { kind: "unit" | "stack"; regionId: string; unitIds: string[] }
export function counterSize(z: number): { width: number; height: number }; // 30x18 × clamp(sqrt(z), 0.85, 1.35)
export function layoutCounters(stacks: Map<string, UnitStackInfo>, cityScreen: Map<string, Point>, z: number, expandedRegionId: string | null): CounterBox[];

// pills.ts
export interface Insets { top: number; right: number; bottom: number; left: number } // map defaults: { top: 48, right: 12, bottom: 46, left: 12 }
export function edgePillAnchor(from: Point, to: Point, viewport: Viewport, insets: Insets): { x: number; y: number; angle: number } | null; // null when `to` is inside the inset rect

// hitTest.ts
export type MapHit = { kind: "unit"; unitId: string; regionId: string } | { kind: "stack"; regionId: string } | { kind: "city"; regionId: string } | { kind: "pill"; regionId: string } | { kind: "region"; regionId: string } | { kind: "sea" };
export interface FrameHitData { counters: CounterBox[]; cities: { regionId: string; x: number; y: number }[]; pills: (Box & { regionId: string })[] }
export function hitTest(sx: number, sy: number, frame: FrameHitData, camera: Camera, lookup: Pick<RegionLookup, "regionAt">, cityRadius?: number /* 9 */): MapHit;
```

**Rules:**
- **Label positions** relative to the marker center (x, y), with radius r:
  - right: `(x + r + 4, y − h/2)`;
  - left: `(x − r − 4 − w, y − h/2)`;
  - above: `(x − w/2, y − r − 3 − h)`;
  - below: `(x − w/2, y + r + 3)`.
- **Label order:** forced first, then priority ascending, then id.
- **Choosing a position:**
  - A non-forced label takes its first position that collides with no placed label or obstacle,
    and is skipped otherwise.
  - A forced label takes the first free position; if none is free, it takes the position with the
    least total overlap area.
- **Counters:**
  - The top edge sits at `city.y + 7`, centered horizontally on the city.
  - One unit gives one `unit` box. Two or more units, not expanded, give one `stack` box.
  - Expanded regions show rows of up to 4 `unit` boxes with a 2 px gap, centered, with rows going
    downward.
- **Pills:**
  - If `from` lies outside the inset rect, use the viewport center as `from`.
  - The anchor is where the segment from→to crosses the inset rect (Liang–Barsky); `angle` is
    `atan2(to − from)`.
- **Hit order:**
  1. counters, last drawn first;
  2. pills;
  3. the nearest city within `cityRadius`;
  4. `lookup.regionAt(screenToWorld(...))`;
  5. otherwise `sea`.
- **Units:** all boxes are CSS pixels. Nothing in these modules takes `devicePixelRatio`.

- [x] **Step 1: Write the failing tests**, including Review Focus 2, 3 and 4.
  - **Labels:**
    - 20 random candidates (seeded) produce pairwise non-overlapping placed boxes;
    - a forced candidate whose four positions are all blocked is still placed;
    - with two candidates competing for one spot, priority 1 wins.
  - **Counters:**
    - `counterSize(1)` is `{ width: 30, height: 18 }`;
    - `counterSize(4)` is 30 × 1.35 wide;
    - an expanded region with 8 units gives 2 rows of 4 and no overlapping boxes (Review Focus 3);
    - a non-expanded region with 3 units gives exactly one `stack` box;
    - box positions don't change with any DPR value (Review Focus 2: the API has no DPR input, so
      assert sizes at `z = 1` with a city at (100, 100) give `x = 85, y = 107`).
  - **Pills:** for targets in all 8 compass directions far outside a 1440x900 viewport, the anchor
    is inside `[12, 1428] × [48, 854]` (Review Focus 4). A target inside the inset rect gives
    `null`.
  - **Hit test:**
    - a point on a counter returns `unit` even when a city lies within 9 px;
    - a point 5 px from a city with no counter returns `city`;
    - an empty sea point returns `sea`.
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Changelog, then commit** with the message `Add map label, counter, pill and hit-test layout`.

### Task 26: MapController skeleton behind `?map=new`

**Files:**
- Create in `src/ui/map/`: `MapView.tsx`, `MapView.css`, `MapController.ts`,
  `render/renderFrame.ts`, `render/layers/base.ts` and `perf/frameStats.ts`.
- Move: the `.map-controls` and `.map-control-button` rules from `src/ui/TheaterMap.css` into
  `MapView.css`. `TheaterMap.tsx` imports `./map/MapView.css` until Task 28.
- Modify: `GameScreen.tsx` renders `MapView` instead of `TheaterMap` when
  `new URLSearchParams(location.search).get("map") === "new"`.

**Interfaces:**
- Consumes: `buildMapGeometry`, `getStartingControllers`, `deriveMapData`, camera functions,
  `layoutCounters`, `hitTest`.
- Produces:

```ts
// MapView.tsx: spec 11.7 props
export interface MapViewProps {
  state: GameState; selectedRegionId: string | null; selectedUnitIds?: string[];
  validMoveTargets?: string[]; validAttackTargets?: string[]; showSupplyOverlay?: boolean;
  onSelectRegion?: (regionId: string) => void; onSelectUnit?: (unitId: string) => void;
  mode?: "game" | "showcase"; highlightCountryId?: CountryId;
}
export const MapView: React.MemoExoticComponent<(props: MapViewProps) => JSX.Element>; // React.memo with the default shallow compare
// DOM: <div className="map-view" data-layout="map-view">
//        <canvas data-layout="map-canvas" />
//        <div className="map-tooltip" />
//        <div className="map-perf" />
//        {mode === "game" && <div className="map-controls" data-layout="map-controls">
//           buttons with data-layout-key zoomin / zoomout / reset}
//      </div>

// MapController.ts
export class MapController {
  constructor(elements: { canvas: HTMLCanvasElement; tooltip: HTMLDivElement; perf: HTMLDivElement });
  setProps(props: MapViewProps): void;  // stores the latest props and callbacks; re-derives when state or showSupplyOverlay changed; requestRender()
  zoomBy(factor: number): void;          // eased, anchored at the viewport center
  resetView(): void;                     // eased back to the fit camera
  focusRegion(regionId: string): void;   // eased pan so that region's city is on screen
  destroy(): void;                       // removes listeners and the ResizeObserver, cancels rAF and timers
}

// renderFrame.ts
export interface FrameInput {
  ctx: CanvasRenderingContext2D; viewport: Viewport; dpr: number; camera: Camera; z: number;
  geometry: MapGeometry; derived: DerivedMapData; state: GameState; props: MapViewProps;
  hoverRegionId: string | null; expandedRegionId: string | null; fontsReady: boolean;
}
export function renderFrame(input: FrameInput): FrameHitData;

// perf/frameStats.ts (dev)
export function recordFrame(ms: number): void;       // keeps a rolling window of 120 frames
export function recordRender(): void;                // MapView calls this in its render body
// exposes window.__mapStats = { renders, frames, lastFrameMs, avgFrameMs, p95FrameMs } when import.meta.env.DEV
```

**Controller behavior** (spec 11.3 and 11.6):
- **Geometry build:** schedule `buildMapGeometry` with `setTimeout(…, 0)`. Until it is built, draw
  the sea and the centered text "Preparing map…". Log `buildMs` in dev.
- **Canvas sizing:**
  - A `ResizeObserver` sets `canvas.width/height = round(css size × devicePixelRatio)`.
  - Every frame begins with `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`; world layers then apply the
    camera on top of that.
- **First fit and resize:** the first size fits the region-point bounds (`geometry.regionBounds`)
  with 40 px padding. On resize, keep the world point that was at the viewport center.
- **Pan:**
  - `pointerdown` with button 0 calls `setPointerCapture` inside try/catch (synthetic events from
    the benchmark have no active pointer).
  - Movement past 5 px becomes a drag; `clampCamera` applies after each move.
  - `pointerup`, `pointercancel` and `lostpointercapture` end the drag.
  - A pointerup without a drag counts as a click.
- **Wheel:**
  - A non-passive listener calls `preventDefault`.
  - `targetScale *= 1.0015 ** (−deltaY)`, clamped to `[MIN_ZOOM, MAX_ZOOM] × fitScale`.
  - Easing runs over 140 ms with `zoomScaleAtProgress` anchored at the cursor. Wheel events
    during an easing restart it from the current camera toward the new target.
- **Buttons:** `+` and `−` call `zoomBy(1.6)` and `zoomBy(1 / 1.6)`; Reset calls `resetView()`.
- **Click:**
  - Hits resolve in this order: `unit` → `onSelectUnit`; `stack` → `onSelectRegion` plus expand;
    `city` or `region` → `onSelectRegion`; `pill` → `focusRegion`; `sea` → nothing.
  - Any click that doesn't land on a stack collapses the expanded stack.
- **Rendering:** `requestRender()` coalesces into one `requestAnimationFrame`, and frames happen
  only on demand.
- **No React state:** the controller never calls React `setState`.
- **This task's frame** draws the sea (flat `#14303f`), background land (`NON_SCENARIO_LAND`),
  region fills (`derived.fillByRegion`) and city dots. Everything else comes in Task 27.

- [x] **Step 1: Implement the files above.**
- [x] **Step 2: Browser check** at `http://127.0.0.1:4173/?map=new` after starting as Russia:
  - regions draw in nation colors;
  - drag pans, the wheel zooms smoothly around the cursor, and `+`, `−` and Reset work;
  - clicking a region updates the Region panel;
  - with units selected, clicking a valid target issues the order (toast appears);
  - `window.__mapStats.renders` stays constant while you pan;
  - the dev console logs `buildMs ≤ 300`.
- [x] **Step 3: Run the benchmark** (pane visible, 1920x1080) on `?map=new`. Record the numbers in
  the changelog; C2 is checked in Task 28.
- [x] **Step 4: Run the type check and build, update the changelog, then commit**
  `Add canvas MapController skeleton behind ?map=new`.

### Task 27: All map layers, tooltip, pills and perf meter

**Files:**
- Create in `src/ui/map/render/`: `layers/sea.ts`, `layers/land.ts`, `layers/regions.ts`,
  `layers/borders.ts`, `layers/front.ts`, `layers/highlights.ts`, `layers/overlays.ts`,
  `layers/cities.ts`, `layers/units.ts`, `layers/arrows.ts`, `layers/labels.ts`,
  `layers/extras.ts`, plus `patterns.ts` and `symbols.ts`.
- Modify: `renderFrame.ts`, `MapController.ts` (hover, tooltip, F3 toggle, font readiness),
  `MapView.css` (tooltip, perf meter).
- Delete: `render/layers/base.ts`, whose parts are absorbed into the new layers.

**Interfaces:**
- Consumes: everything from Tasks 20-26, plus `UNIT_TYPE_LABELS`, `unitSymbolPaths`,
  `flagSvgMarkup`, `RESOURCE_META`, `NATION_COLORS`, `SHADE_OVERLAYS`, `MAX_UNIT_STRENGTH`,
  `getPridnestrovieDepotStatus`.
- Produces: `renderFrame` draws spec 11.4 layers 1-16 in order and returns `FrameHitData` (counter
  boxes, city points, pill boxes).

**Layer checklist.** Exact values are in spec 11.4; this list adds only what the spec leaves open.

| # | Layer | Notes beyond the spec |
|---|---|---|
| 1 | Sea | Vignette is a radial gradient centered on the viewport, from radius `0.2·max(w,h)` (`#14303f`) to `0.75·max(w,h)` (`#0f2531`). Noise is a 256 px canvas from a seeded PRNG, drawn in screen space at alpha 0.04. Graticule lines come from `geometry.graticule` |
| 2-3 | Coast halo and land | Halos stroke the outlines of `scenarioShapes` and `background` |
| 4 | Region fills | Plus `SHADE_OVERLAYS[shadeVariant]` |
| 5 | Occupation stripes | `patterns.ts` caches one `CanvasPattern` per nation color (16x16 tile, one diagonal 2.6 px line). Each frame, `pattern.setTransform(new DOMMatrix().scale(1 / camera.scale))` keeps the spacing constant on screen. Clip each occupied region's path when filling |
| 6-7 | Borders and front | Front lines use `derived.frontEdgeIndexes` |
| 8 | Highlights | Hover, then linked regions of the selection (`state.regions[selected].adjacentRegionIds`), then the selected region, then move/attack targets |
| 9 | Supply overlay | Port of the old map |
| 10-11 | Link network and selection links | Pills use `edgePillAnchor` with insets `{48, 12, 46, 12}`. A pill is a 22 px tall dark rect with a `--gold` border, the city name (Oswald 500 12px) and a small arrow rotated to `angle` |
| 12 | City markers | Every region, always |
| 13 | Order arrows | The "×N" badge sits at the curve midpoint |
| 14 | Counters | Use `layoutCounters`. The symbol comes from `symbols.ts`: draw `unitSymbolPaths` as `Path2D`, scaled into a 15x10 area at counter scale 1. Stacks show "×N" in place of strength. Hold orders get a small shield glyph at the bottom-right |
| 15 | Depot badge and deposits | Depot colors: claimed `rgba(96,198,124,.9)`, claimable `rgba(232,198,88,.92)`, locked `rgba(154,168,184,.86)`; text "DEPOT" in Oswald 600 11px. Deposit chips are 14x14 at `y − 16` above the marker with codes oil O, coal C, iron I, tungsten T, food F, chemicals Ch, plus richness dots underneath |
| 16 | Labels | Use `placeLabels` with counters as obstacles. Nation font size = `clamp(14, 26, 6 + 2.2·ln(area))`, uppercase, `letter-spacing` 0.12em (drawn char by char or with `ctx.letterSpacing` where supported). Draw labels only once `fontsReady` (`document.fonts.load("500 12px Oswald")` resolved, then `requestRender`) |

**Tooltip** (spec 11.3):
- `MapController` sets `tooltip.innerHTML` from escaped strings and `flagSvgMarkup`. It shows:
  - the region name, with "Capital" and "Key city" tags;
  - the controller's flag, name and bloc color;
  - "Occupied, originally {nation}" when occupied;
  - "{n} units" split as own/allied/enemy;
  - "Fort Lv.{level} {health}/{maxHealth}" when there is a fort;
  - "Stability {s}%".
- It is positioned 14 px right of and below the cursor and clamped inside the map, and hidden while
  dragging or when no region is hovered.
- Hover hit-testing runs inside the frame callback, at most once per frame.

**F3 perf meter** (dev only): a `keydown` listener toggles `.map-perf`, which shows the average and
p95 frame time and the render count, updated every 500 ms.

- [x] **Step 1: Implement layers 1-9.** Screenshot `?map=new` at the default view and zoomed into
  Poland. Check them against spec 11.4 #1-9: fills, shade variants, stripes (set Lublin to Russia
  through a crafted save, or use the dev console), the front line, and the highlights after
  selecting a region with units selected.
- [x] **Step 2: Implement layers 10-16, the tooltip and the perf meter.** Screenshot at `z ≈ 1`,
  `z ≈ 2` and `z ≈ 4`, and check against the spec 11.5 level-of-detail table:
  - all 103 city markers visible;
  - selecting Warsaw shows gold link lines and forced labels for every linked region;
  - zooming in until a linked city is off-screen shows an edge pill; clicking it pans to the city;
  - stacks expand on click;
  - order arrows appear for queued orders.
- [ ] **Step 3: Run the benchmark on `?map=new`** (pane visible, 1920x1080). Expect avg ≤ 8 ms,
  p95 ≤ 12 ms and `mapRenders: 0`. If it fails, profile which layer dominates and fix it before
  continuing (likely suspects: label measuring each frame, so cache `measureText` widths by text
  and font; pattern creation each frame).
- [x] **Step 4: Run the type check and build, update the changelog, then commit**
  `Draw all canvas map layers with tooltip and link pills`.

### Task 28: Switch over, parity, performance, cleanup

**Files:**
- Modify: `GameScreen.tsx`. Always render `MapView`, passing `selectedUnitIds={[...selectedUnitIds]}`
  and the same target arrays as before. Remove the `?map=new` switch.
- Delete: `src/ui/TheaterMap.tsx`, `src/ui/TheaterMap.css` and any leftover `.theater-map*` CSS.

- [x] **Step 1: Switch over and delete the old map.** `npx tsc -p tsconfig.app.json --noEmit` must
  pass, and searching for `TheaterMap` must find no remaining references.
- [x] **Step 2: Run the parity checklist** (spec 12.4) in the browser and tick each item in the
  changelog `Verified` entry.
- [ ] **Step 3: Run the benchmark** three times (pane visible, 1920x1080). The medians must meet C2.
  Record them next to the legacy numbers in `docs/superpowers/baselines/perf-legacy.md`.
- [x] **Step 4: Run the C7 phase-end checks and the layout compare at both sizes** (PASS, with
  `map-controls` keys `zoomin`/`zoomout`/`reset`).
- [x] **Step 5: Changelog, commit** `Switch to the canvas map and remove the SVG map`, then
  `git push origin main`.

---

## Phase 5: Start screen

### Task 29: Start screen with showcase map, Continue and Load game

**Files:**
- Create in `src/ui/screens/start/`: `StartScreen.tsx`, `StartScreen.css`, `NationColumn.tsx`,
  `NationCard.tsx`, `BriefingPanel.tsx`, `briefing.ts` and `briefing.test.ts`.
- Create: `src/ui/session/autosave.ts` + `autosave.test.ts`
- Modify: `MapController.ts`, adding showcase mode (spec 11.8).
- Modify: `App.tsx` renders `StartScreen`.
- Modify: `GameProvider`/`SaveLoadWindow` so the Save/Load window can open before a game starts
  (render it from `App` level when `saveLoadOpen`).
- Delete: `src/ui/LandingPage.tsx` and `LandingPage.css`.

**Interfaces:**
- Produces:

```ts
// briefing.ts
export interface NationBriefing {
  countryId: CountryId; name: string; blocLabel: "BRICS" | "EU NATO" | "Neutral"; tierLabel: "Major power" | "Middle power" | "Minor power";
  difficulty: "Easy" | "Medium" | "Hard" | "Very hard"; difficultyPips: 1 | 2 | 3 | 4; status: string;
  capitalName: string; regionCount: number; keyCityCount: number; unitSummary: string; warEntryText: string;
}
export function getNationBriefing(state: GameState, countryId: CountryId): NationBriefing;

// autosave.ts
export const AUTOSAVE_KEY = "mapgame_autosave";
export function parseAutosave(raw: string | null): { state: GameState; countryId: CountryId; turn: number } | null; // requires turn, playerCountryId, regions, units
```

**Briefing rules:**
- `status` and `difficulty` reuse `LandingPage`'s `getStartingStatus` and `getDifficulty` logic
  (move it here). Pips: Easy 1, Medium 2, Hard 3, Very hard 4.
- `unitSummary` counts the nation's units by type, in the order infantry, armor, mlrs, fighter,
  bomber, tacticalMissile, strategicMissile. Labels: "infantry", "armor", "MLRS", "fighter",
  "bomber", "tactical missile", "strategic missile"; add "s" when the count is above 1 for fighter,
  bomber and both missiles. Parts are joined with `" · "`.
- `warEntryText`:
  - at war: `"At war from turn 1."`;
  - otherwise, one sentence per rule: `"Joins the war on turn {n}."` for scripted rules, or the
    rule's `description` for threshold rules;
  - no rules: `"Neutral at the start."`.

**Layout** (spec 9):
- Header, spanning the three columns:
  - "Europe 2026" in Oswald 500, 12 px, `--gold`, letter-spacing 0.14em;
  - "Map Game" in Oswald 500, 32 px;
  - the subtitle "Pick a nation. Each one starts the war differently." in 12 px `--text-dim`.
- Grid: three bloc columns plus a 300 px briefing panel, with 14 px padding.
  - Each column is headed by its bloc name and nation count, and scrolls on its own when it
    overflows.
  - The selected card gets a `--gold` border and a `--gold-deep` fill.
- Background: `MapView mode="showcase"` with `highlightCountryId` set to the hovered nation card,
  falling back to the selected one, under an overlay `rgba(9,11,13,.62)`.
- Buttons:
  - Start: `data-layout="start-button"`, text "Start as {name}", primary.
  - Continue: only when `parseAutosave(localStorage.getItem(AUTOSAVE_KEY))` is non-null (wrap
    `localStorage` in try/catch). It calls `loadStateFromSave(state, "Continued autosave")`.
  - Load game: `openSaveLoadPanel("load")`.

**Showcase mode** (spec 11.8): no pointer listeners, no counters, arrows, tooltip or zoom controls,
and nation labels at every zoom. With `highlightCountryId`, regions whose starting controller is that
nation get a 2 px `#f6e7b0` outline, and the others get a `rgba(0,0,0,.35)` fill.

- [x] **Step 1: Write the failing tests.**
  - **Russia:** `status` "At war", `difficulty` "Easy", `difficultyPips` 1, `capitalName`
    "Moscow"; the unit counts add up to the number of Russian units in the state;
    `warEntryText` is "At war from turn 1.".
  - **Slovakia:** `warEntryText` contains "turn 5".
  - **Austria:** `difficulty` "Very hard", `difficultyPips` 4.
  - **parseAutosave:**
    - a valid state JSON gives `{ countryId, turn }` matching the state;
    - `null`, `"{bad"` and `'{"turn":3}'` give `null` (Review Focus 1).
- [x] **Step 2: Run `npm test`.** Expect FAIL. Implement; expect PASS.
- [x] **Step 3: Build the screen and showcase mode.** Browser check at 1440x900 and 1920x1080:
  - hovering a card highlights that nation on the map;
  - Start works;
  - Continue appears after playing one turn and reloading, and resumes on the same turn;
  - Load game opens the window, and loading a slot starts the game.
- [x] **Step 4: Run the C7 phase-end checks and the layout compare at both sizes.** Expect PASS.
- [x] **Step 5: Changelog, commit** `Add start screen with showcase map, Continue and Load game`,
  then `git push origin main`.

---

## Phase 6: Wrap-up

### Task 30: Final verification and docs

**Files:**
- Modify: `src/ui/theme/tokens.css`, removing alias variables with zero remaining `var(--name)` uses.
- Modify: the `CLAUDE.md` "Code layout" section, replaced with the new tree (`app/`, `game/`
  including `regionGeo`/`strategicDepot`/`playerActions`, `ui/session|screens|hud|panels|windows|kit|theme|format|map|dev`)
  plus one line each for `npm test`, `npm run check:layers` and the layout lock and benchmark
  scripts.
- Modify: `CHANGELOG.md`.

- [x] **Step 1: Remove unused aliases** and run the type check and build.
- [x] **Step 2: Run the full verification.**
  - The C7 checks.
  - The 400-line check (Task 12 step 4 command), which must print nothing.
  - Search `src/` for `style={{`. Every remaining hit must be a runtime-dynamic value (Phase 3
    rule); convert any others to classes.
  - The layout compare at both sizes (PASS).
  - The benchmark (C2) with the pane visible.
  - The full spec 12.4 parity checklist.
  - Screenshots of the start screen, the main screen and every panel and window, at both sizes.
- [x] **Step 3: Update `CLAUDE.md` and `CHANGELOG.md`.** `Verified` gets the final numbers; also
  list any deviations under `Decision`.
- [x] **Step 4: Commit and push.** Commit `Finish round 1 visual overhaul: docs and verification`,
  then `git push origin main`. (Commit made; the `git push origin main` is withheld: Marek
  instructed on 2026-10-18 not to push unless he says so.)
