import type { UnitType } from "../../game/state/types";

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: "Infantry",
  armor: "Armor",
  mlrs: "MLRS",
  fighter: "Fighter",
  bomber: "Bomber",
  tacticalMissile: "Tactical missile",
  strategicMissile: "Strategic missile"
};

const FRAME = "M1 1 H23 V15 H1 Z";

const FIGHTER_PATH =
  "M12 2 L13.5 7 L21 9 L13.5 10 L13 13 L15 14 L9 14 L11 13 L10.5 10 L3 9 L10.5 7 Z";
const BOMBER_PATH =
  "M12 2 L13.5 7 L22 9 L13.5 10 L13 13 L15 14 L9 14 L11 13 L10.5 10 L2 9 L10.5 7 Z";

export interface UnitSymbolPaths {
  frame: true;
  strokes: string[];
  fills: string[];
  letter?: string;
}

export function unitSymbolPaths(type: UnitType): UnitSymbolPaths {
  switch (type) {
    case "infantry":
      return { frame: true, strokes: [FRAME, "M1 1 L23 15", "M23 1 L1 15"], fills: [] };
    case "armor":
      return {
        frame: true,
        strokes: [FRAME, "M5 8 A7 3.8 0 1 0 19 8 A7 3.8 0 1 0 5 8 Z"],
        fills: []
      };
    case "mlrs":
      return {
        frame: true,
        strokes: [FRAME, "M6 12 L17 4"],
        fills: ["M10.2 9 A1.8 1.8 0 1 0 13.8 9 A1.8 1.8 0 1 0 10.2 9 Z"]
      };
    case "fighter":
      return { frame: true, strokes: [FRAME], fills: [FIGHTER_PATH] };
    case "bomber":
      return { frame: true, strokes: [FRAME], fills: [BOMBER_PATH], letter: "B" };
    case "tacticalMissile":
      return {
        frame: true,
        strokes: [FRAME, "M5 13 L19 3 M17.4 5.9 L19 3 L15.8 3.6"],
        fills: []
      };
    case "strategicMissile":
      return {
        frame: true,
        strokes: [
          FRAME,
          "M5 13 L19 3 M17.4 5.9 L19 3 L15.8 3.6",
          "M5 10 L19 0 M17.4 2.9 L19 0 L15.8 0.6"
        ],
        fills: []
      };
  }
}
