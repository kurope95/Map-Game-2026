import { modern2026Scenario } from "../content/scenario";
import { regionEconomies, initialCountryStockpiles } from "../content/economy";
import { FORTIFICATION_MAX_HEALTH_BY_LEVEL } from "../content/economyRecipes";
import { theaterMapLayout } from "../content/regionGeo";
import { createInitialDiplomacyState } from "../rules/diplomacy";
import {
  BlocDefinition,
  BlocId,
  CountryDiplomacyState,
  CountryDefinition,
  CountryStockpile,
  CountryId,
  CountryState,
  DoctrineUpgradeId,
  EconomyBuildOrder,
  GameState,
  Order,
  ProductionQueueItem,
  RegionDefinition,
  ScenarioDefinition,
  UnitDefinition
} from "./types";

const REGION_SUFFIXES = [
  { key: "north", label: "North", lon: 0, lat: 0.65 },
  { key: "east", label: "East", lon: 0.75, lat: 0.1 },
  { key: "south", label: "South", lon: 0, lat: -0.65 },
  { key: "west", label: "West", lon: -0.75, lat: 0.1 },
  { key: "central", label: "Central", lon: 0.4, lat: 0.4 },
];

const FALLBACK_CITY_NAMES: Partial<Record<string, string[]>> = {
  bryansk: ["Klintsy"],
  smolensk: ["Vyazma"],
  kursk: ["Belgorod"],
  brest: ["Pinsk"],
  sevastopol: ["Yalta"],
  constanta: ["Mangalia"],
  brno: ["Ostrava"],
  helsinki: ["Lahti", "Porvoo"],
  turku: ["Pori"],
  tampere: ["Jyvaskyla"],
  riga: ["Daugavpils"],
  tallinn: ["Narva"],
  vilnius: ["Panevezys"],
  kaunas: ["Siauliai"],
  salzburg: ["Innsbruck"],
  belgrade: ["Kragujevac"],
  "novi-sad": ["Subotica"],
  nis: ["Leskovac"],
  bern: ["Zurich"],
  sarajevo: ["Banja Luka"],
  podgorica: ["Bar"],
  pristina: ["Prizren"],
  tirana: ["Durres"],
  skopje: ["Bitola"],
  chisinau: ["Tiraspol"],
};

