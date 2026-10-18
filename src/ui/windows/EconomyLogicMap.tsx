import { ArrowRight, Network, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { FacilityType, StockpileKey, UnitType } from "../../game/state/types";
import { ResourceIcon } from "../kit/ResourceIcon";
import { RESOURCE_META, FACILITY_META } from "../kit/resources";
import { UnitSymbol } from "../kit/UnitSymbol";
import { Window } from "../kit/Window";
import "./EconomyLogicMap.css";

interface EconomyLogicMapProps {
  onClose: () => void;
}

function ResourceNode({ resource, tone = "good", label }: { resource: StockpileKey; tone?: "raw" | "good"; label?: string }) {
  return (
    <div className={`node node--${tone}`}>
      <ResourceIcon resource={resource} />
      <span>{label ?? RESOURCE_META[resource].label}</span>
    </div>
  );
}

function FacilityNode({ type, label, note = false }: { type: FacilityType; label?: string; note?: boolean }) {
  const meta = FACILITY_META[type];
  const Icon = meta.Icon;
  return (
    <>
      <div className="node node--fac">
        <Icon size={13} aria-hidden="true" />
        <span>{label ?? meta.label}</span>
      </div>
      {note ? (
        <em className="node-note">
          <Zap size={11} aria-hidden="true" />
          Requires Energy
        </em>
      ) : null}
    </>
  );
}

function UnitNode({ type, children }: { type: UnitType; children: ReactNode }) {
  return (
    <div className="node node--unit">
      <UnitSymbol type={type} size={18} />
      <span>{children}</span>
    </div>
  );
}

function Arrow({ rotate = false }: { rotate?: boolean }) {
  return <ArrowRight className={`arrow${rotate ? " arrow--down" : ""}`} size={16} aria-hidden="true" />;
}

export function EconomyLogicMap({ onClose }: EconomyLogicMapProps) {
  return (
    <Window
      title="Economy Logic Map"
      icon={Network}
      onClose={onClose}
      variant="modal"
      className="logic-map-modal"
      backdropClassName="logic-map-overlay"
      bodyClassName="logic-map-body"
      layoutId="logic-map"
    >
      <div className="logic-map-legend">
        <span className="logic-map-legend__item"><span className="logic-map-legend__swatch logic-map-legend__swatch--raw" /> Raw Resource</span>
        <Arrow />
        <span className="logic-map-legend__item"><span className="logic-map-legend__swatch logic-map-legend__swatch--fac" /> Facility</span>
        <Arrow />
        <span className="logic-map-legend__item"><span className="logic-map-legend__swatch logic-map-legend__swatch--good" /> Processed Good</span>
        <Arrow />
        <span className="logic-map-legend__item"><span className="logic-map-legend__swatch logic-map-legend__swatch--unit" /> Military Unit</span>
        <span className="logic-map-legend__note">
          <Zap size={12} aria-hidden="true" />
          Power Plants must be built to generate Energy for Industrial Facilities.
        </span>
      </div>

      <div className="logic-map-flows">
        {/* Row 1: Food & Weed */}
        <div className="logic-flow">
          <div className="flow-col">
            <ResourceNode resource="food" tone="raw" label="Fertility Deposit" />
            <ResourceNode resource="fertilizer" tone="raw" label="Fertilizer (Optional Base Boost)" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="farm" />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="food" />
            <ResourceNode resource="weed" label="Weed (Trade & Morale)" />
          </div>
        </div>

        <hr className="divider" />

        {/* Row 2: Metals & Minerals */}
        <div className="logic-flow">
          <div className="flow-col">
            <ResourceNode resource="iron" tone="raw" label="Iron Deposit" />
            <ResourceNode resource="coal" tone="raw" label="Coal Deposit" />
            <ResourceNode resource="tungsten" tone="raw" label="Tungsten Deposit" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="mine" />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="iron" />
            <ResourceNode resource="coal" />
            <ResourceNode resource="tungsten" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="smelter" note />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="steel" />
          </div>
        </div>

        <hr className="divider" />

        {/* Row 3: Oil & Chemicals */}
        <div className="logic-flow">
          <div className="flow-col">
            <ResourceNode resource="oil" tone="raw" label="Oil Deposit" />
            <Arrow rotate />
            <FacilityNode type="oilWell" />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="oil" />
            <div className="node node--hint">(or Coal via Refinery)</div>
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="chemicalPlant" note />
            <FacilityNode type="syntheticRefinery" note />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="fertilizer" />
            <ResourceNode resource="explosives" />
            <ResourceNode resource="fuel" />
            <ResourceNode resource="chemicals" />
          </div>
        </div>

        <hr className="divider" />

        {/* Row 4: Military Industry */}
        <div className="logic-flow">
          <div className="flow-col">
            <ResourceNode resource="steel" />
            <ResourceNode resource="explosives" />
            <ResourceNode resource="chemicals" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="munitionsPlant" note />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="munitions" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="barracks" label="Barracks / Factories" />
          </div>
          <Arrow />
          <div className="flow-col">
            <UnitNode type="infantry">Infantry</UnitNode>
            <UnitNode type="armor">Armor (Requires Fuel)</UnitNode>
            <UnitNode type="fighter">Aircraft (Requires Fuel)</UnitNode>
          </div>
        </div>

        <hr className="divider" />

        {/* Row 5: Civilian Industry */}
        <div className="logic-flow">
          <div className="flow-col">
            <ResourceNode resource="steel" />
            <ResourceNode resource="chemicals" />
            <ResourceNode resource="food" />
          </div>
          <Arrow />
          <div className="flow-col">
            <FacilityNode type="civilianFactory" note />
          </div>
          <Arrow />
          <div className="flow-col">
            <ResourceNode resource="textiles" label="Textiles (Trade)" />
            <ResourceNode resource="electronics" label="Electronics (Trade)" />
            <ResourceNode resource="vehicles" label="Vehicles (Trade)" />
            <ResourceNode resource="pharmaceuticals" label="Pharma (Trade)" />
          </div>
        </div>
      </div>
    </Window>
  );
}
