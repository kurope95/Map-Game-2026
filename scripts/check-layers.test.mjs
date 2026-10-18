import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkLayers, findImportSpecifiers, isLayerViolation } from "./check-layers.mjs";

describe("findImportSpecifiers", () => {
  it("finds static, side-effect, re-export, dynamic and require specifiers", () => {
    const source = `
      import a from "../x";
      import { b } from '../y';
      import type { T } from "../types";
      import "../side-effect";
      export * from "../z";
      export { c } from "../w";
      const d = await import("../dyn");
      const e = require("../req");
    `;
    expect(findImportSpecifiers(source)).toEqual(["../x", "../y", "../types", "../side-effect", "../z", "../w", "../dyn", "../req"]);
  });

  it("ignores import-looking text inside comments", () => {
    const source = `
      // import a from "../../ui/commented";
      /* import b from "react"; */
      import ok from "../rules/turnEngine";
    `;
    expect(findImportSpecifiers(source)).toEqual(["../rules/turnEngine"]);
  });
});

describe("isLayerViolation", () => {
  it.each(["../../ui/mapLayout", "../ui", "../app/App", "react", "react-dom/client"])("flags %s", (specifier) => {
    expect(isLayerViolation(specifier)).toBe(true);
  });

  it.each(["../rules/turnEngine", "./regionGeo", "d3-geo", "vitest", "../content/ui-helpers", "../rules/application"])("allows %s", (specifier) => {
    expect(isLayerViolation(specifier)).toBe(false);
  });
});

describe("checkLayers", () => {
  it("reports every forbidden import with its file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-layers-"));
    try {
      fs.mkdirSync(path.join(dir, "content"));
      fs.writeFileSync(path.join(dir, "content", "bad.ts"), 'import { x } from "../../ui/mapLayout";\nimport { useState } from "react";\n');
      fs.writeFileSync(path.join(dir, "content", "good.ts"), 'import { y } from "../rules/turnEngine";\n');
      const violations = checkLayers(dir);
      expect(violations.map((v) => v.specifier).sort()).toEqual(["../../ui/mapLayout", "react"]);
      expect(violations.every((v) => v.file.endsWith("bad.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds no violations in the real rules engine (src/game)", () => {
    expect(checkLayers(path.resolve(import.meta.dirname, "..", "src", "game"))).toEqual([]);
  });
});
