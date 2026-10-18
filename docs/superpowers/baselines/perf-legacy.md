# Pan/zoom benchmark: legacy SVG map vs the canvas map

Constraint C2 (plan 2026-10-18-visual-overhaul → Tasks 3, 28 and 30). `scripts/perf/pan-zoom-bench.js`
drives 180 scripted `pointermove` frames on the map plus 20 wheel steps and reports requestAnimationFrame
deltas, `mapRenders` (React renders of the map component) and `idleMs` (the display's empty-frame interval).

## Environment (2026-10-19)

- Windows 11, Chrome headless (`--headless=new --enable-gpu`), 1440x900, device scale factor 1.
- GPU: ANGLE / Direct3D 11 on "Qualcomm(R) Adreno(TM) X1-45" (integrated).
- Virtual display refreshes at 120 Hz: `idleMs` 8.3-8.4 ms.
- A control loop (a 1440x900 canvas clearing and drawing 120 rectangles per frame) holds 8.33 ms
  average, so the harness itself is not the limit.

## Results (three runs each, medians of the three)

| Build | avg frame | p95 | max | mapRenders |
|---|---|---|---|---|
| Legacy SVG map (`legacy` f1455a1, line-for-line the pre-overhaul game) | 71.71 ms | 91.60 ms | 133.40 ms | n/a (no `__mapStats`) |
| Canvas map (`main` 65658ab + Task 30 cleanups) | 42.75 ms | 50.10 ms | 58.40 ms | **0** |

Run-by-run canvas map: 45.37 / 42.75 / 40.87 ms avg; p95 50.1 / 50.1 / 50.0 ms.
Run-by-run legacy: 74.87 / 71.71 / 68.83 ms avg; p95 100.0 / 91.6 / 83.3 ms.

The canvas map pans about 1.7x faster than the legacy SVG map in the same environment, and its p95 is
1.8x lower. `mapRenders` is 0 in every run: pan and zoom never re-render the map through React (C2's
structural requirement).

## Caveat: the absolute numbers are not the C2 verdict

The benchmark was designed to run in the visible browser pane; the numbers above come from a headless
Chrome. In that mode frame times do not scale with the viewport (43.9 ms at 720x450, 49.3 ms at
1920x1080), which points at a per-frame presentation cost of the headless compositor rather than at map
work: the map's own draw callback measures 0.9-2.2 ms (`__mapStats.avgFrameMs`) and dispatch is 0.1 ms.
The absolute C2 check (`average frame interval <= idle interval + 1 ms`, provisional reading of C2 for a
120 Hz display) still needs one run in the visible browser with its window in front. Until then, read
the table as a relative legacy-vs-canvas comparison, not as an 8 ms-budget pass or fail.
