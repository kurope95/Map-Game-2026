import type { CountryDefinition, CountryId, GameState } from "../../../game/state/types";
import { UNIT_TYPE_LABELS } from "../../kit/unitSymbols";

export type ReportCategory =
  | "capture"
  | "battle"
  | "air"
  | "strike"
  | "move"
  | "supply"
  | "diplomacy"
  | "production"
  | "warning"
  | "other";

export type ReportTone = "good" | "bad" | "warn" | "neutral";

export interface ReportRow {
  category: ReportCategory;
  text: string;
  tone: ReportTone;
  lines: string[];
  children?: string[];
}

export interface ReportSection {
  key: CountryId | "WORLD";
  relation: "you" | "ally" | "enemy" | "neutral" | "world";
  rows: ReportRow[];
}

export interface TurnReportSummary {
  battles: number;
  captures: number;
  moves: number;
  warEntries: number;
  defeats: number;
}

export interface TurnReport {
  turn: number;
  sections: ReportSection[];
  summary: TurnReportSummary;
}

export interface TurnReportData {
  turn: number;
  events: string[];
  before: GameState;
  after: GameState;
  playerCountryId: CountryId;
}

interface ParsedLine {
  clean: string;
  category: ReportCategory;
  actor: CountryId | "WORLD";
}

const TURN_MARKER = /^Turn advanced\. Active country: (.+)\.$/;
const WORLD_LINE = /entered the war on turn|has been defeated\.|secured the Pridnestrovie depot/;
const BRACKET_PREFIX = /^\[[^\]]+\]\s*/;
const COLLAPSE_WHITESPACE = /\s+/g;
const SUPPLY_ATTRITION = /^(\S+) suffers supply attrition in (.+) \(-(\d+) STR\)\.$/;
const BATTLE_OUTCOME =
  /\. (Decisive attacker victory|Attacker victory|Pyrrhic attacker victory|Surprising attacker breakthrough|Narrow defender hold|Defender holds)\./;
const WON_OUTCOMES = new Set([
  "Decisive attacker victory",
  "Attacker victory",
  "Pyrrhic attacker victory",
  "Surprising attacker breakthrough",
]);
const CAPTURE_CONTROLLER = /is now controlled by (.+)\.$/;
const UNIT_TOKEN = /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g;

const CATEGORY_PATTERNS: [ReportCategory, RegExp][] = [
  ["capture", /is now controlled by/],
  ["battle", /^Battle of/],
  ["air", /^Air combat over/],
  ["strike", /struck|Bomber sortie|MLRS bombardment/],
  ["move", /moved from/],
  ["supply", /supply attrition|cut off|re-established supply|running out of supply/],
  ["diplomacy", /used .+ in/],
  ["production", /deployed|replenished|built|upgraded|repaired/],
  ["warning", /WARNING|FOOD SHORTAGE/],
];

const RELATION_ORDER: Record<ReportSection["relation"], number> = {
  world: 0,
  you: 1,
  ally: 2,
  enemy: 3,
  neutral: 4,
};

