import { describe, expect, it } from "vitest";
import { placeLabels, type Box, type LabelCandidate } from "./labels";

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

describe("placeLabels", () => {
  it("never overlaps placed labels", () => {
    const random = seededRandom(42);
    const candidates: LabelCandidate[] = Array.from({ length: 20 }, (_, index) => ({
      id: `label-${index}`,
      text: `Label ${index}`,
      x: 40 + random() * 1120,
      y: 40 + random() * 720,
      width: 50 + random() * 90,
      height: 14 + random() * 4,
      priority: 1 + Math.floor(random() * 5),
      forced: false,
      markerRadius: 4
    }));
    const placed = placeLabels(candidates, []);
    expect(placed.length).toBeGreaterThan(0);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i], placed[j]), `${placed[i].id}/${placed[j].id}`).toBe(false);
      }
    }
  });

  it("still places a forced label when every position is blocked", () => {
    const candidate: LabelCandidate = {
      id: "forced",
      text: "Forced",
      x: 100,
      y: 100,
      width: 40,
      height: 16,
      priority: 1,
      forced: true,
      markerRadius: 5
    };
    const blocker: Box = { x: 50, y: 70, width: 110, height: 60 };
    const placed = placeLabels([candidate], [blocker]);
    expect(placed).toHaveLength(1);
    expect(placed[0].id).toBe("forced");
    expect(["right", "left", "above", "below"]).toContain(placed[0].position);
  });

  it("lets higher priority claim the preferred spot", () => {
    const shared = { x: 100, y: 100, width: 40, height: 16, markerRadius: 5, forced: false };
    const low: LabelCandidate = { ...shared, id: "a", text: "Low", priority: 2 };
    const high: LabelCandidate = { ...shared, id: "b", text: "High", priority: 1 };
    const placed = placeLabels([low, high], []);
    expect(placed).toHaveLength(2);
    expect(placed.find((label) => label.id === "b")!.position).toBe("right");
    expect(placed.find((label) => label.id === "a")!.position).toBe("left");
  });
});
