// Layout lock CLI: node scripts/layout/compare-layout.mjs <baseline.json> <candidate.json>
// Prints "Layout lock: PASS" (exit 0) or "Layout lock: FAIL" plus one failure per line (exit 1).
import fs from "node:fs";
import { compareLayout } from "./compareLayout.mjs";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  console.error("usage: node scripts/layout/compare-layout.mjs <baseline.json> <candidate.json>");
  process.exit(2);
}

const readCapture = (path) => JSON.parse(fs.readFileSync(path, "utf8").replace(/^﻿/, ""));
const result = compareLayout(readCapture(baselinePath), readCapture(candidatePath));

if (result.ok) {
  console.log("Layout lock: PASS");
  process.exit(0);
}
console.log("Layout lock: FAIL");
for (const failure of result.failures) console.log(failure);
process.exit(1);
