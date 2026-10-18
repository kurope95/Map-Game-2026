import "./ToastStack.css";
import { useGame } from "../session/GameProvider";

export function ToastStack() {
  const { toasts } = useGame();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
