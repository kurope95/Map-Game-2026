import type { EconomyBuildOrder, Facility, StockpileKey } from "../../game/state/types";
import { FACILITY_META, RESOURCE_META } from "../kit/resources";
import { UNIT_TYPE_LABELS } from "../kit/unitSymbols";

/** Human-readable label for a pending construction order in the Orders panel. */
export function describeBuildOrder(order: EconomyBuildOrder, facilities: readonly Facility[]): string {
  const facility = facilities.find((candidate) => candidate.id === order.facilityId);
  switch (order.type) {
    case "buildFacility":
      return `Build ${order.facilityType ? FACILITY_META[order.facilityType].label : "facility"}`;
    case "upgradeFacility":
      return `Upgrade ${facility ? FACILITY_META[facility.type].label : "facility"}`;
    case "repairFacility":
      return `Repair ${facility ? FACILITY_META[facility.type].label : "facility"}`;
    case "recruitUnit":
      return `Recruit ${order.unitType ? UNIT_TYPE_LABELS[order.unitType] : "unit"}`;
    case "replenishUnit":
      return `Replenish ${order.unitType ? UNIT_TYPE_LABELS[order.unitType] : "unit"}`;
    case "buildFortification":
      return "Build fortification";
    case "upgradeFortification":
      return "Upgrade fortification";
    case "repairFortification":
      return "Repair fortification";
  }
}

/** The resources already locked from the stockpile, e.g. "12 Steel · 3 Fuel". */
export function committedCostLabel(order: EconomyBuildOrder): string {
  const parts = Object.entries(order.committed)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([key, amount]) => `${amount} ${RESOURCE_META[key as StockpileKey].label}`);
  return parts.length > 0 ? parts.join(" · ") : "No cost";
}
