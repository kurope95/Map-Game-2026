import type { StockpileKey } from "../../game/state/types";
import { RESOURCE_META } from "./resources";
import "./kit.css";

export function ResourceIcon({ resource, size = 14 }: { resource: StockpileKey; size?: number }) {
  const { Icon, color } = RESOURCE_META[resource];
  return <Icon className="resource-icon" size={size} color={color} aria-hidden="true" />;
}
