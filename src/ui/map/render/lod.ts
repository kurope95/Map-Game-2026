// Level-of-detail rules of spec 11.5, in z (zoom relative to the default fit). One place for every threshold.
export const LOD = {
  /** The link network is at full alpha up to here and gone at `linkNetworkGone`; nation names fade over the same range. */
  linkNetworkFull: 1.3,
  linkNetworkGone: 1.6,
  keyCityLabels: 1.3,
  allCityLabels: 2.2,
  depotBadge: 1.5,
  depositChips: 3.5
} as const;

export const LINK_NETWORK_ALPHA = 0.16;

export type CityKind = "capital" | "key" | "other";

/** 1 up to `full`, 0 from `gone`, linear in between. */
export function lodFade(z: number, full: number, gone: number): number {
  if (z <= full) return 1;
  if (z >= gone) return 0;
  return (gone - z) / (gone - full);
}

export function linkNetworkAlpha(z: number): number {
  return LINK_NETWORK_ALPHA * lodFade(z, LOD.linkNetworkFull, LOD.linkNetworkGone);
}

export function nationLabelFade(z: number): number {
  return lodFade(z, LOD.linkNetworkFull, LOD.linkNetworkGone);
}

/** Capitals (and the selection and its links, decided by the caller) are always labeled. */
export function cityLabelVisible(z: number, kind: CityKind): boolean {
  if (kind === "capital") return true;
  return z >= (kind === "key" ? LOD.keyCityLabels : LOD.allCityLabels);
}

export function depotBadgeVisible(z: number): boolean {
  return z >= LOD.depotBadge;
}

export function depositChipsVisible(z: number): boolean {
  return z >= LOD.depositChips;
}
