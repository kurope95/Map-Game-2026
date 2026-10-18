// Layout lock comparison (spec 12.2, constraint C1). Pure: takes two captures made by
// capture-layout.js and returns { ok, failures }.

export const TOLERANCE_PX = 4;

// Fields compared per probe (the "Fields" column of the plan's probe table). `items: true` also
// compares the key order and row (centerY) of the bar controls.
export const PROBE_FIELDS = {
  "top-bar": { fields: ["left", "top", "width", "height"], items: true },
  "bottom-bar": { fields: ["left", "bottom", "width", "height"], items: true },
  "map-stage": { fields: ["left", "top", "right", "bottom"] },
  "map-controls": { fields: ["right", "top"], items: true },
  "supply-toggle": { fields: ["centerX", "top"] },
  "unit-drawer": { fields: ["right", "bottom", "width"] },
  "panel-region": { fields: ["left", "bottom"] },
  "panel-economy": { fields: ["centerX", "bottom"] },
  "panel-recruitment": { fields: ["centerX", "bottom"] },
  "panel-orders": { fields: ["centerX", "bottom"] },
  "panel-aiintel": { fields: ["centerX", "bottom"] },
  "panel-warstatus": { fields: ["centerX", "bottom"] },
  "panel-eventlog": { fields: ["centerX", "bottom"] },
  stockpile: { fields: ["centerX", "bottom"] },
  facility: { fields: ["centerX", "bottom"] },
  "global-units": { fields: ["left", "top", "bottom", "width"] },
  diplomacy: { fields: ["centerX", "top", "width"] },
  doctrines: { fields: ["centerX", "width"] },
  "save-load": { fields: ["centerX", "width"] },
  "logic-map": { fields: ["centerX", "width"] },
};

const withoutDividers = (items) => (items ?? []).filter((item) => item.key !== "divider");

export function compareLayout(baseline, candidate) {
  const failures = [];
  const bv = baseline.viewport;
  const cv = candidate.viewport;
  if (bv && cv && (bv.width !== cv.width || bv.height !== cv.height)) {
    failures.push(`viewport: ${bv.width}x${bv.height} -> ${cv.width}x${cv.height}`);
  }

  for (const name of baseline.missing ?? []) {
    failures.push(`${name}: missing in baseline`);
  }

  for (const [name, base] of Object.entries(baseline.probes ?? {})) {
    const cand = candidate.probes?.[name];
    if (!cand) {
      failures.push(`${name}: missing`);
      continue;
    }
    const spec = PROBE_FIELDS[name];
    if (!spec) continue;

    for (const field of spec.fields) {
      const a = base.rect[field];
      const b = cand.rect[field];
      if (Math.abs(a - b) > TOLERANCE_PX) {
        failures.push(`${name}.${field}: ${Math.round(a)} -> ${Math.round(b)}`);
      }
    }

    if (spec.items && base.items) {
      const baseItems = withoutDividers(base.items);
      const candItems = withoutDividers(cand.items);
      const baseKeys = baseItems.map((item) => item.key);
      const candKeys = candItems.map((item) => item.key);
      if (baseKeys.join(",") !== candKeys.join(",")) {
        failures.push(`${name}.items: ${baseKeys.join(",")} -> ${candKeys.join(",")}`);
      } else {
        baseItems.forEach((item, index) => {
          const other = candItems[index];
          if (Math.abs(item.centerY - other.centerY) > TOLERANCE_PX) {
            failures.push(`${name}.items[${item.key}].centerY: ${Math.round(item.centerY)} -> ${Math.round(other.centerY)}`);
          }
        });
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
