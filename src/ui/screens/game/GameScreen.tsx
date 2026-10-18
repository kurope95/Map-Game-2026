import { useMemo } from "react";
import { MapView } from "../../map/MapView";
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
import { useStableCallback } from "../../session/useStableCallback";
import { DefeatNotice } from "../../windows/DefeatNotice";
import { DiplomacyWindow } from "../../windows/diplomacy/DiplomacyWindow";
import { DoctrineWindow } from "../../windows/DoctrineWindow";
import { FacilityPopup } from "../../windows/FacilityPopup";
import { GlobalUnitsPanel } from "../../windows/GlobalUnitsPanel";
import { StockpilePopup } from "../../windows/StockpilePopup";
import { TurnReportWindow } from "../../windows/turnReport/TurnReportWindow";
import { UnitDrawer } from "../../windows/UnitDrawer";
import { VictoryOverlay } from "../../windows/VictoryOverlay";

export function GameScreen() {
  const {
    gameState,
    selectedRegionId,
    selectedUnitIds,
    handleSelectRegion,
    handleSelectUnitFromMap,
    validTargets,
    showSupplyOverlay,
    logicMapOpen,
    setLogicMapOpen,
  } = useGame();

  // The map is memoized: id lists and callbacks keep their identity unless their content changes.
  const attackTargets = useMemo(
    () => [...validTargets.attacks, ...validTargets.airTargets, ...validTargets.bombardTargets, ...validTargets.missileTargets],
    [validTargets]
  );
  const unitIds = useMemo(() => [...selectedUnitIds], [selectedUnitIds]);
  const onSelectRegion = useStableCallback(handleSelectRegion);
  const onSelectUnit = useStableCallback(handleSelectUnitFromMap);

  return (
    <div className="game-shell">
      <TopBar />

      <DiplomacyWindow />

      {/* GLOBAL UNITS DROPDOWN */}
      <GlobalUnitsPanel />

      {/* MAP */}
      <div className="map-stage" data-layout="map-stage">
        <MapView
          state={gameState}
          selectedRegionId={selectedRegionId}
          selectedUnitIds={unitIds}
          onSelectRegion={onSelectRegion}
          onSelectUnit={onSelectUnit}
          validMoveTargets={validTargets.moves}
          validAttackTargets={attackTargets}
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
