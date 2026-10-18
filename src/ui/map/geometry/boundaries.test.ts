import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../game/state/createInitialState";
import { getStartingControllers } from "../startingControllers";
import { buildMapGeometry } from "./buildMapGeometry";
import { pointInMultiPolygon } from "./polygon";

const state = createInitialState("RUSSIA");
const startingControllers = getStartingControllers(state);
const geometry = buildMapGeometry(state.regions, startingControllers);

describe("buildBoundaryEdges", () => {
  it("collects symmetric neighbors", () => {
    for (const [a, set] of geometry.neighbors) {
      for (const b of set) {
        expect(geometry.neighbors.get(b), `${a} -> ${b}`).toBeDefined();
        expect(geometry.neighbors.get(b)!.has(a), `${b} -> ${a}`).toBe(true);
      }
    }
  });

  it("gives every region a neighbor or a coast edge", () => {
    for (const id of geometry.regions.keys()) {
      const hasNeighbor = (geometry.neighbors.get(id)?.size ?? 0) > 0;
      const hasCoast = geometry.edges.some(
        (edge) => edge.kind === "coast" && (edge.a === id || edge.b === id)
      );
      expect(hasNeighbor || hasCoast, id).toBe(true);
    }
  });

  it("makes Pridnestrovie adjacent to Chisinau", () => {
    expect(geometry.neighbors.get("chisinau-pridnestrovie")?.has("chisinau")).toBe(true);
  });

  it("tags Gdansk's sea border as coast", () => {
    expect(
      geometry.edges.some(
        (edge) => edge.kind === "coast" && (edge.a === "gdansk" || edge.b === "gdansk")
      )
    ).toBe(true);
  });

  it("keeps at least two points per edge", () => {
    for (const edge of geometry.edges) {
      expect(edge.points.length, `${edge.a}-${edge.b ?? edge.kind}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("colors neighboring regions of the same controller differently", () => {
    for (const [a, set] of geometry.neighbors) {
      for (const b of set) {
        if (startingControllers[a] === startingControllers[b]) {
          expect(geometry.shadeVariant.get(a), `${a}/${b}`).not.toBe(geometry.shadeVariant.get(b));
        }
      }
    }
  });

  it("puts a nation label inside one of each nation's starting regions", () => {
    expect(geometry.nationLabels.size).toBe(24);
    for (const [countryId, label] of geometry.nationLabels) {
      const inside = [...geometry.regions.values()].some(
        (region) =>
          startingControllers[region.id] === countryId &&
          pointInMultiPolygon(label.point[0], label.point[1], region.polygon)
      );
      expect(inside, countryId).toBe(true);
    }
  });
});
