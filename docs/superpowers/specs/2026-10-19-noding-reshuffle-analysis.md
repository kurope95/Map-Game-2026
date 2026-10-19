# Noding analysis and proposed reshuffle

Date: 2026-10-19
Status: **analysis only. Nothing in this document has been implemented or approved.**
The graph, the generator rule and every adjacency in the repo are unchanged. This is the
record of a study Marek asked for; it is not a plan to execute. Do not modify adjacency
without Marek choosing a stage.

## The question

The city-regions are already positioned. The question was how they are **connected**: which
links are nodes on a real corridor, which are redundant shortcuts, and what a cleaner graph
would enable mechanically. Marek's constraints: keep Odesa–Tiraspol, Odesa–Zaporizhzhia and
the Tokmak chain; major cities must remain major nodes you can reach many places from in one
move.

## How the graph works today

`createInitialState("RUSSIA")` starts from 63 hand-authored regions and generates 40
satellites (per country: `Math.max(1, Math.ceil(countryRegions.length × 0.5))`), for **103
regions**.

| Fact | Value |
|---|---|
| Undirected edges | **227** (symmetric adjacency) |
| Components | 1 |
| Average degree | 4.4 |
| Average shortest path | 5.25 |
| Longest shortest path | 12 (Bern → a Helsinki satellite) |
| Bridges | 1: `zaporizhzhia`–`sevastopol` |
| Articulation points | 2: `helsinki`, `zaporizhzhia` |
| Static 63-region graph | 5 bridges, 7 articulation points |

Adjacency is **unweighted**: one hop is one land move or attack, regardless of distance. Air and
missile range are the closed 2-hop neighbourhood. Supply is BFS from the capital. So the graph
directly sets tempo, threat range and supply reach; a redundant link is not cosmetic.

Top-degree hubs: `kharkov`, `moscow`, `warsaw` (9); `belgrade`, `bryansk`, `dnipro`,
`donetsk`, `krakow` (8); then `berlin`, `bucharest`, `budapest`, `helsinki`, `kyiv`, `odesa`,
`poznan`, `tirana`, `wroclaw`, `zaporizhzhia` (7). Marek's "major nodes" requirement is
already true; the reshuffle below keeps these hubs.

## Why some links look wrong

