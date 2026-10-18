import type {
  CountryDefinition,
  CountryId,
  CountryState,
  GameState,
  UnitType
} from "../../../game/state/types";

export interface NationBriefing {
  countryId: CountryId;
  name: string;
  blocLabel: "BRICS" | "EU NATO" | "Neutral";
  tierLabel: "Major power" | "Middle power" | "Minor power";
  difficulty: "Easy" | "Medium" | "Hard" | "Very hard";
  difficultyPips: 1 | 2 | 3 | 4;
  status: string;
  capitalName: string;
  regionCount: number;
  keyCityCount: number;
  unitSummary: string;
  warEntryText: string;
  enemyBlocLabel: "BRICS" | "EU NATO" | null;
  enemyBelligerentCount: number;
  enemyMajorLabels: string[];
}

const DIFFICULTY_PIPS: Record<NationBriefing["difficulty"], NationBriefing["difficultyPips"]> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  "Very hard": 4
};

const TIER_LABELS: Record<CountryDefinition["tier"], NationBriefing["tierLabel"]> = {
  major: "Major power",
  middle: "Middle power",
  minor: "Minor power"
};

interface UnitSummaryPart {
  type: UnitType;
  label: string;
  plural: boolean;
}

const UNIT_SUMMARY_PARTS: UnitSummaryPart[] = [
  { type: "infantry", label: "infantry", plural: false },
  { type: "armor", label: "armor", plural: false },
  { type: "mlrs", label: "MLRS", plural: false },
  { type: "fighter", label: "fighter", plural: true },
  { type: "bomber", label: "bomber", plural: true },
  { type: "tacticalMissile", label: "tactical missile", plural: true },
  { type: "strategicMissile", label: "strategic missile", plural: true }
];

export function getStartingStatus(country: CountryDefinition, state: CountryState): string {
  if (state.atWar) {
    return "At war";
  }

  const scriptedTurnRule = country.warEntryRules.find((rule) => rule.type === "scripted_turn");
  if (scriptedTurnRule && scriptedTurnRule.type === "scripted_turn") {
    return `Joins turn ${scriptedTurnRule.turn}`;
  }

  if (country.alignment === "aligned_non_belligerent") {
    return "Aligned reserve";
  }

  return "Neutral";
}

export function getDifficulty(country: CountryDefinition): NationBriefing["difficulty"] {
  if (country.alignment === "neutral") {
    return "Very hard";
  }
  if (country.tier === "major") {
    return "Easy";
  }
  if (country.tier === "middle") {
    return "Medium";
  }
  return "Hard";
}

function getBlocLabel(country: CountryDefinition): NationBriefing["blocLabel"] {
  if (country.blocId === "BRICS") {
    return "BRICS";
  }
  if (country.blocId === "EU_NATO") {
    return "EU NATO";
  }
  return "Neutral";
}

function getWarEntryText(state: GameState, country: CountryDefinition): string {
  if (state.countryStates[country.id]?.atWar) {
    return "At war from turn 1.";
  }
  if (country.warEntryRules.length === 0) {
    return "Neutral at the start.";
  }

  return country.warEntryRules
    .map((rule) =>
      rule.type === "scripted_turn" ? `Joins the war on turn ${rule.turn}.` : rule.description
    )
    .join(" ");
}

function getUnitSummary(state: GameState, countryId: CountryId): string {
  const counts = new Map<UnitType, number>();
  for (const unit of Object.values(state.units)) {
    if (unit.countryId !== countryId) continue;
    counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
  }

  const parts = UNIT_SUMMARY_PARTS.flatMap((part) => {
    const count = counts.get(part.type) ?? 0;
    if (count === 0) return [];
    const suffix = part.plural && count > 1 ? "s" : "";
    return [`${count} ${part.label}${suffix}`];
  });

  return parts.length === 0 ? "No units" : parts.join(" · ");
}

function getEnemySummary(
  state: GameState,
  country: CountryDefinition
): Pick<NationBriefing, "enemyBlocLabel" | "enemyBelligerentCount" | "enemyMajorLabels"> {
  const enemyBlocId =
    country.blocId === "BRICS" ? "EU_NATO" : country.blocId === "EU_NATO" ? "BRICS" : null;
  if (!state.countryStates[country.id]?.atWar || enemyBlocId === null) {
    return { enemyBlocLabel: null, enemyBelligerentCount: 0, enemyMajorLabels: [] };
  }

  const belligerents = state.scenario.countries.filter(
    (other) => other.blocId === enemyBlocId && state.countryStates[other.id]?.atWar
  );

  return {
    enemyBlocLabel: enemyBlocId === "EU_NATO" ? "EU NATO" : "BRICS",
    enemyBelligerentCount: belligerents.length,
    enemyMajorLabels: belligerents
      .filter((other) => other.tier === "major")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(
        (other) =>
          `${other.name} (${state.regions[other.capitalRegionId]?.name ?? other.capitalRegionId})`
      )
  };
}

export function getNationBriefing(state: GameState, countryId: CountryId): NationBriefing {
  const country = state.countries[countryId];
  const countryState = state.countryStates[countryId];
  const difficulty = getDifficulty(country);

  return {
    countryId,
    name: country.name,
    blocLabel: getBlocLabel(country),
    tierLabel: TIER_LABELS[country.tier],
    difficulty,
    difficultyPips: DIFFICULTY_PIPS[difficulty],
    status: getStartingStatus(country, countryState),
    capitalName: state.regions[country.capitalRegionId]?.name ?? country.capitalRegionId,
    regionCount: country.startingRegionIds.length,
    keyCityCount: country.keyRegionIds.length,
    unitSummary: getUnitSummary(state, countryId),
    warEntryText: getWarEntryText(state, country),
    ...getEnemySummary(state, country)
  };
}
