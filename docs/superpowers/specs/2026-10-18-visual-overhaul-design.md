# Visual Overhaul and Restructure: Design Spec (Round 1)

- **Date:** 2026-10-18
- **Status:** Approved in conversation (parts 1-4); written spec awaiting Marek's review
- **Branch:** `main` (the pre-improvement game is frozen on `legacy`)
- **Implements:** the first of three planned improvement rounds (see "Later rounds")

## 1. Summary

Map Game works, but it looks like a data visualization, the map still stutters while panning and
zooming, and the whole interface lives in one 2,700-line file. This round:

1. **Restructures** the code: `src/app/App.tsx` (2,728 lines) and `src/ui/styles.css` (2,512 lines)
   are split into small, focused files. Behavior does not change and old saves keep loading.
2. **Restyles** every window, pop-up, the top and bottom bars, and the start screen in the chosen
   **style C, "painted strategy map"**: charcoal windows with gold accents, a distinct color per
   nation, Oswald + Inter typography, real icons and flags.
3. **Replaces the map** with a custom **Canvas 2D renderer**: smooth pan/zoom (pan and zoom never
   go through React), every region visible with its own border, regions filled with their
   *controller's* color, occupied land striped in its pre-war owner's color, a bold front line,
   NATO-style unit counters, order arrows, link lines to every directly linked region, and readable
   labels.
4. **Keeps the main-screen control layout** exactly as it is: the same controls, in the same order,
   in the same places.

No game rules, AI or balance change in this round.

## 2. Decisions made while brainstorming

