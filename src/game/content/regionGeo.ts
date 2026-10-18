export interface GeoPoint {
  lon: number;
  lat: number;
}

export const theaterMapSize = {
  width: 1600,
  height: 980
};

// Only countries that have game regions — removes Greece (300), Turkey (792)
// 8=Albania, 40=Austria, 70=BiH, 112=Belarus, 191=Croatia, 203=CzechRep,
// 233=Estonia, 246=Finland, 276=Germany, 348=Hungary, 428=Latvia, 440=Lithuania,
// 498=Moldova, 499=Montenegro, 616=Poland, 642=Romania, 643=Russia,
// 688=Serbia, 703=Slovakia, 705=Slovenia, 756=Switzerland, 804=Ukraine, 807=NMacedonia
export const europeCountryIds = [
  8, 40, 70, 112, 191, 203, 233, 246, 276, 348, 428, 440, 498, 499, 616,
  642, 643, 688, 703, 705, 756, 804, 807
];

export const theaterMapLayout: Record<string, GeoPoint> = {
  "moscow": { lon: 37.6173, lat: 55.7558 },
  "saint-petersburg": { lon: 30.3351, lat: 59.9343 },
  "nizhny-novgorod": { lon: 44.0059, lat: 56.3269 },
  "rostov-on-don": { lon: 39.7015, lat: 47.2357 },
  "kazan": { lon: 49.1221, lat: 55.7887 },
  "bryansk": { lon: 34.3634, lat: 53.2436 },
  "smolensk": { lon: 32.0453, lat: 54.7826 },
  "voronezh": { lon: 39.2003, lat: 51.672 },
  "kursk": { lon: 36.1939, lat: 51.7304 },
  "minsk": { lon: 27.5615, lat: 53.9045 },
  "gomel": { lon: 30.9754, lat: 52.4345 },
  "brest": { lon: 23.6878, lat: 52.0976 },
  "donetsk": { lon: 37.8029, lat: 48.0159 },
  "kharkov": { lon: 36.2304, lat: 49.9935 },
  "lugansk": { lon: 39.3078, lat: 48.574 },
  "mariupol": { lon: 37.5494, lat: 47.0971 },
  "zaporizhzhia": { lon: 35.1396, lat: 47.8388 },
  "sevastopol": { lon: 33.5224, lat: 44.6166 },
  "bratislava": { lon: 17.1077, lat: 48.1486 },
  "budapest": { lon: 19.0402, lat: 47.4979 },
  "berlin": { lon: 13.405, lat: 52.52 },
  "hamburg": { lon: 9.9937, lat: 53.5511 },
  "munich": { lon: 11.582, lat: 48.1351 },
  "essen": { lon: 7.0123, lat: 51.4556 },
  "hannover": { lon: 9.732, lat: 52.3759 },
  "dresden": { lon: 13.7373, lat: 51.0504 },
  "warsaw": { lon: 21.0122, lat: 52.2297 },
  "gdansk": { lon: 18.6466, lat: 54.352 },
  "lublin": { lon: 22.5684, lat: 51.2465 },
  "krakow": { lon: 19.945, lat: 50.0647 },
  "poznan": { lon: 16.9252, lat: 52.4064 },
  "wroclaw": { lon: 17.0385, lat: 51.1079 },
  "bucharest": { lon: 26.1025, lat: 44.4268 },
  "constanta": { lon: 28.6348, lat: 44.1598 },
  "cluj-napoca": { lon: 23.5948, lat: 46.7712 },
  "prague": { lon: 14.4378, lat: 50.0755 },
  "brno": { lon: 16.6068, lat: 49.1951 },
  "helsinki": { lon: 24.9384, lat: 60.1699 },
  "turku": { lon: 22.2666, lat: 60.4518 },
  "tampere": { lon: 23.761, lat: 61.4978 },
  "riga": { lon: 24.1052, lat: 56.9496 },
  "tallinn": { lon: 24.7536, lat: 59.437 },
  "vilnius": { lon: 25.2797, lat: 54.6872 },
  "kaunas": { lon: 23.8813, lat: 54.8985 },
  "kyiv": { lon: 30.5234, lat: 50.4501 },
  "lviv": { lon: 24.0316, lat: 49.8397 },
  "odesa": { lon: 30.7233, lat: 46.4825 },
  "dnipro": { lon: 35.0462, lat: 48.4647 },
  "kaliningrad": { lon: 20.4522, lat: 54.7104 },
  "vienna": { lon: 16.3738, lat: 48.2082 },
  "salzburg": { lon: 13.055, lat: 47.8095 },
  "belgrade": { lon: 20.4489, lat: 44.7866 },
  "novi-sad": { lon: 19.8335, lat: 45.2671 },
  "nis": { lon: 21.8958, lat: 43.3209 },
  "bern": { lon: 7.4474, lat: 46.948 },
  "sarajevo": { lon: 18.4131, lat: 43.8563 },
  "podgorica": { lon: 19.262, lat: 42.4304 },
  "pristina": { lon: 21.1655, lat: 42.6629 },
  "tirana": { lon: 19.8189, lat: 41.3275 },
  "skopje": { lon: 21.4316, lat: 41.9981 },
  "zagreb": { lon: 15.9819, lat: 45.815 },
  "ljubljana": { lon: 14.5058, lat: 46.0569 },
  "chisinau": { lon: 28.8353, lat: 47.0105 }
};

// Display-only fixes for generated map points that fall outside their own country shape. Rules
// never read this: only the map does, through getRegionGeoPoint.
export const MAP_POINT_OVERRIDES: Record<string, GeoPoint> = {
  "berlin-brandenburg-belt": { lon: 13.0645, lat: 52.3906 }, // Potsdam
  "essen-ruhr-corridor": { lon: 6.7623, lat: 51.4344 }, // Duisburg
  "riga-north": { lon: 26.535, lat: 55.877 }, // Daugavpils
  "tallinn-east": { lon: 28.05, lat: 59.4 }, // Narva, just inside the river border
  "novi-sad-vojvodina": { lon: 19.6647, lat: 46.1003 }, // Subotica
  "sarajevo-northern-bosnia": { lon: 17.191, lat: 44.7722 }, // Banja Luka
  "podgorica-adriatic-gate": { lon: 19.0983, lat: 42.0931 }, // Bar
  "pristina-dukagjin": { lon: 20.741, lat: 42.213 }, // Prizren
  "tirana-durres-coast": { lon: 19.4565, lat: 41.3231 }, // Durres
  "skopje-pelagonia": { lon: 21.3347, lat: 41.0328 } // Bitola
};

export function getRegionGeoPoint(regionId: string): GeoPoint | undefined {
  return MAP_POINT_OVERRIDES[regionId] ?? theaterMapLayout[regionId];
}
