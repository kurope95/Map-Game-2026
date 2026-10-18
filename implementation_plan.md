# Map Game — Implementation Plan (Remaining Work)

This plan covers **only the work that still remains** from `CODEX_PLAN.md`. It is written
for the agent that will implement it. Do **not** re-do work that is already complete.

> **Read this first.** Before touching anything, read `CODEX_PLAN.md` (the original
> roadmap) and `docs/v1-design.md` (the product vision). After every task below, run
> `npx tsc --noEmit` **and** `npm run build` and confirm both succeed with zero errors
> before moving on. Record every change in `CHANGELOG.md` (see that file for the format).

---

## Audit Summary — What Is Already Done

A full audit of the codebase against `CODEX_PLAN.md` found the following already implemented.
**Do not redo these.** They are listed so you know the current baseline.

| Phase | Item | Status | Evidence (file) |
|-------|------|--------|-----------------|
| 0 | Build compiles cleanly | DONE | `npm run build` passes, 0 errors |
| 1A | `types.ts` nation-scoped (`countryStockpiles`, `playerCountryId`, `currentActorId`, `turnOrder`) | DONE | `src/game/state/types.ts` |
| 1B | Country-level stockpiles | DONE | `src/game/content/economy.ts`, `createInitialState.ts` |
| 1C | Starting units for every country incl. neutrals | DONE | `src/game/content/units.ts` |
| 1D | `createInitialState(playerCountryId)` builds turn order | DONE | `src/game/state/createInitialState.ts` |
| 1E | `processEconomy(state, countryId)` | DONE | `src/game/rules/economyEngine.ts` |
| 1F | Order resolution keyed by country | DONE | `src/game/rules/orderResolution.ts` |
| 1G | `advanceTurn` cycles `turnOrder` | DONE | `src/game/rules/turnEngine.ts` |
| 1H | `planCountryTurn` / `executeCountryTurn` | DONE | `src/game/ai/heuristicBot.ts` |
| 1I | `App.tsx` single-nation play, player-only controls | DONE | `src/app/App.tsx` |
| 2 | `aiEconomyTurn` (exceeds the 8-priority spec) | DONE | `src/game/ai/heuristicBot.ts` |
| 3 | Landing page with nation picker | DONE | `src/ui/LandingPage.tsx` |
| 4B | Region capture attribution (`controllerCountryId`) | DONE | `setRegionController` in `turnEngine.ts` |
| 4D | Turn flow (instant resolve + combat report, "Option A") | DONE | `handleAdvanceTurn` in `App.tsx` |

The codebase also includes features **beyond** the original plan: a diplomacy system
(`src/game/rules/diplomacy.ts`), save/load, a doctrine/tech system
(`src/game/content/doctrines.ts`), an economy logic map, an auto-play helper
(`handleAutoPlay` in `App.tsx`), and the Pridnestrovie scenario content.

---

## Remaining Work

There are five remaining items. They are ordered by priority. **TASK 1 is the most
important** — the plan explicitly required it and there is no evidence it was completed.

---

### TASK 1 — Phase 4A: Balance verification pass for every playable nation

**Why:** `CODEX_PLAN.md` Phase 4A requires that every nation be auto-played for ~10 turns
to confirm it does not immediately collapse (run out of food/units/economy). The auto-play
tooling exists (`handleAutoPlay` in `src/app/App.tsx`), but there is no record that the
balance pass itself was ever run, and no fixes derived from it.

**Goal:** Prove (and document) that every playable nation has a viable opening, then fix any
nation that collapses.

**Instructions:**
1. Identify the full set of playable nations from `src/game/content/countries.ts` /
   `scenario.ts` (everything offered on the landing page, including neutrals).
2. For **each** nation, simulate ~10 turns of pure AI auto-play starting from
   `createInitialState(<COUNTRY_ID>)`. You can do this without the UI by writing a small
   throwaway Node/ts script that imports `createInitialState`, `evaluateWarEntryRules`,
   `executeCountryTurn`, and `advanceTurn`, loops 10 game-turns, and prints per-turn:
   - food balance and whether food went negative,
   - total unit count (did it hit zero?),
   - stockpile of key resources (steel, munitions, fuel, energy),
   - regions controlled (did the nation get eliminated?).
   Put this script under a `scripts/` folder (create it) named `balanceCheck.ts`. Keep it —
   it becomes the reusable balance harness referenced by future tasks.