const MANUAL_SPLIT_PLANS: Partial<Record<string, Array<{
  key: string;
  label: string;
  name?: string;
  lon: number;
  lat: number;
  mapLon?: number;
  mapLat?: number;
  terrain?: RegionDefinition["terrain"];
  pointsFactor?: number;
  populationFactor?: number;
  industryFactor?: number;
  linkIds?: string[];
}>>> = {
  moscow: [
    { key: "oblast", label: "Oblast", name: "Balashikha", lon: 0.8, lat: 0.6, terrain: "urban", pointsFactor: 0.6, populationFactor: 0.62, industryFactor: 0.6, linkIds: ["bryansk", "nizhny-novgorod"] },
    { key: "southern-arc", label: "Southern Arc", name: "Podolsk", lon: 0.35, lat: -0.85, terrain: "urban", pointsFactor: 0.56, populationFactor: 0.58, industryFactor: 0.56, linkIds: ["bryansk", "smolensk"] },
  ],
  "saint-petersburg": [
    { key: "neva-corridor", label: "Neva Corridor", name: "Gatchina", lon: 0.7, lat: -0.8, terrain: "coastal", pointsFactor: 0.58, linkIds: ["tallinn", "moscow"] },
    { key: "gulf-shore", label: "Gulf Shore", name: "Kronstadt", lon: -0.75, lat: -0.25, terrain: "coastal", pointsFactor: 0.54, linkIds: ["tallinn", "helsinki"] },
  ],
  "rostov-on-don": [
    { key: "lower-don", label: "Lower Don", name: "Taganrog", lon: 0.95, lat: -0.55, terrain: "industrial", pointsFactor: 0.6, linkIds: ["lugansk", "donetsk"] },
    { key: "steppe-hinterland", label: "Steppe Hinterland", name: "Shakhty", lon: 0.65, lat: 0.55, terrain: "industrial", pointsFactor: 0.56, linkIds: ["voronezh", "lugansk"] },
  ],
  kazan: [
    { key: "volga-bend", label: "Volga Bend", name: "Zelenodolsk", lon: -0.8, lat: -0.45, terrain: "industrial", pointsFactor: 0.56, linkIds: ["nizhny-novgorod", "moscow"] },
  ],
  "nizhny-novgorod": [
    { key: "oka-district", label: "Oka District", name: "Dzerzhinsk", lon: -0.75, lat: 0.45, terrain: "industrial", pointsFactor: 0.54, linkIds: ["moscow", "kazan"] },
  ],
  kaliningrad: [
    { key: "coast", label: "Coast", name: "Baltiysk", lon: 0.75, lat: -0.55, terrain: "coastal", pointsFactor: 0.56, linkIds: ["gdansk"] },
  ],
  berlin: [
    { key: "brandenburg-belt", label: "Brandenburg Belt", name: "Potsdam", lon: 0.95, lat: -0.15, terrain: "urban", pointsFactor: 0.58, linkIds: ["poznan", "dresden"] },
    { key: "capital-ring", label: "Capital Ring", name: "Oranienburg", lon: -0.65, lat: 0.45, terrain: "urban", pointsFactor: 0.56, linkIds: ["hamburg", "essen"] },
  ],
  essen: [
    { key: "ruhr-corridor", label: "Ruhr Corridor", name: "Dortmund", lon: -0.8, lat: -0.35, terrain: "industrial", pointsFactor: 0.6, linkIds: ["hannover", "munich"] },
    { key: "rhein-belt", label: "Rhine Belt", name: "Duisburg", lon: -0.35, lat: 0.7, terrain: "industrial", pointsFactor: 0.56, linkIds: ["hannover", "berlin"] },
  ],
  munich: [
    { key: "swabia", label: "Swabia", name: "Stuttgart", lon: -1.35, lat: 0.05, terrain: "urban", pointsFactor: 0.56, linkIds: ["essen", "dresden"] },
    { key: "upper-bavaria", label: "Upper Bavaria", name: "Augsburg", lon: 0.85, lat: 0.25, terrain: "urban", pointsFactor: 0.53, linkIds: ["dresden", "salzburg"] },
  ],
  warsaw: [
    { key: "masovia", label: "Masovia", name: "Radom", lon: 0.85, lat: -0.25, terrain: "urban", pointsFactor: 0.58, linkIds: ["lublin", "poznan"] },
    { key: "vistula-ring", label: "Vistula Ring", name: "Plock", lon: -0.65, lat: 0.4, terrain: "urban", pointsFactor: 0.56, linkIds: ["gdansk", "wroclaw"] },
  ],
  gdansk: [
    { key: "pomerania", label: "Pomerania", name: "Gdynia", lon: -0.65, lat: 0.3, terrain: "coastal", pointsFactor: 0.56, linkIds: ["poznan", "kaliningrad"] },
    { key: "shipyard-coast", label: "Shipyard Coast", name: "Sopot", lon: 0.65, lat: -0.2, terrain: "coastal", pointsFactor: 0.53, linkIds: ["warsaw", "poznan"] },
  ],
  krakow: [
    { key: "silesian-gate", label: "Silesian Gate", name: "Katowice", lon: -0.85, lat: 0.1, terrain: "urban", pointsFactor: 0.56, linkIds: ["wroclaw", "prague"] },
    { key: "lesser-poland", label: "Lesser Poland", name: "Tarnow", lon: 0.65, lat: -0.25, terrain: "urban", pointsFactor: 0.53, linkIds: ["lublin", "wroclaw"] },
  ],
  kyiv: [
    { key: "left-bank", label: "Left Bank", name: "Brovary", lon: 0.95, lat: 0.1, terrain: "urban", pointsFactor: 0.58, linkIds: ["kharkov", "dnipro"] },
    { key: "right-bank", label: "Right Bank", name: "Bila Tserkva", lon: -0.8, lat: 0.2, terrain: "urban", pointsFactor: 0.56, linkIds: ["lviv", "odesa"] },
  ],
  odesa: [
    { key: "black-sea-port", label: "Black Sea Port", name: "Chornomorsk", lon: -0.7, lat: -0.2, mapLon: 30.66, mapLat: 46.31, terrain: "coastal", pointsFactor: 0.58, linkIds: ["constanta", "chisinau"] },
    { key: "steppe-coast", label: "Steppe Coast", name: "Mykolaiv", lon: 0.75, lat: 0.2, terrain: "coastal", pointsFactor: 0.54, linkIds: ["dnipro", "zaporizhzhia"] },
  ],
  donetsk: [
    { key: "central-basin", label: "Central Basin", name: "Horlivka", lon: -0.7, lat: -0.1, terrain: "industrial", pointsFactor: 0.58, linkIds: ["mariupol", "zaporizhzhia"] },
    { key: "makiivka-line", label: "Makiivka Line", name: "Makiivka", lon: 0.85, lat: 0.2, terrain: "industrial", pointsFactor: 0.56, linkIds: ["lugansk", "kharkov"] },
  ],
  kharkov: [
    { key: "outer-belt", label: "Outer Belt", name: "Chuhuiv", lon: 1.15, lat: 0.05, mapLon: 36.68, mapLat: 49.84, terrain: "urban", pointsFactor: 0.56, linkIds: ["kursk", "dnipro"] },
    { key: "northern-arc", label: "Northern Arc", name: "Derhachi", lon: 0.25, lat: 0.95, terrain: "urban", pointsFactor: 0.54, linkIds: ["voronezh", "kyiv"] },
  ],
  lugansk: [
    { key: "salient", label: "Salient", name: "Alchevsk", lon: 0.8, lat: -0.25, terrain: "industrial", pointsFactor: 0.56, linkIds: ["rostov-on-don", "donetsk"] },
    { key: "border-belt", label: "Border Belt", name: "Dovzhansk", lon: 0.65, lat: 0.45, terrain: "industrial", pointsFactor: 0.54, linkIds: ["kharkov", "rostov-on-don"] },
  ],
  mariupol: [
    { key: "azov-coast", label: "Azov Coast", name: "Berdiansk", lon: -0.35, lat: 0.75, terrain: "coastal", pointsFactor: 0.54, linkIds: ["zaporizhzhia", "donetsk"] },
    { key: "port-district", label: "Port District", name: "Primorsk", lon: 0.65, lat: -0.25, terrain: "coastal", pointsFactor: 0.52, linkIds: ["donetsk", "zaporizhzhia"] },
  ],
  zaporizhzhia: [
    { key: "tokmak-line", label: "Tokmak Line", name: "Tokmak", lon: 0.35, lat: -0.45, terrain: "industrial", pointsFactor: 0.54, linkIds: ["mariupol", "dnipro"] },
    { key: "lower-dnieper", label: "Lower Dnieper", name: "Melitopol", lon: 0.75, lat: -0.7, terrain: "industrial", pointsFactor: 0.53, linkIds: ["mariupol", "sevastopol"] },
  ],
  dnipro: [
    { key: "river-bend", label: "River Bend", name: "Kamianske", lon: 0.8, lat: -0.25, terrain: "industrial", pointsFactor: 0.56, linkIds: ["kharkov", "zaporizhzhia"] },
    { key: "factory-bank", label: "Factory Bank", name: "Pavlohrad", lon: -0.65, lat: 0.4, terrain: "industrial", pointsFactor: 0.54, linkIds: ["kyiv", "odesa"] },
  ],
  lviv: [
    { key: "galicia", label: "Galicia", name: "Drohobych", lon: -0.8, lat: 0.25, terrain: "urban", pointsFactor: 0.56, linkIds: ["lublin", "kyiv"] },
    { key: "carpathian-gate", label: "Carpathian Gate", name: "Stryi", lon: -0.35, lat: -0.7, terrain: "urban", pointsFactor: 0.53, linkIds: ["lublin", "krakow"] },
  ],
  dresden: [
    { key: "saxon-corridor", label: "Saxon Corridor", name: "Chemnitz", lon: 0.75, lat: -0.35, terrain: "urban", pointsFactor: 0.54, linkIds: ["wroclaw", "prague"] },
    { key: "elbe-bend", label: "Elbe Bend", name: "Meissen", lon: -0.45, lat: 0.55, terrain: "urban", pointsFactor: 0.52, linkIds: ["berlin", "munich"] },
  ],
  hannover: [
    { key: "lower-saxony", label: "Lower Saxony", name: "Braunschweig", lon: -0.65, lat: 0.35, terrain: "plains", pointsFactor: 0.52, linkIds: ["hamburg", "essen"] },
    { key: "midland", label: "Midland", name: "Hildesheim", lon: 0.65, lat: 0.1, terrain: "plains", pointsFactor: 0.5, linkIds: ["berlin", "essen"] },
  ],
  poznan: [
    { key: "greater-poland", label: "Greater Poland", name: "Konin", lon: -0.65, lat: 0.2, terrain: "plains", pointsFactor: 0.54, linkIds: ["berlin", "wroclaw"] },
    { key: "western-approach", label: "Western Approach", name: "Leszno", lon: 0.65, lat: -0.2, terrain: "plains", pointsFactor: 0.52, linkIds: ["warsaw", "gdansk"] },
  ],
  wroclaw: [
    { key: "lower-silesia", label: "Lower Silesia", name: "Legnica", lon: -0.65, lat: -0.25, terrain: "urban", pointsFactor: 0.54, linkIds: ["krakow", "dresden"] },
    { key: "odra-line", label: "Odra Line", name: "Opole", lon: 0.65, lat: 0.2, terrain: "urban", pointsFactor: 0.52, linkIds: ["poznan", "berlin"] },
  ],
  bucharest: [
    { key: "wallachia", label: "Wallachia", name: "Ploiesti", lon: -0.65, lat: -0.2, terrain: "urban", pointsFactor: 0.56, linkIds: ["constanta", "cluj-napoca"] },
  ],
  "cluj-napoca": [
    { key: "transylvania", label: "Transylvania", name: "Targu Mures", lon: -0.8, lat: 0.35, terrain: "urban", pointsFactor: 0.56, linkIds: ["bucharest", "chisinau"] },
  ],
  minsk: [
    { key: "central-belt", label: "Central Belt", name: "Barysaw", lon: 0.85, lat: -0.25, terrain: "urban", pointsFactor: 0.56, linkIds: ["gomel", "warsaw"] },
    { key: "western-gate", label: "Western Gate", name: "Molodechno", lon: -0.8, lat: 0.25, terrain: "urban", pointsFactor: 0.53, linkIds: ["brest", "warsaw"] },
  ],
  gomel: [
    { key: "southern-approach", label: "Southern Approach", name: "Rechytsa", lon: 1.05, lat: -0.05, mapLon: 30.39, mapLat: 52.36, terrain: "forest", pointsFactor: 0.54, linkIds: ["kyiv", "bryansk"] },
    { key: "pripyat-belt", label: "Pripyat Belt", name: "Mazyr", lon: -0.75, lat: -0.55, terrain: "forest", pointsFactor: 0.52, linkIds: ["minsk", "kyiv"] },
  ],
  voronezh: [
    { key: "don-steppe", label: "Don Steppe", name: "Rossosh", lon: 0.9, lat: -0.2, terrain: "plains", pointsFactor: 0.54, linkIds: ["kharkov", "rostov-on-don"] },
  ],
  hamburg: [
    { key: "elbe-approach", label: "Elbe Approach", name: "Luneburg", lon: -0.8, lat: -0.2, terrain: "coastal", pointsFactor: 0.54, linkIds: ["hannover", "berlin"] },
  ],
  lublin: [
    { key: "bug-line", label: "Bug Line", name: "Chelm", lon: 0.8, lat: -0.1, terrain: "plains", pointsFactor: 0.54, linkIds: ["lviv", "warsaw"] },
  ],
  bratislava: [
    { key: "eastern-slovakia", label: "Eastern Slovakia", name: "Kosice", lon: 2.35, lat: 0.05, mapLon: 21.26, mapLat: 48.72, terrain: "urban", pointsFactor: 0.54, linkIds: ["budapest", "krakow", "lviv"] },
  ],
  budapest: [
    { key: "great-plain", label: "Great Plain", name: "Debrecen", lon: 1.4, lat: -0.15, terrain: "urban", pointsFactor: 0.54, linkIds: ["cluj-napoca", "novi-sad"] },
  ],
  vienna: [
    { key: "upper-austria", label: "Upper Austria", name: "Linz", lon: -1.45, lat: 0.05, terrain: "urban", pointsFactor: 0.54, linkIds: ["salzburg", "brno"] },
  ],
  prague: [
    { key: "moravian-gate", label: "Moravian Gate", name: "Ostrava", lon: 1.95, lat: 0.15, mapLon: 18.29, mapLat: 49.82, terrain: "urban", pointsFactor: 0.54, linkIds: ["krakow", "brno"] },
  ],
  ljubljana: [
    { key: "drava-belt", label: "Drava Belt", name: "Maribor", lon: 0.85, lat: 0.85, mapLon: 15.65, mapLat: 46.56, terrain: "urban", pointsFactor: 0.52, linkIds: ["zagreb", "vienna"] },
  ],
  zagreb: [
    { key: "adriatic-coast", label: "Adriatic Coast", name: "Rijeka", lon: -1.15, lat: -0.25, terrain: "coastal", pointsFactor: 0.52, linkIds: ["ljubljana", "sarajevo"] },
  ],
  chisinau: [
    { key: "pridnestrovie", label: "Pridnestrovie", name: "Tiraspol", lon: 0.95, lat: -0.05, mapLon: 29.63, mapLat: 46.84, terrain: "plains", pointsFactor: 0.5, linkIds: ["odesa", "chisinau"] },
  ],
  belgrade: [
    { key: "morava-belt", label: "Morava Belt", name: "Kragujevac", lon: 0.35, lat: -0.85, terrain: "urban", pointsFactor: 0.5, linkIds: ["nis", "novi-sad"] },
  ],
  "novi-sad": [
    { key: "vojvodina", label: "Vojvodina", name: "Subotica", lon: 0.1, lat: 0.9, terrain: "plains", pointsFactor: 0.48, linkIds: ["belgrade", "budapest"] },
  ],
  bern: [
    { key: "zurich-basin", label: "Zurich Basin", name: "Zurich", lon: 1.05, lat: 0.15, terrain: "urban", pointsFactor: 0.52, linkIds: ["salzburg", "munich"] },
  ],
  sarajevo: [
    { key: "northern-bosnia", label: "Northern Bosnia", name: "Banja Luka", lon: -0.5, lat: 0.8, terrain: "urban", pointsFactor: 0.48, linkIds: ["zagreb", "belgrade"] },
  ],
  podgorica: [
    { key: "adriatic-gate", label: "Adriatic Gate", name: "Bar", lon: -0.15, lat: -0.9, terrain: "coastal", pointsFactor: 0.46, linkIds: ["sarajevo", "tirana"] },
  ],
  pristina: [
    { key: "dukagjin", label: "Dukagjin", name: "Prizren", lon: -0.45, lat: -0.55, terrain: "urban", pointsFactor: 0.46, linkIds: ["tirana", "skopje"] },
  ],
  tirana: [
    { key: "durres-coast", label: "Durres Coast", name: "Durres", lon: -0.45, lat: 0.25, terrain: "coastal", pointsFactor: 0.46, linkIds: ["podgorica", "skopje"] },
  ],
  skopje: [
    { key: "pelagonia", label: "Pelagonia", name: "Bitola", lon: -0.2, lat: -0.85, terrain: "urban", pointsFactor: 0.46, linkIds: ["pristina", "tirana"] },
  ],
};

