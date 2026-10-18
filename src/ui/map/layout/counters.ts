import type { UnitStackInfo } from "../derive";
import type { Point } from "../geometry/types";
import type { Box } from "./labels";

export interface CounterBox extends Box {
  kind: "unit" | "stack";
  regionId: string;
  unitIds: string[];
}

const BASE_WIDTH = 30;
const BASE_HEIGHT = 18;
/** Vertical gap under the city marker. */
const TOP_OFFSET = 7;
/** Gap between expanded unit boxes. */
const GAP = 2;
const ROW_SIZE = 4;

export function counterSize(z: number): { width: number; height: number } {
  const factor = Math.max(0.85, Math.min(1.35, Math.sqrt(Math.max(z, 0))));
  return { width: BASE_WIDTH * factor, height: BASE_HEIGHT * factor };
}

/**
 * Counter boxes in CSS pixels. Unexpanded regions get one box (unit or stack); the expanded region
 * shows every unit in rows of four, growing downward from the city.
 */
export function layoutCounters(
  stacks: Map<string, UnitStackInfo>,
  cityScreen: Map<string, Point>,
  z: number,
  expandedRegionId: string | null
): CounterBox[] {
  const { width, height } = counterSize(z);
  const boxes: CounterBox[] = [];

  for (const stack of stacks.values()) {
    const city = cityScreen.get(stack.regionId);
    if (!city) continue;

    if (stack.regionId !== expandedRegionId) {
      boxes.push({
        kind: stack.unitIds.length === 1 ? "unit" : "stack",
        regionId: stack.regionId,
        unitIds: [...stack.unitIds],
        x: city[0] - width / 2,
        y: city[1] + TOP_OFFSET,
        width,
        height
      });
      continue;
    }

    for (let start = 0; start < stack.unitIds.length; start += ROW_SIZE) {
      const rowIds = stack.unitIds.slice(start, start + ROW_SIZE);
      const rowWidth = rowIds.length * width + (rowIds.length - 1) * GAP;
      const startX = city[0] - rowWidth / 2;
      const row = start / ROW_SIZE;
      rowIds.forEach((unitId, index) => {
        boxes.push({
          kind: "unit",
          regionId: stack.regionId,
          unitIds: [unitId],
          x: startX + index * (width + GAP),
          y: city[1] + TOP_OFFSET + row * (height + GAP),
          width,
          height
        });
      });
    }
  }
  return boxes;
}