| # | Decision | Choice |
|---|---|---|
| D1 | Game direction | Deep grand strategy (Hearts of Iron spirit); keep and deepen the economy |
| D2 | Audience | Single player, Marek only; no multiplayer, tutorial or hosting |
| D3 | Turn structure | Stays turn-based |
| D4 | Engine | Stay on the web stack (React + TypeScript + Vite). No Unreal or Godot rewrite. PixiJS stays a possible later upgrade for the map layer only |
| D5 | Visual style | C, "painted strategy map" (mockups shown in the brainstorming session) |
| D6 | Map technology | Custom Canvas 2D renderer |
| D7 | Main-screen layout | Frozen. Restyle only; moving or regrouping controls needs Marek's OK |
| D8 | Region visibility | Every region keeps a visible border and its own fill, also inside a country |
| D9 | Captured regions | Fill = controller's nation color; stripes in the pre-war owner's color mark occupied land |
| D10 | City nodes and links | All 103 city markers always drawn; selecting a region shows link lines to every directly linked region (per the game's adjacency list), forces their names visible, and points to off-screen ones |
| D11 | Delivery | Spec + plan written by Opus; implementation handed to a new Sonnet 5.5 session |

## 3. Scope

### In scope

- Code restructure (section 6).
- Design system and restyle of all windows, pop-ups, bars, toasts and modals (sections 7-8).
- Start screen redesign with Continue and Load game (section 9).
- Turn report redesign (section 10).
- New Canvas 2D map renderer with full feature parity plus the new map features (section 11).
- Tests, layout lock, performance benchmark (section 12).
- Docs: `CLAUDE.md` code layout section, `CHANGELOG.md` entries (section 13).

### Out of scope (later rounds)

- Animating AI moves on the map (turn replay) and showing odds before an attack.
- Any change to rules, combat, economy, diplomacy, AI, balance, victory conditions or war entry.
- Implementing `implementation_plan.md` TASK 6-9 (three-condition victory, siege loop, bloc AI,
  difficulty).
- New controls on the main screen, layout changes, sound, multiplayer, mobile layouts.

## 4. Hard constraints

| # | Constraint | How it is checked |
|---|---|---|
| C1 | **Main-screen arrangement is frozen.** Same controls, same order, same container, same side. Container edges move at most 4 px; control centers at most 32 px horizontally and 4 px vertically (fonts change, so text widths change slightly) | Layout lock script (12.2) at 1440x900 and 1920x1080 |
| C2 | **Smooth map.** During continuous pan/zoom at 1920x1080: average frame time ≤ 8 ms, p95 ≤ 12 ms; zero React re-renders of the map component | Pan/zoom benchmark (12.3) with the browser pane visible |
| C3 | **No rule changes.** `src/game/` changes are limited to pure moves/extractions listed in 6.3 and display-only map-point data (11.2.4) | `npm run smoke`, `npm run balance-check` unchanged results; code review |
| C4 | **Old saves load.** The `GameState` shape does not change | Load a save made on `legacy` |
| C5 | **Works offline.** Fonts and icons are bundled through npm; no CDN at runtime | Build output has no external URLs |
| C6 | **Rules engine stays UI-free.** Nothing in `src/game/` imports from `src/ui/` or React | `grep` check in the plan's final task |
| C7 | Type check, build, smoke and balance check pass at the end of every phase | Commands in `CLAUDE.md` |

## 5. Architecture overview

```
src/
  app/
    App.tsx                 Chooses StartScreen or GameScreen; wraps them in GameProvider (~100 lines)
    main.tsx                Imports fonts and global CSS, mounts App
  game/                     Rules engine (unchanged behavior) plus three extractions (6.3)
    content/regionGeo.ts      Map points and map size, moved from ui/mapLayout.ts
    rules/strategicDepot.ts   Pridnestrovie depot status + bloc path check (was copied 3x)
    rules/playerActions.ts    Pure versions of the player's economy/doctrine actions from App.tsx
  ui/
    session/                Game state and actions (React hooks + one context)
    screens/start/          Start screen
    screens/game/           GameScreen: composes HUD, map, panels and windows
    hud/                    TopBar, BottomBar, SupplyToggle, ToastStack
    panels/                 One file per bottom tab
    windows/                Pop-ups and modal windows, incl. turnReport/ and diplomacy/
    kit/                    Shared building blocks (Window, Button, Badge, Flag, ...)
    theme/                  tokens.css, base.css, palette.ts, fonts
    format/                 Pure display helpers (unit status labels, numbers, resource labels)
    map/                    Canvas map renderer (section 11)
```

**Data flow.** `GameProvider` owns `gameState` and all UI state and exposes them through one React
context (`useGame()`). Components read what they need and call actions. Game mutations go through
pure functions (`src/game/rules/*`) that take a `GameState` and return a new one. The map receives
the game state and selection as props, draws on a canvas, and reports clicks through callbacks; it
never stores game state of its own.

**CSS.** `theme/tokens.css` defines the design tokens, `theme/base.css` the resets and global
elements. Each component imports its own CSS file next to it (`TopBar.tsx` + `TopBar.css`). Inline
`style={{...}}` objects are removed, except for values that are truly dynamic (for example a nation
color swatch or a progress width).

## 6. Restructure

### 6.1 Rules

- **No behavior change.** Every handler keeps its guards, messages (toasts) and side effects.
- Work in small steps: extract one piece, type-check, run the game, commit.
- Layout and positioning CSS moves **verbatim** in this phase; visuals change only in phase 3.

### 6.2 Where each part of `App.tsx` goes

| Current `App.tsx` lines | Content | New home |
|---|---|---|
| 45-47, 702-778, 1201-1219, 242-262 | Session creation, End Turn, Run AI, Auto x6, start game, autosave, victory status | `ui/session/useGameSession.ts` |
| 49-61, 341-482 | Save slot types and save/load/delete logic | `ui/session/useSaveSlots.ts` |
| 234-240 | Toasts | `ui/session/useToasts.ts`, rendered by `ui/hud/ToastStack.tsx` |
| 201-232, 484-606 | Selected region/units/facility, valid targets, click-to-order, hold, cancel, clear orders | `ui/session/useSelection.ts` |
| 608-700, 780-1101 | Replenish, doctrines, build/upgrade/repair/fortify/recruit/demolish/cancel, canAfford | `game/rules/playerActions.ts` (pure) + `ui/session/useEconomyActions.ts` (calls + toasts) |
| 66-88 | Supply status, veterancy, entrenchment labels | `ui/format/unitStatus.ts` |
| 90-145 | Depot status and bloc path check | `game/rules/strategicDepot.ts` |
| 1232-1279 | Top bar | `ui/hud/TopBar.tsx` |
| 2398-2425, 1109-1118 | Bottom tab bar and tab list | `ui/hud/BottomBar.tsx` |
| 2619-2642 | Supply lines toggle | `ui/hud/SupplyToggle.tsx` |
| 1933-1995 | Region tab | `ui/panels/RegionPanel.tsx` |
| 1997-2107 | Economy tab | `ui/panels/EconomyPanel.tsx` |
| 2109-2298 | Recruitment tab | `ui/panels/RecruitmentPanel.tsx` |
| 2300-2342 | Orders tab | `ui/panels/OrdersPanel.tsx` |
| 2344-2369 | AI Intel tab | `ui/panels/AiIntelPanel.tsx` |
| 2371-2384 | War Status tab | `ui/panels/WarStatusPanel.tsx` |
| 2386-2396 | Event Log tab | `ui/panels/EventLogPanel.tsx` |
| 1581-1660 | Unit drawer | `ui/windows/UnitDrawer.tsx` + `UnitCard.tsx` |
| 1529-1566 | All units list | `ui/windows/GlobalUnitsPanel.tsx` |
| 1662-1722 | Stockpile pop-up | `ui/windows/StockpilePopup.tsx` |
| 1724-1929 | Facility pop-up | `ui/windows/FacilityPopup.tsx` (+ section components) |
| 1350-1527, 1125-1199 | Diplomacy window and its bar/card renderers | `ui/windows/diplomacy/` (`DiplomacyWindow`, `DiplomacyBar`, `DiplomacyListCard`, `DiplomacyActions`) |
| 2644-2725 | Doctrines | `ui/windows/DoctrineWindow.tsx` |
| 1281-1348 | Save/Load | `ui/windows/SaveLoadWindow.tsx` |
| 2469-2526 | Battle report | `ui/windows/turnReport/` (section 10) |
| 2427-2467 | Country defeated notice | `ui/windows/DefeatNotice.tsx` |
| 2563-2613 | Victory/defeat overlay | `ui/windows/VictoryOverlay.tsx` |
| (separate file) | Economy logic map | `ui/windows/EconomyLogicMap.tsx` (moved) |
| 1221-1230, 188-198 | Landing page | `ui/screens/start/` (section 9) |
| 1232-2726 (shell) | Game layout | `ui/screens/game/GameScreen.tsx` |

`ui/TheaterMap.tsx` stays in use until the new map replaces it in phase 4, then it is deleted.

### 6.3 Game-layer extractions (pure, behavior-preserving)

1. **`game/content/regionGeo.ts`** takes over `ui/mapLayout.ts` unchanged (`GeoPoint`,
   `theaterMapSize`, `europeCountryIds`, `theaterMapLayout`). `createInitialState.ts` imports it
   from here, so the rules engine no longer imports UI code. It also gains
   `MAP_POINT_OVERRIDES` (11.2.4).
2. **`game/rules/strategicDepot.ts`** exports `hasBlocPathToRegion` and
   `getPridnestrovieDepotStatus` (with the `detail` text). `turnEngine.ts`, the UI and the map use
   this single copy.
3. **`game/rules/playerActions.ts`** exports one pure function per player action. Each returns
   `{ ok: true, state, toast? } | { ok: false, toast? }`, where `toast` is present exactly where the
   old handler showed one (silent failures stay silent):
   `queueFacilityBuild`, `queueFacilityUpgrade`, `queueFacilityRepair`, `queueFortificationBuild`,
   `queueFortificationUpgrade`, `queueFortificationRepair`, `demolishFacility`, `queueUnitRecruit`,
   `queueUnitReplenish`, `cancelBuildOrder`, `purchaseDoctrine`, `toggleChemicalMode`,
   plus helpers `canAfford`, `getMissingResources`, `getBestOperationalFacility`.
   Guards are kept exactly, including "only on your own turn" (`state.currentActorId ===
   countryId`) where the old handler checked `playerTurnActive`. Order ids keep the old format
   (`build-<timestamp>-<rand>` etc.); an optional `makeId` parameter makes tests deterministic.

### 6.4 State management

`ui/session/GameProvider.tsx` composes the hooks and provides one context value:

- `session`: `gameState`, `setGameState`, `playerCountryId`, `gameStarted`, `startGame(countryId)`,
  `loadState(state, label)`, `endTurn()`, `runAiTurn()`, `autoPlay(turns)`, `victoryStatus`,
  `lastBotDecision`, `turnReport` (events + pre-turn state, section 10).
- `selection`: `selectedRegionId`, `selectedUnitIds`, `selectedFacilityId`, `validTargets`,
  `selectRegion`, `selectUnit`, `selectUnitFromMap`, `holdUnit`, `cancelOrder`, `clearOrders`.
- `ui`: which panel or window is open (`activeTab`, `bottomOpen`, `stockpileOpen`, `diplomacyOpen`,
  `doctrineOpen`, `saveLoad` mode, `globalUnitsOpen`, `unitDrawerOpen`, `logicMapOpen`,
  `showSupplyOverlay`, `turnReportOpen`, dismissed defeat notice) and their setters.
- `economy`: the wrapped player actions (they show toasts like today).
- `toasts`: `addToast`, `toasts`.

## 7. Design system (style C)

### 7.1 Tokens (`ui/theme/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0e1114` | Page background |
| `--surface-1` | `#171b1f` | Window and panel body |
| `--surface-2` | `#1d2227` | Cards inside windows |
| `--surface-3` | `#252b31` | Hover |
| `--surface-inset` | `#121518` | Inputs, wells, track backgrounds |
| `--line` / `--line-strong` | `#2c3238` / `#3a424a` | Borders, dividers |
| `--text` / `--text-dim` / `--text-faint` | `#e4e8ec` / `#a3acb5` / `#737d87` | Text levels |
| `--gold` / `--gold-bright` / `--gold-deep` / `--gold-ink` | `#d4a537` / `#f0c75e` / `#2a2516` / `#1d1606` | Accent, header rule, primary button, text on gold |
| `--brics` / `--brics-soft` / `--brics-text` | `#b8423f` / `#4a1f1d` / `#f0a49e` | Bloc color, chip background, chip text |
| `--nato` / `--nato-soft` / `--nato-text` | `#3f72b8` / `#1d2f4a` / `#9cc0f0` | Same for EU NATO |
| `--neutral` / `--neutral-soft` / `--neutral-text` | `#8b8667` / `#33321f` / `#d8d2a2` | Same for neutrals |
| `--good` / `--warn` / `--bad` / `--info` | `#7cc47c` / `#e0b04a` / `#e0605a` / `#6ea8e0` | Status |
| `--font-display` | `"Oswald", "Arial Narrow", sans-serif` | Titles, numbers, labels |
| `--font-body` | `"Inter", "Segoe UI", sans-serif` | Body text |
| `--fs-xs` ... `--fs-3xl` | 11, 12, 13, 15, 18, 24, 32 px | Type scale (11 px minimum) |
| `--radius-sm` / `--radius-md` | 3 px / 6 px | Controls / windows |
| `--shadow-window` | `0 12px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)` | Floating windows |

The old variable names (`--bg`, `--panel`, `--panel-soft`, `--border`, `--text`, `--muted`,
`--accent`, `--brics`, `--eu`, `--neutral`) stay defined as aliases until no CSS uses them.

### 7.2 Nation palette (`ui/theme/palette.ts`)

Shared by the map, flags-adjacent swatches, cards and chips. Bloc families keep the war readable;
each nation stays distinguishable from its neighbors.

| Nation | Color | Nation | Color | Nation | Color |
|---|---|---|---|---|---|
| Russia | `#8f2a2a` | Germany | `#4f6d8f` | Austria | `#a0895f` |
| Belarus | `#b8693a` | Poland | `#3b6fc0` | Serbia | `#9a7458` |
| Novorossia | `#a33a63` | Ukraine | `#2a8c9c` | Switzerland | `#8f7f9a` |
| Pridnestrovie | `#6e2236` | Romania | `#6d93d9` | Bosnia and Herzegovina | `#6f8f4e` |
| Slovakia | `#c4914c` | Czech Republic | `#7468c4` | Montenegro | `#8a5f7a` |
| Hungary | `#b04a3c` | Finland | `#8fb3d6` | Kosovo | `#a7a58f` |
| | | Baltic Federation | `#5a4fa3` | Albania | `#6f7f5f` |
| | | | | North Macedonia | `#c29a5c` |
| | | | | Croatia | `#5f8a76` |
| | | | | Slovenia | `#7fa58c` |
| | | | | Moldova | `#97904f` |

These values were checked so that every pair of nations whose regions touch differs by an RGB
distance of at least 40 (enforced by `palette.test.ts`). Non-scenario land (Italy, Sweden,
Bulgaria, ...) is `#3a3f45`. Bloc colors come from the tokens.

### 7.3 Typography and icons

- Fonts are bundled with `@fontsource/oswald` (400, 500, 600) and `@fontsource/inter` (400, 500,
  600), imported in `main.tsx`. Numbers use `font-variant-numeric: tabular-nums`.
- Icons come from `lucide-react`. Emoji in the interface are removed. Fixed mapping:
  - **Tabs:** Region `MapPin`, Stockpile `Package`, Economy `Factory`, Recruitment `Medal`, Orders
    `ListChecks`, AI Intel `BrainCircuit`, War Status `Swords`, Event Log `ScrollText`.
  - **Top bar:** Diplomacy `Handshake`, Doctrines `GraduationCap`, Save `Save`, Load `FolderOpen`.
  - **Other controls:** Supply lines `Network`, close `X`.
  - **Resources:** oil `Droplet`, coal `Mountain`, iron `Pickaxe`, tungsten `Diamond`, food
    `Wheat`, chemicals `FlaskConical`, steel `Hammer`, fuel `Fuel`, explosives `Bomb`, fertilizer
    `Sprout`, munitions `Crosshair`, energy `Zap`, textiles `Shirt`, electronics `Cpu`, vehicles
    `Car`, pharmaceuticals `Pill`, luxury goods `Gem`, weed `Leaf`, trade points `Coins`.

  If an icon name does not exist in the installed version, the type check fails. The
  implementer picks the closest existing icon and records the swap in `CHANGELOG.md`.
- Unit types in the interface use the same NATO-style symbols as the map (`kit/UnitSymbol.tsx`,
  inline SVG): infantry box with X, armor box with oval, MLRS box with a dot and arrow, fighter and
  bomber aircraft silhouettes (bomber with a "B"), tactical missile single arrow, strategic missile
  double arrow.

### 7.4 Flags (`ui/kit/Flag.tsx`)

Simplified SVG flags (3:2, no coats of arms) for all 24 nations, typed as
`Record<CountryId, ...>` so none can be missing. Real flags are drawn from their color fields. The
three non-standard ones are:

- **Novorossia:** red field with a white-bordered blue saltire.
- **Pridnestrovie:** red-green-red horizontal bands.
- **Baltic Federation:** three equal horizontal bands, blue `#0072ce`, carmine `#9e3039` and gold
  `#fdb913`.

Simplifications for flags with emblems:
- **Switzerland:** white cross on red.
- **Bosnia:** blue field, yellow triangle, white star row.
- **Kosovo:** six white stars in an arc on blue.
- **Albania:** a black stylized eagle shape on red.
- **North Macedonia:** a yellow sun with 8 rays on red.
- **Croatia, Slovenia and Moldova:** tricolor plus a small plain shield.
- **Montenegro:** red with a gold border.
- **Slovakia:** tricolor plus a small red shield with a white double cross.
- **Czech Republic:** white and red with a blue hoist triangle.
- **Belarus:** red over green with a thin white hoist band.

### 7.5 Kit components (`ui/kit/`)

- **`Window`**:
  - Header with an optional flag or icon, the title in display font, optional header actions and
    a close button; a 2 px gold rule under the header; a scrolling body; an optional footer.
  - Variants: `panel` (floating, anchored by the caller's positioning class), `modal` (centered,
    with a backdrop `rgba(6,8,10,.62)`), `popup`.
  - Positioning classes from the old CSS are passed in through `className` and keep their exact
    layout declarations.
- **`Button`** variants:
  - `primary`: gold fill, `--gold-ink` text. At most one per window.
  - `secondary`: gold outline, `--gold-deep` fill.
  - `ghost`.
  - `danger`.

  Sizes are `sm` and `md`. A disabled button keeps a `title` explaining what is missing, as today.
- **Smaller components:**
  - `Badge`: bloc variants (`brics`, `nato`, `neutral`) and status variants (`good`, `warn`, `bad`,
    `info`).
  - `StatRow`: a dim label and a value.
  - `ProgressBar`.
  - `ResourceIcon` and `ResourceAmount`: icon plus value, and a "missing" style.
  - `Pips`: difficulty, 1-4.
  - `Tabs`.
  - `Flag`.
  - `UnitSymbol`.

## 8. Restyle of the main screen and its windows

Every item below keeps its current position, size behavior, z-order, open/close behavior and
content. Only its look changes, unless noted otherwise.

- **Top bar:**
  - Dark band `#14181c` with a 1 px gold hairline at the bottom.
  - Stats render as a dim label plus an Oswald value. The nation stat shows its flag.
  - End Turn is the primary button. Run AI, Auto x6, Diplomacy and Doctrines are secondary
    buttons with icons. Save and Load are icon buttons. The quick-jump select is restyled.
  - Item order is unchanged.
- **Bottom tab bar:** same eight tabs in the same order. Each tab gets an icon and its label; the
  active tab gets a gold underline and bright text.
- **Supply lines toggle:** same place (top center). It becomes an icon and the label "Supply lines"
  in a pill, gold-filled when on.
- **Map zoom controls** (+, -, Reset): same place, restyled as square dark buttons.
- **Floating panels** (Region, Economy, Recruitment, Orders, AI Intel, War Status, Event Log):
  `Window` variant `panel`.
  - Region panel: the controller row shows flag, nation and bloc chip. Stability is colored by
    level. Deposits show resource icons with richness pips.
  - Economy and Recruitment: facilities are listed as rows with icon, level and damaged tag; build
    buttons become compact secondary buttons with cost tooltips. The build queue shows progress
    bars.
  - Orders: order chips show the unit symbol, order type and target.
  - AI Intel, War Status and Event Log: restyled cards and lists. War Status shows flags.
- **Unit drawer and unit cards:** NATO symbol, nation color edge, strength bar, supply, veterancy
  and entrenchment as small badges, an ally or enemy chip, order chip and the same action buttons.
- **All units list, stockpile pop-up, facility pop-up:** same content and positions. Resources use
  `ResourceIcon`.
- **Diplomacy window:** same position and size, defined in a CSS class instead of the inline style.
  Country cards get flags. The support bars keep their markers and are restyled. Action tiles use
  the kit.
- **Doctrines, Save/Load, Economy logic map:** `Window` variant `modal`. Doctrine cards show the
  category color, a lock or check state, and the cost in trade points.
- **Country defeated notice and Victory/Defeat overlay:** `Window` variant `modal` with the
  defeated or winning nation's flag.
- **Toasts:** same corner. Dark cards with a colored left edge and an icon per type.

## 9. Start screen

Replaces `LandingPage.tsx`. The layout is free to change here; the freeze applies only to the main
screen.

- **Background:** the new map in showcase mode (11.8), fitted to the whole theater, under a dark
  overlay `rgba(9,11,13,.62)`.
- **Header:** "Europe 2026" (gold, small) above "Map Game" (Oswald, 32 px) and one line of
  subtitle.
- **Three bloc columns:** BRICS (6), Neutral (11), EU NATO (7). Each column scrolls if needed.
  - Each nation card shows its flag, name, tier word, difficulty pips (Easy 1, Medium 2, Hard 3,
    Very hard 4) and a status chip (At war / Joins turn N / Reserve / Neutral). The existing
    `getStartingStatus` and `getDifficulty` logic is kept.
  - The selected card has a gold border.
- **Briefing panel (right):**
  - Flag, name, and bloc with tier.
  - Difficulty, capital name, regions and key cities, and starting units by type (for example
    "5 infantry · 2 armor · 1 fighter · 1 bomber").
  - War entry text: "At war from turn 1", or the scripted or threshold rule descriptions.
- **Buttons:**
  - **Start as {nation}**: primary.
  - **Continue · {nation}, turn {n}**: shown only when `mapgame_autosave` parses as a game state;
    it loads it.
  - **Load game**: opens `SaveLoadWindow` in load mode, which now also works before a game starts.
- **Map highlight:** selecting or hovering a nation card highlights that nation's starting regions
  on the background map and dims the rest.

## 10. Turn report (replaces the battle report modal)

Built entirely in the UI layer from the same log lines; engine text is not changed.

- **Input:** the new `eventLog` lines produced by End Turn, the game state *before* End Turn
  (for unit names), the state after, and `playerCountryId`.
- **Segmenting by nation:**
  - Lines before the first `Turn advanced. Active country: X.` belong to the player's nation.
  - After each such marker, lines belong to X until the next marker. Marker lines are not shown.
- **World events** go to a "World events" section at the top: war entries (`entered the war`),
  defeats (`has been defeated`) and the depot capture (`secured the Pridnestrovie depot`).
- **Categories** are matched by regex in this order:

  | Category | Pattern |
  |---|---|
  | `capture` | `is now controlled by` |
  | `battle` | `^Battle of` |
  | `air` | `^Air combat over` |
  | `strike` | `struck`, `Bomber sortie`, `MLRS bombardment` |
  | `move` | `moved from` |
  | `supply` | `supply attrition`, `cut off`, `re-established supply`, `running out of supply` |
  | `diplomacy` | `used .+ in` |
  | `production` | `deployed`, `replenished`, `built`, `upgraded`, `repaired` |
  | `warning` | `WARNING`, `FOOD SHORTAGE` |
  | `other` | anything else |

- **Battle outcome:** taken from the label, from the attacker's (segment nation's) point of view.
  - Won: "Decisive attacker victory", "Attacker victory", "Pyrrhic attacker victory", "Surprising
    attacker breakthrough".
  - Lost: "Narrow defender hold", "Defender holds".
