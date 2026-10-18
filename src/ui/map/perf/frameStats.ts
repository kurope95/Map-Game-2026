// Dev-only frame-time meter for the canvas map. `recordFrame` receives the draw time of every rendered
// frame, `recordRender` is called from MapView's render body, so a benchmark can prove that panning and
// zooming never re-render React (window.__mapStats.renders stays constant).
const WINDOW = 120;

let renders = 0;
let frames = 0;
let lastFrameMs = 0;
const samples: number[] = [];

export interface MapStats {
  renders: number;
  frames: number;
  lastFrameMs: number;
  avgFrameMs: number;
  p95FrameMs: number;
}

export function recordRender(): void {
  renders += 1;
}

export function recordFrame(ms: number): void {
  frames += 1;
  lastFrameMs = ms;
  samples.push(ms);
  if (samples.length > WINDOW) samples.shift();
}

export function readStats(): MapStats {
  if (samples.length === 0) return { renders, frames, lastFrameMs, avgFrameMs: 0, p95FrameMs: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((total, value) => total + value, 0);
  return {
    renders,
    frames,
    lastFrameMs,
    avgFrameMs: sum / samples.length,
    p95FrameMs: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]
  };
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  Object.defineProperty(window, "__mapStats", { configurable: true, get: readStats });
}