3. Record a results table in `CHANGELOG.md` (and optionally a `docs/balance-report.md`):
   nation | survived 10 turns? | lowest food | min units | notes.
4. For every nation that collapses (eliminated, runs out of food for >2 consecutive turns,
   or cannot afford a single build in the first 3 turns), apply the **minimal** fix:
   - adjust that nation's starting stockpile in `src/game/content/economy.ts`, and/or
   - adjust starting units in `src/game/content/units.ts`, and/or
   - ensure it controls at least one region with a matching resource deposit and enough
     building slots for a basic chain (farm + powerPlant + barracks). Check
     `src/game/content/regions.ts` and `economy.ts`.
   Do **not** rebalance nations that already pass. Make the smallest change that fixes it.
5. Re-run the harness until every playable nation survives 10 turns. Document final numbers.

**Acceptance criteria:**
- `scripts/balanceCheck.ts` exists and runs.
- Every playable nation survives a 10-turn AI auto-play without elimination or sustained
  food starvation.
- A results table is recorded in `CHANGELOG.md` (and/or `docs/balance-report.md`).

---

### TASK 2 — Phase 4C: Allied target coordination

**Why:** `CODEX_PLAN.md` Phase 4C requires that AI countries in the same bloc not compete
for the same attack target, and that when two allies both want a region the **stronger
force** goes. Today each country plans independently in `planCountryTurn`
(`src/game/ai/heuristicBot.ts`); there is no cross-country deduplication of attack targets.
Combat-level coordination (multiple units stacking on one target) already works, and allies
never attack each other's regions, so this is a refinement, not a rewrite.

**Goal:** Prevent allied nations from wasting turns piling onto the same target when one ally
already has overwhelming force committed, and prevent contradictory allied moves.

**Instructions:**
1. Introduce a per-resolution "claimed targets" structure scoped to a bloc for the current
   game-turn cycle. Options (pick the simpler one that fits the existing architecture):
   - **Option A (preferred):** Add an optional transient field to `GameState` (e.g.
     `allyTargetClaims?: Record<BlocId, Record<string /*regionId*/, { countryId, strength }>>`)
     that is reset at the start of each full turn cycle in `advanceTurn`
     (`src/game/rules/turnEngine.ts`). When `executeCountryTurn` issues attack orders, record
     the committed attacker strength against the target region for that bloc.
   - **Option B:** Compute, inside `planCountryTurn`, the set of regions already targeted this
     cycle by same-bloc allies (read from pending orders + claims) and skip targets that an
     ally has already committed sufficient force to.
2. Coordination rule: a nation should **not** issue an attack against a region if an allied
   nation has already committed force ≥ ~1.5× the region's defender strength this cycle.
   Instead it should pick its next-best target (the AI already ranks targets — fall through to
   the next candidate). If this nation's available force is clearly stronger than the ally's
   committed force, it may still take the target (the "stronger force goes" rule); in that case
   the weaker ally's claim should yield.
3. Confirm allied unit **stacking** is allowed (units of different countries in the same bloc
   can occupy the same region without conflict). Verify in `orderResolution.ts` that movement
   into an allied-occupied friendly region is never treated as combat. If it is, fix it.
4. Keep the logic explainable: extend the `BotDecision.reasoning` string to mention when a
   target was skipped due to an allied claim.

**Acceptance criteria:**
- In a multi-nation bloc, two allied AI nations no longer both throw force at the same
  already-secured target in the same turn cycle.
- Allied units can stack in one region without triggering friendly combat.
- `npx tsc --noEmit` and `npm run build` pass.

---

### TASK 3 — Phase 4B: Decide and document captured-facility damage policy

**Why:** `CODEX_PLAN.md` Phase 4B states existing facilities in a captured region should
become `damaged: true` (repairable in 1 turn). The current implementation
(`orderResolution.ts`, around the `attackerCaptured` block) only damages facilities on a
**chance** during hard-fought captures, not always. This is a reasonable design deviation,
but it should be an explicit, recorded decision rather than an accident.

**Goal:** Make the capture-damage behavior intentional and consistent with the repair flow.

**Instructions:**
1. Confirm how facility repair currently works: a `damaged: true` facility should be
   repairable and should rejoin production after ~1 turn. Trace the repair path in
   `src/game/rules/economyEngine.ts` and the AI repair logic in `heuristicBot.ts`
   (search for `damaged`). Verify a damaged facility actually stops producing and can be
   repaired.
