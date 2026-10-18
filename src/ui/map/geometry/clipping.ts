import * as polygonClipping from "polygon-clipping";

// The package's ESM build (used by `vite build`) has only a default export, the same object its CJS build
// assigns to module.exports (used by Node and Vitest). Reading `default` first works in both; the named
// exports are the typed fallback.
const api = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ?? polygonClipping) as typeof polygonClipping;

export const intersection = api.intersection;