- **Readable unit names:** unit ids such as `pmr-ru-inf-1` that exist in the pre-turn or post-turn
  units are replaced with `Infantry (Russia)`. Unknown ids stay as they are.
- **Aggregation:**
  - Supply attrition lines for the same nation and region merge into one row, for example
    "3 units lose strength in Tiraspol: no supply (−4)".
  - Each nation's moves collapse into one expandable row ("5 units repositioned").
- **Layout:**
  - A `Window` modal "Turn {n} report".
  - Summary chips: battles, regions that changed hands, units repositioned, plus war entries or
    defeats if any.
  - Then the sections: World events, your nation (labelled "you"), allies, enemies, neutrals.
  - Each section header shows the flag, the nation and a relation tag. Rows carry an icon per
    category; battles are green when won and red when lost.
- **Behavior:** opens after End Turn exactly as the old report did. The Orders tab's "Last turn
  events" list stays as it is, restyled.

## 11. Map renderer (Canvas 2D)

### 11.1 Module layout (`src/ui/map/`)

| File | Responsibility |
|---|---|
| `MapView.tsx` | React component: canvas, zoom buttons, tooltip, perf meter; wires interaction and rendering |
| `geometry/projection.ts` | Same Mercator projection and 1600x980 world as today's `createProjection` |
| `geometry/countryShapes.ts` | Loads `world-atlas/countries-50m.json`, maps numeric ids to nations, clips shapes to the world bounds |
| `geometry/buildRegionGeometry.ts` | One-time precompute of region polygons, boundary edges and label anchors (pure, runs in Node for tests) |
| `geometry/regionLookup.ts` | `regionAt(x, y)` point query with bbox prefilter |
| `geometry/pointInPolygon.ts` | Even-odd point-in-multipolygon |
| `camera.ts` | Pure camera math (world/screen transforms, zoom around a point, clamping, fit) |
| `derive.ts` | Per-state visual data, memoized by `GameState` identity (WeakMap) |
| `labels.ts` | Greedy label placement with collision boxes (pure) |
| `render/renderFrame.ts` | Draws one frame in layer order (11.4) |
| `render/layers/*.ts` | One file per layer group |
| `render/symbols.ts` | NATO unit symbols on canvas, matching `kit/UnitSymbol.tsx` |
| `render/patterns.ts` | Cached stripe patterns per nation color, sea texture |
| `interaction/useMapInteraction.ts` | Pointer drag, wheel zoom with easing, click vs drag, hover |
| `hitTest.ts` | Maps a screen point to a unit, stack, city, off-screen pill, region or nothing |
| `perf/frameStats.ts` | Dev-only frame-time meter (F3) and `window.__mapStats` counters |