2. Choose ONE policy and implement/confirm it (default recommendation: **keep chance-based**,
   because always-damage is punishing and the chance system already exists):
   - **If keeping chance-based:** no code change needed; just document the deviation from the
     plan in `CHANGELOG.md` with rationale, and make sure the chance is tuned sensibly
     (currently scales with how close the battle was).
   - **If switching to always-damage:** in the `attackerCaptured` branch of
     `orderResolution.ts`, set `damaged: true` on all of the captured region's facilities
     (not chance-gated), and add an event-log line. Then verify repair returns them to
     production in ~1 turn.
3. Ensure newly captured regions correctly transfer their economy to the capturing country
   (extraction + facilities now produce for the new owner). This is mostly handled by
   `setRegionController` + `processEconomy` filtering on `controllerCountryId`; just confirm
   with a quick capture test.

**Acceptance criteria:**
- The capture-damage policy is explicitly documented in `CHANGELOG.md`.
- Damaged facilities stop producing and are repaired within ~1 turn.
- Captured regions produce for the new controller on the following turn.

---

### TASK 4 — Phase 4D (optional): AI-turn progress feedback

**Why:** `CODEX_PLAN.md` Phase 4D offered two options for non-player turns. "Option A"
(resolve instantly, show the combat report) is already implemented and was the recommended
choice. "Option B" (a brief processing animation / per-AI-country action log) is optional and
was never built. Only do this if the player experience needs more feedback during long AI
sequences.

**Goal:** Give the player lightweight feedback that AI nations are taking their turns.

**Instructions:**
1. There is already an "Active <country>" indicator in the top bar and a combat report modal
   after End Turn. Decide whether more is needed. If the AI resolution is effectively instant,
   **skip this task** and note "not needed" in `CHANGELOG.md`.
2. If feedback is wanted: add a transient "Resolving AI turns…" overlay/spinner shown while
   `handleAdvanceTurn` iterates through non-player actors in `src/app/App.tsx`. Because the
   loop is synchronous, you'll need to either (a) yield to the event loop between actors
   (e.g. process actors via `setTimeout`/`requestAnimationFrame` chunks and update a status
   string), or (b) show the overlay, defer the heavy loop one frame, then run it. Keep it
   simple; do not change turn logic or `advanceTurn`.
3. Reuse existing CSS variables and modal/overlay styles already in the project. Do not
   restyle the app.

**Acceptance criteria:**
- Either the task is explicitly marked "not needed" in `CHANGELOG.md`, or a non-blocking
  progress indicator appears during multi-nation AI resolution without altering game logic.

---

### TASK 5 — Verification harness & final regression

**Why:** The plan repeatedly required `npx tsc --noEmit` + `npm run build` after each phase,
but there is no automated test coverage. A minimal harness protects the now-complete refactor.

**Goal:** A repeatable, low-cost verification that the game still initializes, advances turns,
and resolves combat for any nation.

**Instructions:**
1. Reuse `scripts/balanceCheck.ts` from TASK 1 as the smoke test, OR add a tiny
   `scripts/smokeTest.ts` that, for 2–3 representative nations (a major, a minor, and a
   neutral), creates initial state, runs 5 turns of auto-play, and asserts: no exceptions,
   `turnOrder` non-empty, player country still defined, event log growing.
2. Add an npm script in `package.json` (e.g. `"smoke": "tsx scripts/smokeTest.ts"` or the
   ts-node/esbuild equivalent already available — check existing devDependencies before adding
   new ones; prefer the toolchain already installed).
3. Run the full regression: `npx tsc --noEmit`, `npm run build`, and the smoke script. All
   must pass.
4. Record the final verification results in `CHANGELOG.md`.

**Acceptance criteria:**
- A smoke/verification script exists and passes.
- `npx tsc --noEmit` and `npm run build` both pass.
- Final results recorded in `CHANGELOG.md`.

---

## Global Rules for This Plan

1. **Do not delete or rewrite working systems** — economy, combat, map rendering, diplomacy,
   save/load are working. Refine, don't replace.
2. **Smallest viable change** — especially for balance. Fix only nations that fail.
3. **Compile after every task** — `npx tsc --noEmit` and `npm run build`, zero errors.
4. **Log everything in `CHANGELOG.md`** — reference the TASK number from this file and the
   files you touched.