const COUNTRY_MANUAL_SOURCE_ORDER: Partial<Record<CountryId, string[]>> = {
  RUSSIA: ["moscow", "saint-petersburg", "rostov-on-don", "voronezh", "nizhny-novgorod", "kazan", "kaliningrad"],
  BELARUS: ["minsk", "gomel", "brest"],
  NOVOROSSIA: ["donetsk", "kharkov", "zaporizhzhia", "lugansk", "mariupol"],
  SLOVAKIA: ["bratislava"],
  HUNGARY: ["budapest"],
  GERMANY: ["berlin", "munich", "essen", "dresden", "hannover", "hamburg"],
  POLAND: ["warsaw", "poznan", "krakow", "gdansk", "wroclaw", "lublin"],
  CZECH_REPUBLIC: ["prague", "brno"],
  UKRAINE: ["kyiv", "odesa", "dnipro", "lviv"],
  ROMANIA: ["bucharest", "cluj-napoca"],
  AUSTRIA: ["vienna", "salzburg"],
  SERBIA: ["belgrade", "novi-sad", "nis"],
  SWITZERLAND: ["bern"],
  BOSNIA_AND_HERZEGOVINA: ["sarajevo"],
  MONTENEGRO: ["podgorica"],
  KOSOVO: ["pristina"],
  ALBANIA: ["tirana"],
  NORTH_MACEDONIA: ["skopje"],
  CROATIA: ["zagreb"],
  SLOVENIA: ["ljubljana"],
  MOLDOVA: ["chisinau"],
};

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
}

