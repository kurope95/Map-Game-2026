import { blocDefinitions } from "./blocs";
import { balanceConfig } from "./balance";
import { countryDefinitions } from "./countries";
import { regionDefinitions } from "./regions";
import { initialProductionQueues } from "./production";
import { startingUnits } from "./units";
import { BlocResources, ScenarioDefinition } from "../state/types";

const blocResources: Record<"BRICS" | "EU_NATO" | "NEUTRAL", BlocResources> = {
  BRICS: {
    industry: 138,
    oil: 126,
    morale: 100
  },
  EU_NATO: {
    industry: 144,
    oil: 118,
    morale: 100
  },
  NEUTRAL: {
    industry: 0,
    oil: 0,
    morale: 100
  }
};

export const modern2026Scenario: ScenarioDefinition = {
  id: "modern-2026",
  name: "Modern Europe 2026",
  description:
    "Country-based 2026 escalation scenario with scripted war entry, neutral middle powers, and city-region strategic geography.",
  blocs: blocDefinitions,
  blocResources,
  balanceConfig,
  countries: countryDefinitions,
  regions: regionDefinitions,
  startingUnits,
  initialQueues: initialProductionQueues
};
