import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Delaunay } from "d3-delaunay";
import { feature, mesh } from "topojson-client";
import { geoGraticule10, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import countries50m from "world-atlas/countries-50m.json";
import { CountryId, GameState, UnitDefinition } from "../game/state/types";
import { europeCountryIds, theaterMapLayout, theaterMapSize } from "../game/content/regionGeo";
import { getPridnestrovieDepotStatus } from "../game/rules/strategicDepot";

interface TheaterMapProps {
  state: GameState;
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
  onSelectFacility?: (regionId: string, facilityId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  validMoveTargets?: string[];
  validAttackTargets?: string[];
  showSupplyOverlay?: boolean;
}

const MIN_SCALE = 0.6;
const MAX_SCALE = 26;
const DRAG_THRESHOLD_PX = 5;

const countryIdByNumericId: Record<number, CountryId> = {
  8: "ALBANIA",
  40: "AUSTRIA",
  70: "BOSNIA_AND_HERZEGOVINA",
  112: "BELARUS",
  191: "CROATIA",
  203: "CZECH_REPUBLIC",
  233: "BALTIC_FEDERATION",
  246: "FINLAND",
  276: "GERMANY",
  348: "HUNGARY",
  428: "BALTIC_FEDERATION",
  440: "BALTIC_FEDERATION",
  498: "MOLDOVA",
  499: "MONTENEGRO",
  616: "POLAND",
  642: "ROMANIA",
  643: "RUSSIA",
  688: "SERBIA",
  703: "SLOVAKIA",
  705: "SLOVENIA",
  756: "SWITZERLAND",
  804: "UKRAINE",
  807: "NORTH_MACEDONIA"
};

const numericIdByCountryId = Object.fromEntries(
  Object.entries(countryIdByNumericId).map(([numericId, countryId]) => [countryId, Number(numericId)])
) as Partial<Record<CountryId, number>>;

const atlasCountries = countries50m as unknown as any;
const atlasFeatureCollection = feature(atlasCountries, atlasCountries.objects.countries) as unknown as GeoJSON.FeatureCollection;
const europeCountryFeatures = atlasFeatureCollection.features.filter((country) => {
  const numericId = Number(country.id);
  return europeCountryIds.includes(numericId);
});
const europeBorderMesh = mesh(atlasCountries, atlasCountries.objects.countries, (left: any, right: any) => {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  return leftId !== rightId && europeCountryIds.includes(leftId) && europeCountryIds.includes(rightId);
});
const worldGraticule = geoGraticule10();

const clipCountryIdByRegionId: Partial<Record<string, number>> = {
  "tallinn": 233,
  "riga": 428,
  "vilnius": 440,
  "kaunas": 440,
  "donetsk": 804,
  "kharkov": 804,
  "lugansk": 804,
  "mariupol": 804,
  "zaporizhzhia": 804,
  "sevastopol": 643
};

function getRegionFill(state: GameState, regionId: string) {
  const region = state.regions[regionId];
  if (region.controllerBlocId === "BRICS") {
    return "#cf666a";
  }
  if (region.controllerBlocId === "EU_NATO") {
    return "#6b98ef";
  }
  return "#98a2ad";
}

function getRegionTerritoryStyle(state: GameState, regionId: string, selected: boolean, adjacent: boolean) {
  const region = state.regions[regionId];

  if (region.controllerBlocId === "BRICS") {
    return {
      fill: selected
        ? "rgba(255, 120, 125, 0.45)"
        : adjacent
          ? "rgba(207, 102, 106, 0.22)"
          : "rgba(207, 102, 106, 0.12)",
      stroke: selected ? "rgba(255, 230, 230, 0.95)" : adjacent ? "rgba(255, 220, 120, 0.70)" : "rgba(226, 132, 136, 0.28)"
    };
  }

  if (region.controllerBlocId === "EU_NATO") {
    return {
      fill: selected
        ? "rgba(130, 180, 255, 0.45)"
        : adjacent
          ? "rgba(107, 152, 239, 0.22)"
          : "rgba(107, 152, 239, 0.12)",
      stroke: selected ? "rgba(220, 235, 255, 0.95)" : adjacent ? "rgba(255, 220, 120, 0.70)" : "rgba(144, 179, 245, 0.28)"
    };
  }

  return {
    fill: selected
      ? "rgba(200, 210, 220, 0.40)"
      : adjacent
        ? "rgba(152, 162, 173, 0.18)"
        : "rgba(152, 162, 173, 0.08)",
    stroke: selected ? "rgba(240, 243, 247, 0.95)" : adjacent ? "rgba(255, 220, 120, 0.70)" : "rgba(188, 198, 208, 0.24)"
  };
}

function getClipCountryId(regionId: string, countryId: CountryId) {
  if (countryId === "NOVOROSSIA") {
    return 804;
  }
  return clipCountryIdByRegionId[regionId] ?? numericIdByCountryId[countryId];
}

function createProjection(): GeoProjection {
  const projection = geoMercator();
  const boundsFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [5.0, 41.0],
        [51.0, 41.0],
        [51.0, 62.5],
        [5.0, 62.5],
        [5.0, 41.0]
      ]]
    }
  };

  projection.fitExtent(
    [
      [40, 30],
      [theaterMapSize.width - 40, theaterMapSize.height - 30]
    ],
    boundsFeature
  );

  return projection;
}

