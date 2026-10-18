import { BalanceConfig } from "../state/types";

export const balanceConfig: BalanceConfig = {
  tiers: {
    major: {
      industryMultiplier: 1.2,
      oilMultiplier: 1.15,
      moraleBase: 100,
      unitCap: 18
    },
    middle: {
      industryMultiplier: 1,
      oilMultiplier: 1,
      moraleBase: 92,
      unitCap: 12
    },
    minor: {
      industryMultiplier: 0.8,
      oilMultiplier: 0.85,
      moraleBase: 84,
      unitCap: 8
    }
  },
  infrastructure: {
    airportRangePerLevel: 2,
    factoryIndustryPerLevel: 4,
    militaryFactoryOutputPerLevel: 3,
    supplyReachPerLevel: 2
  }
};
