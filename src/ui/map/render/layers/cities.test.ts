import { describe, expect, it } from "vitest";
import { markerRadius } from "./cities";

describe("markerRadius (spec 11.4 layer 12)", () => {
  it("makes capitals 5.5 px, or 4.5 px below z 1", () => {
    expect(markerRadius(true, false, 1)).toBe(5.5);
    expect(markerRadius(true, true, 3)).toBe(5.5);
    expect(markerRadius(true, false, 0.99)).toBe(4.5);
  });

  it("makes key cities 3.2 px and other cities 2.4 px", () => {
    expect(markerRadius(false, true, 1)).toBe(3.2);
    expect(markerRadius(false, false, 1)).toBe(2.4);
  });
});
