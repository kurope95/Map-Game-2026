const fs = require("node:fs");
const path = require("node:path");

const tempPackagePath = path.join(process.cwd(), ".tmp-check", "package.json");
fs.writeFileSync(tempPackagePath, JSON.stringify({ type: "commonjs" }, null, 2));
require(path.join(process.cwd(), ".tmp-check", "scripts", "check-war-entry.js"));
