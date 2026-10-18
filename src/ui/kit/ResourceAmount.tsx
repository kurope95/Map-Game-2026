import type { StockpileKey } from "../../game/state/types";
import { ResourceIcon } from "./ResourceIcon";
import { RESOURCE_META } from "./resources";
import "./kit.css";

export function ResourceAmount({
  resource,
  amount,
  missing = false
}: {
  resource: StockpileKey;
  amount: number;
  missing?: boolean;
}) {
  return (
    <span
      className={`resource-amount${missing ? " resource-amount--missing" : ""}`}
      title={RESOURCE_META[resource].label}
    >
      <ResourceIcon resource={resource} size={13} />
      <span className="resource-amount__value">{amount}</span>
    </span>
  );
}
