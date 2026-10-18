// Text helpers for the canvas layers: one font stack and a measurement cache (measureText is slow in a hot loop).
export const DISPLAY_FONT = 'Oswald, "Arial Narrow", sans-serif';

export function font(weight: number, size: number): string {
  return `${weight} ${size}px ${DISPLAY_FONT}`;
}

const widths = new Map<string, number>();

/** Width of `text` in `fontSpec` (cached by font and text). The caller must already have set ctx.font to it. */
export function textWidth(ctx: CanvasRenderingContext2D, fontSpec: string, text: string): number {
  const key = `${fontSpec}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    ctx.font = fontSpec;
    width = ctx.measureText(text).width;
    widths.set(key, width);
  }
  return width;
}

/** Text with a dark halo so it reads on any fill (spec 11.4 layer 16: 3 px, rgba(10,12,14,.85)). */
export function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(10, 12, 14, 0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
