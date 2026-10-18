# Map Game — Implementation Plan for Codex

This is a multi-phase plan. Execute phases in order. Each phase must compile cleanly (`npx tsc --noEmit` and `npm run build`) before moving to the next.

---

## PHASE 0: Fix Build Errors

The dev server (`npm run dev`) works, but `npm run build` fails on stricter TypeScript checks.

**Tasks:**
1. Run `npm run build` and collect all errors.
2. Fix each error — likely candidates:
   - `TheaterMap.tsx` — missing or incorrect type import (around line 20). Ensure `CountryId` or whatever type is referenced is properly imported from `types.ts`.
   - `economyEngine.ts` — unsafe casts like `stockpile as Record<string, number>`. Replace with proper typed access using `StockpileKey` or index into the `BlocStockpile` type correctly.
3. Do NOT change any game logic in this phase — only fix type errors.
4. Verify: `npm run build` succeeds with zero errors.

---

## PHASE 1: Nation-Scope Refactor (The Big One)

Currently everything is bloc-scoped (BRICS / EU_NATO). We need nation-scoped play where blocs are just fixed alliances. The player picks ONE country and controls only that country's units, economy, and production. Allied countries are run by AI.

### Phase 1A: Update Type Definitions (`src/game/state/types.ts`)

1. **UnitDefinition** — already has `countryId: CountryId`. Verify it's populated everywhere. Units belong to a country; `blocId` stays as the alliance tag.

2. **Rename and re-key bloc-scoped state fields:**
   ```
   blocStockpiles: Record<BlocId, BlocStockpile>
   → countryStockpiles: Record<CountryId, CountryStockpile>
   ```
   Rename the `BlocStockpile` type to `CountryStockpile` (same fields).

3. **Re-key build orders:**
   ```
   economyBuildOrders: Record<BlocId, EconomyBuildOrder[]>
   → economyBuildOrders: Record<CountryId, EconomyBuildOrder[]>
   ```
   Update `EconomyBuildOrder.blocId` → `EconomyBuildOrder.countryId: CountryId`.

4. **Re-key pending orders:**
   ```
   pendingOrders: Record<BlocId, Order[]>
   → pendingOrders: Record<CountryId, Order[]>
   ```

5. **Re-key weed saturation:**
   ```
   weedSaturation: Record<BlocId, number>
   → weedSaturation: Record<CountryId, number>
   ```

6. **Add player identity to GameState:**
   ```typescript
   playerCountryId: CountryId;   // Which country the human controls
   currentActorId: CountryId;    // Whose turn it is right now
   ```
   Keep `currentBlocId` as a **derived getter or computed field** — it's just `countries[currentActorId].blocId`.

7. **Add a turn order array to GameState:**
   ```typescript
   turnOrder: CountryId[];  // All countries that are at war, in play order
   ```

### Phase 1B: Update Economy Data (`src/game/content/economy.ts`)

1. **Replace `initialBlocStockpiles` with `initialCountryStockpiles: Record<CountryId, CountryStockpile>`.**

2. Split the old bloc stockpiles across member nations. Use this distribution logic:
   - Count how many regions each country controls
   - Distribute the bloc's total stockpile proportionally by region count
   - Round to integers, give remainders to the major power (RUSSIA for BRICS, GERMANY for EU_NATO)
   - Neutral countries that start at peace get a small default stockpile: `{ oil: 5, coal: 5, iron: 5, tungsten: 1, food: 15, chemicals: 3, steel: 5, fuel: 3, explosives: 2, fertilizer: 3, munitions: 3, energy: 5, textiles: 1, electronics: 1, vehicles: 0, pharmaceuticals: 0, luxuryGoods: 0, weed: 0, tradePoints: 5 }`

3. Every country that starts at war MUST have a viable stockpile — enough to feed its units and build at least one facility in the first few turns.

### Phase 1C: Fill Out Starting Units (`src/game/content/units.ts`)

Currently only 10 units exist across 5 countries. Every country that `startsAtWar: true` needs starting units. Countries that are `aligned_non_belligerent` should also get a small garrison.

**Minimum starting forces per country:**

