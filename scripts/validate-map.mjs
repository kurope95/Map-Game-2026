import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "src", "game", "content", "regions.ts");
const text = fs.readFileSync(filePath, "utf8");
const layoutPath = path.join(process.cwd(), "src", "ui", "mapLayout.ts");
const layoutText = fs.readFileSync(layoutPath, "utf8");

const ids = [...text.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
const adjacencyBlocks = [...text.matchAll(/adjacentRegionIds: \[([^\]]*)\]/g)].map(
  (match) => match[1]
);

const adjacency = new Map();
const layoutIds = [...layoutText.matchAll(/"([^"]+)": \{/g)].map((match) => match[1]);

ids.forEach((id, index) => {
  const raw = adjacencyBlocks[index] ?? "";
  const neighbors = [...raw.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  adjacency.set(id, neighbors);
});

const missingIds = [];
const asymmetricLinks = [];
const missingLayoutIds = ids.filter((id) => !layoutIds.includes(id));
const orphanLayoutIds = layoutIds.filter((id) => !ids.includes(id));

for (const [id, neighbors] of adjacency.entries()) {
  for (const neighbor of neighbors) {
    if (!adjacency.has(neighbor)) {
      missingIds.push(`${id} -> ${neighbor}`);
      continue;
    }

    if (!adjacency.get(neighbor).includes(id)) {
      asymmetricLinks.push(`${id} -> ${neighbor}`);
    }
  }
}

if (
  missingIds.length === 0 &&
  asymmetricLinks.length === 0 &&
  missingLayoutIds.length === 0 &&
  orphanLayoutIds.length === 0
) {
  console.log(`Map validation passed for ${ids.length} regions.`);
  process.exit(0);
}

if (missingIds.length > 0) {
  console.error("Missing region references:");
  for (const item of missingIds) {
    console.error(`- ${item}`);
  }
}

if (asymmetricLinks.length > 0) {
  console.error("Asymmetric adjacency links:");
  for (const item of asymmetricLinks) {
    console.error(`- ${item}`);
  }
}

if (missingLayoutIds.length > 0) {
  console.error("Regions missing map coordinates:");
  for (const item of missingLayoutIds) {
    console.error(`- ${item}`);
  }
}

if (orphanLayoutIds.length > 0) {
  console.error("Map coordinates without matching regions:");
  for (const item of orphanLayoutIds) {
    console.error(`- ${item}`);
  }
}

process.exit(1);
