import { KitGallery } from "../ui/dev/KitGallery";
import { GameScreen } from "../ui/screens/game/GameScreen";
import { StartScreen } from "../ui/screens/start/StartScreen";
import { GameProvider, useGame } from "../ui/session/GameProvider";
import { SaveLoadWindow } from "../ui/windows/SaveLoadWindow";

function AppScreens() {
  const { gameStarted } = useGame();
  return (
    <>
      {gameStarted ? <GameScreen /> : <StartScreen />}
      <SaveLoadWindow />
    </>
  );
}

export function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("kit")) {
    return <KitGallery />;
  }
  return (
    <GameProvider>
      <AppScreens />
    </GameProvider>
  );
}