| Country | Bloc | Tier | Starting Units |
|---------|------|------|---------------|
| RUSSIA | BRICS | major | 2 infantry (bryansk, moscow), 1 armor (rostov-on-don), 1 fighter (moscow), 1 bomber (smolensk) |
| NOVOROSSIA | BRICS | middle | 2 infantry (donetsk, lugansk), 1 armor (mariupol) |
| BELARUS | BRICS | middle | 1 infantry (minsk), 1 infantry (brest) — activates turn 5 |
| SLOVAKIA | BRICS | minor | 1 infantry (bratislava) — activates turn 5 |
| HUNGARY | BRICS | minor | 1 infantry (budapest) — activates turn 5 |
| GERMANY | EU_NATO | major | 2 infantry (berlin, hannover), 1 armor (dresden), 1 fighter (berlin), 1 strategicMissile (essen) |
| POLAND | EU_NATO | major | 2 infantry (warsaw, lublin), 1 armor (poznan), 1 fighter (gdansk) |
| UKRAINE | EU_NATO | middle | 2 infantry (kyiv, lviv), 1 armor (kharkov), 1 bomber (kyiv) |
| ROMANIA | EU_NATO | minor | 1 infantry (bucharest), 1 infantry (constanta) |
| BALTIC_FEDERATION | EU_NATO | minor | 1 infantry (riga), 1 infantry (vilnius) |
| CZECH_REPUBLIC | EU_NATO | middle | 1 infantry (prague), 1 armor (brno) — activates on Poland crisis |
| FINLAND | EU_NATO | middle | 1 infantry (helsinki) — activates on Baltic collapse |

**Neutral countries** (AUSTRIA, SERBIA, SWITZERLAND, etc.): 1 infantry in capital each. These units defend if attacked but don't act offensively until diplomacy activates them. For now they just sit there.

**Unit ID convention:** `{countryCode}-{unitType}-{number}`, e.g. `by-inf-1` for Belarus infantry #1.

Each unit MUST have both `blocId` and `countryId` set correctly.

### Phase 1D: Update `createInitialState.ts`

1. Import `initialCountryStockpiles` instead of `initialBlocStockpiles`.
2. Set `countryStockpiles` from the new data.
3. Initialize `economyBuildOrders` as `Record<CountryId, []>` for every country.
4. Initialize `pendingOrders` as `Record<CountryId, []>` for every country.
5. Initialize `weedSaturation` as `Record<CountryId, 0>` for every country.
6. Set `playerCountryId` — for now hardcode to `"RUSSIA"`. The landing page (Phase 4) will make this dynamic.
7. Set `currentActorId` to `playerCountryId`.
8. Build `turnOrder`: all countries where `startsAtWar === true`, ordered by bloc alternation. E.g.: `[RUSSIA, GERMANY, NOVOROSSIA, POLAND, ...]` — interleave BRICS and EU_NATO countries so play alternates. Player's country goes first.

### Phase 1E: Update Economy Engine (`src/game/rules/economyEngine.ts`)

1. Change signature: `processEconomy(state, countryId: CountryId)` instead of `blocId`.
2. Process only regions where `controllerCountryId === countryId` (not all bloc regions).
3. Read/write `countryStockpiles[countryId]` instead of `blocStockpiles[blocId]`.
4. Build orders: process `economyBuildOrders[countryId]`.
5. Weed saturation: calculate per country population, store in `weedSaturation[countryId]`.
6. Food consumption: only this country's units and regions.
7. When a unit is recruited via build order completion, set both `countryId` and `blocId` on the new unit.

### Phase 1F: Update Order Resolution (`src/game/rules/orderResolution.ts`)

1. `issueOrder` / `clearOrders` / `resolveOrders` — change from `blocId` to `countryId`.
2. `pendingOrders[countryId]` instead of `pendingOrders[blocId]`.
3. `getValidTargets` — a unit can move to any adjacent region. It can attack regions controlled by an enemy **bloc** (not just enemy country). Allied countries' regions are friendly.
4. When a country's unit captures a region: set `controllerCountryId` to the capturing unit's `countryId`, and `controllerBlocId` to that country's `blocId`.

### Phase 1G: Update Turn Engine (`src/game/rules/turnEngine.ts`)

1. Replace the simple BRICS↔EU_NATO flip with a turn order system:
   ```typescript
   function advanceTurn(state: GameState): GameState {
     // Resolve orders for current actor
     let next = resolveOrders(state, state.currentActorId);
     // Process economy for current actor
     next = processEconomy(next, state.currentActorId);
     // Advance to next actor in turnOrder
     const idx = next.turnOrder.indexOf(next.currentActorId);
     const nextIdx = (idx + 1) % next.turnOrder.length;
     next.currentActorId = next.turnOrder[nextIdx];
     // Increment game turn when we've cycled back to the first actor
     if (nextIdx === 0) next.turn += 1;
     // Check war entry rules
     next = evaluateWarEntryRules(next);
     return next;
   }
   ```
2. When a country enters war via war entry rules, add it to `turnOrder`.

### Phase 1H: Update AI (`src/game/ai/heuristicBot.ts`)

