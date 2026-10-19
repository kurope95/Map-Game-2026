# Start screen polish — design and handoff

Date: 2026-10-19
Status: implemented and verified on `main`; no game rules changed.
Predecessor: commit `04d5d76` ("Redesign the start screen around a scenario briefing").

## Why this exists

The start screen answers one question before a campaign begins: **what does the war look like
for this nation?** The redesign in `04d5d76` established the three bloc columns, the campaign
briefing and the theatre panel. A review of that screen then found six concrete problems. This
document records what each problem was, how it was solved, and what a later agent must not
undo. It is presentation work only: everything under `src/game/` is untouched.

The screen intentionally stays inside the layout Marek approved: three bloc columns on the
left, a right rail with the briefing on top and the theatre summary below, the showcase map
behind everything. No control was moved to a different place.

## The six changes

### 1. Columns size to their content

**Problem:** the grid stretched all three columns to the height of the tallest one. BRICS (6
cards) and EU NATO (7 cards) carried a large empty area below their last card while Neutral
(11 cards) scrolled. The empty boxes hid the map for no reason.

**Solution:** `.start-column` uses `align-self: start` and `max-height: 100%`, so each column
is only as tall as its cards plus header and footer. Neutral remains the tallest and scrolls
inside itself. The map is visible below the shorter columns.

Files: [`StartScreen.css`](../../../src/ui/screens/start/StartScreen.css),
[`NationColumn.tsx`](../../../src/ui/screens/start/NationColumn.tsx)

### 2. A scroll fade on the Neutral column

**Problem:** at 1335×747 the Neutral column is taller than the viewport can show. Its last
visible card was cut off with no cue that more cards existed below.

**Solution:** the card body is wrapped in `.start-column__scroll`; a `.start-column__fade`
gradient strip is rendered only while the body is scrollable **and** not already at its end.
A passive `scroll` listener updates the flag, and a `ResizeObserver` recomputes it when the
column changes size. The fade is `pointer-events: none`.

Files: [`NationColumn.tsx`](../../../src/ui/screens/start/NationColumn.tsx),
[`StartScreen.css`](../../../src/ui/screens/start/StartScreen.css)

### 3. Right-rail composition, including short screens

**Problem:** the briefing and the theatre panel were a fixed stack. At 1440×900 they fit; at
1335×747 the theatre panel was pushed below the fold and appeared chopped off.

**Solution:** the rail uses `justify-content: space-between`, so on tall screens the theatre
panel sits on the bottom edge, level with the column footers. Below **900 px of viewport
height** the theatre panel is hidden. This costs no information: its "35 / 25 / 43" starting
totals are repeated in the three column footers, and the bloc share bar is an overview, not a
control. The briefing itself always fits and its Start/Load actions stay visible.

Files: [`StartScreen.css`](../../../src/ui/screens/start/StartScreen.css),
[`TheatrePanel.css`](../../../src/ui/screens/start/TheatrePanel.css)

### 4. Key cities and bordering countries in the briefing

**Problem:** "17 regions · 4 key cities" was a count with no names, and the war-entry block
never said who the nation actually shares a border with. Marek had to open the game to learn
either.

**Solution:** `NationBriefing` gained three fields:

- `keyCityNames: string[]` — names in `country.keyRegionIds` order, from
  `state.regions[id].name`. Rendered as a quiet `Key cities · A · B · C` line under Territory.
- `borders: BorderCountry[]` — every country that controls a region adjacent to one of this
  nation's starting regions. Resolved through `getStartingControllers`, so it describes the
  **scenario** border, not a later occupation. The nation itself is excluded, IDs are deduped,
  and the list is sorted at-war first, then alphabetically. Rendered as bloc-toned chips; an
  at-war border also gets a red inset ring.
- `unitCounts: UnitCount[]` — see change 6.

Files: [`briefing.ts`](../../../src/ui/screens/start/briefing.ts),
[`briefing.test.ts`](../../../src/ui/screens/start/briefing.test.ts),
[`BriefingPanel.tsx`](../../../src/ui/screens/start/BriefingPanel.tsx),
[`BriefingPanel.css`](../../../src/ui/screens/start/BriefingPanel.css)

### 5. A stronger selected-nation highlight on the showcase map

**Problem:** the showcase map dimmed non-selected territory, but the selected nation's shape
still read as one more dark polygon. The connection between the gold card and the map was
easy to miss.

**Solution:** in [`showcase.ts`](../../../src/ui/map/render/layers/showcase.ts):

- the non-selected wash is `rgba(0, 0, 0, 0.42)` (was `0.35`);
- the selected regions get a cream fill `rgba(246, 231, 176, 0.12)` before the outline;
- the outline is `2.5 / scale` px (was `2 / scale`), so it stays visually constant at any zoom.

