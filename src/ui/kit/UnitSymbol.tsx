import type { UnitType } from "../../game/state/types";
import { unitSymbolPaths } from "./unitSymbols";
import "./kit.css";

export function UnitSymbol({
  type,
  size = 24,
  color = "currentColor"
}: {
  type: UnitType;
  size?: number;
  color?: string;
}) {
  const { strokes, fills, letter } = unitSymbolPaths(type);
  const showLetter = Boolean(letter) && size >= 14;
  return (
    <svg
      className="unit-symbol"
      width={size}
      height={(size * 16) / 24}
      viewBox="0 0 24 16"
      aria-hidden="true"
    >
      {strokes.map((d, index) => (
        <path key={`stroke-${index}`} d={d} fill="none" stroke={color} strokeWidth={1.2} />
      ))}
      {fills.map((d, index) => (
        <path key={`fill-${index}`} d={d} fill={color} />
      ))}
      {showLetter ? (
        <text x={20} y={6} fill={color} fontSize={6} fontFamily="var(--font-display)" textAnchor="middle">
          {letter}
        </text>
      ) : null}
    </svg>
  );
}
