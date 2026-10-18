import { describe, expect, it } from "vitest";
import {
  distanceToSegment,
  multiPolygonArea,
  nestRings,
  pointInPolygon,
  type MultiPolygon,
  type Ring
} from "./polygon";

const outer: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole: Ring = [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]];
const withHole: MultiPolygon = nestRings([outer, hole]);

describe("pointInPolygon", () => {
  it("accepts a point in the exterior", () => {
    expect(pointInPolygon(1, 1, withHole[0])).toBe(true);
  });

  it("rejects a point inside a hole", () => {
    expect(pointInPolygon(5, 5, withHole[0])).toBe(false);
  });
});

describe("multiPolygonArea", () => {
  it("subtracts the hole from the exterior", () => {
    expect(multiPolygonArea(withHole)).toBe(96);
  });
});

describe("nestRings", () => {
  it("attaches the hole to its containing exterior", () => {
    expect(withHole).toHaveLength(1);
    expect(withHole[0]).toHaveLength(2);
  });
});

describe("distanceToSegment", () => {
  it("returns the perpendicular distance", () => {
    expect(distanceToSegment(0, 5, [0, 0], [10, 0])).toBe(5);
  });
});