The highlight still comes from `getStartingControllers`, so occupations during a campaign do
not change the start-screen picture.

### 6. Unit symbols instead of a text force count

**Problem:** "Starting forces — 4 infantry · 2 armor · 2 fighters · 1 bomber" was a sentence.
The game already has `UnitSymbol`, so the briefing should speak the same visual language as
the map and unit drawer.

**Solution:** `getUnitCounts` aggregates `state.units` by `UnitType` in the established
`UNIT_SUMMARY_PARTS` order (infantry, armor, MLRS, fighter, bomber, tactical missile,
strategic missile) and drops zero entries. `BriefingPanel` renders one
`UnitSymbol size={18}` plus the count per type, with a `title` such as `"4 Infantry"`.
`unitSummary` is retained as the plain-text fallback (and for nations with no units).

Files: [`briefing.ts`](../../../src/ui/screens/start/briefing.ts),
[`BriefingPanel.tsx`](../../../src/ui/screens/start/BriefingPanel.tsx),
[`BriefingPanel.css`](../../../src/ui/screens/start/BriefingPanel.css)

## Supporting change: memoized briefing

`StartScreen` now computes the selected nation's briefing with `useMemo` on
`[gameState, playerCountryId]` instead of rebuilding it on every render during hover. Hovering
a card only updates the showcase highlight; it must not rebuild every briefing or the canvas
highlight path.

File: [`StartScreen.tsx`](../../../src/ui/screens/start/StartScreen.tsx)

## Responsive behavior (measured)

Headless Chrome, device scale factor 1, CDP `Emulation.setDeviceMetricsOverride`. Values are
the actual boxes from the page, not estimates.

| Viewport | Rail fits? | Theatre panel | Neutral column | BRICS / NATO |
|---|---|---|---|---|
| 1335 × 747 | 594 / 594 px, not scrollable | hidden | scrolls (519 / 659 px body), fade visible | fit |
| 1440 × 900 | 747 / 747 px, not scrollable | visible, 153 px | fit | fit |
| 1920 × 1080 | 927 / 927 px, not scrollable | visible, 153 px | fit | fit |

At every size the briefing's Start/Load actions are inside the viewport. The column header and
footer padding is `11px 19px` and `7px 19px`; the rail width is
`clamp(300px, 23vw, 380px)` (307 px at 1335, 331 px at 1440, 380 px at 1920).

## Verification

Commands on the finished tree:

- `npx tsc -p tsconfig.app.json --noEmit` — 0 errors.
- `npm test -- --run` — **311 / 311** tests in 41 files. The four new tests are in
  [`briefing.test.ts`](../../../src/ui/screens/start/briefing.test.ts): Russia key-city order,
  Russia's border list with at-war countries first, Austria's border list (Germany at war), and
  Russia's typed unit counts (total 9, infantry 4).
- `npm run build` — OK, CSS 72.26 kB, JS 1,317.74 kB.

Browser check (headless Chrome over CDP, Vite dev server): all three viewports above, no
`console.error` and no uncaught exception. The first run had the right rail 84 px too tall at
1335×747; hiding the theatre panel below 900 px fixed it, and the re-run reports
`sidebar scrollable: false` at all three sizes.

Not run, deliberately: `npm run smoke` and `npm run balance-check`. Nothing under `src/game/`
changed, so the rules and the harnessed scenario are untouched. The main-screen layout lock
also does not cover the start screen; Task 29's start-screen browser walk-through remains the
last full interaction check.

## Things a later agent should know

- **The review was wrong about Austria.** It claimed Austria had no border at war. Verification
  showed it borders **Germany**, which is at war on turn 1. The test asserts Germany specifically;
  do not "fix" it back to the review's claim.
- **Borders describe the start, not the current map.** They use the scenario controllers on
  purpose. If a future feature wants live borders, add a separate field rather than changing
  this one; the start screen must not change while a campaign is being previewed.
- **The theatre panel is hidden below 900 px on purpose.** Do not turn it into a scrolling rail
  again: the clipped panel was the exact defect this pass removed. If its information becomes
  actionable later, put the action in the briefing, not in a panel below the fold.
- **The fade listens to `nations.length` plus a `ResizeObserver`.** The start-screen cards are
  static for a given scenario, so content never changes without a length change. If cards ever
  become dynamic (e.g. live status text), re-run `update()` on those changes too.
- **No new design tokens were added for the chips.** They reuse `--brics-soft`, `--nato-soft`,
  `--neutral-soft`, the matching `*-text` tokens, and `--bad` for the war ring. Keep it that way
  unless the chips become a shared kit component.