function buildBlocQueues(initialQueues: ProductionQueueItem[]): Record<BlocId, ProductionQueueItem[]> {
  return {
    BRICS: initialQueues.filter((queue) => queue.blocId === "BRICS"),
    EU_NATO: initialQueues.filter((queue) => queue.blocId === "EU_NATO"),
    NEUTRAL: initialQueues.filter((queue) => queue.blocId === "NEUTRAL")
  };
}

function buildCountryRecord<T>(countries: CountryDefinition[], factory: () => T): Record<CountryId, T> {
  return countries.reduce<Record<string, T>>((accumulator, country) => {
    accumulator[country.id] = factory();
    return accumulator;
  }, {}) as Record<CountryId, T>;
}

function buildCountryStates(countries: CountryDefinition[]): Record<CountryId, CountryState> {
  return countries.reduce<Record<string, CountryState>>((accumulator, country) => {
    accumulator[country.id] = {
      countryId: country.id,
      atWar: country.startsAtWar,
      activatedOnTurn: country.startsAtWar ? 1 : undefined
    };
    return accumulator;
  }, {}) as Record<CountryId, CountryState>;
}

function buildDiplomacyStates(countries: CountryDefinition[]): Record<CountryId, CountryDiplomacyState> {
  return countries.reduce<Record<string, CountryDiplomacyState>>((accumulator, country) => {
    accumulator[country.id] = createInitialDiplomacyState(country);
    return accumulator;
  }, {}) as Record<CountryId, CountryDiplomacyState>;
}

