import { describe, expect, it } from "vitest";
import { createInitialState } from "./createInitialState";
import type { GameState } from "./types";

/**
 * Runtime graph checks for the core noding reshuffle
 * (spec 2026-10-19-noding-reshuffle-analysis.md, 15 edits).
 *
 * These read the live state from createInitialState, not the static scenario file, so they cover
 * the 40 generated satellite regions too.
 */

type Graph = Map<string, Set<string>>;

function graphOf(regions: Record<string, { adjacentRegionIds: string[] }>): Graph {
  const graph: Graph = new Map();
  for (const [id, region] of Object.entries(regions)) {
    graph.set(id, new Set(region.adjacentRegionIds));
  }
  return graph;
}

function scenarioGraph(state: GameState): Graph {
  return graphOf(Object.fromEntries(state.scenario.regions.map((region) => [region.id, region])));
}

function edgeKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function edgeSet(graph: Graph): Set<string> {
  const edges = new Set<string>();
  for (const [id, neighbors] of graph) {
    for (const neighbor of neighbors) edges.add(edgeKey(id, neighbor));
  }
  return edges;
}

function hasEdge(graph: Graph, left: string, right: string): boolean {
  return graph.get(left)?.has(right) ?? false;
}

function connectedComponents(graph: Graph): number {
  const seen = new Set<string>();
  let components = 0;
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    components += 1;
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const id = queue.pop()!;
      for (const neighbor of graph.get(id) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return components;
}

/** Tarjan bridge/articulation pass over an undirected graph. */
function bridgeAndArticulationPoints(graph: Graph): { bridges: string[]; articulationPoints: string[] } {
  let time = 0;
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const bridges: string[] = [];
  const articulation = new Set<string>();

  function visit(id: string) {
    discovery.set(id, time);
    low.set(id, time);
    time += 1;
    let children = 0;

    for (const neighbor of graph.get(id) ?? []) {
      if (!graph.has(neighbor)) continue;
      if (!discovery.has(neighbor)) {
        parent.set(neighbor, id);
        children += 1;
        visit(neighbor);
        low.set(id, Math.min(low.get(id)!, low.get(neighbor)!));
        if (low.get(neighbor)! > discovery.get(id)!) bridges.push(edgeKey(id, neighbor));
        if (parent.get(id) !== undefined && parent.get(id) !== null && low.get(neighbor)! >= discovery.get(id)!) {
          articulation.add(id);
        }
      } else if (neighbor !== parent.get(id)) {
        low.set(id, Math.min(low.get(id)!, discovery.get(neighbor)!));
      }
    }

    if (parent.get(id) === null && children > 1) {
      articulation.add(id);
    }
  }

  for (const id of graph.keys()) {
    if (!discovery.has(id)) {
      parent.set(id, null);
      visit(id);
    }
  }

  return { bridges: bridges.sort(), articulationPoints: [...articulation].sort() };
}

const MUST_KEEP: Array<[string, string]> = [
  ["odesa", "chisinau-pridnestrovie"],
  ["odesa", "zaporizhzhia"],
  ["zaporizhzhia", "zaporizhzhia-tokmak-line"],
  ["mariupol", "zaporizhzhia-tokmak-line"],
  ["chisinau", "chisinau-pridnestrovie"],
  ["brest", "warsaw"],
  ["brest", "minsk"],
  ["odesa", "constanta"],
];

const CUT: Array<[string, string]> = [
  ["moscow", "kazan"],
  ["kazan-volga-bend-2", "moscow"],
  ["nizhny-novgorod-oka-district", "moscow"],
  ["minsk", "warsaw"],
  ["minsk-central-belt", "warsaw"],
  ["bryansk", "minsk"],
  ["berlin", "essen"],
  ["odesa", "bucharest"],
  ["saint-petersburg-neva-corridor", "tallinn"],
  ["tallinn-east", "helsinki"],
];

const ADDED: Array<[string, string]> = [
  ["minsk", "vilnius"],
  ["warsaw", "kaunas"],
  ["berlin", "hannover"],
  ["belgrade", "zagreb"],
  ["sevastopol", "mariupol"],
];

describe("runtime region graph after the noding reshuffle", () => {
  const state = createInitialState("RUSSIA");
  const graph = graphOf(state.regions);

  it("has 103 regions and 222 symmetric undirected edges", () => {
    expect(Object.keys(state.regions)).toHaveLength(103);
    expect(edgeSet(graph).size).toBe(222);
    for (const [id, neighbors] of graph) {
      for (const neighbor of neighbors) {
        expect(graph.get(neighbor)?.has(id), `${id} -> ${neighbor} is not symmetric`).toBe(true);
      }
    }
  });

  it("is one connected component with no leaves and no bridges", () => {
    expect(connectedComponents(graph)).toBe(1);
    for (const [id, neighbors] of graph) {
      expect(neighbors.size, `${id} is a leaf`).toBeGreaterThanOrEqual(2);
    }
    const { bridges, articulationPoints } = bridgeAndArticulationPoints(graph);
    expect(bridges).toEqual([]);
    expect(articulationPoints).toEqual(["helsinki", "nizhny-novgorod"]);
  });

  it("keeps every required corridor link", () => {
    for (const [left, right] of MUST_KEEP) {
      expect(hasEdge(graph, left, right), `${left}–${right} must exist`).toBe(true);
    }
  });

  it("applies all 10 cuts and 5 additions", () => {
    for (const [left, right] of CUT) {
      expect(hasEdge(graph, left, right), `${left}–${right} must be cut`).toBe(false);
    }
    for (const [left, right] of ADDED) {
      expect(hasEdge(graph, left, right), `${left}–${right} must be added`).toBe(true);
    }
  });

  it("does not add a direct Odesa–Tokmak edge", () => {
    expect(hasEdge(graph, "odesa", "zaporizhzhia-tokmak-line")).toBe(false);
  });

  it("keeps state.scenario.regions on the same graph as state.regions", () => {
    expect(edgeSet(scenarioGraph(state))).toEqual(edgeSet(graph));
    expect(scenarioGraph(state).size).toBe(graph.size);
  });
});