function categorize(text: string): ReportCategory {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

function cleanLine(raw: string): string {
  return raw.replace(BRACKET_PREFIX, "").replace(COLLAPSE_WHITESPACE, " ").trim();
}

function buildUnitLabels(before: GameState, after: GameState): Map<string, string> {
  const labels = new Map<string, string>();
  for (const state of [before, after]) {
    for (const [id, unit] of Object.entries(state.units)) {
      if (labels.has(id)) continue;
      const countryName =
        before.countries[unit.countryId]?.name ?? after.countries[unit.countryId]?.name ?? unit.countryId;
      labels.set(id, `${UNIT_TYPE_LABELS[unit.type]} (${countryName})`);
    }
  }
  return labels;
}

function replaceUnitNames(text: string, unitLabels: Map<string, string>): string {
  return text.replace(UNIT_TOKEN, (token) => unitLabels.get(token) ?? token);
}

// Only BRICS and EU NATO are blocs a nation can be allied or at odds through; "NEUTRAL" is not one.
const isAlignedBloc = (blocId: string | null | undefined) => blocId === "BRICS" || blocId === "EU_NATO";

function relationOf(
  key: CountryId | "WORLD",
  playerCountryId: CountryId,
  countries: Record<CountryId, CountryDefinition>
): ReportSection["relation"] {
  if (key === "WORLD") return "world";
  if (key === playerCountryId) return "you";
  const playerBlocId = countries[playerCountryId]?.blocId ?? null;
  const otherBlocId = countries[key]?.blocId ?? null;
  if (!isAlignedBloc(playerBlocId) || !isAlignedBloc(otherBlocId)) return "neutral";
  return playerBlocId === otherBlocId ? "ally" : "enemy";
}

function toneForCapture(clean: string, playerCountryId: CountryId, playerBlocId: string | null, countries: Record<CountryId, CountryDefinition>): ReportTone {
  const controllerName = clean.match(CAPTURE_CONTROLLER)?.[1];
  const controller = Object.values(countries).find((country) => country.name === controllerName);
  if (!controller) return "neutral";
  if (controller.id === playerCountryId) return "good";
  if (isAlignedBloc(playerBlocId) && controller.blocId === playerBlocId) return "good";
  return "bad";
}

function toneFor(
  line: ParsedLine,
  playerCountryId: CountryId,
  playerBlocId: string | null,
  countries: Record<CountryId, CountryDefinition>
): ReportTone {
  switch (line.category) {
    case "battle": {
      const outcome = line.clean.match(BATTLE_OUTCOME)?.[1];
      if (!outcome) return "neutral";
      return WON_OUTCOMES.has(outcome) ? "good" : "bad";
    }
    case "capture":
      return toneForCapture(line.clean, playerCountryId, playerBlocId, countries);
    case "strike":
      return "warn";
    case "warning":
      return "bad";
    case "production":
      return "good";
    default:
      return "neutral";
  }
}

function buildRows(
  lines: ParsedLine[],
  playerCountryId: CountryId,
  playerBlocId: string | null,
  countries: Record<CountryId, CountryDefinition>,
  unitLabels: Map<string, string>
): ReportRow[] {
  const rows: ReportRow[] = [];
  const consumed = new Set<number>();
  let movesRowCreated = false;

  for (let index = 0; index < lines.length; index++) {
    if (consumed.has(index)) continue;
    const line = lines[index];

    if (line.category === "supply") {
      const attrition = line.clean.match(SUPPLY_ATTRITION);
      if (attrition) {
        const region = attrition[2];
        const mergedLines: string[] = [];
        let count = 0;
        let sum = 0;
        for (let other = index; other < lines.length; other++) {
          if (consumed.has(other) || lines[other].category !== "supply") continue;
          const match = lines[other].clean.match(SUPPLY_ATTRITION);
          if (!match || match[2] !== region) continue;
          consumed.add(other);
          count += 1;
          sum += Number(match[3]);
          mergedLines.push(lines[other].clean);
        }
        rows.push({
          category: "supply",
          tone: "warn",
          text: `${count} unit${count === 1 ? "" : "s"} lose${count === 1 ? "s" : ""} strength in ${region}: no supply (−${sum})`,
          lines: mergedLines,
        });
        continue;
      }
    }

    if (line.category === "move") {
      if (movesRowCreated) continue;
      const moveLines: string[] = [];
      for (let other = index; other < lines.length; other++) {
        if (consumed.has(other) || lines[other].category !== "move") continue;
        consumed.add(other);
        moveLines.push(lines[other].clean);
      }
      movesRowCreated = true;
      rows.push({
        category: "move",
        tone: "neutral",
        text: `${moveLines.length} unit${moveLines.length === 1 ? "" : "s"} repositioned`,
        lines: moveLines,
        children: moveLines.map((text) => replaceUnitNames(text, unitLabels)),
      });
      continue;
    }

    consumed.add(index);
    rows.push({
      category: line.category,
      tone: toneFor(line, playerCountryId, playerBlocId, countries),
      text: replaceUnitNames(line.clean, unitLabels),
      lines: [line.clean],
    });
  }

  return rows;
}

export function parseTurnReport(data: TurnReportData): TurnReport {
  const countries = data.before.countries;
  const playerBlocId = countries[data.playerCountryId]?.blocId ?? null;
  const countryByName = new Map(Object.values(countries).map((country) => [country.name, country.id]));
  const unitLabels = buildUnitLabels(data.before, data.after);

  let actor: CountryId = data.playerCountryId;
  const parsedLines: ParsedLine[] = [];
  for (const raw of data.events) {
    const marker = raw.match(TURN_MARKER);
    if (marker) {
      const nextActor = countryByName.get(marker[1]);
      if (nextActor) actor = nextActor;
      continue;
    }
    const clean = cleanLine(raw);
    parsedLines.push({
      clean,
      category: categorize(clean),
      actor: WORLD_LINE.test(clean) ? "WORLD" : actor,
    });
  }

  const bySection = new Map<CountryId | "WORLD", ParsedLine[]>();
  for (const line of parsedLines) {
    const list = bySection.get(line.actor);
    if (list) list.push(line);
    else bySection.set(line.actor, [line]);
  }

  const sections: ReportSection[] = [];
  for (const [key, lines] of bySection) {
    sections.push({
      key,
      relation: relationOf(key, data.playerCountryId, countries),
      rows: buildRows(lines, data.playerCountryId, playerBlocId, countries, unitLabels),
    });
  }
  sections.sort((left, right) => RELATION_ORDER[left.relation] - RELATION_ORDER[right.relation]);

  const summary: TurnReportSummary = { battles: 0, captures: 0, moves: 0, warEntries: 0, defeats: 0 };
  for (const line of parsedLines) {
    if (line.category === "battle") summary.battles += 1;
    if (line.category === "capture") summary.captures += 1;
    if (line.category === "move") summary.moves += 1;
    if (line.actor === "WORLD") {
      if (/entered the war on turn/.test(line.clean)) summary.warEntries += 1;
      if (/has been defeated\./.test(line.clean)) summary.defeats += 1;
    }
  }

  return { turn: data.turn, sections, summary };
}
