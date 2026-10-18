import type { DoctrineUpgradeId } from "../state/types";

export interface DoctrineDefinition {
  id: DoctrineUpgradeId;
  name: string;
  description: string;
  /** Cost in tradePoints */
  cost: number;
  /** Which other doctrines must be unlocked first (optional) */
  requires?: DoctrineUpgradeId[];
  category: "military" | "logistics" | "economy";
}

export const DOCTRINE_DEFINITIONS: DoctrineDefinition[] = [
  {
    id: "infantry_drill",
    name: "Infantry Drill",
    description: "Intensive training increases infantry combat effectiveness by 10%.",
    cost: 20,
    category: "military",
  },
  {
    id: "combined_arms",
    name: "Combined Arms Doctrine",
    description: "Infantry and armor attacking the same target gain +15% coordinated assault bonus.",
    cost: 35,
    requires: ["infantry_drill"],
    category: "military",
  },
  {
    id: "armored_spearhead",
    name: "Armored Spearhead",
    description: "Armor units no longer suffer terrain defense multipliers when attacking.",
    cost: 40,
    requires: ["combined_arms"],
    category: "military",
  },
  {
    id: "artillery_doctrine",
    name: "Artillery Doctrine",
    description: "Bombers and pre-combat bombardment deal 25% more damage.",
    cost: 30,
    category: "military",
  },
  {
    id: "air_superiority",
    name: "Air Superiority",
    description: "Fighters deal 30% more damage in air-to-air interception fights.",
    cost: 35,
    requires: ["artillery_doctrine"],
    category: "military",
  },
  {
    id: "logistics_network",
    name: "Logistics Network",
    description: "Reduces all incoming supply attrition. Units survive 1 extra turn when cut off.",
    cost: 25,
    category: "logistics",
  },
  {
    id: "industrial_capacity",
    name: "Industrial Capacity",
    description: "All facility build and upgrade orders are completed 1 turn faster (minimum 1 turn).",
    cost: 30,
    category: "economy",
  },
  {
    id: "partisan_suppression",
    name: "Partisan Suppression",
    description: "Occupied enemy regions gain +5 stability per turn, reducing instability risk.",
    cost: 20,
    category: "economy",
  },
  {
    id: "trench_networks",
    name: "Trench Networks",
    description: "Prepared defensive lines increase defending force effectiveness by 18%.",
    cost: 28,
    requires: ["infantry_drill"],
    category: "military",
  },
  {
    id: "close_air_support",
    name: "Close Air Support",
    description: "Air support contributes 25% more combat value to land assaults.",
    cost: 30,
    requires: ["combined_arms"],
    category: "military",
  },
  {
    id: "missile_corps",
    name: "Missile Corps",
    description: "Tactical and strategic missile strikes deal 20% more direct unit damage.",
    cost: 36,
    requires: ["artillery_doctrine"],
    category: "military",
  },
  {
    id: "counterbattery_radar",
    name: "Counterbattery Radar",
    description: "Bombardment against your units is 20% less effective due to dispersion and warning.",
    cost: 34,
    requires: ["artillery_doctrine"],
    category: "military",
  },
  {
    id: "rail_logistics",
    name: "Rail Logistics",
    description: "Recruitment and replenishment orders complete 1 turn faster (minimum 1 turn).",
    cost: 26,
    requires: ["logistics_network"],
    category: "logistics",
  },
  {
    id: "field_hospitals",
    name: "Field Hospitals",
    description: "Land units suffer 1 less strength damage when unsupplied attrition hits.",
    cost: 24,
    requires: ["logistics_network"],
    category: "logistics",
  },
  {
    id: "war_bonds",
    name: "War Bonds",
    description: "Civilian industry trade-point output increases by 20%.",
    cost: 28,
    requires: ["industrial_capacity"],
    category: "economy",
  },
  {
    id: "rationing_program",
    name: "Rationing Program",
    description: "Food shortages hurt military units less: -1 strength loss reduction per turn.",
    cost: 22,
    requires: ["industrial_capacity"],
    category: "economy",
  },
  {
    id: "occupation_administration",
    name: "Occupation Administration",
    description: "Adds another +5 stability per turn in occupied regions (stacks with suppression).",
    cost: 24,
    requires: ["partisan_suppression"],
    category: "economy",
  },
  {
    id: "emergency_conscription",
    name: "Emergency Conscription",
    description: "Recruitable pool in each region is maintained at a minimum of 10% of population.",
    cost: 26,
    requires: ["industrial_capacity"],
    category: "military",
  },
];