5. **Prefer the installed toolchain** — check `package.json` before adding any dependency.
6. **Do not change CSS** except where a task explicitly requires new UI.

## Suggested Execution Order

```
TASK 1: Balance verification pass        (highest priority; may surface fixes)
TASK 3: Capture-facility damage policy   (quick decision + doc)
TASK 2: Allied target coordination       (AI refinement)
TASK 5: Verification harness             (lock in the result)
TASK 4: AI-turn progress feedback        (optional; only if needed)
```

> **Status (2026-06-02):** TASK 1–5 are COMPLETE and verified. See `CHANGELOG.md` and
> `docs/balance-report.md`. The tasks below (TASK 6–9) were greenlit afterwards as the next
> wave of feature work. They are NOT part of the original `CODEX_PLAN.md`; they extend it.

---

# Wave 2 — Greenlit Improvements (Warfare & AI)

These tasks deepen the warfare model and add a strategic AI layer. Same global rules apply:
compile after every task (`npx tsc --noEmit` + `npm run build`), keep the balance/smoke
harness green (`npm run balance-check`, `npm run smoke`), and log every change in
`CHANGELOG.md`. Re-run the balance harness after ANY combat/AI change — these tasks can shift
balance, and TASK 1's harness exists precisely to catch that.

> **Design constraint (Wave 2):** Each map region is a strategic **city-region**, not open countryside.
> Do NOT add mechanics that treat "cities vs non-cities" or open-field maneuver (encirclement
> pockets, terrain-based attack penalties, combined-arms by biome). Improvements should deepen
> what already fits: capitals/key cities, forts, facilities, national goals, bloc war entry,
> stability, and the existing air/missile/bombard pipeline.

> **Important baseline — what already exists (do NOT rebuild):**
> - City-region model: regions have names, capitals, key cities, forts, facilities, stability.
> - Fort sieges (partial): forts block capture until reduced; bombers/MLRS/missiles damage forts
>   and facilities — see [`orderResolution.ts`](./src/game/rules/orderResolution.ts).
> - Entrenchment & veterancy on units (same file).
> - Regional stability (0–100): food, occupation, doctrines; revolt **warnings** exist in
>   [`economyEngine.ts`](./src/game/rules/economyEngine.ts) but low stability has no mechanical bite yet.
> - National AI goals per country: [`aiObjectives.ts`](./src/game/content/aiObjectives.ts).
> - Supply attrition via `supplyTurnsRemaining` (keep as-is; do not add encirclement layer).
> - Allied target coordination (Wave 1 TASK 2): [`allyCoordination.ts`](./src/game/ai/allyCoordination.ts).
> - AI planning: `planCountryTurn` / `getCountryFrontlineData` in [`heuristicBot.ts`](./src/game/ai/heuristicBot.ts).
> - Seeded combat RNG: `setCombatSeed` in `orderResolution.ts`.

---

## TASK 6 — Victory & defeat: implement the v1 three-condition bloc victory

**Why:** `docs/v1-design.md` defines bloc victory as three simultaneous conditions (enemy capital,
≥3 enemy key regions, ≥70% of enemy starting territory value). The game currently uses a simplified
check in [`App.tsx`](./src/app/App.tsx): all enemy **major** powers defeated OR player eliminated.
That undersells the city-region model — winning should mean taking named strategic cities, not
only wiping majors off the map.

**Goal:** A rules-engine victory evaluator that tracks the three v1 conditions per enemy bloc and
drives `victoryStatus` / end-game UI.

**Instructions:**
1. Add `src/game/rules/victoryEngine.ts` with something like
   `evaluateVictoryStatus(state, playerCountryId): VictoryStatus` and helper
   `getBlocVictoryProgress(state, targetBlocId)` returning which of the three conditions are met.
2. **Condition 1 — Capital:** player bloc controls the enemy bloc's designated capital region(s).
   Use each country's `capitalRegionId` and `controllerBlocId` / `controllerCountryId`.
3. **Condition 2 — Key cities:** player bloc controls ≥3 key regions from the enemy bloc's
   starting set. Use `keyRegionIds` and/or regions marked `isKeyCity` owned by enemy countries at
   game start (store starting ownership in `WarHistory` if not already tracked).
4. **Condition 3 — Territory value:** player bloc controls ≥70% of the **point value** of enemy
   bloc starting territory. Sum `pointsFactor` (or equivalent on `RegionDefinition`) for regions
   whose `homeCountryId` belonged to the enemy bloc at start and are now controlled by the player
   bloc. Only starting ownership counts toward the denominator (per v1-design).
