import { describe, expect, it } from "vitest";
import { createInitialState } from "../../../../game/state/createInitialState";
import type { Point } from "../../geometry/types";
import { cityLabelCandidates, nationLabelSize, selectNationLabels } from "./labels";

describe("nationLabelSize (spec 11.4 layer 16)", () => {
  it("is 6 + 2.2·ln(area), clamped to 14-26 px", () => {
    expect(nationLabelSize(309)).toBeCloseTo(6 + 2.2 * Math.log(309), 8);
    expect(nationLabelSize(5)).toBe(14);
    expect(nationLabelSize(1)).toBe(14);
    expect(nationLabelSize(43714)).toBe(26);
  });

  it("grows with the area", () => {
    expect(nationLabelSize(500)).toBeGreaterThan(nationLabelSize(100));
  });

  it("copes with a zero or negative area", () => {
    expect(nationLabelSize(0)).toBe(14);
    expect(nationLabelSize(-4)).toBe(14);
  });
});

describe("selectNationLabels", () => {
  const item = (countryId: string, x: number, area: number, width = 100) => ({ countryId, text: countryId, x, y: 50, width, height: 20, area });

  it("keeps non-overlapping labels in order of area", () => {
    const kept = selectNationLabels([item("A", 0, 10), item("B", 300, 500)]);
    expect(kept.map((label) => label.countryId)).toEqual(["B", "A"]);
  });

  it("drops the smaller of two overlapping labels", () => {
    const kept = selectNationLabels([item("small", 40, 10), item("big", 0, 900), item("far", 400, 5)]);
    expect(kept.map((label) => label.countryId)).toEqual(["big", "far"]);
  });
});

describe("cityLabelCandidates (level of detail, spec 11.5)", () => {
  const state = createInitialState("RUSSIA");
  const viewport = { width: 1600, height: 1200 };
  // one distinct on-screen spot per region
  const cities = new Map<string, Point>(Object.keys(state.regions).map((id, index) => [id, [60 + (index % 20) * 70, 80 + Math.floor(index / 20) * 120] as Point]));
  const measure = (text: string) => text.length * 6;
  const build = (z: number, selectedRegionId: string | null = null, linked: string[] = []) =>
    cityLabelCandidates({ state, cities, viewport, z, selectedRegionId, linkedIds: new Set(linked), measure });

  const capitals = Object.values(state.regions).filter((region) => region.isCapital).map((region) => region.id);
  const keyCities = Object.values(state.regions).filter((region) => region.isKeyCity && !region.isCapital).map((region) => region.id);
  const others = Object.values(state.regions).filter((region) => !region.isKeyCity && !region.isCapital).map((region) => region.id);

  it("shows only capitals below z 1.3", () => {
    const ids = build(0.8).map((candidate) => candidate.id);
    expect(ids.sort()).toEqual([...capitals].sort());
  });

  it("adds key cities from z 1.3 and every city from z 2.2", () => {
    const mid = build(1.5).map((candidate) => candidate.id);
    expect(mid).toEqual(expect.arrayContaining([...capitals, ...keyCities]));
    expect(mid).not.toContain(others[0]);
    expect(build(2.5)).toHaveLength(Object.keys(state.regions).length);
  });

  it("always labels the selection (priority 1) and its links (forced, priority 2) even at low zoom", () => {
    const selected = others[0];
    const linked = state.regions[selected].adjacentRegionIds.filter((id) => !capitals.includes(id)).slice(0, 2);
    const candidates = build(0.8, selected, linked);
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    expect(byId.get(selected)).toMatchObject({ priority: 1, forced: true });
    for (const id of linked) expect(byId.get(id)).toMatchObject({ priority: 2, forced: true });
    expect(byId.get(capitals[0])).toMatchObject({ priority: 3, forced: false });
  });

  it("gives key cities priority 4 and other cities priority 5", () => {
    const byId = new Map(build(3).map((candidate) => [candidate.id, candidate]));
    expect(byId.get(keyCities[0])?.priority).toBe(4);
    expect(byId.get(others[0])?.priority).toBe(5);
  });

  it("sizes each candidate from the measured text and leaves room for the marker", () => {
    const candidate = build(0.8).find((entry) => entry.id === capitals[0])!;
    expect(candidate.width).toBeGreaterThanOrEqual(measure(candidate.text));
    expect(candidate.height).toBe(14);
    expect(candidate.markerRadius).toBeGreaterThan(0);
  });

  it("skips cities far outside the screen", () => {
    const far = new Map(cities);
    far.set(capitals[0], [-900, 50]);
    const ids = cityLabelCandidates({ state, cities: far, viewport, z: 1, selectedRegionId: null, linkedIds: new Set(), measure }).map((candidate) => candidate.id);
    expect(ids).not.toContain(capitals[0]);
  });
});
