import type { MapViewProps } from "./MapView";

const NONE: readonly string[] = [];

function sameIds(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = a ?? NONE;
  const right = b ?? NONE;
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

/**
 * React.memo comparator for MapView (spec 11.6). GameScreen builds its id lists afresh on every render, so lists are
 * compared by content. Callbacks are compared by identity: the controller calls the latest ones, so a changed
 * callback must reach it (GameScreen passes stable callbacks, so this does not defeat the memo).
 */
export function mapViewPropsEqual(prev: MapViewProps, next: MapViewProps): boolean {
  return (
    prev.state === next.state &&
    prev.selectedRegionId === next.selectedRegionId &&
    prev.showSupplyOverlay === next.showSupplyOverlay &&
    prev.mode === next.mode &&
    prev.highlightCountryId === next.highlightCountryId &&
    prev.onSelectRegion === next.onSelectRegion &&
    prev.onSelectUnit === next.onSelectUnit &&
    prev.attackPreviews === next.attackPreviews &&
    sameIds(prev.selectedUnitIds, next.selectedUnitIds) &&
    sameIds(prev.validMoveTargets, next.validMoveTargets) &&
    sameIds(prev.validAttackTargets, next.validAttackTargets)
  );
}