5. **Defeat:** keep existing country-defeat logic; player defeat when `playerCountryId` is
   defeated. Optionally: player bloc loses if its capital is taken AND two key cities are lost
   (mirror condition — only if cheap; otherwise skip and document).
6. Wire into [`turnEngine.ts`](./src/game/rules/turnEngine.ts) after region control changes (or
   at end of `advanceTurn`) and replace the ad-hoc `useMemo` in `App.tsx` with the engine result.
7. **UI:** extend the victory modal to show progress toward the three conditions (checklist or
   progress bars) while the game is ongoing — e.g. a collapsible "War aims" panel in the top bar
   or end-game screen. Reuse existing CSS variables.
8. Add a small deterministic test in `scripts/` (or extend smoke test) that asserts progress
   calculation on a crafted state (capture capital → condition 1 true).
9. Re-run balance + smoke; victory changes should not break the 10-turn harness (games won't
   reach victory in 10 turns).

**Acceptance criteria:**
- Victory requires all three v1 conditions against the enemy bloc, not merely defeating all majors.
- Player can see progress toward each condition during play.
- `tsc` + build pass; smoke/balance harness pass.

---

## TASK 7 — Warfare: city siege loop (fort → bombard → assault)

**Why:** City-regions already have forts, facilities, and a bombard/missile pipeline, but assault
and softening are only loosely connected. Deepening the **siege loop** fits the map: take a city
by degrading its fort and garrison, not by open-field encirclement or terrain rules.

**Goal:** Make taking a fortified city-region a deliberate multi-step operation with clear feedback.

**Instructions:**
1. Audit the existing flow in [`orderResolution.ts`](./src/game/rules/orderResolution.ts):
   fort blocks capture (`fortStillHolding`), bombard/missile fort damage, facility damage on
   bombard. Document gaps in `CHANGELOG.md` before coding.
2. **Siege state (lightweight):** optionally track per region `siegePressure?: number` (0–100) or
   derive it each turn from recent bombard damage + adjacent attacker presence — no new "terrain"
   concepts. High siege pressure gives assault bonus and/or extra fort damage next bombard.
