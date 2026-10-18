import { ProductionQueueItem } from "../state/types";

export const initialProductionQueues: ProductionQueueItem[] = [
  {
    id: "queue-brics-1",
    blocId: "BRICS",
    countryId: "RUSSIA",
    outputType: "armor",
    targetRegionId: "rostov-on-don",
    remainingTurns: 3,
    facilityType: "militaryFactory"
  },
  {
    id: "queue-eu-1",
    blocId: "EU_NATO",
    countryId: "GERMANY",
    outputType: "fighter",
    targetRegionId: "berlin",
    remainingTurns: 3,
    facilityType: "airport"
  }
];
