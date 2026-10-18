import type { ReactNode } from "react";
import "./kit.css";

export type BadgeTone = "brics" | "nato" | "neutral" | "good" | "warn" | "bad" | "info" | "plain";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
