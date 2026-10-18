import { LandingPage } from "../ui/LandingPage";
import { KitGallery } from "../ui/dev/KitGallery";
import { GameScreen } from "../ui/screens/game/GameScreen";
import { GameProvider, useGame } from "../ui/session/GameProvider";

function AppScreens() {
  const { gameStarted, landingNations, playerCountryId, setPlayerCountryId, handleStartGame } = useGame();
  return gameStarted ? (
    <GameScreen />
  ) : (
    <LandingPage
      nations={landingNations}
      selectedCountryId={playerCountryId}
      onSelectCountry={setPlayerCountryId}
      onStartGame={handleStartGame}
    />
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