1. Change `planBlocTurn(state, blocId)` → `planCountryTurn(state, countryId: CountryId)`.
2. Filter units by `unit.countryId === countryId` (not `unit.blocId`).
3. The AI should NOT attack regions controlled by countries in the same bloc (allied countries).
4. `executeBlocTurn` → `executeCountryTurn(state, countryId)`.

### Phase 1I: Update App.tsx

This is the biggest UI change. Key principles:
- The player only controls their own country (identified by `playerCountryId`).
- When it's the player's turn (`currentActorId === playerCountryId`), they can issue orders, build, recruit.
- When it's any other country's turn, the AI runs automatically (or the player clicks "Next" to advance).
- The stockpile popup shows the player's country stockpile.
- The economy tab shows the selected region's economy, but build/recruit only works if the region belongs to the player's country.

**Specific changes:**
1. Replace all `gameState.currentBlocId` references:
   - For filtering player's units: use `gameState.playerCountryId`
   - For checking whose turn it is: use `gameState.currentActorId`
   - For bloc alliance checks: derive from `gameState.countries[countryId].blocId`

2. `handleAdvanceTurn`: if the next actor is not the player, auto-run AI for all non-player countries until it's the player's turn again.

3. `handleSelectUnit`: only allow selecting units where `unit.countryId === playerCountryId`.

4. Stockpile tab: show `countryStockpiles[playerCountryId]`.

5. Build/recruit handlers: deduct from `countryStockpiles[playerCountryId]`, queue in `economyBuildOrders[playerCountryId]`.

6. The "Bloc" indicator in the top bar should show both the country name and the bloc: e.g., "RUSSIA (BRICS)".

**Verify:** The game should be playable end-to-end as Russia. End Turn → AI runs all other countries → back to player.

---

## PHASE 2: AI Economy

The AI currently only moves/attacks. It doesn't build facilities, recruit units, or manage resources. Without this, AI countries will run out of units and lose every game.

### Implementation: Add `aiEconomyTurn(state, countryId)` in `heuristicBot.ts`

This function runs BEFORE the military AI (`planCountryTurn`). It uses a simple priority chain — evaluate top-to-bottom, execute the first affordable action:

```typescript
function aiEconomyTurn(state: GameState, countryId: CountryId): GameState {
  const stockpile = state.countryStockpiles[countryId];
  const myRegions = Object.values(state.regionEconomies)
    .filter(([regionId]) => state.regions[regionId].controllerCountryId === countryId);
  const myUnits = Object.values(state.units).filter(u => u.countryId === countryId);
  const pendingBuilds = state.economyBuildOrders[countryId] ?? [];

  // Don't queue more than 3 builds at once (budget discipline)
  if (pendingBuilds.length >= 3) return state;

  // Priority chain:
  // 1. ENERGY CRISIS: no powerPlant and coal available → build powerPlant
  // 2. FOOD CRISIS: food < myUnits.length * 2 → build farm in highest-fertility region
  // 3. NO BARRACKS: no barracks anywhere → build barracks in capital
  // 4. STEEL SHORTAGE: steel < 5 and has iron region → build smelter
  // 5. MUNITIONS SHORTAGE: munitions < 3 → build munitionsPlant
  // 6. INFANTRY LOW: infantry count < 3 and has barracks → recruit infantry
  // 7. ARMOR LOW: armor count < 1 and has armorFactory → recruit armor
  // 8. UPGRADE: if surplus resources, upgrade highest-value facility

  // For each priority, check:
  //   a) Is this need real? (deficit exists)
  //   b) Is there a valid region with available building slots?
  //   c) Can we afford it?
  // If yes: deduct cost, add to economyBuildOrders[countryId], return updated state
  // If no: fall through to next priority

  return state;
}
```

**Key rules for AI economy:**
- Never spend to zero — always keep a reserve of at least `{ steel: 2, food: 5 }`.
- Prefer building in regions with more building slots available.
- Prefer extraction facilities in regions that have matching resource deposits.
- Major powers (tier: "major") can queue up to 4 builds; middle powers 3; minor powers 2.
- Don't build civilian factories during wartime (focus on military).

### Wire it in:

In `executeCountryTurn`:
```typescript
function executeCountryTurn(state: GameState, countryId: CountryId) {
  let s = aiEconomyTurn(state, countryId);      // Economy first
  const result = planCountryTurn(s, countryId);   // Then military
  // ... issue orders
  return { state: s, decision: result };
}
```

---

## PHASE 3: Landing Page

Add a pre-game screen where the player picks their country before entering the map.

### Implementation:

