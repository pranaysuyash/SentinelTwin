import { describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { simulateStudio } from "@/simulation/simulate-studio";

describe("scene-intelligence-graph", () => {
  test("derives a provenance graph from scene inputs and simulation output", () => {
    const simulationResult = simulateStudio(smallRetailShopScene);
    const graph = buildSceneIntelligenceGraph(smallRetailShopScene, {
      simulationResult,
      revisionDepth: 2,
      snapshotCount: 3,
    });

    expect(graph.rootId).toBe(`scene:${smallRetailShopScene.id}`);
    expect(graph.summary.sceneSourceLabel).toBe("Demo Scene");
    expect(graph.summary.cameraCount).toBe(smallRetailShopScene.cameras.length);
    expect(graph.summary.zoneCount).toBe(smallRetailShopScene.criticalZones.length);
    expect(graph.summary.snapshotCount).toBe(3);
    expect(graph.summary.revisionDepth).toBe(2);
    expect(graph.summary.sourceCounts.demo).toBeGreaterThanOrEqual(1);
    expect(graph.nodes.some((node) => node.kind === "simulation")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "assumption")).toBe(true);
    expect(graph.edges.some((edge) => edge.kind === "covers")).toBe(simulationResult.criticalZoneResults.length > 0);
  });
});
