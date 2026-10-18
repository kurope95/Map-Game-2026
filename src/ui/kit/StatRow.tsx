import type { ReactNode } from "react";
import "./kit.css";

export function StatRow({
  label,
  value,
  tone
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className={`stat-row${tone ? ` stat-row--${tone}` : ""}`}>
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">{value}</span>
    </div>
  );
}
