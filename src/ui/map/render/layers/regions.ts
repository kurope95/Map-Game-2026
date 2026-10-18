import { NATION_COLORS, NON_SCENARIO_LAND, SHADE_OVERLAYS } from "../../../theme/palette";
import type { Camera } from "../../camera";
import type { DerivedMapData } from "../../derive";
import type { MapGeometry } from "../../geometry/buildMapGeometry";
import type { BBox } from "../../geometry/types";
import { getStripePattern, stripeTransform } from "../patterns";
import { getPaths, intersects } from "../paths";

const shadeCache = new Map<string, string>();

function parseHex(color: string): [number, number, number] {
  const value = color.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** A fill with the region's shade variant blended in, so each region needs one fill instead of two. */
function shaded(color: string, variant: number): string {
  const overlay = SHADE_OVERLAYS[variant];
  if (overlay === null || overlay === undefined) return color;
  const key = `${color}|${variant}`;
  let result = shadeCache.get(key);
  if (!result) {
    const [r, g, b] = parseHex(color);
    const match = overlay.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
    if (!match) return color;
    const alpha = Number(match[4]);
    const mix = (base: number, over: number) => Math.round(base * (1 - alpha) + over * alpha);
    result = `rgb(${mix(r, Number(match[1]))},${mix(g, Number(match[2]))},${mix(b, Number(match[3]))})`;
    shadeCache.set(key, result);
  }
  return result;
}

/** Spec 11.4 layers 4-5: controller-colored fills with shade variants, then stripes on occupied land. */
export function drawRegions(
  ctx: CanvasRenderingContext2D,
  geometry: MapGeometry,
  derived: DerivedMapData,
  camera: Camera,
  visible: BBox,
  dpr: number
): void {
  const paths = getPaths(geometry).region;
  for (const [regionId, shape] of geometry.regions) {
    if (!intersects(shape.bbox, visible)) continue;
    const path = paths.get(regionId);
    if (!path) continue;
    ctx.fillStyle = shaded(derived.fillByRegion.get(regionId) ?? NON_SCENARIO_LAND, geometry.shadeVariant.get(regionId) ?? 0);
    ctx.fill(path, "evenodd");
  }

  for (const [regionId, preWarController] of derived.occupiedBy) {
    const shape = geometry.regions.get(regionId);
    const path = paths.get(regionId);
    if (!shape || !path || !intersects(shape.bbox, visible)) continue;
    const pattern = getStripePattern(ctx, NATION_COLORS[preWarController], dpr);
    if (!pattern) continue;
    pattern.setTransform(stripeTransform(camera.scale, dpr));
    ctx.fillStyle = pattern;
    ctx.fill(path, "evenodd");
  }
}
