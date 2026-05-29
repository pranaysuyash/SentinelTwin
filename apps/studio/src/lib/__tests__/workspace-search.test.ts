import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
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
      },
      maxResults: 10,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.kind === "workspace" && hit.title === scene.name)).toBe(true);
    expect(hits.some((hit) => hit.kind === "evidence" && hit.title.includes("Camera 1"))).toBe(true);
    expect(hits.some((hit) => hit.kind === "report" && hit.summary.includes("Coverage"))).toBe(true);
    expect(hits.some((hit) => hit.kind === "archive" && hit.branchLabel === "published" && hit.routeTab === "timeline")).toBe(true);
  });
});
