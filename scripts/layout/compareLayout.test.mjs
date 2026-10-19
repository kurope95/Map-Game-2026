import { describe, expect, it } from "vitest";
import { compareLayout, PROBE_FIELDS } from "./compareLayout.mjs";

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, centerX: left + width / 2, centerY: top + height / 2 });
const base = { viewport: { width: 1440, height: 900 }, missing: [], probes: {
  "top-bar": { rect: rect(0, 0, 1440, 36), items: [{ key: "mapgame", centerY: 18 }, { key: "divider", centerY: 18 }, { key: "nation", centerY: 18 }] },
  "panel-region": { rect: rect(8, 500, 400, 362) } } };

describe("compareLayout", () => {
  it("passes identical captures", () => expect(compareLayout(base, base)).toEqual({ ok: true, failures: [] }));
  it("fails a panel moved by 6 px", () => {
    const moved = structuredClone(base); moved.probes["panel-region"].rect = rect(14, 500, 400, 362);
    const r = compareLayout(base, moved);
    expect(r.ok).toBe(false);
    expect(r.failures).toContain("panel-region.left: 8 -> 14");
  });
  it("ignores content-sized height on bottom-anchored panels", () => {
    const taller = structuredClone(base); taller.probes["panel-region"].rect = rect(8, 450, 400, 412);
    expect(compareLayout(base, taller).ok).toBe(true);
  });
  it("fails reordered bar items but ignores dividers", () => {
    const re = structuredClone(base); re.probes["top-bar"].items = [{ key: "nation", centerY: 18 }, { key: "mapgame", centerY: 18 }];
    expect(compareLayout(base, re).ok).toBe(false);
    const noDiv = structuredClone(base); noDiv.probes["top-bar"].items = [{ key: "mapgame", centerY: 18 }, { key: "nation", centerY: 19 }];
    expect(compareLayout(base, noDiv).ok).toBe(true);
  });
  it("fails a probe missing from the candidate", () => {
    const gone = structuredClone(base); delete gone.probes["panel-region"];
    expect(compareLayout(base, gone).failures).toContain("panel-region: missing");
  });

  it("accepts a move of exactly 4 px and rejects 5 px", () => {
    const four = structuredClone(base); four.probes["panel-region"].rect = rect(12, 500, 400, 362);
    expect(compareLayout(base, four).ok).toBe(true);
    const five = structuredClone(base); five.probes["panel-region"].rect = rect(13, 500, 400, 362);
    expect(compareLayout(base, five).failures).toEqual(["panel-region.left: 8 -> 13"]);
  });
  it("lists the key sequences when bar items are reordered", () => {
    const re = structuredClone(base); re.probes["top-bar"].items = [{ key: "nation", centerY: 18 }, { key: "mapgame", centerY: 18 }];
    expect(compareLayout(base, re).failures).toContain("top-bar.items: mapgame,nation -> nation,mapgame");
  });
  it("fails a bar control that moved to another row", () => {
    const row = structuredClone(base); row.probes["top-bar"].items[2].centerY = 30;
    expect(compareLayout(base, row).failures).toContain("top-bar.items[nation].centerY: 18 -> 30");
  });
  it("fails a probe the candidate reports as missing", () => {
    const gone = structuredClone(base); delete gone.probes["panel-region"]; gone.missing = ["panel-region"];
    expect(compareLayout(base, gone).failures).toEqual(["panel-region: missing"]);
  });
  it("fails captures taken at different viewport sizes", () => {
    const other = structuredClone(base); other.viewport = { width: 1920, height: 1080 };
    expect(compareLayout(base, other).failures).toContain("viewport: 1440x900 -> 1920x1080");
  });
  it("fails a capture whose content is wider than the window, whatever the baseline says", () => {
    const wide = structuredClone(base); wide.overflow = { document: 0, shell: 40, "top-bar": 40, "map-stage": 40, "bottom-bar": 0 };
    const r = compareLayout(base, wide);
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual([
      "overflow.shell: content is 40 px wider than the window",
      "overflow.top-bar: content is 40 px wider than the window",
      "overflow.map-stage: content is 40 px wider than the window",
    ]);
  });
  it("tolerates overflow of up to 4 px and captures without overflow data", () => {
    const fits = structuredClone(base); fits.overflow = { document: 0, shell: 4, "top-bar": 0, "map-stage": 0, "bottom-bar": 0 };
    expect(compareLayout(base, fits).ok).toBe(true);
    expect(compareLayout(base, structuredClone(base)).ok).toBe(true); // older captures have no overflow field
  });
  it("knows which fields each probe compares", () => {
    expect(PROBE_FIELDS["panel-region"]).toEqual({ fields: ["left", "bottom"] });
    expect(PROBE_FIELDS["top-bar"]).toEqual({ fields: ["left", "top", "width", "height"], items: true });
    expect(Object.keys(PROBE_FIELDS)).toHaveLength(20);
  });
});