function cloneRegionEconomies() {
  return Object.fromEntries(
    Object.entries(regionEconomies).map(([regionId, economy]) => [
      regionId,
      {
        ...economy,
        facilities: economy.facilities.map((facility) => ({ ...facility })),
        fortification: economy.fortification ? { ...economy.fortification } : undefined,
        resourceDeposits: economy.resourceDeposits.map((deposit) => ({ ...deposit })),
      },
    ])
  );
}

function cloneScenarioDefinition(scenario: ScenarioDefinition): ScenarioDefinition {
  return {
    ...scenario,
    blocResources: {
      BRICS: { ...scenario.blocResources.BRICS },
      EU_NATO: { ...scenario.blocResources.EU_NATO },
      NEUTRAL: { ...scenario.blocResources.NEUTRAL },
    },
    countries: scenario.countries.map((country) => ({
      ...country,
      keyRegionIds: [...country.keyRegionIds],
      startingRegionIds: [...country.startingRegionIds],
      warEntryRules: country.warEntryRules.map((rule) => ({ ...rule })),
    })),
    regions: scenario.regions.map((region) => ({
      ...region,
      controllerBlocId: region.controllerBlocId ?? scenario.countries.find(c => c.id === region.controllerCountryId)?.blocId,
      adjacentRegionIds: [...region.adjacentRegionIds],
      infrastructure: region.infrastructure.map((item) => ({ ...item })),
    })),
    startingUnits: scenario.startingUnits.map((unit) => ({ ...unit })),
    initialQueues: scenario.initialQueues.map((queue) => ({ ...queue })),
  };
}

function expandScenarioRegions(
  scenario: ScenarioDefinition,
  economies: ReturnType<typeof cloneRegionEconomies>
) {
  const regionsById = indexById(scenario.regions) as Record<string, RegionDefinition>;

  for (const country of scenario.countries) {
    const countryRegions = scenario.regions.filter((region) => region.homeCountryId === country.id);
    if (countryRegions.length === 0) {
      continue;
    }
    const additionalCount = Math.max(1, Math.ceil(countryRegions.length * 0.5));
    const preferredOrder = COUNTRY_MANUAL_SOURCE_ORDER[country.id] ?? [];
    const sourceRegions = [...countryRegions].sort((left, right) => {
      const leftPreferred = preferredOrder.indexOf(left.id);
      const rightPreferred = preferredOrder.indexOf(right.id);
      if (leftPreferred !== -1 || rightPreferred !== -1) {
        if (leftPreferred === -1) return 1;
        if (rightPreferred === -1) return -1;
        return leftPreferred - rightPreferred;
      }
      return right.points - left.points;
    });
    const sourceUsage = new Map<string, number>();

    for (let index = 0; index < additionalCount; index++) {
      const source = sourceRegions[index % sourceRegions.length];
      const sourceManualIndex = sourceUsage.get(source.id) ?? 0;
      const manualVariant = MANUAL_SPLIT_PLANS[source.id]?.[sourceManualIndex];
      const suffix = manualVariant ?? REGION_SUFFIXES[index % REGION_SUFFIXES.length];
      const depth = Math.floor(index / REGION_SUFFIXES.length);
      const generatedId = `${source.id}-${suffix.key}${depth > 0 ? `-${depth + 1}` : ""}`;
      if (regionsById[generatedId]) continue;
      sourceUsage.set(source.id, sourceManualIndex + 1);

      const sourceEconomy = economies[source.id];
      if (!sourceEconomy) continue;

      const sourcePoint = theaterMapLayout[source.id];
      if (sourcePoint) {
        const spread = manualVariant ? 1.7 + depth * 0.45 : 1.25 + depth * 0.35;
        theaterMapLayout[generatedId] = {
          lon: manualVariant?.mapLon ?? sourcePoint.lon + suffix.lon * spread,
          lat: manualVariant?.mapLat ?? sourcePoint.lat + suffix.lat * spread,
        };
      }

      const linkedNeighbors = (manualVariant?.linkIds ?? source.adjacentRegionIds.slice(0, 2))
        .filter((neighborId) => regionsById[neighborId] && neighborId !== source.id)
        .slice(0, 3);
      const newRegion: RegionDefinition = {
        ...source,
        id: generatedId,
        name: manualVariant?.name ?? FALLBACK_CITY_NAMES[source.id]?.[sourceManualIndex] ?? `${source.name} ${suffix.label}`,
        isCapital: false,
        isKeyCity: false,
        terrain: manualVariant?.terrain ?? source.terrain,
        points: Math.max(4, Math.round(source.points * (manualVariant?.pointsFactor ?? 0.55))),
        populationWeight: Math.max(2, Math.round(source.populationWeight * (manualVariant?.populationFactor ?? 0.6))),
        industryWeight: Math.max(2, Math.round(source.industryWeight * (manualVariant?.industryFactor ?? 0.6))),
        adjacentRegionIds: [source.id, ...linkedNeighbors],
        infrastructure: source.infrastructure
          .filter((item) => item.type === "factory" || item.type === "supplyHub")
          .slice(0, 1)
          .map((item, infrastructureIndex) => ({
            ...item,
            id: undefined,
            level: Math.max(1, item.level - 1),
          })) as RegionDefinition["infrastructure"],
      };

      scenario.regions.push(newRegion);
      regionsById[newRegion.id] = newRegion;
      country.startingRegionIds.push(newRegion.id);

      if (!source.adjacentRegionIds.includes(newRegion.id)) {
        source.adjacentRegionIds.push(newRegion.id);
      }

      for (const neighborId of linkedNeighbors) {
        const neighbor = regionsById[neighborId];
        if (neighbor && !neighbor.adjacentRegionIds.includes(newRegion.id)) {
          neighbor.adjacentRegionIds.push(newRegion.id);
        }
      }

      economies[newRegion.id] = {
        population: Math.max(180, Math.ceil(sourceEconomy.population * 0.38)),
        stability: sourceEconomy.stability,
        recruitablePool: Math.max(18, Math.ceil(sourceEconomy.recruitablePool * 0.4)),
        buildingSlots: Math.max(2, sourceEconomy.buildingSlots - 1),
        facilities: [],
        fortification: undefined,
        resourceDeposits: sourceEconomy.resourceDeposits.map((deposit) => ({
          ...deposit,
          richness: Math.max(1, deposit.richness - 1),
        })),
      };
    }
  }

  return { scenario, economies };
}

