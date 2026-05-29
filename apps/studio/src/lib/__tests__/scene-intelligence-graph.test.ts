import { describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
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

  test("attaches node version history from operational evidence", () => {
    const camera = smallRetailShopScene.cameras[0]!;
    const evidence = buildOperationalEvidenceEvent({
      kind: "camera_metadata_updated",
      title: "Camera metadata updated",
      details: "Camera metadata refresh applied.",
      actor: "user",
      source: "manual",
      sceneId: smallRetailShopScene.id,
      sceneName: smallRetailShopScene.name,
      revisionDepth: 1,
      affectedNodeIds: [camera.id],
      confidence: 0.92,
      beforeSummary: "Before: status on.",
      afterSummary: "After: status dirty.",
    });

    const graph = buildSceneIntelligenceGraph(smallRetailShopScene, {
      operationalEvidenceEvents: [evidence],
      revisionDepth: 1,
      snapshotCount: 0,
    });

    const cameraNode = graph.nodes.find((node) => node.id === `camera:${camera.id}`);
    expect(cameraNode?.historyCount).toBe(1);
    expect(cameraNode?.latestEvidenceKind).toBe("camera_metadata_updated");
    expect(cameraNode?.latestEvidenceSummary).toContain("After:");
  });
});
