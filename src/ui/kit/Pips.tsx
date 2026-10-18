import "./kit.css";

export function Pips({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <span className="pips" aria-label={`${count} of ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`pips__pip${index < count ? " pips__pip--on" : ""}`} />
      ))}
    </span>
  );
}
