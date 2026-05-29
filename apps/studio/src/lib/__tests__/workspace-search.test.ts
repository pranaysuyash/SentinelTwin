import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { createOperationalEvidenceArchiveHistoryRecord } from "@/lib/operational-evidence-archive-history";
import { searchWorkspaceMemory } from "@/lib/workspace-search";
import type { GovernanceArchiveRecord } from "@/lib/governance-archive";
import type { SimulationResult } from "@/schema/security-scene";

describe("workspace search", () => {
  test("finds workspace, evidence, and report hits from a single query", () => {
    const scene = createSmallRetailShopScene();
    scene.changeLog = [
      ...scene.changeLog,
      "Evidence: May 29, 10:00 AM | Sensor Triggered | Front door contact triggered near Camera 1 | high",
      "Evidence: May 29, 10:05 AM | Simulation Run | Coverage recomputed after scene edit | medium",
    ];
    const result = {
      totalCoveragePct: 82,
      blindspotPct: 18,
      recognitionAreaPct: 61,
      identificationAreaPct: 39,
      worstAreaQuality: "observation",
      criticalZoneResults: [],
      issues: [
        {
          id: "issue_camera_1",
          title: "Camera 1 coverage gap",
          description: "Camera 1 misses the cash counter edge during peak traffic.",
          severity: "medium",
        },
      ],
      recommendations: [
        {
          id: "rec_camera_1",
          title: "Re-aim Camera 1",
          description: "Adjust Camera 1 to cover the cash counter and entry lane.",
          priority: "high",
        },
      ],
      pathResults: [],
    } as unknown as SimulationResult;

    const hits = searchWorkspaceMemory("camera 1 coverage", {
      currentScene: scene,
      currentResult: result,
      savedProjects: [
        {
          scene,
          workspaceOrganization: "Personal Workspace",
          workspaceOwner: "You",
          workspaceVisibility: "private",
          folder: "Retail",
          tags: ["audit"],
          pinned: false,
          createdAt: scene.createdAt,
          updatedAt: scene.updatedAt,
          lastOpenedAt: null,
        },
      ],
      archives: {
        governanceArchiveHistory: [
          {
            ok: true,
            source: "debug-panel",
            receivedAt: "2026-05-29T00:00:00.000Z",
            sceneId: scene.id,
            sceneName: scene.name,
            summary: "Approval trail queued for Camera 1 coverage audit.",
            archiveStatus: "local cache",
            historyId: "governance_history_1",
            governanceTrail: {
              totalEvents: 1,
              requestCount: 0,
              approvalCount: 0,
              rejectionCount: 0,
              annotationCount: 0,
              roleChangeCount: 0,
              policyChangeCount: 0,
              latestEvent: {
                id: "governance_event_1",
                kind: "scene_published",
                title: "Scene published",
                details: "Promoted the current scene state to the published branch.",
                timestamp: 1_725_000_000_000,
                branchLabel: "published",
                lifecycleStage: "published",
              },
              recentEvents: [],
            },
            deliveredCount: 0,
            queuedCount: 1,
            failedCount: 0,
            destinations: [],
            submittedAt: 1_725_000_000_000,
            storedAt: 1_725_000_000_500,
          } as GovernanceArchiveRecord,
        ],
        operationalEvidenceArchiveHistory: [
          createOperationalEvidenceArchiveHistoryRecord({
            exportedAt: "2026-05-29T00:10:00.000Z",
            source: "studio",
            scene,
            simulationResult: result,
            sceneIntelligenceGraphSummary: {} as never,
            operationalEvidenceEvents: [
              {
                id: "evidence_event_2",
                kind: "scene_reverted",
                title: "Operational archive restored",
                details: "Restored the workspace from an exported operational evidence archive.",
                actor: "user",
                source: scene.source,
                sceneId: scene.id,
                sceneName: scene.name,
                timestamp: 1_725_000_200_000,
                revisionDepth: 2,
                affectedNodeIds: [],
                confidence: 0.98,
                branchLabel: "recovered",
                lifecycleStage: "recovered",
                published: false,
                sceneSnapshot: scene,
              },
            ],
            workspaceGovernance: {} as never,
            workspaceAccess: {} as never,
            notes: ["Recovered evidence archive"],
          } as never, "recovered", 1_725_000_200_500),
        ],
      },
      maxResults: 10,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.kind === "workspace" && hit.title === scene.name)).toBe(true);
    expect(hits.some((hit) => hit.kind === "evidence" && hit.title.includes("Camera 1"))).toBe(true);
    expect(hits.some((hit) => hit.kind === "report" && hit.summary.includes("Coverage"))).toBe(true);
    expect(hits.some((hit) => hit.kind === "archive" && hit.branchLabel === "published" && hit.routeTab === "timeline" && hit.timelineEventId === "governance_event_1" && hit.targetSummary === "Timeline branch + exact checkpoint")).toBe(true);
  });

  test("finds operational evidence archive hits with exact checkpoint routing", () => {
    const scene = createSmallRetailShopScene();
    const result = {
      totalCoveragePct: 82,
      blindspotPct: 18,
      recognitionAreaPct: 61,
      identificationAreaPct: 39,
      worstAreaQuality: "observation",
      criticalZoneResults: [],
      issues: [],
      recommendations: [],
      pathResults: [],
    } as unknown as SimulationResult;
    const archive = createOperationalEvidenceArchiveHistoryRecord({
      exportedAt: "2026-05-29T00:10:00.000Z",
      source: "studio",
      scene,
      simulationResult: result,
      sceneIntelligenceGraphSummary: {} as never,
      operationalEvidenceEvents: [
        {
          id: "evidence_event_2",
          kind: "scene_reverted",
          title: "Operational archive restored",
          details: "Restored the workspace from an exported operational evidence archive.",
          actor: "user",
          source: scene.source,
          sceneId: scene.id,
          sceneName: scene.name,
          timestamp: 1_725_000_200_000,
          revisionDepth: 2,
          affectedNodeIds: [],
          confidence: 0.98,
          branchLabel: "recovered",
          lifecycleStage: "recovered",
          published: false,
          sceneSnapshot: scene,
        },
      ],
      workspaceGovernance: {} as never,
      workspaceAccess: {} as never,
      notes: ["Recovered evidence archive"],
    } as never, "recovered", 1_725_000_200_500);

    const hits = searchWorkspaceMemory("recovered checkpoint", {
      currentScene: scene,
      currentResult: result,
      savedProjects: [],
      archives: {
        operationalEvidenceArchiveHistory: [archive],
      },
      maxResults: 10,
    });

    expect(hits.some((hit) => hit.kind === "archive" && hit.sourceLabel === "Operational evidence archive" && hit.branchLabel === "recovered" && hit.routeTab === "timeline" && hit.timelineEventId === "evidence_event_2")).toBe(true);
  });
});
