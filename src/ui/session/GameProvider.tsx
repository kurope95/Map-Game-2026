import { createContext, useContext, type ReactNode } from "react";
import { useGameController } from "./useGameController";

export type GameContextValue = ReturnType<typeof useGameController>;

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const value = useGameController();
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
