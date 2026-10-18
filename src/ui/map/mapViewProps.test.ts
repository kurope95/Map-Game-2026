import { describe, expect, it } from "vitest";
import { createInitialState } from "../../game/state/createInitialState";
import { mapViewPropsEqual } from "./mapViewProps";
import type { MapViewProps } from "./MapView";

const state = createInitialState("RUSSIA");
const onSelectRegion = () => {};
const onSelectUnit = () => {};
const base = (): MapViewProps => ({
  state,
  selectedRegionId: "moscow",
  selectedUnitIds: ["ru-inf-2"],
  validMoveTargets: ["smolensk"],
  validAttackTargets: ["lublin", "brest"],
  showSupplyOverlay: false,
  onSelectRegion,
  onSelectUnit
});

describe("mapViewPropsEqual", () => {
  it("treats freshly built arrays with the same content as equal", () => {
    expect(mapViewPropsEqual(base(), base())).toBe(true);
  });

  it("is false when the game state object changes", () => {
    expect(mapViewPropsEqual(base(), { ...base(), state: { ...state } })).toBe(false);
  });

  it("is false when the selection, the overlay, the mode or the highlighted nation changes", () => {
    expect(mapViewPropsEqual(base(), { ...base(), selectedRegionId: "lublin" })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), showSupplyOverlay: true })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), mode: "showcase" })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), highlightCountryId: "POLAND" })).toBe(false);
  });

  it("is false when an id list changes in content, order or length", () => {
    expect(mapViewPropsEqual(base(), { ...base(), selectedUnitIds: ["ru-ftr-1"] })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), validMoveTargets: [] })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), validAttackTargets: ["brest", "lublin"] })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), validAttackTargets: ["lublin"] })).toBe(false);
  });

  it("treats a missing list and an empty list as the same", () => {
    expect(mapViewPropsEqual({ ...base(), selectedUnitIds: undefined }, { ...base(), selectedUnitIds: [] })).toBe(true);
  });

  it("is false when a callback changes, because the controller calls the latest ones", () => {
    expect(mapViewPropsEqual(base(), { ...base(), onSelectRegion: () => {} })).toBe(false);
    expect(mapViewPropsEqual(base(), { ...base(), onSelectUnit: () => {} })).toBe(false);
  });
});
