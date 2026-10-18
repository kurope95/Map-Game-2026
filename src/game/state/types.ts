export type BlocId = "BRICS" | "EU_NATO" | "NEUTRAL";

export type CountryId =
  | "RUSSIA"
  | "BELARUS"
  | "NOVOROSSIA"
  | "PRIDNESTROVIE"
  | "SLOVAKIA"
  | "HUNGARY"
  | "GERMANY"
  | "POLAND"
  | "ROMANIA"
  | "CZECH_REPUBLIC"
  | "FINLAND"
  | "BALTIC_FEDERATION"
  | "UKRAINE"
  | "AUSTRIA"
  | "SERBIA"
  | "SWITZERLAND"
  | "BOSNIA_AND_HERZEGOVINA"
  | "MONTENEGRO"
  | "KOSOVO"
  | "ALBANIA"
  | "NORTH_MACEDONIA"
  | "CROATIA"
  | "SLOVENIA"
  | "MOLDOVA";

export type CountryTier = "major" | "middle" | "minor";
export type CountryAlignment = "fixed_member" | "aligned_non_belligerent" | "neutral";

export type RegionTerrain =
  | "urban"
  | "plains"
  | "forest"
  | "mountain"
  | "industrial"
  | "coastal";

export type InfrastructureType =
  | "airport"
  | "factory"
  | "militaryFactory"
  | "supplyHub";

export type LandUnitType = "infantry" | "armor" | "mlrs";
export type AirUnitType = "fighter" | "bomber";
export type MissileUnitType = "tacticalMissile" | "strategicMissile";
export type UnitType = LandUnitType | AirUnitType | MissileUnitType;

export type DoctrineType =
  | "defensive_attrition"
  | "mobile_offensive"
  | "diplomatic_opportunist";

export type ThresholdMetric =
  | "minor_powers_eliminated"
  | "major_power_key_cities_captured"
  | "major_power_capitals_captured"
  | "different_major_powers_key_cities_captured"
  | "country_key_cities_lost"
  | "country_capitals_lost"
  | "country_regions_lost"
  | "country_defeated";

export interface RegionInfrastructure {
  type: InfrastructureType;
  level: number;
  damaged: boolean;
}

export interface RegionDefinition {
  id: string;
  name: string;
  homeCountryId: CountryId;
  controllerCountryId: CountryId;
  controllerBlocId?: BlocId;
  terrain: RegionTerrain;
  points: number;
  populationWeight: number;
  industryWeight: number;
  isCapital: boolean;
  isKeyCity: boolean;
  adjacentRegionIds: string[];
  infrastructure: RegionInfrastructure[];
}

export interface BlocDefinition {
  id: BlocId;
  name: string;
  doctrine: DoctrineType;
}

export interface ThresholdCondition {
  metric: ThresholdMetric;
  operator: ">=";
  value: number;
  countryId?: CountryId;
}

export interface ThresholdRule {
  kind: "any_of";
  conditions: ThresholdCondition[];
}

export interface ScriptedTurnRule {
  id: string;
  type: "scripted_turn";
  description: string;
  turn: number;
}

export interface ThresholdEventRule {
  id: string;
  type: "threshold_event";
  description: string;
  threshold: ThresholdRule;
}

export type WarEntryRule = ScriptedTurnRule | ThresholdEventRule;

export interface CountryDefinition {
  id: CountryId;
  name: string;
  blocId?: BlocId;
  alignment: CountryAlignment;
  tier: CountryTier;
  startsAtWar: boolean;
  capitalRegionId: string;
  keyRegionIds: string[];
  startingRegionIds: string[];
  warEntryRules: WarEntryRule[];
}

export interface BlocResources {
  industry: number;
  oil: number;
  morale: number;
}

export interface TierBalance {
  industryMultiplier: number;
  oilMultiplier: number;
  moraleBase: number;
  unitCap: number;
}

export interface InfrastructureBalance {
  airportRangePerLevel: number;
  factoryIndustryPerLevel: number;
  militaryFactoryOutputPerLevel: number;
  supplyReachPerLevel: number;
}

export interface BalanceConfig {
  tiers: Record<CountryTier, TierBalance>;
  infrastructure: InfrastructureBalance;
}

export interface CountryState {
  countryId: CountryId;
  atWar: boolean;
  activatedOnTurn?: number;
  defeatedOnTurn?: number;
}

export type DiplomacyActionType =
  | "eliteBribery"
  | "publicCampaign"
  | "economicAid"
  | "weedSmuggling"
  | "securityPressure";

export interface CountryDiplomacyState {
  countryId: CountryId;
  eliteSupport: number;   // -100 BRICS to +100 EU/NATO
  publicSupport: number;  // -100 BRICS to +100 EU/NATO
  lastActionTurn?: number;
}

