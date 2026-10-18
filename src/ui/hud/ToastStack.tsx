import "./ToastStack.css";
import { CheckCircle2, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { GameToast } from "../../game/state/types";
import { useGame } from "../session/GameProvider";

const TOAST_ICONS: Record<GameToast["type"], LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

export function ToastStack() {
  const { toasts } = useGame();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type];
        return (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <Icon className="toast__icon" size={15} aria-hidden="true" />
            <span className="toast__message">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
