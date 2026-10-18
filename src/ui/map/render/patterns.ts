// Cached canvas patterns: occupation stripes per nation color and the sea noise texture.
const STRIPE_PERIOD_PX = 8;
const STRIPE_WIDTH_PX = 2.6;
const STRIPE_ALPHA = 0.85;

const stripes = new Map<string, CanvasPattern>();

/**
 * Diagonal stripes in `color`: 2.6 px wide, one every 8 screen px along an axis. The tile is made in device
 * pixels so the lines stay sharp; set `transform` with {@link stripeTransform} before every fill.
 */
export function getStripePattern(ctx: CanvasRenderingContext2D, color: string, dpr: number): CanvasPattern | null {
  const key = `${color}|${dpr}`;
  let pattern = stripes.get(key);
  if (!pattern) {
    const size = Math.max(4, Math.round(STRIPE_PERIOD_PX * dpr));
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) return null;
    tileCtx.strokeStyle = color;
    tileCtx.globalAlpha = STRIPE_ALPHA;
    tileCtx.lineWidth = STRIPE_WIDTH_PX * dpr;
    tileCtx.beginPath();
    for (const shift of [-1, 0, 1]) {
      tileCtx.moveTo(shift * size, size);
      tileCtx.lineTo(size + shift * size, 0);
    }
    tileCtx.stroke();
    const created = ctx.createPattern(tile, "repeat");
    if (!created) return null;
    pattern = created;
    stripes.set(key, pattern);
  }
  return pattern;
}

/** One pattern pixel is one device pixel whatever the camera zoom, so the spacing stays constant on screen. */
export function stripeTransform(cameraScale: number, dpr: number): DOMMatrix {
  return new DOMMatrix().scale(1 / (cameraScale * dpr));
}

// ---- sea noise ----

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTile: HTMLCanvasElement | null = null;

/** 256 px grey noise from a seeded generator (the same every run), drawn at 4 % alpha over the sea. */
export function getNoiseTile(): HTMLCanvasElement | null {
  if (noiseTile) return noiseTile;
  const tile = document.createElement("canvas");
  tile.width = 256;
  tile.height = 256;
  const tileCtx = tile.getContext("2d");
  if (!tileCtx) return null;
  const image = tileCtx.createImageData(256, 256);
  const random = mulberry32(20261018);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.floor(random() * 256);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  tileCtx.putImageData(image, 0, 0);
  noiseTile = tile;
  return tile;
}