### 11.2 Geometry precompute (once per page load)

1. **Projection.** Keep today's world space: Mercator fitted to lon 5-51, lat 41-62.5 inside
   1600x980 with the same padding, so all existing positions keep their meaning.
2. **Country shapes.**
   - Project every world-atlas feature that intersects the world bounds `[-200,-200,1800,1180]`
     and clip it to those bounds with `polygon-clipping`. This drops Siberia and keeps the cost
     low.
   - Scenario countries use today's numeric-id mapping (`countryIdByNumericId`). Every other
     feature is background land.
3. **Clip groups.**
   - Keep today's grouping: a region renders inside its "clip country" shape (`getClipCountryId`).
     Novorossia regions use Ukraine's shape (804); the Baltic regions use 233/428/440; Sevastopol
     uses Russia (643), whose shape contains Crimea in this dataset.
   - A group with one region uses the whole country shape. Otherwise, compute a Voronoi diagram of
     the group's region points (`d3-delaunay`, bounds as above) and intersect each cell with the
     country shape (`polygon-clipping`). A result can have several parts; for example, an exclave
     goes to the nearest point.
4. **Map point fixes.**
   - Some generated regions have computed points outside their own country shape. One example is
     `kaliningrad-coast` (Baltiysk), which falls inside Poland.
   - `MAP_POINT_OVERRIDES` in `regionGeo.ts` moves those points inside their own shape. This is
     display-only data; rules never read it.
   - The geometry test lists any region whose point is not inside its own polygon, and the
     implementer adds overrides until the list is empty.