export interface WarHistory {
  eliminatedMinorPowers: CountryId[];
  capturedMajorKeyCities: string[];
  capturedMajorCapitals: string[];
  claimedStrategicDepots: string[];
  defeatedCountries: CountryId[];
}

export interface UnitDefinition {
  id: string;
  type: UnitType;
  blocId: BlocId;
  countryId: CountryId;
  regionId: string;
  strength: number;
  supplyTurnsRemaining: number;
  /** Number of battles won — grants veterancy bonuses */
  battlesWon?: number;
  /** Consecutive turns this unit has held position — grants entrenchment bonus */
  entrenchmentTurns?: number;
}

export interface RegionFortification {
  level: number;          // 1-3
  health: number;
  maxHealth: number;
  damaged: boolean;
}

/* ═══════════════════════════════════
   ECONOMY: Resources, Facilities, Production
   ═══════════════════════════════════ */

export type ResourceType = "oil" | "coal" | "iron" | "tungsten" | "food" | "chemicals";

/** Natural resource deposit in a region (must build extraction facility to exploit) */
export interface ResourceDeposit {
  type: ResourceType;
  richness: number;        // base yield per turn when extracted (1-5)
}

// ── Facility types ──
export type ExtractionFacilityType = "mine" | "oilWell" | "farm" | "chemicalPlant";
export type ProcessingFacilityType = "powerPlant" | "smelter" | "refinery" | "syntheticRefinery";
export type MilitaryFacilityType = "barracks" | "armorFactory" | "airFactory" | "munitionsPlant";
export type CivilianFacilityType = "civilianFactory";
export type FacilityType =
  | ExtractionFacilityType
  | ProcessingFacilityType
  | MilitaryFacilityType
  | CivilianFacilityType;

export interface Facility {
  id: string;
  type: FacilityType;
  level: number;           // 1-3
  regionId: string;
  damaged: boolean;
  /** For chemicalPlant: "fertilizer" boosts food, "explosives" produces munitions */
  chemicalMode?: "fertilizer" | "explosives";
  /** For civilianFactory: which civilian good is being produced */
  civilianProduct?: CivilianGoodType;
}

// ── Civilian goods ──
export type CivilianGoodType = "textiles" | "electronics" | "vehicles" | "pharmaceuticals" | "luxuryGoods" | "weed";

// ── All stockpile keys (raw + processed + civilian) ──
export type StockpileKey =
  | ResourceType
  | "steel" | "fuel" | "explosives" | "fertilizer" | "munitions" | "energy"
  | "tradePoints"
  | CivilianGoodType;

/** Country-level stockpile of raw + processed resources + civilian goods */
export interface CountryStockpile {
  // Raw resources
  oil: number;
  coal: number;
  iron: number;
  tungsten: number;
  food: number;
  chemicals: number;
  // Intermediate / processed
  steel: number;
  fuel: number;
  explosives: number;
  fertilizer: number;
  munitions: number;
  energy: number;
  // Civilian goods
  textiles: number;
  electronics: number;
  vehicles: number;
  pharmaceuticals: number;
  luxuryGoods: number;
  weed: number;             // perishable — consumed each turn, no carry-over
  // Trade currency
  tradePoints: number;
}

/** Weed saturation bracket effects */
export interface WeedEffect {
  moraleBonus: number;
  foodMultiplier: number;   // 1.0 = normal, 1.3 = 30% more food consumed
}

/** Region economic state */
export interface RegionEconomy {
  population: number;       // thousands — determines recruitment cap & labor
  stability: number;        // 0-100 — affected by food shortage, war damage, occupation
  recruitablePool: number;  // available for conscription (replenished slowly)
  buildingSlots: number;    // total shared military + civilian facility slots
  facilities: Facility[];
  fortification?: RegionFortification;
  resourceDeposits: ResourceDeposit[];
}

/** Production order: player queues building a unit or upgrading a facility */
export interface EconomyBuildOrder {
  id: string;
  countryId: CountryId;
  regionId: string;
  type: "recruitUnit" | "buildFacility" | "upgradeFacility" | "replenishUnit" | "repairFacility" | "buildFortification" | "upgradeFortification" | "repairFortification";
  /** For recruitUnit: which unit type */
  unitType?: UnitType;
  /** For replenishUnit: which existing unit to restore */
  unitId?: string;
  /** For buildFacility: which facility type */
  facilityType?: FacilityType;
  /** Optional mode for newly built chemical plants */
  chemicalMode?: "fertilizer" | "explosives";
  /** For upgradeFacility / repairFacility: which facility id */
  facilityId?: string;
  turnsRemaining: number;
  totalTurns: number;
  /** Resources already committed (locked from stockpile) */
  committed: Partial<Record<StockpileKey, number>>;
}

