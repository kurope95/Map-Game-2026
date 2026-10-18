import { Button } from "../kit/Button";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";
import "./windows.css";

export function DefeatNotice() {
  const { gameState, latestDefeatAnnouncement, dismissedDefeatAnnouncement, setDismissedDefeatAnnouncement } = useGame();

  if (!latestDefeatAnnouncement || dismissedDefeatAnnouncement === latestDefeatAnnouncement) return null;

  const defeatedCountry = Object.values(gameState.countries).find((country) =>
    latestDefeatAnnouncement.startsWith(`${country.name} has been defeated.`)
  );

  return (
    <Window
      title="Country Defeated"
      flag={defeatedCountry?.id}
      variant="modal"
      className="defeat-notice"
      backdropClassName="defeat-notice-overlay"
      layoutId="defeat-notice"
      footer={
        <Button variant="primary" onClick={() => setDismissedDefeatAnnouncement(latestDefeatAnnouncement)}>
          Continue
        </Button>
      }
    >
      <div className="defeat-notice__title">Strategic collapse confirmed</div>
      <div className="defeat-notice__message">{latestDefeatAnnouncement}</div>
    </Window>
  );
}
