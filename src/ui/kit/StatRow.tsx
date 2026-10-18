import type { ReactNode } from "react";
import "./kit.css";

export function StatRow({
  label,
  value,
  tone,
  className = ""
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "good" | "warn" | "bad";
  className?: string;
}) {
  return (
    <div className={`stat-row${tone ? ` stat-row--${tone}` : ""} ${className}`.trim()}>
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">{value}</span>
    </div>
  );
}