5. **Boundary edges.**
   - Walk every ring edge of every region polygon. Take the midpoint, step 0.6 world units outward
     along the edge normal, and look up what is there with `regionAt`.
   - Each edge is tagged with its neighbor region, or with `coast` (sea) or `foreign`
     (non-scenario land).
   - Consecutive edges with the same neighbor merge into polylines. Region pairs are deduplicated
     by keeping the side with the smaller region id.
   - Kind:
     - `internal`: same clip country.
     - `national`: different clip countries.
     - `coast`.
     - `foreign`.
6. **Label anchors.**
   - City labels sit next to the city point.
   - Nation labels sit at the best interior point of the nation's largest starting region polygon:
     a 24x24 grid sample, maximizing the distance to the ring edges.
7. **Budget.** The whole precompute must take ≤ 300 ms on Marek's PC (measured and logged in dev).
   While it runs, the map area shows "Preparing map…".
8. **Robustness.** `polygon-clipping` calls are wrapped. If a clip throws for a cell, fall back to
   the cell clipped to the country's bounding box and log a dev warning. The geometry test asserts
   no fallback happens with the shipped data.

### 11.3 Camera and interaction

- **Camera:** `{ scale, offsetX, offsetY }`, the same meaning as today. `MIN_SCALE` 0.6 and
  `MAX_SCALE` 26 stay. The default view fits all region points with 40 px padding, as today.
  Zoom level for level-of-detail rules: `z = scale / defaultScale`.
