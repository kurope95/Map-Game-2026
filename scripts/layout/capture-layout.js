// Layout lock capture (spec 12.2, constraint C1).
//
// A browser snippet: one async IIFE that returns a JSON object. Run it inside the started game
// (for example with the preview tools' javascript_tool; the dev server also serves this file, so
// `await (0, eval)(await (await fetch('/scripts/layout/capture-layout.js')).text())` runs it) and
// save the result to a file, then compare two captures with:
//   node scripts/layout/compare-layout.mjs <baseline.json> <candidate.json>
//
// It opens every probed container through the UI, records its bounding box and closes it again,
// then restores the initial screen (Region panel open). Result shape:
//   { viewport: {width, height},
//     probes: { [name]: { rect: {left, top, right, bottom, width, height, centerX, centerY},
//                         items?: [{key, centerY}] } },
//     missing: string[] }
//
// Convention for new code: put data-layout="<probe name>" on every probed element,
// data-layout-key="<key>" on every top-bar and bottom-bar control and on the map controls, and
// data-layout="<probe>-backdrop" on modal backdrops. Legacy selectors are the fallback.
(async () => {
  // Two MessageChannel ticks after each click. requestAnimationFrame and setTimeout are throttled
  // while the browser pane is hidden, MessageChannel is not.
  const tick = () => new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
  const settle = async () => {
    await tick();
    await tick();
    for (const animation of document.getAnimations()) {
      try { animation.finish(); } catch (error) { /* infinite animations cannot finish */ }
    }
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
  const q = (selector) => document.querySelector(selector);
  const layout = (name, legacy) => q(`[data-layout="${name}"]`) || (legacy ? legacy() : null);

  // Key rule: data-layout-key, "spacer"/"divider" by class, "select", first direct text node,
  // title, full text; the map controls "+" and "-" map to zoomin and zoomout.
  const keyOf = (el) => {
    const explicit = el.getAttribute("data-layout-key");
    if (explicit) return explicit;
    const cls = typeof el.className === "string" ? el.className : "";
    if (cls.includes("spacer")) return "spacer";
    if (cls.includes("divider")) return "divider";
    if (el.tagName === "SELECT") return "select";
    const text = (el.textContent || "").trim();
    if (text === "+") return "zoomin";
    if (text === "-" || text === "−") return "zoomout";
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const key = normalize(node.textContent);
        if (key) return key;
      }
    }
    return normalize(el.getAttribute("title")) || normalize(el.textContent);
  };

  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: round2(r.left), top: round2(r.top), right: round2(r.right), bottom: round2(r.bottom),
      width: round2(r.width), height: round2(r.height),
      centerX: round2(r.left + r.width / 2), centerY: round2(r.top + r.height / 2),
    };
  };

  const panel = (name) => () => layout(name, () => q(".float-panel--bottom-center"));
  const finders = {
    "top-bar": () => layout("top-bar", () => q(".top-bar")),
    "bottom-bar": () => layout("bottom-bar", () => q(".bottom-bar")),
    "map-stage": () => layout("map-stage", () => q(".map-stage")),
    "map-controls": () => layout("map-controls", () => q(".map-controls")),
    "supply-toggle": () => layout("supply-toggle", () => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("SUPPLY LINES")) || null),
    "unit-drawer": () => layout("unit-drawer", () => q(".unit-drawer")),
    "panel-region": () => layout("panel-region", () => q(".float-panel--bottom-left")),
    "panel-economy": panel("panel-economy"),
    "panel-recruitment": panel("panel-recruitment"),
    "panel-orders": panel("panel-orders"),
    "panel-aiintel": panel("panel-aiintel"),
    "panel-warstatus": panel("panel-warstatus"),
    "panel-eventlog": panel("panel-eventlog"),
    stockpile: () => layout("stockpile", () => q(".stockpile-popup")),
    facility: () => layout("facility", () => q(".facility-popup")),
    "global-units": () => layout("global-units", () => q(".global-units-panel")),
    diplomacy: () => layout("diplomacy", () => [...document.querySelectorAll(".float-panel")].find((p) => (((p.querySelector(".float-panel__header") || {}).textContent) || "").trim().startsWith("Diplomacy")) || null),
    doctrines: () => layout("doctrines", () => {
      const header = [...document.querySelectorAll("span, h1, h2, h3, div")].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes("DOCTRINE UPGRADES")));
      let overlay = header;
      while (overlay && getComputedStyle(overlay).position !== "fixed") overlay = overlay.parentElement;
      return overlay ? overlay.firstElementChild : null;
    }),
    "save-load": () => layout("save-load", () => q(".save-modal")),
    "logic-map": () => layout("logic-map", () => q(".logic-map-modal")),
  };
  const itemKinds = { "top-bar": "children", "bottom-bar": "buttons", "map-controls": "buttons" };

  // The bar controls: [data-layout-key] descendants if there are any, else the legacy rule.
  const barControls = (name) => {
    const container = finders[name]();
    if (!container) return [];
    const keyed = [...container.querySelectorAll("[data-layout-key]")];
    const elements = keyed.length ? keyed : itemKinds[name] === "children" ? [...container.children] : [...container.querySelectorAll("button")];
    return elements.map((el) => ({ el, key: keyOf(el) }));
  };

  const probes = {};
  const missing = [];
  const press = async (el) => { el.click(); await settle(); };
  const pressBar = async (name, key) => {
    const control = barControls(name).find((c) => c.key === key);
    if (control) await press(control.el);
    return Boolean(control);
  };
  const tab = (key) => pressBar("bottom-bar", key);
  const top = (key) => pressBar("top-bar", key);
  const measure = (name) => {
    const el = finders[name]();
    if (!el) { missing.push(name); return false; }
    const entry = { rect: rectOf(el) };
    if (itemKinds[name]) entry.items = barControls(name).map((c) => ({ key: c.key, centerY: round2(rectOf(c.el).centerY) }));
    probes[name] = entry;
    return true;
  };

  await document.fonts.ready;
  await settle();
  const regionOpenAtStart = Boolean(finders["panel-region"]());

  // Always-on probes.
  for (const name of ["top-bar", "bottom-bar", "map-stage", "map-controls", "supply-toggle", "unit-drawer"]) measure(name);

  // Region panel: open by default; click the tab to open it first when it is not.
  if (!regionOpenAtStart) await tab("region");
  measure("panel-region");
  await tab("region");

  // Bottom-tab panels and the stockpile pop-up: open, measure, close.
  for (const [name, key] of [
    ["panel-economy", "economy"], ["panel-recruitment", "recruitment"], ["panel-orders", "orders"],
    ["panel-aiintel", "aiintel"], ["panel-warstatus", "warstatus"], ["panel-eventlog", "eventlog"],
    ["stockpile", "stockpile"],
  ]) {
    if (await tab(key)) measure(name); else missing.push(name);
    await tab(key);
  }

  // Facility pop-up: economy tab, then the first clickable facility row.
  await tab("economy");
  if (q(".facility-item--clickable")) {
    await press(q(".facility-item--clickable"));
    measure("facility");
    if (q(".facility-item--clickable")) await press(q(".facility-item--clickable"));
  } else {
    missing.push("facility");
  }
  await tab("economy");

  // Top-bar windows: open, measure, toggle closed.
  for (const [name, key] of [["global-units", "units"], ["diplomacy", "diplomacy"], ["doctrines", "doctrines"]]) {
    if (await top(key)) measure(name); else missing.push(name);
    await top(key);
  }

  // Save/Load modal: close through its backdrop.
  if (await top("savegame")) {
    measure("save-load");
    const backdrop = layout("save-load-backdrop", () => q(".save-modal-overlay"));
    if (backdrop) await press(backdrop);
  } else {
    missing.push("save-load");
  }

  // Economy logic map: opened from the stockpile pop-up, closed through its backdrop.
  await tab("stockpile");
  const logicMapButton = [...document.querySelectorAll("button")].find((b) => keyOf(b) === "logicmap");
  if (logicMapButton) {
    await press(logicMapButton);
    measure("logic-map");
    const backdrop = layout("logic-map-backdrop", () => q(".logic-map-overlay"));
    if (backdrop) await press(backdrop);
  } else {
    missing.push("logic-map");
  }
  await tab("stockpile");

  // Back to the initial screen.
  if (regionOpenAtStart) await tab("region");

  return { viewport: { width: window.innerWidth, height: window.innerHeight }, probes, missing };
})()
