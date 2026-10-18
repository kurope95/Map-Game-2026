import { describe, expect, it } from "vitest";
import {
  cityLabelVisible,
  depositChipsVisible,
  depotBadgeVisible,
  linkNetworkAlpha,
  lodFade,
  nationLabelFade
} from "./lod";

describe("lodFade", () => {
  it("is 1 up to the full threshold, 0 from the gone threshold and linear between", () => {
    expect(lodFade(0.6, 1.3, 1.6)).toBe(1);
    expect(lodFade(1.3, 1.3, 1.6)).toBe(1);
    expect(lodFade(1.45, 1.3, 1.6)).toBeCloseTo(0.5, 10);
    expect(lodFade(1.6, 1.3, 1.6)).toBe(0);
    expect(lodFade(9, 1.3, 1.6)).toBe(0);
  });
});

describe("level-of-detail table (spec 11.5)", () => {
  it("draws the link network at alpha .16 up to z 1.3, fading to nothing at z 1.6", () => {
    expect(linkNetworkAlpha(0.6)).toBeCloseTo(0.16, 10);
    expect(linkNetworkAlpha(1.3)).toBeCloseTo(0.16, 10);
    expect(linkNetworkAlpha(1.45)).toBeCloseTo(0.08, 10);
    expect(linkNetworkAlpha(1.6)).toBe(0);
    expect(linkNetworkAlpha(3)).toBe(0);
  });

  it("fades the nation names over the same range", () => {
    expect(nationLabelFade(1)).toBe(1);
    expect(nationLabelFade(1.45)).toBeCloseTo(0.5, 10);
    expect(nationLabelFade(1.6)).toBe(0);
  });

  it("shows capitals always, key cities from z 1.3 and all other cities from z 2.2", () => {
    expect(cityLabelVisible(0.6, "capital")).toBe(true);
    expect(cityLabelVisible(0.6, "key")).toBe(false);
    expect(cityLabelVisible(1.29, "key")).toBe(false);
    expect(cityLabelVisible(1.3, "key")).toBe(true);
    expect(cityLabelVisible(2.19, "other")).toBe(false);
    expect(cityLabelVisible(2.2, "other")).toBe(true);
  });

  it("shows the depot badge from z 1.5 and the deposit chips from z 3.5", () => {
    expect(depotBadgeVisible(1.49)).toBe(false);
    expect(depotBadgeVisible(1.5)).toBe(true);
    expect(depositChipsVisible(3.49)).toBe(false);
    expect(depositChipsVisible(3.5)).toBe(true);
  });
});
