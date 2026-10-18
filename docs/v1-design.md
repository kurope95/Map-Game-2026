# Map Game v1 Design

## Product Target

Map Game v1 is a local browser-based grand strategy prototype set in 2026. The first release targets a playable "Hearts of Iron lite" experience built around two playable blocs, multiple countries with different power tiers, scripted war-entry events, meaningful neutral states, and city-region strategic geography across Northern, Central, and Eastern Europe.

## Scope

- Two playable blocs with literal modern identities:
  - BRICS
  - EU NATO
- Neutral states with diplomatic weight:
  - Austria
  - Switzerland
  - Serbia
  - Bosnia and Herzegovina
  - Montenegro
  - Kosovo
  - Albania
  - North Macedonia
  - Croatia
  - Slovenia
  - Moldova
- Approximate map density target: 60-70 strategic regions
- Turn-based alternating bloc turns
- Fog of war with recon and gradual intelligence improvements
- Production queues with facility-based speed modifiers
- Airports, factories, military factories, and supply hubs
- Offline explainable AI only for v1

## Playable Factions

### BRICS

Playable/allied countries:
- Russia: major power
- Belarus: middle power, aligned but not initially at war
- Novorossia: middle power
- Slovakia: minor power, scripted entry on turn 5
- Hungary: minor power, scripted entry on turn 5

### EU NATO

Playable/allied countries:
- Germany: major power
- Poland: major power
- Romania: minor power
- Czech Republic: middle power, aligned but conditional war entry
- Finland: middle power
- Baltic Federation: minor power
- Ukraine: middle power

## Victory Rules

To defeat a bloc, the attacker must satisfy all three conditions:

1. Control the enemy capital
2. Control at least three designated enemy key regions
3. Control at least 70% of the point value of the enemy's original starting territory

Only the point values from regions owned by that bloc's countries at game start count toward the 70% threshold.

## Economy

Faction-level resources:

- Industry: supports general construction and production
- Oil: consumed by armor, fighters, bombers, and parts of the missile system
- Morale: modifies combat effectiveness and diplomatic resilience

Infrastructure types:

- Airport: required for air unit basing and missions, level affects range and sortie efficiency
- Factory: improves economic throughput
- Military factory: produces military units and missiles, higher level reduces queue time
- Supply hub: anchors logistics networks and extends sustained operational depth

## Units

### Land Units

- Infantry
- Armor

### Air Units

- Fighters
- Bombers

Air units are based in regions with airports and act through missions rather than region occupation.

### Missile Units

- Tactical missiles
- Strategic missiles

Missiles are stockpiled assets produced through military production and launched from eligible infrastructure.

## Rules Priorities

### Fog of War

- Players always see their owned regions
- Adjacent hostile regions are partially visible
- Recon and diplomacy can reveal additional information
- Unit composition outside intel range should be approximate when possible

### Supply

- Supply traces through friendly or authorized-access regions
- Unsupplied units take mild early penalties, then increasing attrition over time

### Diplomacy

Neutral diplomacy is core from v1. The first implementation should support:

- Influence
- Aid
- Pressure
- Guarantee
- Military access request
- Basing rights request
- Intel cooperation

Outcomes should be driven mainly by deterministic thresholds, with small bounded uncertainty rather than swingy randomness.

### AI

The first AI should be heuristic and explainable. Each move set should be backed by doctrine-style priorities such as:

- Defensive attrition
- Mobile offensive
- Diplomatic opportunism

## Delivery Strategy

1. Define content schemas and one scenario
2. Implement deterministic rules engine
3. Build a functional SVG-based UI
4. Add save/load and launcher scripts
5. Add explainable AI

## Scripted Entry Rules

- Belarus joins the war for BRICS after wider strategic escalation:
  - two minor powers eliminated, or
  - two major-power key cities captured, or
  - one major-power capital captured
- Slovakia joins BRICS on turn 5
- Hungary joins BRICS on turn 5
- Czech Republic joins EU NATO if Poland loses one key city or its capital

## Immediate Open Decisions

- Expand the starter city-region set to the intended 60-70 regions
- Initial unit counts and country-specific starting infrastructure
- Exact diplomacy pressure numbers for middle-power neutrals such as Austria and Serbia
