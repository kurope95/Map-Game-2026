// Pan/zoom benchmark (spec 12.3, constraint C2).
//
// A browser snippet: one async IIFE that returns { avgMs, p95Ms, maxMs, frames, mapRenders, idleMs }
// or { error }. Run it inside the started game with the browser pane VISIBLE (a hidden pane stops
// requestAnimationFrame and invalidates the numbers; the snippet then returns an error). For example
// with the preview tools' javascript_tool, which can load it from the dev server:
//   await (0, eval)(await (await fetch('/scripts/perf/pan-zoom-bench.js')).text())
//
// What it does, on [data-layout="map-canvas"] (fallback: the legacy .theater-map-shell):
//   1. pointerdown at the element center, then 180 pointermove events (one per frame) along an
//      ellipse with radii 200 x 120 px around the center, then pointerup;
//   2. 20 wheel events (one per frame) at the center: deltaY -100 for the first 10, then +100;
//   3. frame times are the requestAnimationFrame deltas of the whole run; the first is dropped.
// mapRenders is window.__mapStats.renders after minus before (React renders of the map component),
// or null when __mapStats does not exist (the legacy SVG map). idleMs is the median frame interval
// of an idle page, measured first: it is the display's floor for any frame time.
(async () => {
  const hidden = { error: "Browser pane hidden: show it and rerun" };
  if (document.visibilityState !== "visible") return hidden;
  const target = document.querySelector('[data-layout="map-canvas"]') || document.querySelector(".theater-map-shell");
  if (!target) return { error: 'Map element not found: [data-layout="map-canvas"] or .theater-map-shell' };

  const round2 = (n) => Math.round(n * 100) / 100;
  const startedAt = performance.now();
  // A hidden pane delivers no (or about one per second) animation frames: give up instead of hanging.
  const nextFrame = () => new Promise((resolve) => {
    const giveUp = setTimeout(() => resolve(null), 2000);
    requestAnimationFrame((t) => { clearTimeout(giveUp); resolve(t); });
  });

  // Idle calibration: 12 frames with nothing happening.
  const idle = [];
  let previous = await nextFrame();
  if (previous === null) return hidden;
  for (let i = 0; i < 12; i++) {
    const t = await nextFrame();
    if (t === null) return hidden;
    idle.push(t - previous);
    previous = t;
  }
  idle.sort((a, b) => a - b);
  const idleMs = round2(idle[Math.floor(idle.length / 2)]);
  if (idleMs > 100) return hidden;

  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const pointer = (type, x, y) => target.dispatchEvent(new PointerEvent(type, {
    pointerId: 7, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1,
    clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true,
  }));
  const wheel = (deltaY) => target.dispatchEvent(new WheelEvent("wheel", {
    deltaY, clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));

  const rendersBefore = window.__mapStats ? window.__mapStats.renders : null;
  const stamps = [];
  const frame = async () => {
    const t = await nextFrame();
    if (t === null || performance.now() - startedAt > 60000) return false;
    stamps.push(t);
    return true;
  };

  if (!(await frame())) return hidden;
  pointer("pointerdown", cx, cy);
  let x = cx;
  let y = cy;
  for (let i = 0; i < 180; i++) {
    if (!(await frame())) return hidden;
    const angle = (i / 180) * 2 * Math.PI;
    x = cx + 200 * Math.cos(angle);
    y = cy + 120 * Math.sin(angle);
    pointer("pointermove", x, y);
  }
  pointer("pointerup", x, y);
  for (let i = 0; i < 20; i++) {
    if (!(await frame())) return hidden;
    wheel(i < 10 ? -100 : 100);
  }
  if (!(await frame())) return hidden;

  const deltas = stamps.slice(1).map((t, i) => t - stamps[i]).slice(1); // drop the first frame
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    avgMs: round2(sum / deltas.length),
    p95Ms: round2(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: round2(sorted[sorted.length - 1]),
    frames: deltas.length,
    mapRenders: rendersBefore === null ? null : (window.__mapStats ? window.__mapStats.renders : 0) - rendersBefore,
    idleMs,
  };
})()
