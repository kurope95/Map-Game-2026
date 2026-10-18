// Layering check (constraint C6): nothing under src/game/ may import UI, app or React code, so the
// rules engine keeps running in plain Node. Run with `npm run check:layers`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// A path segment named ui or app (../ui/x, ../app/App, ../ui) or any react package.
const FORBIDDEN = /(?:^|\/)(?:ui|app)(?:\/|$)|^react/;

// import ... from "x" / export ... from "x" / import "x" / import("x") / require("x")
const IMPORT_PATTERN =
  /\b(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

export function findImportSpecifiers(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  return [...code.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2] ?? match[3] ?? match[4]);
}

export function isLayerViolation(specifier) {
  return FORBIDDEN.test(specifier);
}

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

export function checkLayers(rootDir) {
  const violations = [];
  for (const file of listSourceFiles(rootDir)) {
    for (const specifier of findImportSpecifiers(fs.readFileSync(file, "utf8"))) {
      if (isLayerViolation(specifier)) violations.push({ file, specifier });
    }
  }
  return violations;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "game");
  const violations = checkLayers(root);
  if (violations.length === 0) {
    console.log("Layering: PASS");
    return;
  }
  console.log("Layering: FAIL (src/game must not import ui, app or react)");
  for (const { file, specifier } of violations) {
    console.log(`${path.relative(process.cwd(), file).split(path.sep).join("/")}: ${specifier}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
