import { describe, expect, test } from "bun:test";

import { buildDiagnosticBundle, stringifyDiagnosticBundle } from "@/lib/diagnostic-bundle";
import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
import { createDefaultWorkspaceAccessState } from "@/lib/workspace-access";
import { createDefaultWorkspaceGovernance } from "@/lib/workspace-governance";
import { simulateStudio } from "@/simulation/simulate-studio";
import { createRuntimeIncident } from "@/store/studio-store";

describe("diagnostic bundle", () => {
  test("captures a support-ready scene, simulation, graph, and evidence snapshot", () => {
    const simulationResult = simulateStudio(smallRetailShopScene);
    const graph = buildSceneIntelligenceGraph(smallRetailShopScene, {
      simulationResult,
      revisionDepth: 4,
      snapshotCount: 2,
    });
    const events = [
      buildOperationalEvidenceEvent({
        kind: "scene_created",
        title: "Scene created",
        details: "Initial published scene",
        actor: "user",
        source: smallRetailShopScene.source,
        sceneId: smallRetailShopScene.id,
        sceneName: smallRetailShopScene.name,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        branchLabel: "draft",
        lifecycleStage: "draft",
      }),
      buildOperationalEvidenceEvent({
        kind: "scene_published",
        title: "Scene published",
        details: "Published scene checkpoint",
        actor: "user",
        source: smallRetailShopScene.source,
        sceneId: smallRetailShopScene.id,
        sceneName: smallRetailShopScene.name,
        revisionDepth: 2,
        affectedNodeIds: [],
        confidence: 0.98,
        branchLabel: "published",
        lifecycleStage: "published",
      }),
    ];
    const runtimeIncidents = [
      createRuntimeIncident({
        category: "performance_trace",
        severity: "info",
        title: "Simulation completed",
        details: "Shared simulation completed successfully.",
        durationMs: 42,
        action: "runSimulation",
        path: "/studio",
      }),
      createRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "Unhandled rejection",
        details: "A rejected promise was caught by the global handler.",
        stack: "Error: boom",
        path: "/studio",
      }),
    ];

    const bundle = buildDiagnosticBundle({
      scene: smallRetailShopScene,
      simulationResult,
      sceneIntelligenceGraph: graph,
      operationalEvidenceEvents: events,
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceGovernance: { ...createDefaultWorkspaceGovernance(), approvalMode: "open", sceneStatus: "published" },
      lastRunMs: 123,
      showDebugOverlays: true,
      overlayDensity: "compact",
      autoRecompute: false,
      cameraFailures: ["cam_counter"],
      runtimeIncidents,
      localOnlyMode: false,
      aiProviderLabel: "OpenAI GPT-5",
      simulationDirty: false,
      simulationRunning: false,
      launchNotice: "Scene opened successfully.",
      pathname: "/studio",
      userAgent: "bun-test",
    });

    expect(bundle.version).toBe("1");
    expect(bundle.scene.id).toBe(smallRetailShopScene.id);
    expect(bundle.scene.sourceLabel).toContain("Demo");
    expect(bundle.simulation.totalCoveragePct).toBeGreaterThanOrEqual(0);
    expect(bundle.graph.nodeCount).toBeGreaterThan(0);
    expect(bundle.evidence.totalEvents).toBe(2);
    expect(bundle.evidence.kindCounts.scene_published).toBe(1);
    expect(bundle.evidence.recentEvents[0]?.branchLabel).toBe("published");
    expect(bundle.governance.sceneStatus).toBe("published");
    expect(bundle.governance.approvalMode).toBe("open");
    expect(bundle.access.teamSize).toBeGreaterThan(0);
    expect(bundle.access.mode).toBe("single_user");
    expect(bundle.runtime.cameraFailures).toBe(1);
    expect(bundle.runtime.aiPolicyLabel).toBe("Hybrid");
    expect(bundle.runtime.incidentCount).toBe(2);
    expect(bundle.runtime.recentIncidents[0]?.category).toBe("runtime_failure");
    expect(bundle.runtime.performanceTraces[0]?.title).toBe("Simulation completed");
    expect(bundle.runtime.journeyHealth[0]?.kind).toBe("import");
    expect(bundle.runtime.journeyHealth[3]?.label).toBe("Render");
    expect(bundle.runtime.recentTrace[0]?.title).toBe("Scene published");
    expect(stringifyDiagnosticBundle(bundle)).toContain("\"version\": \"1\"");
  });
});
