import type { BlocId, CountryId } from "../../game/state/types";

export const NATION_COLORS: Record<CountryId, string> = {
  RUSSIA: "#8f2a2a",
  BELARUS: "#b8693a",
  NOVOROSSIA: "#a33a63",
  PRIDNESTROVIE: "#6e2236",
  SLOVAKIA: "#c4914c",
  HUNGARY: "#b04a3c",
  GERMANY: "#4f6d8f",
  POLAND: "#3b6fc0",
  ROMANIA: "#6d93d9",
  CZECH_REPUBLIC: "#7468c4",
  FINLAND: "#8fb3d6",
  BALTIC_FEDERATION: "#5a4fa3",
  UKRAINE: "#2a8c9c",
  AUSTRIA: "#a0895f",
  SERBIA: "#9a7458",
  SWITZERLAND: "#8f7f9a",
  BOSNIA_AND_HERZEGOVINA: "#6f8f4e",
  MONTENEGRO: "#8a5f7a",
  KOSOVO: "#a7a58f",
  ALBANIA: "#6f7f5f",
  NORTH_MACEDONIA: "#c29a5c",
  CROATIA: "#5f8a76",
  SLOVENIA: "#7fa58c",
  MOLDOVA: "#97904f"
};

export const NON_SCENARIO_LAND = "#3a3f45";

export const BLOC_COLORS: Record<BlocId, string> = {
  BRICS: "#b8423f",
  EU_NATO: "#3f72b8",
  NEUTRAL: "#8b8667"
};

export const SHADE_OVERLAYS: readonly [string, null, string, string] = [
  "rgba(255,255,255,0.06)",
  null,
  "rgba(0,0,0,0.07)",
  "rgba(255,255,255,0.03)"
];

export const GEO_NEIGHBORS: ReadonlyArray<readonly [CountryId, CountryId]> = [
  ["RUSSIA", "BELARUS"],
  ["RUSSIA", "UKRAINE"],
  ["RUSSIA", "NOVOROSSIA"],
  ["RUSSIA", "BALTIC_FEDERATION"],
  ["RUSSIA", "FINLAND"],
  ["RUSSIA", "POLAND"],
  ["BELARUS", "POLAND"],
  ["BELARUS", "UKRAINE"],
  ["BELARUS", "BALTIC_FEDERATION"],
  ["NOVOROSSIA", "UKRAINE"],
  ["PRIDNESTROVIE", "MOLDOVA"],
  ["PRIDNESTROVIE", "UKRAINE"],
  ["SLOVAKIA", "POLAND"],
  ["SLOVAKIA", "CZECH_REPUBLIC"],
  ["SLOVAKIA", "AUSTRIA"],
  ["SLOVAKIA", "HUNGARY"],
  ["SLOVAKIA", "UKRAINE"],
  ["HUNGARY", "AUSTRIA"],
  ["HUNGARY", "SLOVENIA"],
  ["HUNGARY", "CROATIA"],
  ["HUNGARY", "SERBIA"],
  ["HUNGARY", "ROMANIA"],
  ["HUNGARY", "UKRAINE"],
  ["GERMANY", "POLAND"],
  ["GERMANY", "CZECH_REPUBLIC"],
  ["GERMANY", "AUSTRIA"],
  ["GERMANY", "SWITZERLAND"],
  ["POLAND", "CZECH_REPUBLIC"],
  ["POLAND", "UKRAINE"],
  ["POLAND", "BALTIC_FEDERATION"],
  ["UKRAINE", "ROMANIA"],
  ["UKRAINE", "MOLDOVA"],
  ["ROMANIA", "MOLDOVA"],
  ["ROMANIA", "SERBIA"],
  ["CZECH_REPUBLIC", "AUSTRIA"],
  ["AUSTRIA", "SWITZERLAND"],
  ["AUSTRIA", "SLOVENIA"],
  ["SLOVENIA", "CROATIA"],
  ["CROATIA", "BOSNIA_AND_HERZEGOVINA"],
  ["CROATIA", "SERBIA"],
  ["CROATIA", "MONTENEGRO"],
  ["BOSNIA_AND_HERZEGOVINA", "SERBIA"],
  ["BOSNIA_AND_HERZEGOVINA", "MONTENEGRO"],
  ["SERBIA", "MONTENEGRO"],
  ["SERBIA", "KOSOVO"],
  ["SERBIA", "NORTH_MACEDONIA"],
  ["MONTENEGRO", "KOSOVO"],
  ["MONTENEGRO", "ALBANIA"],
  ["KOSOVO", "ALBANIA"],
  ["KOSOVO", "NORTH_MACEDONIA"],
  ["ALBANIA", "NORTH_MACEDONIA"],
  ["FINLAND", "BALTIC_FEDERATION"]
];

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

export function rgbDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = parseHex(hexA);
  const [r2, g2, b2] = parseHex(hexB);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
