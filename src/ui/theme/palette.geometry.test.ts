import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import { buildMapGeometry } from "../map/geometry/buildMapGeometry";
import { getStartingControllers } from "../map/startingControllers";
import { NATION_COLORS, rgbDistance } from "./palette";

const state = createInitialState("RUSSIA");
const startingControllers = getStartingControllers(state);
const geometry = buildMapGeometry(state.regions, startingControllers);

describe("geometry palette", () => {
  it("keeps every geometrically adjacent pair of controllers distinct", () => {
    const checked = new Set<string>();
    for (const edge of geometry.edges) {
      if (edge.b === null || (edge.kind !== "internal" && edge.kind !== "national")) continue;
      const a = startingControllers[edge.a];
      const b = startingControllers[edge.b];
      if (!a || !b || a === b) continue;
      const key = [a, b].sort().join("-");
      if (checked.has(key)) continue;
      checked.add(key);
      expect(rgbDistance(NATION_COLORS[a], NATION_COLORS[b]), key).toBeGreaterThanOrEqual(40);
    }
  });
});