function unlinkRegions(regionsById: Record<string, RegionDefinition>, leftId: string, rightId: string) {
  const left = regionsById[leftId];
  const right = regionsById[rightId];
  if (left) {
    left.adjacentRegionIds = left.adjacentRegionIds.filter((regionId) => regionId !== rightId);
  }
  if (right) {
    right.adjacentRegionIds = right.adjacentRegionIds.filter((regionId) => regionId !== leftId);
  }
}

function linkRegions(regionsById: Record<string, RegionDefinition>, leftId: string, rightId: string) {
  const left = regionsById[leftId];
  const right = regionsById[rightId];
  if (!left || !right) return;
  if (!left.adjacentRegionIds.includes(rightId)) {
    left.adjacentRegionIds.push(rightId);
  }
  if (!right.adjacentRegionIds.includes(leftId)) {
    right.adjacentRegionIds.push(leftId);
  }
}

function applyGeneratedAdjacencyCorrections(scenario: ScenarioDefinition) {
  const regionsById = indexById(scenario.regions) as Record<string, RegionDefinition>;

  unlinkRegions(regionsById, "bratislava", "warsaw");
  unlinkRegions(regionsById, "bratislava", "prague");
  linkRegions(regionsById, "bratislava", "brno");
  linkRegions(regionsById, "bratislava", "krakow-silesian-gate");

  unlinkRegions(regionsById, "bratislava-eastern-slovakia", "prague");
  linkRegions(regionsById, "bratislava-eastern-slovakia", "krakow");
  linkRegions(regionsById, "bratislava-eastern-slovakia", "lviv");
}

function boostCountryStockpiles(countries: CountryDefinition[], stockpiles: Record<CountryId, CountryStockpile>) {
  const boosted = { ...stockpiles };

  const balancePassMinimums: Partial<Record<CountryId, Partial<CountryStockpile>>> = {
    RUSSIA: { food: 90, munitions: 18, fertilizer: 12 },
    GERMANY: { food: 90, munitions: 18, fertilizer: 12 },
    POLAND: { food: 55, munitions: 14, fertilizer: 10 },
    NOVOROSSIA: { food: 60, munitions: 14, fertilizer: 12 },
    PRIDNESTROVIE: { food: 45, munitions: 16, steel: 16, fuel: 12 },
    HUNGARY: { food: 45, munitions: 14, steel: 14, fuel: 10 },
    SLOVAKIA: { food: 52, munitions: 16, steel: 16, fuel: 12 },
    BALTIC_FEDERATION: { food: 40, munitions: 12, steel: 12, fuel: 8 },
    ROMANIA: { food: 50, munitions: 14, steel: 12, fuel: 8 },
    BELARUS: { food: 45, munitions: 12, steel: 12, fuel: 8 },
  };

  for (const country of countries) {
    const baseline =
      country.tier === "major"
        ? { food: 28, steel: 12, munitions: 10, fuel: 8, tradePoints: 12, coal: 10, iron: 10 }
        : country.tier === "middle"
          ? { food: 22, steel: 9, munitions: 7, fuel: 5, tradePoints: 10, coal: 7, iron: 7 }
          : { food: 18, steel: 7, munitions: 5, fuel: 3, tradePoints: 8, coal: 5, iron: 5 };

    const current = { ...boosted[country.id] };
    for (const [key, value] of Object.entries(baseline)) {
      const stockpileKey = key as keyof CountryStockpile;
      current[stockpileKey] = Math.max(current[stockpileKey], value);
    }
    current.food += Math.max(0, country.startingRegionIds.length - 1);

    const override = balancePassMinimums[country.id];
    if (override) {
      for (const [key, value] of Object.entries(override)) {
        const stockpileKey = key as keyof CountryStockpile;
        current[stockpileKey] = Math.max(current[stockpileKey], value ?? 0);
      }
    }

    if (country.startsAtWar) {
      current.food += 25;
      current.munitions = Math.max(current.munitions, 10);
      current.fertilizer = Math.max(current.fertilizer, 6);
    }

    if (country.warEntryRules.some((rule) => rule.type === "scripted_turn")) {
      current.food += 15;
      current.munitions = Math.max(current.munitions, 12);
      current.steel = Math.max(current.steel, 12);
    }

    boosted[country.id] = current;
  }

  return boosted;
}

