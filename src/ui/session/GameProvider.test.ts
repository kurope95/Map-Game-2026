import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameProvider, useGame } from "./GameProvider";

function Probe() {
  const game = useGame();
  return createElement("span", null, `${game.playerCountryId}:${String(game.gameStarted)}:turn ${game.gameState.turn}`);
}

describe("GameProvider and useGame", () => {
  it("throws when useGame is used outside a provider", () => {
    const originalError = console.error;
    console.error = () => {}; // React logs the thrown render error as well
    try {
      expect(() => renderToString(createElement(Probe))).toThrow("useGame must be used inside GameProvider");
    } finally {
      console.error = originalError;
    }
  });

  it("gives its children the game controller (Russia, not started, turn 1)", () => {
    const html = renderToString(createElement(GameProvider, null, createElement(Probe)));
    expect(html).toContain("RUSSIA:false:turn 1");
  });
});
