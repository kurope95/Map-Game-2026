import { useCallback, useState } from "react";
import type { GameToast } from "../../game/state/types";

export type AddToast = (message: string, type?: GameToast["type"]) => void;

export function useToasts(getTurn: () => number) {
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const addToast = useCallback<AddToast>(
    (message, type = "info") => {
      const toast: GameToast = {
        id: `t${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        message,
        type,
        turn: getTurn(),
      };
      setToasts((prev) => [...prev.slice(-4), toast]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4000);
    },
    [getTurn]
  );
  return { toasts, setToasts, addToast };
}