function getCountryLayerStyle(state: GameState, featureId: number) {
  const scenarioCountryId = countryIdByNumericId[featureId];
  if (scenarioCountryId === undefined) {
    return {
      fill: "rgba(133, 148, 162, 0.10)",
      stroke: "rgba(122, 140, 156, 0.48)"
    };
  }

  const country = state.countries[scenarioCountryId];
  const atWar = state.countryStates[scenarioCountryId]?.atWar ?? false;

  if (country.blocId === "BRICS") {
    return {
      fill: atWar ? "rgba(198, 93, 98, 0.10)" : "rgba(198, 93, 98, 0.05)",
      stroke: atWar ? "rgba(218, 112, 117, 0.95)" : "rgba(218, 112, 117, 0.48)"
    };
  }

  if (country.blocId === "EU_NATO") {
    return {
      fill: atWar ? "rgba(94, 144, 234, 0.10)" : "rgba(94, 144, 234, 0.05)",
      stroke: atWar ? "rgba(111, 157, 241, 0.92)" : "rgba(111, 157, 241, 0.46)"
    };
  }

  return {
    fill: "rgba(163, 171, 182, 0.08)",
    stroke: "rgba(182, 190, 201, 0.62)"
  };
}

function getUnitSymbol(type: UnitDefinition["type"]): string {
  switch (type) {
    case "infantry": return "▮▮";
    case "armor": return "◆";
    case "fighter": return "✈";
    case "bomber": return "✈✈";
    case "tacticalMissile": return "↗";
    case "strategicMissile": return "⬆";
    default: return "?";
  }
}

function getUnitColor(blocId: string): string {
  if (blocId === "BRICS") return "#ff9a9d";
  if (blocId === "EU_NATO") return "#9dc2ff";
  return "#c7d0da";
}