export type OrderType = "move" | "attack" | "hold" | "airSupport" | "bombard" | "missileStrike";

export interface Order {
  unitId: string;
  type: OrderType;
  targetRegionId: string;  // for move/attack, same as current for hold
}

export interface CombatResult {
  attackerUnitId: string;
  attackerUnitIds?: string[];       // for coordinated attacks
  defenderUnitIds: string[];
  regionId: string;
  attackerStrengthBefore: number;
  defenderStrengthBefore: number;
  attackerStrengthAfter: number;
  defenderStrengthAfter: number;
  attackerWon: boolean;
  terrainModifier: number;
  /** Air support strength bonus applied to attackers */
  airSupportBonus?: number;
  /** Bombardment damage applied before land combat */
  bombardmentDamage?: number;
  /** Missile strike damage applied */
  missileStrikeDamage?: number;
  /** Facilities damaged during combat */
  facilitiesDamaged?: string[];
  /** Units that retreated instead of being destroyed */
  retreatedUnitIds?: string[];
}

export interface ProductionQueueItem {
  id: string;
  blocId: BlocId;
  countryId: CountryId;
  outputType: UnitType | InfrastructureType;
  targetRegionId: string;
  remainingTurns: number;
  facilityType: "factory" | "militaryFactory" | "airport";
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  blocs: BlocDefinition[];
  blocResources: Record<BlocId, BlocResources>;
  balanceConfig: BalanceConfig;
  countries: CountryDefinition[];
  regions: RegionDefinition[];
  startingUnits: UnitDefinition[];
  initialQueues: ProductionQueueItem[];
}

export type VictoryStatus = "ongoing" | "player_victory" | "player_defeat";

export type DoctrineUpgradeId =
  | "infantry_drill"        // +10% infantry combat power
  | "combined_arms"         // +15% attack bonus when infantry+armor attack same target
  | "logistics_network"     // Land units get +1 supply turn before attrition starts
  | "industrial_capacity"   // Facility build/upgrade speed -1 turn (min 1)
  | "artillery_doctrine"    // Bombardment damage +25%
  | "armored_spearhead"     // Armor ignores terrain defense penalty
  | "air_superiority"       // Fighter air-to-air damage +30%
  | "partisan_suppression"  // Occupied regions gain +5 stability/turn
  | "trench_networks"       // Defenders gain +18% effective combat strength
  | "close_air_support"     // Air support bonus +25% in land battles
  | "missile_corps"         // Missile strike payload +20%
  | "counterbattery_radar"  // Incoming bombardment damage -20%
  | "rail_logistics"        // Recruit/replenish orders complete 1 turn faster (min 1)
  | "field_hospitals"       // Supply attrition damage reduced by 1
  | "war_bonds"             // Trade point income from civilian production +20%
  | "rationing_program"     // Food shortage unit strength loss reduced by 1
  | "occupation_administration" // Additional +5 occupied-region stability/turn
  | "emergency_conscription"; // Recruitable pool floor increased to 10% of population

export interface GameState {
  scenario: ScenarioDefinition;
  turn: number;
  playerCountryId: CountryId;
  currentActorId: CountryId;
  currentBlocId: BlocId;
  turnOrder: CountryId[];
  blocs: Record<BlocId, BlocDefinition>;
  blocResources: Record<BlocId, BlocResources>;
  countryStockpiles: Record<CountryId, CountryStockpile>;
  balanceConfig: BalanceConfig;
  countries: Record<CountryId, CountryDefinition>;
  countryStates: Record<CountryId, CountryState>;
  diplomacy: Record<CountryId, CountryDiplomacyState>;
  regions: Record<string, RegionDefinition>;
  regionEconomies: Record<string, RegionEconomy>;
  units: Record<string, UnitDefinition>;
  productionQueues: Record<BlocId, ProductionQueueItem[]>;
  economyBuildOrders: Record<CountryId, EconomyBuildOrder[]>;
  weedSaturation: Record<CountryId, number>;  // 0-1 ratio, computed each turn
  pendingOrders: Record<CountryId, Order[]>;
  history: WarHistory;
  combatLog: CombatResult[];
  eventLog: string[];
  /** Unlocked doctrine upgrades per country */
  doctrineUpgrades: Record<CountryId, DoctrineUpgradeId[]>;
  /** Victory/defeat status */
  victoryStatus?: VictoryStatus;
  /** Notification toasts to display */
  toasts?: GameToast[];
  /** Difficulty setting */
  difficulty?: "easy" | "normal" | "hard" | "brutal";
  /** Transient allied attack commitments for the current turn cycle (reset each game turn) */
  allyTargetClaims?: Partial<Record<BlocId, Record<string, { countryId: CountryId; strength: number }>>>;
}

export interface GameToast {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
  turn: number;
}
