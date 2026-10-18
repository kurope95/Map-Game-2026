import { useGame } from "../session/GameProvider";
import "./windows.css";

export function DefeatNotice() {
  const { latestDefeatAnnouncement, dismissedDefeatAnnouncement, setDismissedDefeatAnnouncement } = useGame();

  if (!latestDefeatAnnouncement || dismissedDefeatAnnouncement === latestDefeatAnnouncement) return null;

  return (
    <div className="defeat-notice-overlay">
      <div className="defeat-notice" data-layout="defeat-notice">
        <div className="defeat-notice__header">
          COUNTRY DEFEATED
        </div>
        <div className="defeat-notice__body">
          <div className="defeat-notice__title">
            Strategic collapse confirmed
          </div>
          <div className="defeat-notice__message">
            {latestDefeatAnnouncement}
          </div>
        </div>
        <div className="defeat-notice__footer">
          <button className="top-bar__btn top-bar__btn--primary" onClick={() => setDismissedDefeatAnnouncement(latestDefeatAnnouncement)}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
