import type { LucideIcon } from "lucide-react";
import "./kit.css";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: { id: T; label: string; icon?: LucideIcon; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`tabs__tab${active === id ? " tabs__tab--active" : ""}`}
          onClick={() => onChange(id)}
        >
          {Icon ? <Icon size={14} aria-hidden="true" /> : null}
          <span>{label}</span>
          {count !== undefined ? <span className="tabs__count">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}