function seedStarterFacilities(
  economies: ReturnType<typeof cloneRegionEconomies>,
  countries: CountryDefinition[]
) {
  for (const country of countries) {
    const capitalEconomy = economies[country.capitalRegionId];
    if (!capitalEconomy) continue;

    const existingTypes = new Set(capitalEconomy.facilities.map((facility) => facility.type));
    const starterTypes = [
      "barracks",
      "farm",
      country.tier !== "minor" ? "powerPlant" : null,
    ].filter((value): value is "barracks" | "farm" | "powerPlant" => value !== null);

    for (const facilityType of starterTypes) {
      if (existingTypes.has(facilityType)) continue;
      capitalEconomy.facilities.push({
        id: `seed-${country.id.toLowerCase()}-${facilityType}`,
        type: facilityType,
        level: 1,
        regionId: country.capitalRegionId,
        damaged: false,
      });
      existingTypes.add(facilityType);
    }

    capitalEconomy.buildingSlots = Math.max(capitalEconomy.buildingSlots, capitalEconomy.facilities.length + 1);
  }

  return economies;
}

function seedStartingFortifications(
  scenario: ScenarioDefinition,
  economies: ReturnType<typeof cloneRegionEconomies>
) {
  const setFortification = (regionId: string, level: keyof typeof FORTIFICATION_MAX_HEALTH_BY_LEVEL) => {
    const region = scenario.regions.find((candidate) => candidate.id === regionId);
    const economy = economies[regionId];
    if (!region || !economy) return;

    const maxHealth = FORTIFICATION_MAX_HEALTH_BY_LEVEL[level];
    economy.fortification = {
      level,
      health: maxHealth,
      maxHealth,
      damaged: false,
    };
  };

  const novorossiaFrontlineLevel3 = [
    "kharkov",
    "donetsk",
    "zaporizhzhia",
    "kyiv",
    "dnipro",
    "odesa",
  ] as const;

  const russiaUkraineBorderLevel2 = [
    "kursk",
    "voronezh",
    "kharkov",
  ] as const;

  for (const regionId of novorossiaFrontlineLevel3) {
    setFortification(regionId, 3);
  }

  for (const regionId of russiaUkraineBorderLevel2) {
    if (!economies[regionId]?.fortification || economies[regionId].fortification!.level < 2) {
      setFortification(regionId, 2);
    }
  }

  setFortification("bratislava", 2);
  setFortification("budapest", 2);
  setFortification("bucharest", 2);
  setFortification("riga", 2);
  setFortification("vilnius", 2);
  setFortification("minsk", 2);

  return economies;
}

function seedStarterUnits(units: UnitDefinition[], countries: CountryDefinition[]) {
  const seededUnits = units.map((unit) => ({ ...unit }));
  const landCounts = seededUnits.reduce<Record<CountryId, number>>((accumulator, unit) => {
    if (unit.type === "infantry" || unit.type === "armor") {
      accumulator[unit.countryId] = (accumulator[unit.countryId] ?? 0) + 1;
    }
    return accumulator;
  }, {} as Record<CountryId, number>);

  for (const country of countries) {
    const minimumLandUnits =
      country.id === "PRIDNESTROVIE"
        ? 2
        : country.tier === "major"
          ? 5
          : country.tier === "middle"
            ? 4
            : 3;
    const currentCount = landCounts[country.id] ?? 0;

    for (let index = currentCount; index < minimumLandUnits; index++) {
      seededUnits.push({
        id: `seed-${country.id.toLowerCase()}-inf-${index + 1}`,
        type: "infantry",
        blocId: country.blocId ?? "NEUTRAL",
        countryId: country.id,
        regionId: country.capitalRegionId,
        strength: 8,
        supplyTurnsRemaining: 3,
      });
    }
  }

  return seededUnits;
}

function configurePridnestrovie(
  scenario: ScenarioDefinition,
  economies: ReturnType<typeof cloneRegionEconomies>,
  stockpiles: Record<CountryId, CountryStockpile>
) {
  const tiraspol = scenario.regions.find((region) => region.id === "chisinau-pridnestrovie");
  if (!tiraspol) {
    return { scenario, economies, stockpiles };
  }

  tiraspol.controllerCountryId = "PRIDNESTROVIE";
  tiraspol.controllerBlocId = "BRICS";
  tiraspol.homeCountryId = "MOLDOVA";
  tiraspol.isKeyCity = true;
  tiraspol.adjacentRegionIds = ["chisinau", "odesa"];

  // Keep Tiraspol mechanics strict: only Chisinau <-> Tiraspol <-> Odesa.
  for (const region of scenario.regions) {
    if (region.id === tiraspol.id || region.id === "chisinau" || region.id === "odesa") continue;
    region.adjacentRegionIds = region.adjacentRegionIds.filter((adjacentId) => adjacentId !== tiraspol.id);
  }

  const chisinau = scenario.regions.find((region) => region.id === "chisinau");
  if (chisinau && !chisinau.adjacentRegionIds.includes(tiraspol.id)) {
    chisinau.adjacentRegionIds.push(tiraspol.id);
  }

  const odesa = scenario.regions.find((region) => region.id === "odesa");
  if (odesa && !odesa.adjacentRegionIds.includes(tiraspol.id)) {
    odesa.adjacentRegionIds.push(tiraspol.id);
  }

  const economy = economies[tiraspol.id];
  if (economy) {
    economy.population = 180;
    economy.recruitablePool = 18;
    economy.buildingSlots = 0;
    economy.facilities = [];
  }

  stockpiles.PRIDNESTROVIE = {
    ...stockpiles.PRIDNESTROVIE,
    munitions: 160,
    explosives: 80,
    fuel: 24,
    tradePoints: 4,
  };

  return { scenario, economies, stockpiles };
}

