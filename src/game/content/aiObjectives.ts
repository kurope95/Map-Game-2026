import type { CountryId } from "../state/types";

export const AI_STRATEGY_WEIGHTS = {
  homelandCohesion: 0.3,
  nationalGoals: 0.3,
  keyNodeSecurity: 0.2,
  randomness: 0.2,
} as const;

export interface AiCountryProfile {
  allyDefenseGoals?: string[];
  primaryObjectiveBonus?: number;
  primaryObjectiveAttackCap?: number;
  attackReserveFlex?: number;
  infantryTargetBonus?: number;
  armorTargetBonus?: number;
}

export const AI_NATIONAL_GOALS: Record<CountryId, string[]> = {
  RUSSIA: ["kyiv", "odesa", "lviv", "dnipro", "gomel", "minsk", "brest", "vilnius", "kaunas", "riga", "tallinn", "warsaw", "lublin", "poznan", "berlin"],
  BELARUS: ["warsaw", "lublin", "krakow", "gdansk", "poznan", "wroclaw"],
  NOVOROSSIA: ["kyiv", "lviv", "odesa", "dnipro"],
  PRIDNESTROVIE: ["odesa", "bucharest", "constanta", "cluj-napoca"],
  SLOVAKIA: ["krakow-silesian-gate", "krakow", "brno"],
  HUNGARY: ["bucharest", "constanta", "cluj-napoca", "bucharest-wallachia", "cluj-napoca-transylvania"],
  GERMANY: ["bratislava", "budapest", "brno", "krakow-silesian-gate", "budapest-great-plain"],
  POLAND: ["bratislava-eastern-slovakia", "kaliningrad", "minsk", "brest", "gomel"],
  ROMANIA: ["budapest", "budapest-great-plain"],
  CZECH_REPUBLIC: ["bratislava", "wroclaw", "dresden"],
  FINLAND: ["saint-petersburg"],
  BALTIC_FEDERATION: ["saint-petersburg"],
  UKRAINE: ["bratislava-eastern-slovakia", "donetsk", "kharkov", "lugansk", "mariupol", "zaporizhzhia", "kursk"],
  AUSTRIA: ["bratislava", "munich", "ljubljana"],
  SERBIA: ["sarajevo", "zagreb", "podgorica", "pristina"],
  SWITZERLAND: ["munich", "salzburg"],
  BOSNIA_AND_HERZEGOVINA: ["belgrade", "zagreb"],
  MONTENEGRO: ["sarajevo", "pristina", "tirana"],
  KOSOVO: ["skopje", "nis", "podgorica"],
  ALBANIA: ["pristina", "skopje", "podgorica"],
  NORTH_MACEDONIA: ["pristina", "nis", "tirana"],
  CROATIA: ["sarajevo", "ljubljana", "belgrade"],
  SLOVENIA: ["zagreb", "vienna", "salzburg"],
  MOLDOVA: ["chisinau-pridnestrovie", "odesa", "bucharest"],
};

export const AI_COUNTRY_PROFILES: Partial<Record<CountryId, AiCountryProfile>> = {
  RUSSIA: {
    allyDefenseGoals: ["gomel", "minsk", "brest"],
    primaryObjectiveBonus: 80,
    primaryObjectiveAttackCap: 5,
    attackReserveFlex: 1,
    infantryTargetBonus: 2,
    armorTargetBonus: 1,
  },
  NOVOROSSIA: {
    primaryObjectiveBonus: 55,
    primaryObjectiveAttackCap: 4,
    infantryTargetBonus: 1,
  },
};
