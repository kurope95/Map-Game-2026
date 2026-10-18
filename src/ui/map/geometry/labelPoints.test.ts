import { describe, expect, it } from "vitest";
import { interiorPoint } from "./labelPoints";
import { pointInPolygon, type Polygon, type Ring } from "./polygon";

function circle(cx: number, cy: number, radius: number, vertices: number): Ring {
  const ring: Ring = [];
  for (let i = 0; i < vertices; i += 1) {
    const angle = (i / vertices) * Math.PI * 2;
    ring.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  ring.push(ring[0]);
  return ring;
}

describe("interiorPoint", () => {
  it("picks a point near the middle of a square", () => {
    const square: Polygon = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
    const [x, y] = interiorPoint([square]);
    expect(Math.hypot(x - 5, y - 5)).toBeLessThan(1.5);
  });

  it("stays inside an L shape and avoids its notch", () => {
    const ell: Polygon = [[[0, 0], [10, 0], [10, 3], [3, 3], [3, 10], [0, 10], [0, 0]]];
    const point = interiorPoint([ell]);
    expect(pointInPolygon(point[0], point[1], ell)).toBe(true);
  });

  it("finds the middle of a very detailed circle and stays inside it", () => {
    const detailed: Polygon = [circle(40, 60, 20, 6000)];
    const point = interiorPoint([detailed]);
    expect(pointInPolygon(point[0], point[1], detailed)).toBe(true);
    expect(Math.hypot(point[0] - 40, point[1] - 60)).toBeLessThan(4);
  });

  it("uses the largest part of a multipolygon and the fallback for an empty one", () => {
    const small: Polygon = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
    const big: Polygon = [[[100, 100], [140, 100], [140, 140], [100, 140], [100, 100]]];
    const [x, y] = interiorPoint([small, big]);
    expect(x).toBeGreaterThan(100);
    expect(y).toBeGreaterThan(100);
    expect(interiorPoint([], 24, [7, 8])).toEqual([7, 8]);
  });
});