function buildTurnOrder(
  countries: CountryDefinition[],
  countryStates: Record<CountryId, CountryState>,
  playerCountryId: CountryId
): CountryId[] {
  const brics = countries.filter((country) => country.blocId === "BRICS" && countryStates[country.id].atWar);
  const eu = countries.filter((country) => country.blocId === "EU_NATO" && countryStates[country.id].atWar);
  const neutrals = countries.filter((country) => country.blocId === "NEUTRAL" && countryStates[country.id].atWar);

  const order: CountryId[] = [];
  const maxLength = Math.max(brics.length, eu.length);
  for (let index = 0; index < maxLength; index++) {
    if (brics[index]) order.push(brics[index].id);
    if (eu[index]) order.push(eu[index].id);
  }
  order.push(...neutrals.map((country) => country.id));

  if (!order.includes(playerCountryId)) {
    order.unshift(playerCountryId);
  } else {
    const reordered = [playerCountryId, ...order.filter((countryId) => countryId !== playerCountryId)];
    return reordered;
  }

  return order;
}

export function createInitialState(playerCountryId: CountryId = "RUSSIA"): GameState {
  const scenario = cloneScenarioDefinition(modern2026Scenario);
  const expanded = expandScenarioRegions(scenario, cloneRegionEconomies());
  applyGeneratedAdjacencyCorrections(expanded.scenario);
  const preconfiguredStockpiles = boostCountryStockpiles(expanded.scenario.countries, { ...initialCountryStockpiles } as Record<CountryId, CountryStockpile>);
  const pridnestrovieConfigured = configurePridnestrovie(expanded.scenario, expanded.economies, preconfiguredStockpiles);
  const preparedRegionEconomies = seedStartingFortifications(
    pridnestrovieConfigured.scenario,
    seedStarterFacilities(pridnestrovieConfigured.economies, pridnestrovieConfigured.scenario.countries)
  );
  const preparedUnits = seedStarterUnits(expanded.scenario.startingUnits, expanded.scenario.countries);
  const preparedStockpiles = pridnestrovieConfigured.stockpiles;
  const countryStates = buildCountryStates(pridnestrovieConfigured.scenario.countries);
  const turnOrder = buildTurnOrder(pridnestrovieConfigured.scenario.countries, countryStates, playerCountryId);
  const currentActorId = turnOrder[0];
  const currentBlocId = pridnestrovieConfigured.scenario.countries.find((country) => country.id === currentActorId)?.blocId ?? "NEUTRAL";

  return {
    scenario: pridnestrovieConfigured.scenario,
    turn: 1,
    playerCountryId,
    currentActorId,
    currentBlocId,
    turnOrder,
    blocs: indexById(pridnestrovieConfigured.scenario.blocs) as Record<BlocId, BlocDefinition>,
    blocResources: pridnestrovieConfigured.scenario.blocResources,
    countryStockpiles: preparedStockpiles,
    balanceConfig: pridnestrovieConfigured.scenario.balanceConfig,
    countries: indexById(pridnestrovieConfigured.scenario.countries) as Record<CountryId, CountryDefinition>,
    countryStates,
    diplomacy: buildDiplomacyStates(pridnestrovieConfigured.scenario.countries),
    regions: indexById(pridnestrovieConfigured.scenario.regions) as Record<string, RegionDefinition>,
    regionEconomies: preparedRegionEconomies,
    units: indexById(preparedUnits) as Record<string, UnitDefinition>,
    productionQueues: buildBlocQueues(pridnestrovieConfigured.scenario.initialQueues),
    economyBuildOrders: buildCountryRecord<EconomyBuildOrder[]>(pridnestrovieConfigured.scenario.countries, () => []),
    weedSaturation: buildCountryRecord<number>(pridnestrovieConfigured.scenario.countries, () => 0),
    pendingOrders: buildCountryRecord<Order[]>(pridnestrovieConfigured.scenario.countries, () => []),
    doctrineUpgrades: buildCountryRecord<DoctrineUpgradeId[]>(pridnestrovieConfigured.scenario.countries, () => []),
    combatLog: [],
    history: {
      eliminatedMinorPowers: [],
      capturedMajorKeyCities: [],
      capturedMajorCapitals: [],
      claimedStrategicDepots: [],
      defeatedCountries: []
    },
    eventLog: [
      "Scenario initialized: Modern Europe 2026.",
      "Operational map expanded with additional subregions across all countries.",
      "Pridnestrovie begins as a BRICS enclave with a major munitions depot cut off from Russia.",
      "Belarus is aligned with BRICS but remains outside the war at turn 1.",
      "Slovakia and Hungary are scripted to enter the war on turn 5."
    ]
  };
}
