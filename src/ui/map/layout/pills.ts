import type { Viewport } from "../camera";
import type { Point } from "../geometry/types";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Default insets keep pills clear of the top bar (48 px) and the bottom tab bar (46 px). */
export const MAP_INSETS: Insets = { top: 48, right: 12, bottom: 46, left: 12 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Where an off-screen link line leaves the visible map area, and the line's angle. The segment is
 * clipped to the inset rect with Liang-Barsky; the anchor sits on the rect edge facing the target.
 * A target already inside the rect needs no pill (null).
 */
export function edgePillAnchor(
  from: Point,
  to: Point,
  viewport: Viewport,
  insets: Insets
): { x: number; y: number; angle: number } | null {
  const minX = insets.left;
  const maxX = viewport.width - insets.right;
  const minY = insets.top;
  const maxY = viewport.height - insets.bottom;

  const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  if (inside(to[0], to[1])) return null;

  let startX = from[0];
  let startY = from[1];
  if (!inside(startX, startY)) {
    startX = viewport.width / 2;
    startY = viewport.height / 2;
  }

  const dx = to[0] - startX;
  const dy = to[1] - startY;
  const p = [-dx, dx, -dy, dy];
  const q = [startX - minX, maxX - startX, startY - minY, maxY - startY];

  let enter = 0;
  let exit = 1;
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > enter) enter = t;
    } else if (t < exit) {
      exit = t;
    }
    if (enter > exit) return null;
  }

  return {
    x: clamp(startX + exit * dx, minX, maxX),
    y: clamp(startY + exit * dy, minY, maxY),
    angle: Math.atan2(dy, dx)
  };
}
