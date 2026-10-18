import { CountryDefinition } from "../state/types";

export const countryDefinitions: CountryDefinition[] = [
  {
    id: "RUSSIA",
    name: "Russia",
    blocId: "BRICS",
    alignment: "fixed_member",
    tier: "major",
    startsAtWar: true,
    capitalRegionId: "moscow",
    keyRegionIds: ["saint-petersburg", "nizhny-novgorod", "rostov-on-don", "kazan"],
    startingRegionIds: ["moscow", "saint-petersburg", "nizhny-novgorod", "rostov-on-don", "kazan", "bryansk", "voronezh", "smolensk", "kursk", "kaliningrad", "sevastopol"],
    warEntryRules: []
  },
  {
    id: "BELARUS",
    name: "Belarus",
    blocId: "BRICS",
    alignment: "aligned_non_belligerent",
    tier: "middle",
    startsAtWar: false,
    capitalRegionId: "minsk",
    keyRegionIds: ["gomel"],
    startingRegionIds: ["minsk", "gomel", "brest"],
    warEntryRules: [
      {
        id: "belarus-escalation",
        type: "threshold_event",
        description: "Belarus joins BRICS after strategic escalation in the wider war.",
        threshold: {
          kind: "any_of",
          conditions: [
            { metric: "major_power_key_cities_captured", operator: ">=", value: 2 },
            { metric: "major_power_capitals_captured", operator: ">=", value: 1 }
            ,{ metric: "different_major_powers_key_cities_captured", operator: ">=", value: 2 }
          ]
        }
      }
    ]
  },
  {
    id: "NOVOROSSIA",
    name: "Novorossia",
    blocId: "BRICS",
    alignment: "fixed_member",
    tier: "middle",
    startsAtWar: true,
    capitalRegionId: "donetsk",
    keyRegionIds: ["kharkov", "lugansk"],
    startingRegionIds: ["donetsk", "kharkov", "lugansk", "mariupol", "zaporizhzhia"],
    warEntryRules: []
  },
  {
    id: "PRIDNESTROVIE",
    name: "Pridnestrovie",
    blocId: "BRICS",
    alignment: "fixed_member",
    tier: "minor",
    startsAtWar: true,
    capitalRegionId: "chisinau-pridnestrovie",
    keyRegionIds: [],
    startingRegionIds: ["chisinau-pridnestrovie"],
    warEntryRules: []
  },
  {
    id: "SLOVAKIA",
    name: "Slovakia",
    blocId: "BRICS",
    alignment: "aligned_non_belligerent",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "bratislava",
    keyRegionIds: [],
    startingRegionIds: ["bratislava"],
    warEntryRules: [
      {
        id: "slovakia-turn-5",
        type: "scripted_turn",
        description: "Slovakia enters the war on the BRICS side on turn 5.",
        turn: 5
      }
    ]
  },
  {
    id: "HUNGARY",
    name: "Hungary",
    blocId: "BRICS",
    alignment: "aligned_non_belligerent",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "budapest",
    keyRegionIds: [],
    startingRegionIds: ["budapest"],
    warEntryRules: [
      {
        id: "hungary-turn-5",
        type: "scripted_turn",
        description: "Hungary enters the war on the BRICS side on turn 5.",
        turn: 5
      }
    ]
  },
  {
    id: "GERMANY",
    name: "Germany",
    blocId: "EU_NATO",
    alignment: "fixed_member",
    tier: "major",
    startsAtWar: true,
    capitalRegionId: "berlin",
    keyRegionIds: ["hamburg", "munich", "essen"],
    startingRegionIds: ["berlin", "hamburg", "munich", "essen", "hannover", "dresden"],
    warEntryRules: []
  },
  {
    id: "POLAND",
    name: "Poland",
    blocId: "EU_NATO",
    alignment: "fixed_member",
    tier: "major",
    startsAtWar: true,
    capitalRegionId: "warsaw",
    keyRegionIds: ["lublin", "krakow", "gdansk"],
    startingRegionIds: ["warsaw", "lublin", "krakow", "gdansk", "poznan", "wroclaw"],
    warEntryRules: []
  },
  {
    id: "ROMANIA",
    name: "Romania",
    blocId: "EU_NATO",
    alignment: "fixed_member",
    tier: "minor",
    startsAtWar: true,
    capitalRegionId: "bucharest",
    keyRegionIds: [],
    startingRegionIds: ["bucharest", "constanta", "cluj-napoca"],
    warEntryRules: []
  },
  {
    id: "CZECH_REPUBLIC",
    name: "Czech Republic",
    blocId: "EU_NATO",
    alignment: "aligned_non_belligerent",
    tier: "middle",
    startsAtWar: false,
    capitalRegionId: "prague",
    keyRegionIds: ["brno"],
    startingRegionIds: ["prague", "brno"],
    warEntryRules: [
      {
        id: "czech-polish-trigger",
        type: "threshold_event",
        description: "The Czech Republic joins EU NATO if Poland loses its capital or two key cities.",
        threshold: {
          kind: "any_of",
          conditions: [
            { metric: "country_key_cities_lost", operator: ">=", value: 2, countryId: "POLAND" },
            { metric: "country_capitals_lost", operator: ">=", value: 1, countryId: "POLAND" }
          ]
        }
      }
    ]
  },
  {
    id: "FINLAND",
    name: "Finland",
    blocId: "EU_NATO",
    alignment: "aligned_non_belligerent",
    tier: "middle",
    startsAtWar: false,
    capitalRegionId: "helsinki",
    keyRegionIds: ["turku"],
    startingRegionIds: ["helsinki", "turku", "tampere"],
    warEntryRules: [
      {
        id: "finland-baltics-collapse",
        type: "threshold_event",
        description: "Finland enters the war once the Baltic Federation has been completely overrun.",
        threshold: {
          kind: "any_of",
          conditions: [
            { metric: "country_defeated", operator: ">=", value: 1, countryId: "BALTIC_FEDERATION" }
          ]
        }
      }
    ]
  },
  {
    id: "BALTIC_FEDERATION",
    name: "Baltic Federation",
    blocId: "EU_NATO",
    alignment: "fixed_member",
    tier: "minor",
    startsAtWar: true,
    capitalRegionId: "riga",
    keyRegionIds: [],
    startingRegionIds: ["riga", "tallinn", "vilnius", "kaunas"],
    warEntryRules: []
  },
  {
    id: "UKRAINE",
    name: "Ukraine",
    blocId: "EU_NATO",
    alignment: "fixed_member",
    tier: "middle",
    startsAtWar: true,
    capitalRegionId: "kyiv",
    keyRegionIds: ["lviv", "odesa"],
    startingRegionIds: ["kyiv", "lviv", "odesa", "dnipro"],
    warEntryRules: []
  },
  {
    id: "AUSTRIA",
    name: "Austria",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "middle",
    startsAtWar: false,
    capitalRegionId: "vienna",
    keyRegionIds: ["salzburg"],
    startingRegionIds: ["vienna", "salzburg"],
    warEntryRules: []
  },
  {
    id: "SERBIA",
    name: "Serbia",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "middle",
    startsAtWar: false,
    capitalRegionId: "belgrade",
    keyRegionIds: ["novi-sad", "nis"],
    startingRegionIds: ["belgrade", "novi-sad", "nis"],
    warEntryRules: []
  },
  {
    id: "SWITZERLAND",
    name: "Switzerland",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "bern",
    keyRegionIds: [],
    startingRegionIds: ["bern"],
    warEntryRules: []
  },
  {
    id: "BOSNIA_AND_HERZEGOVINA",
    name: "Bosnia and Herzegovina",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "sarajevo",
    keyRegionIds: [],
    startingRegionIds: ["sarajevo"],
    warEntryRules: []
  },
  {
    id: "MONTENEGRO",
    name: "Montenegro",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "podgorica",
    keyRegionIds: [],
    startingRegionIds: ["podgorica"],
    warEntryRules: []
  },
  {
    id: "KOSOVO",
    name: "Kosovo",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "pristina",
    keyRegionIds: [],
    startingRegionIds: ["pristina"],
    warEntryRules: []
  },
  {
    id: "ALBANIA",
    name: "Albania",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "tirana",
    keyRegionIds: [],
    startingRegionIds: ["tirana"],
    warEntryRules: []
  },
  {
    id: "NORTH_MACEDONIA",
    name: "North Macedonia",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "skopje",
    keyRegionIds: [],
    startingRegionIds: ["skopje"],
    warEntryRules: []
  },
  {
    id: "CROATIA",
    name: "Croatia",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "zagreb",
    keyRegionIds: [],
    startingRegionIds: ["zagreb"],
    warEntryRules: []
  },
  {
    id: "SLOVENIA",
    name: "Slovenia",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "ljubljana",
    keyRegionIds: [],
    startingRegionIds: ["ljubljana"],
    warEntryRules: []
  },
  {
    id: "MOLDOVA",
    name: "Moldova",
    blocId: "NEUTRAL",
    alignment: "neutral",
    tier: "minor",
    startsAtWar: false,
    capitalRegionId: "chisinau",
    keyRegionIds: [],
    startingRegionIds: ["chisinau"],
    warEntryRules: []
  }
];
