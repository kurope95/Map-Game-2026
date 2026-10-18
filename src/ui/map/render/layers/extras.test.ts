import { describe, expect, it } from "vitest";
import {
  DEPOSIT_CODES,
  DEPOT_COLORS,
  DEPOT_REGION_ID,
  depositChipBoxes,
  depotBadgeBox,
  readableTextColor
} from "./extras";

describe("deposit chips (spec 11.4 layer 15)", () => {
  it("uses one-letter codes, Ch for chemicals", () => {
    expect(DEPOSIT_CODES).toEqual({ oil: "O", coal: "C", iron: "I", tungsten: "T", food: "F", chemicals: "Ch" });
  });

  it("lays 14x14 chips in a centered row 16 px above the marker, 2 px apart", () => {
    const boxes = depositChipBoxes({ x: 100, y: 200 }, 3);
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box.width).toBe(14);
      expect(box.height).toBe(14);
      expect(box.y + box.height).toBe(200 - 16);
    }
    expect(boxes.map((box) => box.x)).toEqual([77, 93, 109]);
  });

  it("centers a single chip on the city", () => {
    const [box] = depositChipBoxes({ x: 50, y: 80 }, 1);
    expect(box.x + box.width / 2).toBe(50);
  });
});

describe("depot badge", () => {
  it("is the Pridnestrovie region with the three status colors of the old map", () => {
    expect(DEPOT_REGION_ID).toBe("chisinau-pridnestrovie");
    expect(DEPOT_COLORS).toEqual({
      claimed: "rgba(96, 198, 124, 0.9)",
      claimable: "rgba(232, 198, 88, 0.92)",
      locked: "rgba(154, 168, 184, 0.86)"
    });
  });

  it("sits above the city, and above the deposit chips when they are shown", () => {
    const city = { x: 300, y: 300 };
    const plain = depotBadgeBox(city, 36, false);
    const withChips = depotBadgeBox(city, 36, true);
    const chipTop = depositChipBoxes(city, 1)[0].y;
    expect(plain.y + plain.height).toBeLessThanOrEqual(300 - 8);
    expect(withChips.y + withChips.height).toBeLessThanOrEqual(chipTop);
    expect(withChips.y).toBeLessThan(plain.y);
    expect(plain.x + plain.width / 2).toBeCloseTo(300, 5);
  });
});

describe("readableTextColor", () => {
  it("picks dark text on light chips and white text on dark ones", () => {
    expect(readableTextColor("#9aa7b0")).toBe("#10161c"); // iron
    expect(readableTextColor("#8fbf5a")).toBe("#10161c"); // food
    expect(readableTextColor("#6b6f75")).toBe("#ffffff"); // coal
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#10161c");
  });
});
