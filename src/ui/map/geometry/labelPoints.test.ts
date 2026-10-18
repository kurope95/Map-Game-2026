import { describe, expect, it } from "vitest";
import type { CountryId } from "../../../game/state/types";
import { computeNationLabelPoints, interiorPoint } from "./labelPoints";
import { bboxOf, multiPolygonArea, pointInPolygon, type Point, type Polygon, type Ring } from "./polygon";
import type { RegionShape } from "./regionShapes";

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

describe("computeNationLabelPoints with a view box", () => {
  const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  const shape = (id: string, polygon: Polygon, point: Point): RegionShape => ({
    id,
    clipNumericId: 0,
    polygon: [polygon],
    bbox: bboxOf([polygon]),
    point,
    area: multiPolygonArea([polygon]),
    usedFallback: false
  });
  const russia = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, "RUSSIA" as CountryId]));
  const view: [number, number, number, number] = [0, 0, 100, 100];

  it("leaves a nation that lies inside the view exactly as it was", () => {
    const regions = new Map([["a", shape("a", rect(10, 10, 60, 60), [30, 30])]]);
    const plain = computeNationLabelPoints(regions, russia(["a"])).get("RUSSIA")!;
    const withView = computeNationLabelPoints(regions, russia(["a"]), view).get("RUSSIA")!;
    expect(withView).toEqual(plain);
  });

  it("anchors a huge region inside the view instead of deep outside it, and keeps its full area for the font size", () => {
    const regions = new Map([["big", shape("big", rect(0, 0, 1000, 1000), [50, 50])]]);
    const plain = computeNationLabelPoints(regions, russia(["big"])).get("RUSSIA")!;
    expect(plain.point[0]).toBeGreaterThan(300);
    const clipped = computeNationLabelPoints(regions, russia(["big"]), view).get("RUSSIA")!;
    expect(clipped.point[0]).toBeGreaterThan(0);
    expect(clipped.point[0]).toBeLessThan(100);
    expect(clipped.area).toBe(plain.area);
  });

  it("picks the region with the largest visible part, not the largest overall", () => {
    const regions = new Map([
      ["far", shape("far", rect(60, 0, 1060, 1000), [80, 50])],
      ["near", shape("near", rect(0, 0, 60, 100), [30, 50])]
    ]);
    const plain = computeNationLabelPoints(regions, russia(["far", "near"])).get("RUSSIA")!;
    expect(plain.point[0]).toBeGreaterThan(60);
    const clipped = computeNationLabelPoints(regions, russia(["far", "near"]), view).get("RUSSIA")!;
    expect(clipped.point[0]).toBeLessThan(60);
  });
});
