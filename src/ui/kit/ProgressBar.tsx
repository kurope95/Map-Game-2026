import "./kit.css";

export function ProgressBar({
  value,
  tone = "gold"
}: {
  value: number;
  tone?: "good" | "warn" | "bad" | "gold";
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span
      className={`progress-bar progress-bar--${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <span className="progress-bar__fill" style={{ width: `${clamped * 100}%` }} />
    </span>
  );
}
