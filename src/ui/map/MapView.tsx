import { memo, useEffect, useRef } from "react";
import type { CountryId, GameState } from "../../game/state/types";
import { BUTTON_ZOOM, MapController } from "./MapController";
import { recordRender } from "./perf/frameStats";
import "./MapView.css";

export interface MapViewProps {
  state: GameState;
  selectedRegionId: string | null;
  /** Highlights the selected counters. */
  selectedUnitIds?: string[];
  validMoveTargets?: string[];
  /** Attacks, air support, bombard and missile targets, as today. */
  validAttackTargets?: string[];
  showSupplyOverlay?: boolean;
  onSelectRegion?: (regionId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  /** showcase: no interaction, no counters or arrows. */
  mode?: "game" | "showcase";
  /** showcase: outline this nation's starting regions and dim the others. */
  highlightCountryId?: CountryId;
}

function MapViewComponent(props: MapViewProps) {
  recordRender();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const perfRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const controller = new MapController({ canvas: canvasRef.current!, tooltip: tooltipRef.current!, perf: perfRef.current! });
    controllerRef.current = controller;
    controller.setProps(propsRef.current);
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  // Runs after every render, which only happens when a prop changed (pan and zoom never render React).
  useEffect(() => {
    controllerRef.current?.setProps(props);
  });

  return (
    <div className="map-view" data-layout="map-view">
      <canvas ref={canvasRef} className="map-view__canvas" data-layout="map-canvas" />
      <div ref={tooltipRef} className="map-tooltip" />
      <div ref={perfRef} className="map-perf" />
      {props.mode !== "showcase" && (
        <div className="map-controls" data-layout="map-controls">
          <button className="map-control-button" data-layout-key="zoomin" onClick={() => controllerRef.current?.zoomBy(BUTTON_ZOOM)}>+</button>
          <button className="map-control-button" data-layout-key="zoomout" onClick={() => controllerRef.current?.zoomBy(1 / BUTTON_ZOOM)}>−</button>
          <button className="map-control-button map-control-button--reset" data-layout-key="reset" onClick={() => controllerRef.current?.resetView()}>Reset</button>
        </div>
      )}
    </div>
  );
}

export const MapView = memo(MapViewComponent);