The generator in
[`createInitialState.ts`](../../../src/game/state/createInitialState.ts#L344) gives every
satellite this adjacency:

```ts
const linkedNeighbors = (manualVariant?.linkIds ?? source.adjacentRegionIds.slice(0, 2))
  .filter((neighborId) => regionsById[neighborId] && neighborId !== source.id)
  .slice(0, 3);
// ...
adjacentRegionIds: [source.id, ...linkedNeighbors]
```

It then writes the reverse edges for every neighbour (lines 419–428). Three consequences:

1. **Each satellite closes a triangle.** It links to its parent *and* to up to two of the
   parent's neighbours, so the parent's neighbours become adjacent to each other through the
   satellite. That bypasses gateways the static map intended.
2. **`manualVariant.linkIds` can be ambitious.** The 40 hand-authored satellite plans include
   long cross-country links (Gatchina → Tallinn and Moscow, Dzerzhinsk → Moscow and Kazan,
   Zelenodolsk → Nizhny Novgorod and Moscow, Chornomorsk → Chisinau).
3. **Distance never costs anything.** A 500 km inherited link costs the same one hop as a
   100 km link, so the shortcut is always taken.

Concrete examples of the result:

- `chisinau`–`odesa-black-sea-port`: Chornomorsk gives Moldova a direct Black Sea port,
  bypassing Tiraspol.
- `odesa`–`bucharest` (427 km): a direct jump over the Constanța corridor.
- `moscow`–`kazan` (719 km), `kazan-volga-bend-2` (Zelenodolsk)–`moscow` and
  `nizhny-novgorod-oka-district` (Dzerzhinsk)–`moscow`: the Volga approach is triple-linked to
  Moscow, bypassing Nizhny Novgorod; `moscow-oblast` (Balashikha)–`bryansk` adds a fourth
  shortcut around the capital.
- `minsk`–`warsaw` (475 km) and `minsk-central-belt` (Barysaw)–`warsaw`: two parallel
  Belarus–Poland crossings, bypassing Brest.
- `bryansk`–`minsk` (455 km): closes the Minsk–Bryansk–Moscow triangle.
- `berlin`–`essen` (453 km) and `essen`–`munich` (494 km): long German north–south jumps that
  skip Hannover and the Rhine corridor.
- `saint-petersburg-neva-corridor` (Gatchina)–`tallinn` and `tallinn-east` (Narva)–`helsinki`:
  triangles around the Gulf of Finland.
- `chisinau`–`cluj-napoca` (399 km) and `chisinau`–`cluj-napoca-transylvania` (500 km): two
  Moldova–Transylvania links in parallel.
- `bern`–`salzburg` (433 km), `sarajevo`–`zagreb-adriatic-coast` (Rijeka, 387 km),
  `prague`–`krakow` (393 km): lateral shortcuts that skip the intermediate capitals.

Long links are not automatically wrong: Odesa–Zaporizhzhia is 366 km and Marek requires it.
The problem is **redundant** long links that remove a decision.

## Must-keep links

Verify these after any edit:

- `odesa`–`chisinau-pridnestrovie` (Odesa–Tiraspol) — Marek requires it.
- `odesa`–`zaporizhzhia` — Marek requires it.
- `zaporizhzhia`–`zaporizhzhia-tokmak-line` — the Tokmak chain; Marek requires it.
- `mariupol`–`zaporizhzhia-tokmak-line` — the second Tokmak link, load-bearing after cuts.
- `chisinau`–`chisinau-pridnestrovie` — keep Tiraspol's forced 2-link adjacency.
- `brest`–`warsaw` and `brest`–`minsk` — the real crossing once the Warsaw–Minsk shortcuts go.
- `odesa`–`constanta` — the southern coastal corridor once Odesa–Bucharest goes.

**Unresolved:** Marek also named "Odesa–Tokmak". There is **no direct edge** today; it is the
2-hop chain Odesa–Zaporizhzhia–Tokmak. Whether he wants a literal edge is an open question.
Do not add it unilaterally.

## Proposed core reshuffle (15 edits)

This is the tested set. IDs are the runtime region IDs, which is what an implementation must
use; the display names are in parentheses.

### Cuts (10)

| Edge | Reason |
|---|---|
| `moscow`–`kazan` (Moscow–Kazan) | 719 km; makes the Volga a route through Nizhny Novgorod instead of a direct jump. |
| `kazan-volga-bend-2`–`moscow` (Zelenodolsk–Moscow) | The satellite repeats the same jump in parallel. |
| `nizhny-novgorod-oka-district`–`moscow` (Dzerzhinsk–Moscow) | Removes the satellite shortcut around Nizhny Novgorod, the Volga hinge. Balashikha–Bryansk is a separate second-wave cut, not this one. |
| `minsk`–`warsaw` | 475 km; Brest should be the crossing. |
| `minsk-central-belt`–`warsaw` (Barysaw–Warsaw) | A second parallel crossing at Barysaw. |
| `bryansk`–`minsk` | 455 km; closes the Minsk–Bryansk–Moscow triangle. |
| `berlin`–`essen` | 453 km; Hannover should be on the route. |
| `odesa`–`bucharest` | 427 km; Constanța is the coastal gateway. |
| `saint-petersburg-neva-corridor`–`tallinn` (Gatchina–Tallinn) | Jumps the Narva/Saint Petersburg corridor. |
| `tallinn-east`–`helsinki` (Narva–Helsinki) | Closes the Gulf of Finland triangle. |

### Adds (5)

| Edge | Reason |
|---|---|
| `minsk`–`vilnius` | The real Belarus–Lithuania corridor. |
| `warsaw`–`kaunas` | The Suwalki land bridge; makes the Poland–Lithuania corridor explicit. |
| `berlin`–`hannover` | Restores the German east–west spine after Berlin–Essen. |
| `belgrade`–`zagreb` | The missing Belgrade–Zagreb corridor; the Balkans currently route through Bosnia or Hungary. |
| `sevastopol`–`mariupol` | Azov coastal link; gives Crimea a second connection instead of the single Zaporizhzhia bridge. |

### Tested outcome

Applied in memory to `createInitialState("RUSSIA")`:

- **222 edges**, one component, **0 bridges**.
- Articulation points: `helsinki`, `nizhny-novgorod`.
- **No leaves**; every region has degree ≥ 2.
- Average shortest path 5.32, longest 12.
- Required links all present; Odesa–Tokmak still 2 hops; Chisinau degree 5, Tiraspol degree 2.

This is the shape to discuss first: it removes the bypasses without creating dead ends.

## Wider probe (not yet recommended)

A broader in-memory stress test added 7 more cuts and 4 more adds to the core set. It is useful
evidence, not a second proposal.

**Extra cuts:** `moscow-oblast`–`bryansk` (Balashikha–Bryansk),
`saint-petersburg-neva-corridor`–`moscow` (Gatchina–Moscow),
`essen-ruhr-corridor`–`munich` (Dortmund–Munich), `chisinau`–`cluj-napoca-transylvania`,
`chisinau`–`cluj-napoca`, `bern`–`salzburg`, `sarajevo`–`zagreb-adriatic-coast`.

**Extra adds:** `dresden`–`wroclaw`, `brest`–`lviv`, `budapest`–`zagreb`,
`belgrade`–`podgorica`. This probe keeps the core's `warsaw`–`kaunas`; a variant that used
`gdansk`–`kaunas` and also cut `prague`–`krakow` and `chisinau`–`odesa-black-sea-port`
produced 218 edges with the same two leaves.

**Outcome:** 219 edges, one component, two bridges
(`saint-petersburg`–`saint-petersburg-neva-corridor`, `bern-zurich-basin`–`bern`);
**leaves are Bern and Gatchina**; Chisinau degree 3, Tiraspol degree 2; required links intact.
The leaves are why this stays a probe: a one-link region is a supply dead-end and easy to
isolate. Adopting it means either adding a relief link (Bern to Zurich/Munich; Gatchina to
Narva or Moscow) or accepting the fragility deliberately.

## The generator fix is the highest-leverage change

Hand-editing 15 edges fixes this map. It does not fix the next one. Proposed rule for
`expandScenarioRegions`:

- parent + **one** real neighbour, not up to two;
- cap the inherited link at roughly **250–300 km**;
- when adding the neighbour link, **remove the parent–neighbour edge** instead of closing a
  triangle.

That keeps satellites as degree-2/3 corridor nodes rather than bypasses. Audit
`manualVariant.linkIds` afterwards: it takes precedence over the fallback and is where the
long hand-authored jumps live.

Changing generation changes the 40 generated regions, so it has the same save-compatibility
question as the hand edits (below).

## Mechanics a cleaner graph would enable

These are candidates, not commitments. None is implemented.

- **Edge types.** Rail / road / sea links with different movement cost and supply throughput.
  Today every edge costs one hop; a rail spine (Berlin–Hannover–Warsaw–Minsk–Moscow) would
  become an asset worth cutting.
- **Gateway forts.** Give the remaining bridges/articulation points (Helsinki, Zaporizhzhia,
  Suwalki, Pridnestrovie) a fort and supply role. Holding them cuts or extends supply. This
  fits the planned city siege loop (implementation_plan TASK 7) without adding open-field
  mechanics.
- **Depots.** Generalize `strategicDepot` (currently Pridnestrovie) to a few corridor nodes; a
  depot projects supply along its corridor.
- **Partisans / interdiction.** A cut corridor behind the front leaves a disconnected pocket
  with unrest or partisan pressure. It is a consequence of the graph, not a new combat system.
- **Neighborhood diplomacy.** Borders decide who can be pressured, who is a buffer, and who can
  be dragged in. Cleaner noding makes neutral buffers behave like buffers.
- **AI multi-hop planning.** With fewer redundant shortcuts, adjacent-only AI looks weaker
  unless it plans routes. BFS/A* over 103 nodes is cheap (see the note at the end).

## Risks and implementation rules

- **Saves store adjacency.** `GameState.regions[].adjacentRegionIds` is serialized. A reshuffle
  applies to new campaigns; old saves keep the old graph unless a migration rebuilds adjacency.
  Decide migrate vs invalidate before shipping any edit.
- **`npm run validate-map` checks only the 63 static regions.** The generated 40 are not
  covered. Any reshuffle needs its own graph assertions: one component, required links, no
  unintended leaves, expected edge count.
- **Re-run `npm run balance-check`.** Supply BFS, 2-hop air/missile range and the AI's adjacent
  scoring all shift with the graph, even though no rule changed.
- **Do not touch `src/game/rules/` for a noding change.** This is content/state data.
- **Do not implement any stage without Marek's choice.** The core 15, the generator rule, the
  wider probe and the mechanics are four separate decisions.

## Open questions for Marek

1. **Odesa–Tokmak:** add a literal edge, or keep the 2-hop chain through Zaporizhzhia?
2. **Which stage first:** generator rule, core 15 hand edits, wider probe, or a mechanic?
3. **Bern and Gatchina:** allow them to become leaves in the wider probe, or add relief links?
4. **Edge types/rail costs:** in scope for the next gameplay spec, or is pure topology enough?

## AI pathfinding

Pathfinding is **not out of scope**. The AI currently only scores adjacent regions
([`heuristicBot.ts`](../../../src/game/ai/heuristicBot.ts)); it has no route planning. A
deterministic BFS or A* over 103 nodes is cheap. The natural layer is AI-only: compute
distance-to-goal and let the AI pick the adjacent step that reduces it. That would not change
player movement rules or require weighted edges. It should be its own spec/plan with tests and
a balance-check, and it pairs naturally with a less redundant graph. It was **not** implemented
in this pass.

## Verification of this analysis

- Run against `createInitialState("RUSSIA")` in Node via `tsx`; metrics computed from the
  runtime adjacency, not from the static scenario file.
- Core 15 edits: 222 edges, one component, 0 bridges, arts Helsinki/Nizhny Novgorod, no leaves,
  average shortest path 5.32, maximum 12.
- Wider probe (17 cuts, 9 adds): 219 edges, one component, 2 bridges, leaves Bern/Gatchina,
  Chisinau degree 3, Tiraspol degree 2.
- The core's Dzerzhinsk cut and the earlier Balashikha–Bryansk cut were also tested
  independently; both versions keep one component, no leaves and no bridges. This document uses
  the Dzerzhinsk version, with Balashikha moved to the wider probe.
- Required links true in both runs; Odesa–Tokmak not direct in either.
- An early analyzer pass misaligned country labels (sorted IDs against an unsorted array).
  Degree, edge and component facts are correct; **do not reuse the per-hub country labels from
  that scratch output**. Recompute them from a live `GameState` if a future step needs them.
- The analysis scripts lived in the OS temp directory (`mapgame-nodes`), not in the repo. No
  repository file changed.