3. **Assault gating (tune, don't break):** if a city has an active fort (`health > 0`), require
   either (a) fort health below a threshold, OR (b) at least one successful bombard/missile hit
   this turn cycle, before land assault can capture — OR strengthen the existing bounce/fort-hold
   behavior if it's already close. Pick the smallest change that makes "bomb then attack" the
   correct player sequence.
4. **Facility targeting:** when strategic missiles/bombers hit a city, prioritize damaging
   military facilities (barracks, armor factory) before civilian — weighted random or deterministic
   priority list. Event-log what was hit.
5. **AI:** in [`heuristicBot.ts`](./src/game/ai/heuristicBot.ts), if a national-goal or key city
   target has an active fort and the AI has bombers/MLRS/missiles in range, score **bombard**
   candidates higher than raw assault until fort health is low. Add reason strings ("Softening
   fort at X before assault").
6. Re-run balance + smoke; retune fort health/bombard damage constants only if harness fails.

**Acceptance criteria:**
- Fortified city-regions are noticeably easier to take after bombard/missile preparation.
- Combat/event log explains fort hold, bombard damage, and assault outcomes.
- AI uses bombard before assault on fortified objectives when it has the units.
- Balance harness stays green; `tsc` + build pass.

---

## TASK 8 — AI: Bloc-level strategic coordinator

**Why:** Each nation plans locally in `planCountryTurn`. Wave 1 TASK 2 stopped allies from
*piling onto the same target*, but there is still no positive coordination — no notion of "you
hold this front, I spearhead that one." A light bloc coordinator makes allied AI feel
purposeful.

**Goal:** A per-bloc planning pass that assigns coarse roles/objectives to member nations each
turn cycle, which individual `planCountryTurn` calls then respect.

**Instructions:**
1. Add a module `src/game/ai/blocStrategy.ts` exporting something like
   `computeBlocDirectives(state, blocId): Record<CountryId, { posture: "spearhead" | "hold" |
   "support"; focusRegionIds: string[] }>`.
   - Identify the bloc's enemy frontier (city-regions adjacent to enemy-controlled regions).
   - Rank shared objectives: enemy capitals, `keyRegionIds`, regions in
     [`AI_NATIONAL_GOALS`](./src/game/content/aiObjectives.ts) for any bloc member, weak garrisons
     (few defenders / damaged fort). **Do not** use supply-cut or terrain scoring.
   - Assign the strongest/most-forward nation as `spearhead` toward the top objective; nations
     whose capital/key city is threatened get `hold`; others `support` (reinforce the spearhead's axis).
2. Store directives transiently on `GameState` (like `allyTargetClaims`), reset at the start of
   each full turn cycle in `advanceTurn` ([`turnEngine.ts`](./src/game/rules/turnEngine.ts)).
   Compute them once when the cycle's first bloc member acts (or lazily per bloc).
3. In `planCountryTurn`, read this nation's directive and bias scoring: `spearhead` boosts
   offensive candidates toward `focusRegionIds`; `hold` boosts defensive reservation; `support`
   boosts moves that stage behind the spearhead. Reuse the existing strategic-adjustment plumbing
   (`buildStrategicAdjustment`) rather than inventing a parallel path.
4. Keep it explainable: directives appear in `BotDecision.reasoning`.
5. Make it conservative — directives only *bias* the existing scoring; never hard-override the
   tactical safety logic (don't strip a threatened capital of defenders to feed a spearhead).
6. Re-run balance + smoke; confirm no nation regresses.

**Acceptance criteria:**
- In a multi-nation bloc, one nation consistently presses a shared objective while others screen
  or reinforce, visible in reasoning strings.
- No nation abandons a genuinely threatened capital because of a directive.
- Balance harness stays green; `tsc` + build pass.

---

## TASK 9 — AI: Adaptive postures & difficulty wiring

**Why:** `GameState.difficulty` exists (`"easy" | "normal" | "hard" | "brutal"`) but is
effectively unused, and nations don't visibly shift between defensive/offensive stances based on
the war situation. Both are low-risk, high-flavor.

**Goal:** (a) Per-nation adaptive posture each turn; (b) difficulty that meaningfully changes AI
behavior.

**Instructions:**
1. **Adaptive posture:** derive a per-nation stance from cheap signals already available
   (front pressure from `getCountryFrontlineData`, economy health from stockpiles, unit count vs.
   `unitCap`, unresolved national goals): e.g. `defensiveAttrition` when capital/key city is
   threatened or outnumbered, `mobileOffensive` when strong and facing weak city garrisons,
   `opportunist` when a high-value city (key city / national goal) is poorly defended. Use it to
   scale the aggression weights in `planCountryTurn`. Surface in reasoning.
2. **Difficulty wiring:** thread `state.difficulty` into AI behavior with a small multiplier
   table — affect (a) AI economy reserve discipline / build aggressiveness in `aiEconomyTurn`,
   (b) attack willingness and reserve flex in `planCountryTurn`, and optionally (c) a modest
   resource handicap/bonus applied to AI nations at setup in
   [`createInitialState.ts`](./src/game/state/createInitialState.ts) (NOT to the player).
   Default `normal` = today's behavior (no change), so existing balance holds.
3. Ensure difficulty is selectable: confirm/extend the landing page
   ([`LandingPage.tsx`](./src/ui/LandingPage.tsx)) or settings to set `difficulty`; if wiring UI
   is out of scope, default it and note that in `CHANGELOG.md`.
4. Add a balance-harness option to run at a fixed difficulty (default `normal`) so results stay
   comparable. Keep `normal` as the canonical balance baseline.
5. Re-run balance + smoke at `normal`; spot-check `hard`/`brutal` don't crash.

**Acceptance criteria:**
- Nations visibly change posture between turns based on the situation (reasoning strings).
- `normal` reproduces current balance (harness green); higher difficulties increase AI pressure
  without runtime errors.
- `tsc` + build pass.

---

## Wave 2 Suggested Execution Order

```
TASK 6: Victory conditions (v1 three-condition bloc win)   (structural; clarifies city-region goals)
TASK 7: City siege loop (fort → bombard → assault)         (warfare that fits city-regions)
TASK 8: Bloc-level strategic coordinator                   (AI; uses capitals/key cities/goals)
TASK 9: Adaptive postures & difficulty                     (flavor + replayability; do last)
```

After each Wave 2 task: `npx tsc --noEmit`, `npm run build`, `npm run balance-check`,
`npm run smoke` — all must pass before moving on.
