export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelCandidate {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 1 = highest. */
  priority: number;
  forced: boolean;
  markerRadius: number;
}

export type LabelPosition = "right" | "left" | "above" | "below";

export interface PlacedLabel extends Box {
  id: string;
  text: string;
  position: LabelPosition;
}

const POSITIONS: LabelPosition[] = ["right", "left", "above", "below"];

function positionBox(candidate: LabelCandidate, position: LabelPosition): Box {
  const { x, y, width, height, markerRadius } = candidate;
  switch (position) {
    case "right":
      return { x: x + markerRadius + 4, y: y - height / 2, width, height };
    case "left":
      return { x: x - markerRadius - 4 - width, y: y - height / 2, width, height };
    case "above":
      return { x: x - width / 2, y: y - markerRadius - 3 - height, width, height };
    case "below":
      return { x: x - width / 2, y: y + markerRadius + 3, width, height };
  }
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function totalOverlap(box: Box, placed: Box[], obstacles: Box[]): number {
  let sum = 0;
  for (const other of placed) sum += overlapArea(box, other);
  for (const obstacle of obstacles) sum += overlapArea(box, obstacle);
  return sum;
}

function isFree(box: Box, placed: Box[], obstacles: Box[]): boolean {
  for (const other of placed) {
    if (overlaps(box, other)) return false;
  }
  for (const obstacle of obstacles) {
    if (overlaps(box, obstacle)) return false;
  }
  return true;
}

/**
 * Greedy label placement: forced labels go first (they must appear), then by priority and id.
 * A normal label is dropped rather than overlapped; a forced one takes its least-overlapping spot.
 */
export function placeLabels(candidates: LabelCandidate[], obstacles: Box[]): PlacedLabel[] {
  const ordered = [...candidates].sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const placed: PlacedLabel[] = [];
  const placedBoxes: Box[] = [];
  for (const candidate of ordered) {
    let choice: { box: Box; position: LabelPosition } | null = null;
    for (const position of POSITIONS) {
      const box = positionBox(candidate, position);
      if (isFree(box, placedBoxes, obstacles)) {
        choice = { box, position };
        break;
      }
    }

    if (choice === null) {
      if (!candidate.forced) continue;
      let leastOverlap = Number.POSITIVE_INFINITY;
      for (const position of POSITIONS) {
        const box = positionBox(candidate, position);
        const overlap = totalOverlap(box, placedBoxes, obstacles);
        if (overlap < leastOverlap) {
          leastOverlap = overlap;
          choice = { box, position };
        }
      }
    }

    if (choice === null) continue;
    const label: PlacedLabel = {
      ...choice.box,
      id: candidate.id,
      text: candidate.text,
      position: choice.position
    };
    placed.push(label);
    placedBoxes.push(choice.box);
  }
  return placed;
}
