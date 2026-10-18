import type { UnitType } from "../../../game/state/types";
import { unitSymbolPaths } from "../../kit/unitSymbols";

interface SymbolPaths {
  frame: Path2D;
  strokes: Path2D[];
  fills: Path2D[];
  letter?: string;
}

const cache = new Map<UnitType, SymbolPaths>();

function pathsFor(type: UnitType): SymbolPaths {
  let entry = cache.get(type);
  if (!entry) {
    const data = unitSymbolPaths(type);
    // strokes[0] is always the frame (x 1, y 1, w 22, h 14 in a 24x16 box)
    entry = {
      frame: new Path2D(data.strokes[0]),
      strokes: data.strokes.slice(1).map((d) => new Path2D(d)),
      fills: data.fills.map((d) => new Path2D(d)),
      letter: data.letter
    };
    cache.set(type, entry);
  }
  return entry;
}

/**
 * The NATO-style unit symbol (the same shapes as kit/UnitSymbol) at (x, y), `width` px wide, in `color`.
 * `frame: false` leaves out the outer box, for counters that draw their own. The bomber's "B" is dropped
 * under 14 px wide.
 */
export function drawUnitSymbol(
  ctx: CanvasRenderingContext2D,
  type: UnitType,
  x: number,
  y: number,
  width: number,
  color: string,
  options: { frame?: boolean } = {}
): void {
  const entry = pathsFor(type);
  const scale = width / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.frame) ctx.stroke(entry.frame);
  for (const path of entry.strokes) ctx.stroke(path);
  for (const path of entry.fills) ctx.fill(path);
  if (entry.letter && width >= 14) {
    ctx.font = '600 6px Oswald, "Arial Narrow", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.letter, 20, 6);
  }
  ctx.restore();
}