- **Pan:** pointer drag past a 5 px threshold. Panning is clamped so at least 25% of the world
  stays on screen. While dragging, the cursor is `grabbing`.
- **Zoom:**
  - The mouse wheel multiplies a target scale by `1.0015^(-deltaY)`. The camera eases toward the
    target over 140 ms (ease-out), keeping the point under the cursor fixed.
  - The +, - and Reset buttons ease the same way; + and - zoom by a factor of 1.6.
- **No React state on hot paths.** Camera, hover and easing live in refs. A change calls
  `requestRender()`, which coalesces into one `requestAnimationFrame`.
- **Click resolution order** (parity with today's map):
  1. Unit counter: `onSelectUnit(unitId)`.
  2. Stack counter: `onSelectRegion(regionId)` and that stack expands.
  3. City marker, within a 9 px radius: `onSelectRegion(regionId)`. City markers win over
     polygons, so every node is clickable even when its point sits near another region's area.
  4. Off-screen link pill: the camera eases so that city is on screen. Selection does not change.
  5. Region polygon (`regionAt`): `onSelectRegion(regionId)`.
  6. Sea: only collapses an expanded stack.

  Any click that is not on a stack collapses the expanded stack.
- **Hover:**
  - The region under the cursor gets a thin outline and a tooltip, and its links show as a faint
    preview.
  - The tooltip is a DOM element updated through a ref (no React render). It shows:
    - the region name with Capital or Key city tags;
    - the controller's flag, name and bloc color;
    - "Occupied, originally {nation}" when occupied;
    - units by side, fort level and health, and stability.
  - The tooltip hides while dragging.

### 11.4 Layers, in drawing order

World-space layers draw under the camera transform. Line widths are divided by `scale` so they stay
constant on screen.

1. **Sea:** base `#14303f`, a screen-space radial vignette to `#0f2531`, a faint graticule
   (alpha .06), and a 256 px noise texture at 4% alpha (generated once at startup).
2. **Coast halo:** all land outlines stroked twice, 8 px `rgba(120,190,210,.2)` and 3.5 px
   `rgba(120,190,210,.32)`.
3. **Background land:** non-scenario countries filled `#3a3f45`, with 1 px darker borders.
4. **Region fills:**
   - Each region is filled with its **controller's** nation color.
   - Regions alternate a ±6% lightness variant (`rgba(255,255,255,.06)` or `rgba(0,0,0,.07)`
     overlay), assigned by a stable hash of the region id, so neighbors with the same owner stay
     distinct.
5. **Occupation stripes:**
   - A region is occupied when its controller differs from its **pre-war controller**. The pre-war
     controller is the region's `controllerCountryId` in `state.scenario.regions`, which the rules
     never mutate; a test guards this.
   - Occupied regions get diagonal stripes in the pre-war controller's color: 2.6 px wide every
     8 screen px, alpha .85, drawn with a cached `CanvasPattern` whose transform cancels the camera
     scale.
6. **Borders:**
   - `internal` edges: 1 px `rgba(10,12,14,.45)`.
   - `national`: 1.6 px `rgba(10,12,14,.9)`.
   - `foreign`: 1.2 px `rgba(10,12,14,.7)`.
   - `coast`: 0.9 px `rgba(225,235,240,.5)`.
7. **Front line:** every edge whose two regions' controllers are in enemy blocs and both at war.
   Drawn as a 6 px `rgba(10,10,10,.6)` underlay plus a 2.6 px `#f2b134` line, recomputed when the
   state changes.
8. **Region highlights** (later rules win):
   - **Hovered:** 1.2 px `rgba(255,255,255,.6)` outline.
   - **Linked regions of the selected region** (from `adjacentRegionIds`): 1.6 px `#d4a537`
     outline.
   - **Selected region:** `rgba(255,255,255,.12)` wash plus a 2.5 px `#f6e7b0` outline.
   - **Valid move targets:** `rgba(124,196,124,.22)` wash plus a 1.6 px `#7cc47c` dashed outline.
   - **Valid attack, air, bombard and missile targets:** `rgba(224,96,90,.26)` wash plus a 1.8 px
     `#e0605a` outline.
9. **Supply overlay** (toggle, same rule as today): BFS from the player's capital through regions
   of the player's bloc.
   - Links between supplied regions: 2.5 px `rgba(124,196,124,.6)`.
   - Links involving friendly but unsupplied regions: 1.5 px grey dashed.

   *(Screen-space layers from here on.)*

10. **Link network** (low zoom only): up to `z = 1.3`, every adjacency link draws as a 1 px line at
    alpha .16 between city points, fading linearly to 0 at `z = 1.6`. This keeps today's network
    look at low zoom.
11. **Selection and hover links:**
    - From the selected region's city to each linked city: a 4 px dark underlay plus a 1.8 px
      `#d4a537` line.
    - Hovered region: the same links at alpha .35.
    - If a linked city is outside the viewport, the line is clipped at the screen edge and a pill
      (dark, gold border, city name plus a small arrow) sits at the edge. Pills are clickable
      (11.3).
12. **City markers: always drawn for all 103 regions at every zoom.**
    - Capital: gold 5-point star, radius 5.5 px (4.5 at `z < 1`).
    - Key city: white dot, radius 3.2 px, with a dark outline.
    - Other: white dot, radius 2.4 px.
    - Selected city: gold ring at 9 px. Linked cities: thin gold ring at 7 px.
13. **Order arrows** (the player's pending orders only):
    - Each arrow runs from the unit's region to the target region as a quadratic curve, bulging
      18 px sideways, with a dark underlay.
    - Colors: attack solid `#e0605a`; move dashed `#7cc47c`; air support dotted `#e0b04a`;
      bombard dotted `#e0b04a` with a small burst at the target; missile strike dotted `#d06bd6`.
    - Identical arrows (same from, to and type) merge into one with a "×N" badge. Hold orders show
      a small shield badge on the counter.
14. **Unit counters** (sit just below the city point):
    - **Size:** 30x18 px, scaled by `clamp(sqrt(z), 0.85, 1.35)`.
    - **Single counter:** the unit nation's color fill and a NATO symbol in white, with the
      strength number on the right.
      - Strength bar along the bottom: green above 66% of `MAX_UNIT_STRENGTH`, amber above 33%,
        red below.
      - Supply dot top-left, using today's colors for low, critical and cut off.
      - Veterancy as 1-3 tiny gold chevrons top-right.
    - **Edges:**
      - Gold edge: the unit has a pending order.
      - White 2.2 px edge: the unit is selected.
    - **Stacks:** a region with two or more units shows one stack counter (two offset shadow cards
      plus "×N"), colored by the majority nation, with a dot in a second nation's color if it is
      mixed. Clicking expands it into a row of single counters, as today.
15. **Depot badge and deposits.**
    - Tiraspol's "DEPOT" badge (claimed, claimable or locked colors) shows at `z ≥ 1.5`.
    - Resource deposits show as small chips under the city at `z ≥ 3.5`: a colored rounded square,
      a one-letter code, and richness pips.
16. **Labels:** placed by `labels.ts`, in Oswald 500 with a 3 px dark halo `rgba(10,12,14,.85)`.
    - **Nation names** (only at `z < 1.6`): letter-spaced, 14-26 px by nation area, alpha .55.
      Defeated nations draw at alpha .25.
    - **City names**, by priority:
      1. Selected region.
      2. Linked regions of the selection. These are **forced**: always drawn, picking the least
         overlapping of four positions if all collide.
      3. Capitals.
      4. Key cities, shown at `z ≥ 1.3`.
      5. All other cities, shown at `z ≥ 2.2`.

      Candidate positions are right, left, above and below the marker. A label is skipped if it
      collides with a placed label or a counter, unless it is forced.

### 11.5 Level-of-detail summary

| Zoom `z` | Nation labels | City labels | Link network | Counters | Deposits |
|---|---|---|---|---|---|
| < 1.3 | yes | capitals, selected and linked | faint, all links | stacks and singles | no |
| 1.3 - 2.2 | fading out by 1.6 | plus key cities | fading out by 1.6 | stacks and singles | no |
| 2.2 - 3.5 | no | all, collision-avoided | off | stacks and singles | no |
| ≥ 3.5 | no | all | off | stacks and singles | yes |

City markers, selection links, front lines and order arrows are drawn at every zoom.

### 11.6 Performance design

- `Path2D` objects are built once per region polygon, background country and edge polyline.
- Viewport culling by bounding box for regions, edges, labels and counters.
- No `shadowBlur` or canvas filters. Glows are layered strokes.
- Derived data (fills, occupation flags, front edges, stacks, arrows, supply network) is memoized
  per `GameState` object.
- The canvas is sized to its CSS size times `devicePixelRatio`, with a `ResizeObserver`.
- Labels draw only after `document.fonts.load('500 12px Oswald')` resolves, then re-render once.
- `MapView` is wrapped in `React.memo` with a comparator on its props. Pan, zoom, hover and stack
  expansion never call `setState`.
- In dev, `window.__mapStats` exposes `{ renders, frames, lastFrameMs, avgFrameMs, p95FrameMs }`.
  F3 toggles an on-screen meter.

### 11.7 Component API

```ts
interface MapViewProps {
  state: GameState;
  selectedRegionId: string | null;
  selectedUnitIds?: string[];          // highlights selected counters
  validMoveTargets?: string[];
  validAttackTargets?: string[];       // attacks + air + bombard + missile, as today
  showSupplyOverlay?: boolean;
  onSelectRegion?: (regionId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  mode?: "game" | "showcase";          // showcase: no interaction, no counters or arrows
  highlightCountryId?: CountryId;      // showcase: outline this nation's starting regions, dim others
}
```

`onSelectFacility` is dropped: the old map never called it.

### 11.8 Showcase mode

Used by the start screen:
- No pointer interaction, no counters, arrows or tooltip.
- Camera fit to the whole theater.
- Nation labels on.
- `highlightCountryId`: that nation's starting regions get a 2 px `#f6e7b0` outline; other regions
  get a `rgba(0,0,0,.35)` overlay.

## 12. Testing and verification

### 12.1 Unit tests (Vitest, Node environment)

Add `vitest` with `npm test` (`vitest run`). Tests live next to the code as `*.test.ts`.

| Test file | What it proves |
|---|---|
| `game/rules/playerActions.test.ts` | Each action deducts the right cost, queues the right order, refunds on cancel, and returns the same toast texts as the old handlers for each failure |
| `game/rules/strategicDepot.test.ts` | Depot status for locked, bridge needed, claimable and claimed cases |
| `game/state/scenarioBaseline.test.ts` | After 10 auto-played turns, `state.scenario.regions` controllers equal the initial ones (the occupation baseline is trustworthy) |
| `ui/map/geometry/buildRegionGeometry.test.ts` | All 103 regions get a non-empty polygon; every city point lies inside its own polygon; polygons in a clip group don't overlap; their area sums to the clipped country area (±1%); no clip fallback happened; precompute ≤ 300 ms |
| `ui/map/geometry/regionLookup.test.ts` | `regionAt(cityPoint) === regionId` for all regions; sea points return null |
| `ui/map/geometry/boundaries.test.ts` | Edges are symmetric (A-B also seen from B); Tiraspol's internal edge neighbors only Chisinau inside Moldova; coastline edges exist for Gdansk |
| `ui/map/camera.test.ts` | World/screen round trip; zooming keeps the anchor point fixed; clamping; fit |
| `ui/map/derive.test.ts` | Front edges only between at-war enemy blocs; occupation flags against the baseline; stacks and majority color; arrow merging |
| `ui/map/labels.test.ts` | Placed labels never overlap; priority order respected; forced labels always placed |
| `ui/windows/turnReport/parseTurnReport.test.ts` | Segmentation by nation on a recorded real log fixture; categories; battle win/loss; unit name replacement; attrition aggregation |
| `ui/theme/palette.test.ts` | Every `CountryId` has a color; any two nations whose regions share a boundary edge (from the map geometry, internal or national) differ by RGB distance ≥ 40 |

### 12.2 Layout lock

- `scripts/layout/capture-layout.js` is a browser snippet run through the preview tools.
  - It opens each bottom tab, the stockpile pop-up, the unit drawer, the all-units list,
    Diplomacy, Doctrines and Save/Load, and records `getBoundingClientRect()` for each container.
  - For the top bar and bottom bar it also records each child control's order and box.
- `scripts/layout/compare-layout.mjs` compares two captures with the C1 tolerances.
- The **baseline** is captured at 1440x900 and 1920x1080 at the start of phase 1, before any code
  change (the UI is then identical to `legacy`), and committed to `docs/superpowers/baselines/`.
  The check runs after phases 2, 3 and 4.

### 12.3 Performance benchmark

- `scripts/perf/pan-zoom-bench.js` is a browser snippet: 3 s of scripted drag in a circle, then
  20 wheel steps in and out. It reports frame-time average, p95 and max from
  `requestAnimationFrame`, plus `window.__mapStats.renders` before and after.
- It runs with the browser pane **visible** (a hidden pane throttles frames to about 1 per second
  and invalidates the numbers).
- Run it on `legacy` for reference and on the new map for acceptance (C2).

### 12.4 Existing checks and manual pass

- `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`, `npm run smoke`,
  `npm run balance-check` and `npm test` pass at the end of every phase.
- **Manual parity checklist in the browser after phase 4:**
  - Select regions, units and stacks; issue move, attack, air, bombard and missile orders; cancel
    and hold.
  - Supply overlay, depot badge, deposits at high zoom.
  - End Turn, then the turn report.
  - Save, load, autosave, then Continue from the start screen.
  - Diplomacy actions and doctrine purchase; build, recruit, repair and demolish; stockpile and
    facility pop-ups.
  - Victory and defeat overlays (forced through a crafted save).
- Screenshots of the start screen, the main screen and every panel and window, at 1440x900 and
  1920x1080.

## 13. Delivery

Six phases. Each ends with a working game, all checks green, a `CHANGELOG.md` entry citing
`(plan 2026-10-18-visual-overhaul → Task N)`, a commit on `main`, and a push to `origin main`.

1. **Safety net:** Vitest, layout baseline from `legacy`, performance baseline, turn report log
   fixture.
2. **Restructure:** extractions (6.3), session hooks and context, component split, CSS split
   verbatim. Layout lock must pass with zero visual change.
3. **Look:**
   - Fonts, tokens, palette, flags, icons and kit.
   - Restyle the HUD, panels and windows.
   - New turn report.
   - Layout lock passes.
4. **New map:**
   - Geometry and camera with tests, layers, interaction.
   - Switch `GameScreen` to `MapView`.
   - Parity checklist and performance benchmark.
   - Delete `TheaterMap.tsx`, `ui/mapLayout.ts` and the old map CSS.
5. **Start screen** with the showcase map, Continue and Load game.
6. **Wrap-up:**
   - Full verification pass.
   - Update the `CLAUDE.md` "Code layout" section.

### New dependencies

| Package | Kind | License | Why |
|---|---|---|---|
| `polygon-clipping` | runtime | MIT | Region polygons and clipping to world bounds |
| `lucide-react` | runtime | ISC | Icons |
| `@fontsource/oswald`, `@fontsource/inter` | runtime | OFL | Offline fonts |
| `vitest` | dev | MIT | Unit tests |

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Behavior regressions while splitting `App.tsx` | One extraction per commit; pure action tests; parity checklist; layout lock after phase 2 |
| Geometry edge cases (points outside shapes, slivers, clip errors) | Geometry tests list violations; `MAP_POINT_OVERRIDES`; wrapped clipping with a tested no-fallback assertion |
| Hidden browser pane gives false performance numbers | Benchmark requires a visible pane; numbers recorded in `CHANGELOG.md` |
| Fonts load late, so labels draw in a fallback font | Re-render after `document.fonts.load` resolves |
| Icon names differ between lucide versions | The type check catches it; swaps are logged |
| Long single-session implementation drifts from the spec | Plan tasks cite spec sections; each phase ends with checks and a commit |

## 15. Later rounds (not part of this spec)

1. **Turn experience:** AI moves animated on the map, structured turn events from the engine, odds
   preview before attacking.
2. **Gameplay depth:** three-condition victory, city siege loop, bloc-level AI strategy, difficulty
   levels (old TASK 6-9), plus economy readability and depth for the deep grand strategy direction.
