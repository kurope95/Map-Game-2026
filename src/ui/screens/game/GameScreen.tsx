import { TheaterMap } from "../../TheaterMap";
import { EconomyLogicMap } from "../../windows/EconomyLogicMap";
import "./GameScreen.css";
import { BottomBar } from "../../hud/BottomBar";
import { SupplyToggle } from "../../hud/SupplyToggle";
import { ToastStack } from "../../hud/ToastStack";
import { TopBar } from "../../hud/TopBar";
import { AiIntelPanel } from "../../panels/AiIntelPanel";
import { EconomyPanel } from "../../panels/EconomyPanel";
import { EventLogPanel } from "../../panels/EventLogPanel";
import { OrdersPanel } from "../../panels/OrdersPanel";
import { RecruitmentPanel } from "../../panels/RecruitmentPanel";
import { RegionPanel } from "../../panels/RegionPanel";
import { WarStatusPanel } from "../../panels/WarStatusPanel";
import { useGame } from "../../session/GameProvider";
import { DefeatNotice } from "../../windows/DefeatNotice";
import { DiplomacyWindow } from "../../windows/diplomacy/DiplomacyWindow";
import { DoctrineWindow } from "../../windows/DoctrineWindow";
import { FacilityPopup } from "../../windows/FacilityPopup";
import { GlobalUnitsPanel } from "../../windows/GlobalUnitsPanel";
import { SaveLoadWindow } from "../../windows/SaveLoadWindow";
import { StockpilePopup } from "../../windows/StockpilePopup";
import { TurnReportWindow } from "../../windows/turnReport/TurnReportWindow";
import { UnitDrawer } from "../../windows/UnitDrawer";
import { VictoryOverlay } from "../../windows/VictoryOverlay";

export function GameScreen() {
  const {
    gameState,
    selectedRegionId,
    handleSelectRegion,
    handleSelectFacilityFromMap,
    handleSelectUnitFromMap,
    validTargets,
    showSupplyOverlay,
    logicMapOpen,
    setLogicMapOpen,
  } = useGame();

  return (
    <div className="game-shell">
      <TopBar />

      <SaveLoadWindow />

      <DiplomacyWindow />

      {/* GLOBAL UNITS DROPDOWN */}
      <GlobalUnitsPanel />

      {/* MAP */}
      <div className="map-stage" data-layout="map-stage">
        <TheaterMap
          state={gameState}
          selectedRegionId={selectedRegionId}
          onSelectRegion={handleSelectRegion}
          onSelectFacility={handleSelectFacilityFromMap}
          onSelectUnit={handleSelectUnitFromMap}
          validMoveTargets={validTargets.moves}
          validAttackTargets={[...validTargets.attacks, ...validTargets.airTargets, ...validTargets.bombardTargets, ...validTargets.missileTargets]}
          showSupplyOverlay={showSupplyOverlay}
        />

        {/* UNIT DRAWER — floats up from bottom of map */}
        <UnitDrawer />

        {/* STOCKPILE POPUP — floating window over map */}
        <StockpilePopup />

        {/* FACILITY DETAIL POPUP — floating window over map */}
        <FacilityPopup />
      </div>

      {/* FLOATING PANELS — each tab opens its own popup over the map */}
      <RegionPanel />
      <EconomyPanel />
      <RecruitmentPanel />
      <OrdersPanel />
      <AiIntelPanel />
      <WarStatusPanel />
      <EventLogPanel />

      <BottomBar />

      <DefeatNotice />

      <TurnReportWindow />

      <ToastStack />

      <VictoryOverlay />

      {logicMapOpen && (
        <EconomyLogicMap onClose={() => setLogicMapOpen(false)} />
      )}

      <SupplyToggle />

      <DoctrineWindow />
    </div>
  );
}