1. **Add game phase to App state:**
   ```typescript
   type GamePhase = "landing" | "inGame";
   const [gamePhase, setGamePhase] = useState<GamePhase>("landing");
   const [playerCountry, setPlayerCountry] = useState<CountryId | null>(null);
   ```

2. **Landing page component** (can be inline in App.tsx or a new file `src/ui/LandingPage.tsx`):
   - Title: "MAP GAME — Europe 2026"
   - Subtitle: "Choose your nation"
   - Three columns: BRICS | NEUTRAL | EU_NATO
   - Each country is a clickable card showing:
     - Country name
     - Flag/color indicator (red for BRICS, blue for EU_NATO, gray for neutral)
     - Tier badge (Major / Middle / Minor)
     - Starting status: "At War" / "Joins Turn X" / "Neutral"
     - Number of starting regions
     - Number of starting units
     - Difficulty rating: Major = Easy, Middle = Medium, Minor = Hard, Neutral = Very Hard (no allies)
   - Clicking a country highlights it; a "Start Game" button confirms
   - Neutral countries should show a tooltip: "Neutral nations have no allies and limited starting forces. Recommended for experienced players."

3. **On "Start Game":**
   - Set `playerCountryId` in the initial state
   - Set `currentActorId` to `playerCountryId`
   - Build `turnOrder` with player's country first
   - Transition to `gamePhase = "inGame"`
   - Render the existing map UI

4. **Styling:** Dark theme consistent with the existing UI. Use the same CSS variables (`--bg`, `--panel`, `--border`, `--text`, `--accent`, `--brics`, `--eu`).

---

## PHASE 4: Balance & Polish

After phases 0-3 are done, these are the remaining items to address:

### 4A: Verify All Nations Have Viable Economies
- Every country at war must have at least one region with a resource deposit.
- Every country must have enough building slots to build a basic military chain (farm + powerPlant + barracks minimum).
- Run 10 turns of auto-play for each playable country and verify they don't immediately collapse.

### 4B: Region Capture Attribution
- When a unit captures a region, the region's `controllerCountryId` must update to the unit's `countryId`, not just the bloc.
- The capturing country gets the region's economy (extraction, facilities).
- Existing facilities in captured regions should become `damaged: true` (takes 1 turn to repair).

### 4C: Allied Coordination
- AI countries in the same bloc should not compete for the same attack targets.
- If two allied countries both want to attack the same region, the one with the stronger force should go.
- Allied units can stack in the same region without conflict.

### 4D: Turn Flow UX
- When it's not the player's turn, show a brief "processing..." overlay or auto-advance.
- Option A: All non-player turns resolve instantly when the player clicks "End Turn".
- Option B: Show a quick animation/log of each AI country's actions.
- Recommend Option A for now (simpler). The event log already captures what happened.

---

## Execution Order Summary

```
PHASE 0: Fix build errors                          (~15 min)
PHASE 1A: Update types.ts                          (~30 min)
PHASE 1B: Update economy.ts (country stockpiles)   (~30 min)
PHASE 1C: Fill out units.ts (all nations)           (~30 min)
PHASE 1D: Update createInitialState.ts              (~20 min)
PHASE 1E: Update economyEngine.ts                   (~30 min)
PHASE 1F: Update orderResolution.ts                 (~15 min)
PHASE 1G: Update turnEngine.ts                      (~20 min)
PHASE 1H: Update heuristicBot.ts                    (~20 min)
PHASE 1I: Update App.tsx                            (~45 min)
── Checkpoint: game plays as single nation ──
PHASE 2: AI Economy                                 (~45 min)
── Checkpoint: AI builds & recruits ──
PHASE 3: Landing Page                               (~30 min)
── Checkpoint: full game flow ──
PHASE 4: Balance & Polish                           (~60 min)
```

After EACH sub-phase: run `npx tsc --noEmit` and fix any type errors before proceeding.

---

## Critical Rules

1. **Do not delete existing game logic** — refactor it. The economy engine, combat resolution, and map rendering are working correctly; they just need re-keying from bloc to country.
2. **Do not change the map rendering** (TheaterMap.tsx) except to update any `blocId` references to use `countryId` where appropriate. The Voronoi tessellation, zoom, and overlays are working.
3. **Do not change CSS** unless adding new styles for the landing page.
4. **Blocs still matter** — they determine alliances, war declarations, and who can attack whom. A unit can attack any region controlled by a country in an enemy bloc. A unit cannot attack regions in its own bloc.
5. **Test after each phase** — the game must remain playable throughout. If something breaks, fix it before moving on.
6. **Keep the existing alternating turn structure** — but instead of 2 blocs alternating, it's N countries cycling through `turnOrder`.
