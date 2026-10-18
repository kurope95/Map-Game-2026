import type { RegionEconomy, CountryStockpile, BlocId, CountryId } from "../state/types";
import { countryDefinitions } from "./countries";
import { regionDefinitions } from "./regions";

// ─────────────────────────────────────────────────────────────────
// Region Economies — one entry per region defined in regions.ts
// Population in thousands, stability 0-100, recruitablePool ≈ 10% pop
// buildingSlots: capitals 6, key cities 4, regular 2-3
// ─────────────────────────────────────────────────────────────────

export const regionEconomies: Record<string, RegionEconomy> = {

  /* ══════════ RUSSIA ══════════ */

  "moscow": {
    population: 12000,
    stability: 100,
    recruitablePool: 1200,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-moscow-barracks", type: "barracks", level: 2, regionId: "moscow", damaged: false },
      { id: "fac-moscow-armor", type: "armorFactory", level: 1, regionId: "moscow", damaged: false },
      { id: "fac-moscow-power", type: "powerPlant", level: 1, regionId: "moscow", damaged: false }
    ]
  },

  "saint-petersburg": {
    population: 5400,
    stability: 100,
    recruitablePool: 540,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-stpetersburg-barracks", type: "barracks", level: 1, regionId: "saint-petersburg", damaged: false }
    ]
  },

  "nizhny-novgorod": {
    population: 1250,
    stability: 100,
    recruitablePool: 125,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "coal", richness: 1 }
    ],
    facilities: [
      { id: "fac-nizhny-civilian", type: "civilianFactory", level: 1, regionId: "nizhny-novgorod", damaged: false }
    ]
  },

  "rostov-on-don": {
    population: 1130,
    stability: 100,
    recruitablePool: 113,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "oil", richness: 2 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-rostov-oilwell", type: "oilWell", level: 1, regionId: "rostov-on-don", damaged: false },
      { id: "fac-rostov-farm", type: "farm", level: 1, regionId: "rostov-on-don", damaged: false }
    ]
  },

  "kazan": {
    population: 1260,
    stability: 100,
    recruitablePool: 126,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "oil", richness: 3 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-kazan-oilwell", type: "oilWell", level: 1, regionId: "kazan", damaged: false },
      { id: "fac-kazan-refinery", type: "refinery", level: 1, regionId: "kazan", damaged: false }
    ]
  },

  "bryansk": {
    population: 400,
    stability: 100,
    recruitablePool: 40,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "tungsten", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-bryansk-mine", type: "mine", level: 1, regionId: "bryansk", damaged: false }
    ]
  },

  "smolensk": {
    population: 330,
    stability: 100,
    recruitablePool: 33,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "voronezh": {
    population: 1050,
    stability: 100,
    recruitablePool: 105,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "coal", richness: 2 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-voronezh-mine", type: "mine", level: 1, regionId: "voronezh", damaged: false },
      { id: "fac-voronezh-farm", type: "farm", level: 1, regionId: "voronezh", damaged: false }
    ]
  },

  "kursk": {
    population: 450,
    stability: 100,
    recruitablePool: 45,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "coal", richness: 2 },
      { type: "iron", richness: 3 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-kursk-mine", type: "mine", level: 1, regionId: "kursk", damaged: false },
      { id: "fac-kursk-smelter", type: "smelter", level: 1, regionId: "kursk", damaged: false }
    ]
  },

  "kaliningrad": {
    population: 490,
    stability: 100,
    recruitablePool: 49,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: [
      { id: "fac-kaliningrad-barracks", type: "barracks", level: 1, regionId: "kaliningrad", damaged: false }
    ]
  },

  "sevastopol": {
    population: 510,
    stability: 100,
    recruitablePool: 51,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: [
      { id: "fac-sevastopol-barracks", type: "barracks", level: 1, regionId: "sevastopol", damaged: false }
    ]
  },

  /* ══════════ BELARUS ══════════ */

  "minsk": {
    population: 2000,
    stability: 100,
    recruitablePool: 200,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 3 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-minsk-barracks", type: "barracks", level: 1, regionId: "minsk", damaged: false },
      { id: "fac-minsk-farm", type: "farm", level: 1, regionId: "minsk", damaged: false }
    ]
  },

  "gomel": {
    population: 530,
    stability: 100,
    recruitablePool: 53,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-gomel-farm", type: "farm", level: 1, regionId: "gomel", damaged: false }
    ]
  },

  "brest": {
    population: 350,
    stability: 100,
    recruitablePool: 35,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "chemicals", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-brest-chemicalplant", type: "chemicalPlant", level: 1, regionId: "brest", damaged: false }
    ]
  },

  /* ══════════ NOVOROSSIA ══════════ */

  "donetsk": {
    population: 930,
    stability: 100,
    recruitablePool: 93,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "coal", richness: 4 },
      { type: "food", richness: 3 }
    ],
    facilities: [
      { id: "fac-donetsk-mine", type: "mine", level: 2, regionId: "donetsk", damaged: false },
      { id: "fac-donetsk-barracks", type: "barracks", level: 1, regionId: "donetsk", damaged: false }
    ]
  },

  "kharkov": {
    population: 1430,
    stability: 100,
    recruitablePool: 143,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "iron", richness: 2 },
      { type: "food", richness: 3 }
    ],
    facilities: [
      { id: "fac-kharkov-mine", type: "mine", level: 1, regionId: "kharkov", damaged: false }
    ]
  },

  "lugansk": {
    population: 420,
    stability: 100,
    recruitablePool: 42,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "coal", richness: 3 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-lugansk-mine", type: "mine", level: 1, regionId: "lugansk", damaged: false }
    ]
  },

  "mariupol": {
    population: 430,
    stability: 100,
    recruitablePool: 43,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "zaporizhzhia": {
    population: 750,
    stability: 100,
    recruitablePool: 75,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "iron", richness: 2 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-zaporizhzhia-mine", type: "mine", level: 1, regionId: "zaporizhzhia", damaged: false }
    ]
  },

  /* ══════════ UKRAINE ══════════ */

  "kyiv": {
    population: 2950,
    stability: 100,
    recruitablePool: 295,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 3 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-kyiv-barracks", type: "barracks", level: 1, regionId: "kyiv", damaged: false },
      { id: "fac-kyiv-farm", type: "farm", level: 1, regionId: "kyiv", damaged: false },
      { id: "fac-kyiv-civilian", type: "civilianFactory", level: 1, regionId: "kyiv", damaged: false },
      { id: "fac-kyiv-power", type: "powerPlant", level: 1, regionId: "kyiv", damaged: false }
    ]
  },

  "lviv": {
    population: 720,
    stability: 100,
    recruitablePool: 72,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-lviv-farm", type: "farm", level: 1, regionId: "lviv", damaged: false }
    ]
  },

  "odesa": {
    population: 1010,
    stability: 100,
    recruitablePool: 101,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 3 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-odesa-farm", type: "farm", level: 1, regionId: "odesa", damaged: false }
    ]
  },

  "dnipro": {
    population: 980,
    stability: 100,
    recruitablePool: 98,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: [
      { id: "fac-dnipro-civilian", type: "civilianFactory", level: 1, regionId: "dnipro", damaged: false }
    ]
  },

  /* ══════════ GERMANY ══════════ */

  "berlin": {
    population: 3700,
    stability: 100,
    recruitablePool: 370,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-berlin-barracks", type: "barracks", level: 1, regionId: "berlin", damaged: false },
      { id: "fac-berlin-civilian", type: "civilianFactory", level: 1, regionId: "berlin", damaged: false },
      { id: "fac-berlin-power", type: "powerPlant", level: 1, regionId: "berlin", damaged: false }
    ]
  },

  "hamburg": {
    population: 1900,
    stability: 100,
    recruitablePool: 190,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "coal", richness: 1 }
    ],
    facilities: [
      { id: "fac-hamburg-civilian", type: "civilianFactory", level: 1, regionId: "hamburg", damaged: false }
    ]
  },

  "munich": {
    population: 1500,
    stability: 100,
    recruitablePool: 150,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "chemicals", richness: 3 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-munich-chemicalplant", type: "chemicalPlant", level: 1, regionId: "munich", damaged: false }
    ]
  },

  "essen": {
    population: 580,
    stability: 100,
    recruitablePool: 58,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "coal", richness: 4 },
      { type: "iron", richness: 3 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-essen-mine", type: "mine", level: 2, regionId: "essen", damaged: false },
      { id: "fac-essen-power", type: "powerPlant", level: 1, regionId: "essen", damaged: false },
      { id: "fac-essen-smelter", type: "smelter", level: 1, regionId: "essen", damaged: false }
    ]
  },

  "hannover": {
    population: 540,
    stability: 100,
    recruitablePool: 54,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "dresden": {
    population: 560,
    stability: 100,
    recruitablePool: 56,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "iron", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-dresden-mine", type: "mine", level: 1, regionId: "dresden", damaged: false }
    ]
  },

  /* ══════════ POLAND ══════════ */

  "warsaw": {
    population: 1800,
    stability: 100,
    recruitablePool: 180,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-warsaw-barracks", type: "barracks", level: 1, regionId: "warsaw", damaged: false },
      { id: "fac-warsaw-farm", type: "farm", level: 1, regionId: "warsaw", damaged: false },
      { id: "fac-warsaw-power", type: "powerPlant", level: 1, regionId: "warsaw", damaged: false }
    ]
  },

  "gdansk": {
    population: 470,
    stability: 100,
    recruitablePool: 47,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "lublin": {
    population: 340,
    stability: 100,
    recruitablePool: 34,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "iron", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-lublin-mine", type: "mine", level: 1, regionId: "lublin", damaged: false }
    ]
  },

  "krakow": {
    population: 780,
    stability: 100,
    recruitablePool: 78,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "coal", richness: 3 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-krakow-mine", type: "mine", level: 1, regionId: "krakow", damaged: false }
    ]
  },

  "poznan": {
    population: 540,
    stability: 100,
    recruitablePool: 54,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-poznan-farm", type: "farm", level: 1, regionId: "poznan", damaged: false }
    ]
  },

  "wroclaw": {
    population: 640,
    stability: 100,
    recruitablePool: 64,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "coal", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-wroclaw-mine", type: "mine", level: 1, regionId: "wroclaw", damaged: false }
    ]
  },

  /* ══════════ ROMANIA ══════════ */

  "bucharest": {
    population: 1800,
    stability: 100,
    recruitablePool: 180,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "oil", richness: 3 },
      { type: "food", richness: 2 }
    ],
    facilities: [
      { id: "fac-bucharest-oilwell", type: "oilWell", level: 1, regionId: "bucharest", damaged: false },
      { id: "fac-bucharest-farm", type: "farm", level: 1, regionId: "bucharest", damaged: false },
      { id: "fac-bucharest-barracks", type: "barracks", level: 1, regionId: "bucharest", damaged: false },
      { id: "fac-bucharest-refinery", type: "refinery", level: 1, regionId: "bucharest", damaged: false }
    ]
  },

  "constanta": {
    population: 310,
    stability: 100,
    recruitablePool: 31,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "cluj-napoca": {
    population: 320,
    stability: 100,
    recruitablePool: 32,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "oil", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-clujnapoca-oilwell", type: "oilWell", level: 1, regionId: "cluj-napoca", damaged: false }
    ]
  },

  /* ══════════ CZECH REPUBLIC ══════════ */

  "prague": {
    population: 1300,
    stability: 100,
    recruitablePool: 130,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-prague-civilian", type: "civilianFactory", level: 1, regionId: "prague", damaged: false }
    ]
  },

  "brno": {
    population: 380,
    stability: 100,
    recruitablePool: 38,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ FINLAND ══════════ */

  "helsinki": {
    population: 650,
    stability: 100,
    recruitablePool: 65,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-helsinki-farm", type: "farm", level: 1, regionId: "helsinki", damaged: false }
    ]
  },

  "turku": {
    population: 190,
    stability: 100,
    recruitablePool: 19,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "tungsten", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-turku-mine", type: "mine", level: 1, regionId: "turku", damaged: false }
    ]
  },

  "tampere": {
    population: 240,
    stability: 100,
    recruitablePool: 24,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ BALTIC FEDERATION ══════════ */

  "riga": {
    population: 630,
    stability: 100,
    recruitablePool: 63,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-riga-farm", type: "farm", level: 1, regionId: "riga", damaged: false }
    ]
  },

  "tallinn": {
    population: 430,
    stability: 100,
    recruitablePool: 43,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "chemicals", richness: 2 },
      { type: "food", richness: 1 }
    ],
    facilities: [
      { id: "fac-tallinn-chemicalplant", type: "chemicalPlant", level: 1, regionId: "tallinn", damaged: false }
    ]
  },

  "vilnius": {
    population: 540,
    stability: 100,
    recruitablePool: 54,
    buildingSlots: 3,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  "kaunas": {
    population: 290,
    stability: 100,
    recruitablePool: 29,
    buildingSlots: 2,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ SLOVAKIA ══════════ */

  "bratislava": {
    population: 430,
    stability: 100,
    recruitablePool: 43,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ HUNGARY ══════════ */

  "budapest": {
    population: 1750,
    stability: 100,
    recruitablePool: 175,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-budapest-civilian", type: "civilianFactory", level: 1, regionId: "budapest", damaged: false }
    ]
  },

  /* ══════════ AUSTRIA ══════════ */

  "vienna": {
    population: 1900,
    stability: 100,
    recruitablePool: 190,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-vienna-civilian", type: "civilianFactory", level: 1, regionId: "vienna", damaged: false }
    ]
  },

  "salzburg": {
    population: 160,
    stability: 100,
    recruitablePool: 16,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ SERBIA ══════════ */

  "belgrade": {
    population: 1400,
    stability: 100,
    recruitablePool: 140,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-belgrade-barracks", type: "barracks", level: 1, regionId: "belgrade", damaged: false }
    ]
  },

  "novi-sad": {
    population: 380,
    stability: 100,
    recruitablePool: 38,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: []
  },

  "nis": {
    population: 260,
    stability: 100,
    recruitablePool: 26,
    buildingSlots: 4,
    resourceDeposits: [
      { type: "coal", richness: 1 },
      { type: "food", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ SWITZERLAND ══════════ */

  "bern": {
    population: 430,
    stability: 100,
    recruitablePool: 43,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-bern-civilian", type: "civilianFactory", level: 1, regionId: "bern", damaged: false }
    ]
  },

  /* ══════════ BOSNIA AND HERZEGOVINA ══════════ */

  "sarajevo": {
    population: 280,
    stability: 100,
    recruitablePool: 28,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "iron", richness: 1 },
      { type: "food", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ MONTENEGRO ══════════ */

  "podgorica": {
    population: 200,
    stability: 100,
    recruitablePool: 20,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ KOSOVO ══════════ */

  "pristina": {
    population: 210,
    stability: 100,
    recruitablePool: 21,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ ALBANIA ══════════ */

  "tirana": {
    population: 420,
    stability: 100,
    recruitablePool: 42,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ NORTH MACEDONIA ══════════ */

  "skopje": {
    population: 310,
    stability: 100,
    recruitablePool: 31,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "iron", richness: 1 },
      { type: "food", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ CROATIA ══════════ */

  "zagreb": {
    population: 680,
    stability: 100,
    recruitablePool: 68,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "iron", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ SLOVENIA ══════════ */

  "ljubljana": {
    population: 290,
    stability: 100,
    recruitablePool: 29,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 1 },
      { type: "coal", richness: 1 }
    ],
    facilities: []
  },

  /* ══════════ MOLDOVA ══════════ */

  "chisinau": {
    population: 670,
    stability: 100,
    recruitablePool: 67,
    buildingSlots: 6,
    resourceDeposits: [
      { type: "food", richness: 2 },
      { type: "iron", richness: 1 }
    ],
    facilities: [
      { id: "fac-chisinau-farm", type: "farm", level: 1, regionId: "chisinau", damaged: false }
    ]
  }
};

for (const region of regionDefinitions) {
  const economy = regionEconomies[region.id];
  if (!economy) continue;

  economy.resourceDeposits = economy.resourceDeposits.map((deposit) => ({
    ...deposit,
    richness: Math.min(5, deposit.richness + 1),
  }));

  economy.buildingSlots += region.isCapital ? 2 : region.isKeyCity ? 1 : 0;
  economy.recruitablePool = Math.ceil(economy.recruitablePool * 1.2);
}

// ─────────────────────────────────────────────────────────────────
// Initial Bloc Stockpiles
// ─────────────────────────────────────────────────────────────────

const baseBlocStockpiles: Record<BlocId, CountryStockpile> = {
  BRICS: {
    oil: 72,
    coal: 60,
    iron: 48,
    tungsten: 16,
    food: 96,
    chemicals: 32,
    steel: 28,
    fuel: 30,
    explosives: 16,
    fertilizer: 18,
    munitions: 24,
    energy: 16,
    textiles: 8,
    electronics: 5,
    vehicles: 0,
    pharmaceuticals: 0,
    luxuryGoods: 0,
    weed: 0,
    tradePoints: 34
  },
  EU_NATO: {
    oil: 48,
    coal: 72,
    iron: 58,
    tungsten: 14,
    food: 82,
    chemicals: 36,
    steel: 32,
    fuel: 24,
    explosives: 14,
    fertilizer: 20,
    munitions: 20,
    energy: 16,
    textiles: 8,
    electronics: 5,
    vehicles: 0,
    pharmaceuticals: 0,
    luxuryGoods: 0,
    weed: 0,
    tradePoints: 36
  },
  NEUTRAL: {
    oil: 0,
    coal: 0,
    iron: 0,
    tungsten: 0,
    food: 0,
    chemicals: 0,
    steel: 0,
    fuel: 0,
    explosives: 0,
    fertilizer: 0,
    munitions: 0,
    energy: 0,
    textiles: 0,
    electronics: 0,
    vehicles: 0,
    pharmaceuticals: 0,
    luxuryGoods: 0,
    weed: 0,
    tradePoints: 0
  }
};

const neutralStarterStockpile: CountryStockpile = {
  oil: 8,
  coal: 8,
  iron: 8,
  tungsten: 2,
  food: 24,
  chemicals: 5,
  steel: 9,
  fuel: 5,
  explosives: 4,
  fertilizer: 5,
  munitions: 5,
  energy: 8,
  textiles: 2,
  electronics: 2,
  vehicles: 0,
  pharmaceuticals: 0,
  luxuryGoods: 0,
  weed: 0,
  tradePoints: 10
};

function cloneStockpile(stockpile: CountryStockpile): CountryStockpile {
  return { ...stockpile };
}

function createEmptyStockpile(): CountryStockpile {
  return {
    oil: 0,
    coal: 0,
    iron: 0,
    tungsten: 0,
    food: 0,
    chemicals: 0,
    steel: 0,
    fuel: 0,
    explosives: 0,
    fertilizer: 0,
    munitions: 0,
    energy: 0,
    textiles: 0,
    electronics: 0,
    vehicles: 0,
    pharmaceuticals: 0,
    luxuryGoods: 0,
    weed: 0,
    tradePoints: 0
  };
}

function getControlledRegionCounts(): Record<CountryId, number> {
  const counts = {} as Record<CountryId, number>;
  for (const country of countryDefinitions) {
    counts[country.id] = 0;
  }
  for (const region of regionDefinitions) {
    counts[region.controllerCountryId] += 1;
  }
  return counts;
}

function splitBlocStockpile(
  blocId: BlocId,
  majorCountryId: CountryId,
  controlledCounts: Record<CountryId, number>
): Record<CountryId, CountryStockpile> {
  const blocCountries = countryDefinitions.filter((country) => country.blocId === blocId);
  const totalRegions = blocCountries.reduce((sum, country) => sum + controlledCounts[country.id], 0);
  const allocated = {} as Record<CountryId, CountryStockpile>;

  for (const country of blocCountries) {
    allocated[country.id] = createEmptyStockpile();
  }

  const keys = Object.keys(baseBlocStockpiles[blocId]) as (keyof CountryStockpile)[];
  for (const key of keys) {
    let assigned = 0;
    for (const country of blocCountries) {
      const regionCount = controlledCounts[country.id];
      const share = totalRegions > 0 ? Math.floor((baseBlocStockpiles[blocId][key] * regionCount) / totalRegions) : 0;
      allocated[country.id][key] = share;
      assigned += share;
    }
    allocated[majorCountryId][key] += baseBlocStockpiles[blocId][key] - assigned;
  }

  return allocated;
}

function buildInitialCountryStockpiles(): Record<CountryId, CountryStockpile> {
  const controlledCounts = getControlledRegionCounts();
  const initial = {} as Record<CountryId, CountryStockpile>;
  const bricsSplit = splitBlocStockpile("BRICS", "RUSSIA", controlledCounts);
  const euSplit = splitBlocStockpile("EU_NATO", "GERMANY", controlledCounts);

  for (const country of countryDefinitions) {
    if (country.blocId === "BRICS") {
      initial[country.id] = cloneStockpile(bricsSplit[country.id] ?? createEmptyStockpile());
      continue;
    }
    if (country.blocId === "EU_NATO") {
      initial[country.id] = cloneStockpile(euSplit[country.id] ?? createEmptyStockpile());
      continue;
    }
    initial[country.id] = cloneStockpile(neutralStarterStockpile);
  }

  return initial;
}

export const initialCountryStockpiles = buildInitialCountryStockpiles();