function getSupplyIndicator(unit: UnitDefinition) {
  if (unit.type !== "infantry" && unit.type !== "armor") {
    return null;
  }
  if (unit.supplyTurnsRemaining <= 0) {
    return { fill: "#ff6b6b", stroke: "rgba(255, 120, 120, 0.9)" };
  }
  if (unit.supplyTurnsRemaining === 1) {
    return { fill: "#f7b955", stroke: "rgba(255, 215, 120, 0.95)" };
  }
  if (unit.supplyTurnsRemaining === 2) {
    return { fill: "#d5d96b", stroke: "rgba(220, 230, 120, 0.9)" };
  }
  return null;
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function TheaterMapComponent({
  state,
  selectedRegionId,
  onSelectRegion,
  onSelectFacility,
  onSelectUnit,
  validMoveTargets = [],
  validAttackTargets = [],
  showSupplyOverlay = false,
}: TheaterMapProps) {
  const selectedRegion = state.regions[selectedRegionId];
  const selectedAdjacency = new Set(selectedRegion.adjacentRegionIds);
  const projection = useMemo(() => createProjection(), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const regionList = useMemo(() => Object.values(state.regions), [state.regions]);
  const validMoveTargetSet = useMemo(() => new Set(validMoveTargets), [validMoveTargets]);
  const validAttackTargetSet = useMemo(() => new Set(validAttackTargets), [validAttackTargets]);

  // Compute supply lines for overlay
  const supplyLineEdges = useMemo(() => {
    if (!showSupplyOverlay) return { supplied: [] as [string, string][], unsupplied: [] as [string, string][] };
    const playerCountryId = state.playerCountryId;
    const playerCountry = state.countries[playerCountryId];
    const playerBlocId = playerCountry?.blocId;
    const capitalRegionId = playerCountry?.capitalRegionId;
    if (!playerBlocId || !capitalRegionId) return { supplied: [], unsupplied: [] };

    // BFS from capital through continuous bloc regions
    const suppliedSet = new Set<string>();
    const queue = [capitalRegionId];
    suppliedSet.add(capitalRegionId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const region = state.regions[current];
      if (!region) continue;
      for (const adjId of region.adjacentRegionIds) {
        if (suppliedSet.has(adjId)) continue;
        const adj = state.regions[adjId];
        if (!adj) continue;
        if (adj.controllerBlocId === playerBlocId) {
          suppliedSet.add(adjId);
          queue.push(adjId);
        }
      }
    }

    // Build edges
    const suppliedEdges: [string, string][] = [];
    const unsuppliedEdges: [string, string][] = [];
    const seen = new Set<string>();
    for (const regionId of suppliedSet) {
      const region = state.regions[regionId];
      if (!region) continue;
      for (const adjId of region.adjacentRegionIds) {
        const edgeKey = [regionId, adjId].sort().join("::");
        if (seen.has(edgeKey)) continue;
        seen.add(edgeKey);
        if (suppliedSet.has(adjId)) {
          suppliedEdges.push([regionId, adjId]);
        } else if (state.regions[adjId]?.controllerBlocId === playerBlocId) {
          // Friendly region but not connected to capital
          unsuppliedEdges.push([regionId, adjId]);
        }
      }
    }
    return { supplied: suppliedEdges, unsupplied: unsuppliedEdges };
  }, [showSupplyOverlay, state.regions, state.countries, state.playerCountryId]);

  const projectedPointByRegionId = useMemo(() => {
    const points = new Map<string, [number, number]>();
    for (const region of regionList) {
      const layout = theaterMapLayout[region.id];
      const point = projection([layout.lon, layout.lat]);
      if (point !== null) {
        points.set(region.id, point);
      }
    }
    return points;
  }, [projection, regionList]);

  const projectedRegionPoints = useMemo(
    () => [...projectedPointByRegionId.values()],
    [projectedPointByRegionId]
  );

  const defaultViewport = useMemo(() => {
    const xs = projectedRegionPoints.map((point) => point[0]);
    const ys = projectedRegionPoints.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    const padding = 40;
    const fittedScale = Math.min(
      (theaterMapSize.width - padding * 2) / regionWidth,
      (theaterMapSize.height - padding * 2) / regionHeight
    );
    const fitScale = Math.max(MIN_SCALE, Number(fittedScale.toFixed(2)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return {
      scale: fitScale,
      offset: {
        x: theaterMapSize.width / 2 - centerX * fitScale,
        y: theaterMapSize.height / 2 - centerY * fitScale
      }
    };
  }, [projectedRegionPoints]);

  const [scale, setScale] = useState(defaultViewport.scale);
  const [offset, setOffset] = useState(defaultViewport.offset);
  const [expandedUnitRegionId, setExpandedUnitRegionId] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragPointerRef = useRef<{ id: number; startClientX: number; startClientY: number; active: boolean } | null>(null);
  const queuedOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const panFrameRef = useRef<number | null>(null);

  const handleSelectRegion = (regionId: string) => {
    setExpandedUnitRegionId(null);
    onSelectRegion(regionId);
  };

  const edges = useMemo(() => {
    const result = new Map<string, [string, string]>();
    for (const region of regionList) {
      for (const adjacentId of region.adjacentRegionIds) {
        const key = [region.id, adjacentId].sort().join("::");
        if (!result.has(key)) {
          result.set(key, [region.id, adjacentId]);
        }
      }
    }
    return [...result.values()];
  }, [regionList]);

  const pridnestrovieDepotStatus = useMemo(() => getPridnestrovieDepotStatus(state), [state]);

  const labels = useMemo(() => {
    return europeCountryFeatures
      .map((country) => {
        const numericId = Number(country.id);
        const scenarioCountryId = countryIdByNumericId[numericId];
        if (scenarioCountryId === undefined) {
          return null;
        }

        const [x, y] = path.centroid(country as GeoJSON.Feature<GeoJSON.Geometry>);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return {
          id: numericId,
          name: state.countries[scenarioCountryId].name,
          x,
          y
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [path, state.countries]);

  const regionCells = useMemo(() => {
    // Build projected points for all regions
    const allEntries = regionList
      .map((region) => {
        const point = projectedPointByRegionId.get(region.id);
        if (point === undefined) return null;
        return { region, point };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    // Group by CLIP country (the GeoJSON shape they render into), not game homeCountryId.
    // This ensures regions sharing a geographic shape (e.g. Ukraine + Novorossia,
    // Baltic Federation split across Estonia/Latvia/Lithuania) get a joint Voronoi.
    const byClipCountry = new Map<number, typeof allEntries>();
    for (const entry of allEntries) {
      const clipId = getClipCountryId(entry.region.id, entry.region.homeCountryId);
      if (clipId === undefined) continue;
      const list = byClipCountry.get(clipId) ?? [];
      list.push(entry);
      byClipCountry.set(clipId, list);
    }

    const results: { region: (typeof allEntries)[number]["region"]; polygon: string | null }[] = [];
    // Voronoi bounds — generous enough to cover any country shape after clipping
    const bounds: [number, number, number, number] = [-200, -200, theaterMapSize.width + 200, theaterMapSize.height + 200];

    for (const [, entries] of byClipCountry) {
      if (entries.length === 1) {
        // Single-region country: one big rect that clipPath will clip to the country shape
        const bigPoly = `${bounds[0]},${bounds[1]} ${bounds[2]},${bounds[1]} ${bounds[2]},${bounds[3]} ${bounds[0]},${bounds[3]}`;
        results.push({ region: entries[0].region, polygon: bigPoly });
      } else {
        // Multi-region country: per-country Voronoi so cells tile the entire country
        const delaunay = Delaunay.from(
          entries,
          (e: (typeof entries)[number]) => e.point[0],
          (e: (typeof entries)[number]) => e.point[1]
        );
        const voronoi = delaunay.voronoi(bounds);

        for (let i = 0; i < entries.length; i++) {
          const polygon = voronoi.cellPolygon(i);
          results.push({
            region: entries[i].region,
            polygon: polygon === null ? null : polygon.map(([x, y]: [number, number]) => `${x},${y}`).join(" ")
          });
        }
      }
    }

    return results;
  }, [projectedPointByRegionId, regionList]);

  const screenRegionPoints = useMemo(
    () =>
      regionList
        .map((region) => {
          const worldPoint = projectedPointByRegionId.get(region.id);
          if (worldPoint === undefined) {
            return null;
          }

          return {
            region,
            worldPoint,
            screenPoint: [worldPoint[0] * scale + offset.x, worldPoint[1] * scale + offset.y] as [number, number]
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [offset.x, offset.y, projectedPointByRegionId, scale, regionList]
  );

  const selectedAndAdjacentCells = useMemo(
    () => regionCells.filter(({ region }) => region.id === selectedRegionId || selectedAdjacency.has(region.id)),
    [regionCells, selectedAdjacency, selectedRegionId]
  );

  const emphasizedTerritoryCells = useMemo(
    () => regionCells.filter(({ region }) => region.homeCountryId === "NOVOROSSIA" || region.id === "sevastopol"),
    [regionCells]
  );

  // Group units by region for rendering
  const unitsByRegion = useMemo(() => {
    const map = new Map<string, UnitDefinition[]>();
    for (const unit of Object.values(state.units)) {
      const list = map.get(unit.regionId) ?? [];
      list.push(unit);
      map.set(unit.regionId, list);
    }
    return map;
  }, [state.units]);

  function clampScale(nextScale: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  }

  function commitQueuedOffset() {
    const queuedOffset = queuedOffsetRef.current;
    if (queuedOffset === null) {
      return;
    }
    queuedOffsetRef.current = null;
    setOffset((previousOffset) =>
      previousOffset.x === queuedOffset.x && previousOffset.y === queuedOffset.y
        ? previousOffset
        : queuedOffset
    );
  }

  function schedulePanCommit() {
    if (panFrameRef.current !== null) {
      return;
    }
    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null;
      commitQueuedOffset();
    });
  }

  function zoomAroundPoint(nextScale: number, anchorX: number, anchorY: number) {
    const clampedScale = clampScale(nextScale);
    const worldX = (anchorX - offset.x) / scale;
    const worldY = (anchorY - offset.y) / scale;

    setScale(clampedScale);
    setOffset({
      x: anchorX - worldX * clampedScale,
      y: anchorY - worldY * clampedScale
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = shellRef.current?.getBoundingClientRect();
    const anchorX = rect ? event.clientX - rect.left : theaterMapSize.width / 2;
    const anchorY = rect ? event.clientY - rect.top : theaterMapSize.height / 2;
    const delta = event.deltaY < 0 ? 0.8 : -0.8;
    zoomAroundPoint(Number((scale + delta).toFixed(2)), anchorX, anchorY);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    dragPointerRef.current = {
      id: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      active: false
    };
    dragStartRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null || dragPointerRef.current?.id !== event.pointerId) {
      return;
    }
    const pointerState = dragPointerRef.current;
    const distance = Math.hypot(event.clientX - pointerState.startClientX, event.clientY - pointerState.startClientY);
    if (!pointerState.active && distance < DRAG_THRESHOLD_PX) {
      return;
    }
    pointerState.active = true;

    queuedOffsetRef.current = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y
    };
    schedulePanCommit();
  }

  function stopDragging(event?: React.PointerEvent<HTMLDivElement>) {
    if (event && dragPointerRef.current?.id !== event.pointerId) {
      return;
    }

    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
    commitQueuedOffset();
    dragStartRef.current = null;
    dragPointerRef.current = null;
  }

  function zoomIn() {
    const rect = shellRef.current?.getBoundingClientRect();
    zoomAroundPoint(
      Number((scale + 0.9).toFixed(2)),
      rect ? rect.width / 2 : theaterMapSize.width / 2,
      rect ? rect.height / 2 : theaterMapSize.height / 2
    );
  }

  function zoomOut() {
    const rect = shellRef.current?.getBoundingClientRect();
    zoomAroundPoint(
      Number((scale - 0.9).toFixed(2)),
      rect ? rect.width / 2 : theaterMapSize.width / 2,
      rect ? rect.height / 2 : theaterMapSize.height / 2
    );
  }

  function resetView() {
    setScale(defaultViewport.scale);
    setOffset(defaultViewport.offset);
  }

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current);
      }
    };
  }, []);

  const zoomAdjustedNodeRadius = (region: (typeof state.regions)[string], selected: boolean) => {
    return selected ? 1.0 : region.isCapital ? 0.7 : region.isKeyCity ? 0.6 : 0.45;
  };

  const zoomAdjustedSelectionRing = (region: (typeof state.regions)[string]) => {
    return region.isCapital ? 1.4 : region.isKeyCity ? 1.2 : 1.0;
  };

  return (
    <>
      <div className="map-controls">
        <button className="map-control-button" onClick={zoomIn}>+</button>
        <button className="map-control-button" onClick={zoomOut}>-</button>
        <button className="map-control-button" onClick={resetView}>Reset</button>
      </div>

      <div
        ref={shellRef}
        className="theater-map-shell"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={stopDragging}
      >
        <svg
          className="theater-map theater-map--interactive"
          viewBox={`0 0 ${theaterMapSize.width} ${theaterMapSize.height}`}
          role="img"
          onClick={() => setExpandedUnitRegionId(null)}
          aria-label="Strategic theater map"
        >
          <rect className="theater-map__sea" x="0" y="0" width={theaterMapSize.width} height={theaterMapSize.height} />
          <defs>
            {europeCountryFeatures.map((country) => {
              const numericId = Number(country.id);
              return (
                <clipPath key={`clip-country-${numericId}`} id={`clip-country-${numericId}`}>
                  <path d={path(country as GeoJSON.Feature<GeoJSON.Geometry>) ?? undefined} />
                </clipPath>
              );
            })}
          </defs>
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>

            <BaseMapLayer 
              state={state} 
              regionCells={regionCells} 
              emphasizedTerritoryCells={emphasizedTerritoryCells} 
              europeCountryFeatures={europeCountryFeatures} 
              path={path} 
              europeBorderMesh={europeBorderMesh} 
              worldGraticule={worldGraticule} 
              onSelectRegion={handleSelectRegion} 
            />

            <g className="theater-map__region-layer">
              {selectedAndAdjacentCells.map(({ region, polygon }) => {
                if (polygon === null) return null;
                const isSelected = region.id === selectedRegionId;
                const isAdjacent = selectedAdjacency.has(region.id);
                const style = getRegionTerritoryStyle(state, region.id, isSelected, isAdjacent);
                const clipCountryId = getClipCountryId(region.id, region.homeCountryId);
                if (clipCountryId === undefined) return null;

                return (
                  <polygon
                    key={`cell-${region.id}`}
                    points={polygon}
                    clipPath={`url(#clip-country-${clipCountryId})`}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={isSelected ? 1.6 : 1}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="all"
                    onClick={() => handleSelectRegion(region.id)}
                    className={isSelected ? "theater-map__region-cell theater-map__region-cell--selected" : "theater-map__region-cell"}
                  />
                );
              })}
              {/* Valid move/attack target overlays */}
              {regionCells.map(({ region, polygon }) => {
                if (polygon === null) return null;
                const isMove = validMoveTargetSet.has(region.id);
                const isAttack = validAttackTargetSet.has(region.id);
                if (!isMove && !isAttack) return null;

                const clipCountryId = getClipCountryId(region.id, region.homeCountryId);
                if (clipCountryId === undefined) return null;

                return (
                  <polygon
                    key={`target-${region.id}`}
                    points={polygon}
                    clipPath={`url(#clip-country-${clipCountryId})`}
                    fill={isAttack ? "rgba(255, 60, 60, 0.18)" : "rgba(60, 200, 120, 0.15)"}
                    stroke={isAttack ? "rgba(255, 80, 80, 0.7)" : "rgba(80, 220, 140, 0.7)"}
                    strokeWidth={1.5}
                    strokeDasharray={isAttack ? "none" : "4 2"}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="all"
                    cursor="pointer"
                    onClick={() => handleSelectRegion(region.id)}
                    className={`theater-map__target ${isAttack ? "theater-map__target--attack" : "theater-map__target--move"}`}
                  />
                );
              })}
            </g>

            {edges.map(([fromId, toId]) => {
              const from = projectedPointByRegionId.get(fromId);
              const to = projectedPointByRegionId.get(toId);
              if (from === undefined || to === undefined) {
                return null;
              }

              const isSelectedEdge = fromId === selectedRegionId || toId === selectedRegionId;
              if (!isSelectedEdge && scale > 1.9) {
                return null;
              }
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from[0]}
                  y1={from[1]}
                  x2={to[0]}
                  y2={to[1]}
                  vectorEffect="non-scaling-stroke"
                  className={isSelectedEdge ? "theater-map__edge theater-map__edge--selected" : "theater-map__edge"}
                />
              );
            })}

            {regionList.map((region) => {
              const point = projectedPointByRegionId.get(region.id);
              if (point === undefined) {
                return null;
              }

              const isSelected = region.id === selectedRegionId;
              const isAdjacent = selectedAdjacency.has(region.id);

              // Supply overlay lines rendered before region nodes
              const supplyLines = showSupplyOverlay ? [
                ...supplyLineEdges.supplied.filter(([a, b]) => a === region.id || b === region.id).map(([a, b]) => {
                  const otherId = a === region.id ? b : a;
                  const otherPt = projectedPointByRegionId.get(otherId);
                  if (otherPt === undefined) return null;
                  return (
                    <line key={`supply-s-${region.id}-${otherId}`}
                      x1={point[0]} y1={point[1]} x2={otherPt[0]} y2={otherPt[1]}
                      stroke="rgba(56,220,120,0.55)" strokeWidth={2.5} strokeLinecap="round"
                      vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  );
                }),
                ...supplyLineEdges.unsupplied.filter(([a, b]) => a === region.id || b === region.id).map(([a, b]) => {
                  const otherId = a === region.id ? b : a;
                  const otherPt = projectedPointByRegionId.get(otherId);
                  if (otherPt === undefined) return null;
                  return (
                    <line key={`supply-u-${region.id}-${otherId}`}
                      x1={point[0]} y1={point[1]} x2={otherPt[0]} y2={otherPt[1]}
                      stroke="rgba(150,170,196,0.35)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round"
                      vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  );
                })
              ] : null;
              return (
                <g key={region.id} className="theater-map__node-group" onClick={() => handleSelectRegion(region.id)}>
                  {supplyLines}
                  {isSelected ? (
                    <circle
                      cx={point[0]}
                      cy={point[1]}
                      r={zoomAdjustedSelectionRing(region)}
                      vectorEffect="non-scaling-stroke"
                      className="theater-map__selection-ring"
                    />
                  ) : null}
                  <circle
                    cx={point[0]}
                    cy={point[1]}
                    r={zoomAdjustedNodeRadius(region, isSelected)}
                    fill={getRegionFill(state, region.id)}
                    vectorEffect="non-scaling-stroke"
                    className={
                      isSelected
                        ? "theater-map__node theater-map__node--selected"
                        : isAdjacent
                          ? "theater-map__node theater-map__node--adjacent"
                          : "theater-map__node"
                    }
                  />
                </g>
              );
            })}

            {/* Economy overlay - resource deposits only (facility icons hidden to reduce clutter) */}
            {scale > 3 && regionList.map((region) => {
              const economy = state.regionEconomies?.[region.id];
              if (!economy) return null;
              const deposits = economy.resourceDeposits;
              if (deposits.length === 0) return null;

              const pt = projectedPointByRegionId.get(region.id);
              if (pt === undefined) return null;

              const iconSize = 0.65;
              const gap = 1.6;
              const yBase = pt[1] + 2.5;

              const depositIcons = deposits.map((d) => {
                const colors: Record<string, string> = {
                  oil: "#8b6914", coal: "#444", iron: "#9aa", tungsten: "#b89d5e", food: "#5a8a3c", chemicals: "#7b5ea7"
                };
                return { color: colors[d.type] ?? "#888", richness: d.richness, type: d.type };
              });

              const rowWidth = depositIcons.length * gap;
              const startX = pt[0] - rowWidth / 2;

              return (
                <g key={`econ-${region.id}`} className="theater-map__economy-overlay" opacity={0.85}>
                  {depositIcons.map((d, i) => (
                    <g key={`dep-${i}`}>
                      <rect
                        x={startX + i * gap - iconSize}
                        y={yBase - iconSize}
                        width={iconSize * 2}
                        height={iconSize * 2}
                        rx={0.2}
                        fill={d.color}
                        opacity={0.7}
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth={0.1}
                      />
                      <text
                        x={startX + i * gap}
                        y={yBase + iconSize * 0.35}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={0.75}
                        fill="#fff"
                        fontWeight="bold"
                      >
                        {d.type === "food" ? "F" : d.richness}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
            {scale > 2.4 ? (() => {
              const region = state.regions["chisinau-pridnestrovie"];
              if (!region) return null;
              const pt = projectedPointByRegionId.get(region.id);
              if (pt === undefined) return null;

              const tone =
                pridnestrovieDepotStatus.tone === "claimed"
                  ? { fill: "rgba(96, 198, 124, 0.9)", stroke: "rgba(170, 245, 180, 0.95)" }
                  : pridnestrovieDepotStatus.tone === "claimable"
                    ? { fill: "rgba(232, 198, 88, 0.92)", stroke: "rgba(255, 232, 140, 0.98)" }
                    : { fill: "rgba(154, 168, 184, 0.86)", stroke: "rgba(226, 231, 238, 0.92)" };

              return (
                <g className="theater-map__strategic-depot" onClick={() => handleSelectRegion(region.id)}>
                  <rect
                    x={pt[0] - 1.15}
                    y={pt[1] - 3.6}
                    width={2.3}
                    height={1.25}
                    rx={0.24}
                    fill={tone.fill}
                    stroke={tone.stroke}
                    strokeWidth={0.1}
                  />
                  <text
                    x={pt[0]}
                    y={pt[1] - 2.73}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={0.62}
                    fontWeight="bold"
                    className="theater-map__strategic-depot-label"
                  >
                    DEPOT
                  </text>
                </g>
              );
            })() : null}

            {/* Unit markers layer */}
            {regionList.map((region) => {
              const units = unitsByRegion.get(region.id);
              if (!units || units.length === 0) return null;

              const point = projectedPointByRegionId.get(region.id);
              if (point === undefined) return null;

              const isExpanded = expandedUnitRegionId === region.id;
              const showStack = units.length > 1 && !isExpanded;
              const unitSize = 0.55;
              const fontSize = 0.45;
              const yOff = 2.2;

              if (showStack) {
                const primaryColor = getUnitColor(units[0].blocId);
                const hasOrder = units.some((unit) => state.pendingOrders[unit.countryId]?.some((o) => o.unitId === unit.id));

                return (
                  <g key={`units-${region.id}`} className="theater-map__unit-group">
                    <g
                      className="theater-map__unit-marker theater-map__unit-marker--stack"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectRegion(region.id);
                        setExpandedUnitRegionId(region.id);
                      }}
                    >
                      <rect
                        x={point[0] - 1.35}
                        y={point[1] + yOff - 0.7}
                        width={2.7}
                        height={1.4}
                        rx={0.28}
                        fill="rgba(20, 28, 40, 0.9)"
                        stroke={hasOrder ? "#ffd700" : primaryColor}
                        strokeWidth={hasOrder ? 0.16 : 0.1}
                      />
                      <text
                        x={point[0]}
                        y={point[1] + yOff + 0.12}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={primaryColor}
                        fontSize={0.78}
                        fontFamily="monospace"
                        fontWeight="bold"
                        className="theater-map__unit-symbol"
                      >
                        {units.length}
                      </text>
                    </g>
                  </g>
                );
              }

              return (
                <g key={`units-${region.id}`} className="theater-map__unit-group">
                  {units.map((unit, idx) => {
                    const xOff = (idx - (units.length - 1) / 2) * 1.9;
                    const color = getUnitColor(unit.blocId);
                    const supplyIndicator = getSupplyIndicator(unit);
                    const bgColor =
                      unit.blocId === "BRICS"
                        ? "rgba(80, 20, 22, 0.85)"
                        : unit.blocId === "EU_NATO"
                          ? "rgba(18, 35, 65, 0.85)"
                          : "rgba(50, 58, 66, 0.88)";
                    const hasOrder = state.pendingOrders[unit.countryId]?.some((o) => o.unitId === unit.id);

                    return (
                      <g
                        key={unit.id}
                        className="theater-map__unit-marker"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectRegion(unit.regionId);
                          onSelectUnit?.(unit.id);
                        }}
                      >
                        <rect
                          x={point[0] + xOff - unitSize}
                          y={point[1] + yOff - unitSize * 0.6}
                          width={unitSize * 2}
                          height={unitSize * 1.2}
                          rx={0.2}
                          fill={bgColor}
                          stroke={hasOrder ? "#ffd700" : color}
                          strokeWidth={hasOrder ? 0.16 : 0.1}
                        />
                        <text
                          x={point[0] + xOff}
                          y={point[1] + yOff + fontSize * 0.15}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={color}
                          fontSize={fontSize}
                          fontFamily="monospace"
                          fontWeight="bold"
                          className="theater-map__unit-symbol"
                        >
                          {getUnitSymbol(unit.type)}
                        </text>
                        <text
                          x={point[0] + xOff + unitSize * 0.8}
                          y={point[1] + yOff - unitSize * 0.3}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={color}
                          fontSize={0.42}
                          fontFamily="monospace"
                          className="theater-map__unit-strength"
                        >
                          {unit.strength}
                        </text>
                        {supplyIndicator && (
                          <circle
                            cx={point[0] + xOff - unitSize * 0.75}
                            cy={point[1] + yOff - unitSize * 0.35}
                            r={0.2}
                            fill={supplyIndicator.fill}
                            stroke={supplyIndicator.stroke}
                            strokeWidth={0.08}
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>

          {scale < 3.2
            ? labels.map((label) => (
                <text
                  key={`country-label-${label.id}`}
                  x={label.x * scale + offset.x}
                  y={label.y * scale + offset.y}
                  className="theater-map__country-label"
                >
                  {label.name}
                </text>
              ))
            : null}

          {screenRegionPoints.map(({ region, worldPoint }) => {
            const isSelected = region.id === selectedRegionId;
            const showLabel =
              isSelected ||
              (scale > 2.5 && region.isCapital) ||
              (scale > 4 && region.isKeyCity) ||
              scale > 5.5;

            if (!showLabel) {
              return null;
            }

            // Render label in screen coordinates but with font that scales with zoom
            const sx = worldPoint[0] * scale + offset.x + 4;
            const sy = worldPoint[1] * scale + offset.y + 7;
            const labelFontSize = Math.min(14, Math.max(7, scale * 1.1));

            return (
              <text
                key={`label-${region.id}`}
                x={sx}
                y={sy}
                fontSize={labelFontSize}
                className={isSelected ? "theater-map__label theater-map__label--selected" : "theater-map__label"}
              >
                {region.name}
              </text>
            );
          })}
        </svg>
      </div>
    </>
  );
}

export const TheaterMap = memo(TheaterMapComponent, (prevProps, nextProps) => {
  return (
    prevProps.state === nextProps.state &&
    prevProps.selectedRegionId === nextProps.selectedRegionId &&
    areStringArraysEqual(prevProps.validMoveTargets ?? [], nextProps.validMoveTargets ?? []) &&
    areStringArraysEqual(prevProps.validAttackTargets ?? [], nextProps.validAttackTargets ?? [])
  );
});

const BaseMapLayer = memo(
  ({
    state,
    regionCells,
    emphasizedTerritoryCells,
    europeCountryFeatures,
    path,
    europeBorderMesh,
    worldGraticule,
    onSelectRegion,
  }: any) => {
    return (
      <>
        <g className="theater-map__country-layer">
          {europeCountryFeatures.map((country: any) => {
            const numericId = Number(country.id);
            const style = getCountryLayerStyle(state, numericId);
            return (
              <path
                key={numericId}
                d={path(country) ?? undefined}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={1.3}
                vectorEffect="non-scaling-stroke"
                className="theater-map__country-shape"
              />
            );
          })}
        </g>

        <g className="theater-map__region-layer-base">
          {regionCells.map(({ region, polygon }: any) => {
            if (polygon === null) return null;
            const clipCountryId = getClipCountryId(region.id, region.homeCountryId);
            if (clipCountryId === undefined) return null;
            const baseStyle = getRegionTerritoryStyle(state, region.id, false, false);

            return (
              <polygon
                key={`base-cell-${region.id}`}
                points={polygon}
                clipPath={`url(#clip-country-${clipCountryId})`}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                onClick={() => onSelectRegion(region.id)}
                className="theater-map__region-cell theater-map__region-cell--base"
              />
            );
          })}

          {emphasizedTerritoryCells.map(({ region, polygon }: any) => {
            if (polygon === null) return null;
            const clipCountryId = getClipCountryId(region.id, region.homeCountryId);
            if (clipCountryId === undefined) return null;

            return (
              <polygon
                key={`novorossia-${region.id}`}
                points={polygon}
                clipPath={`url(#clip-country-${clipCountryId})`}
                fill="rgba(207, 102, 106, 0.5)"
                stroke="none"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                className="theater-map__region-cell theater-map__region-cell--background"
              />
            );
          })}
        </g>

        <path d={path(europeBorderMesh) ?? undefined} vectorEffect="non-scaling-stroke" className="theater-map__borders" />
        <path d={path(worldGraticule) ?? undefined} vectorEffect="non-scaling-stroke" className="theater-map__graticule" />
      </>
    );
  },
  (prev: any, next: any) => {
    if (prev.regionCells !== next.regionCells) return false;
    
    // Check if any country war status changed (affects country layer colors)
    const prevStates = prev.state.countryStates;
    const nextStates = next.state.countryStates;
    for (const key in nextStates) {
      if (prevStates[key]?.atWar !== nextStates[key]?.atWar) return false;
    }

    // Check if any region ownership changed (affects Voronoi cell colors)
    const prevRegions = prev.state.regions;
    const nextRegions = next.state.regions;
    for (const key in nextRegions) {
      if (prevRegions[key]?.controllerBlocId !== nextRegions[key]?.controllerBlocId) return false;
    }

    return true;
  }
);

