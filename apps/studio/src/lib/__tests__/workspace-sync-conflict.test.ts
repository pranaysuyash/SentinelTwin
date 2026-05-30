import { describe, expect, test } from "bun:test";
import { resolveSyncConflict } from "@/lib/workspace-sync-conflict";
import type { OperationalEvidenceBranchComparison, OperationalEvidenceEvent, OperationalEvidenceLineageStep } from "@/lib/operational-evidence";
import { createCameraNode } from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { SecurityScene } from "@/schema/security-scene";

describe("workspace-sync-conflict", () => {
  const mockScene = {
    id: "test-scene",
    name: "Test Scene",
    source: "manual" as const,
    walls: [],
    doors: [],
    windows: [],
    entryPoints: [],
    cameras: [],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    privacyZones: [],
    paths: [],
    sensors: [],
    snapshots: [],
    changeLog: [],
    metadata: { lastUpdated: 0 },
  } as unknown as SecurityScene;

  test("handles null comparison", () => {
    const result = resolveSyncConflict(null);
    expect(result.status).toBe("unrelated");
    expect(result.recommendation).toMatch(/Missing comparison data/i);
  });

  test("detects same state", () => {
    const comparison: OperationalEvidenceBranchComparison = {
      left: { depth: 0, event: {} as unknown as OperationalEvidenceEvent },
      right: { depth: 0, event: {} as unknown as OperationalEvidenceEvent },
      commonAncestor: { depth: 0, event: {} as unknown as OperationalEvidenceEvent },
      leftScene: mockScene,
      rightScene: mockScene,
      ancestorScene: mockScene,
      delta: { cameras: 0, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 0, snapshots: 0 },
      leftSceneSummary: null,
      rightSceneSummary: null,
      ancestorSummary: null,
    };
    const result = resolveSyncConflict(comparison);
    expect(result.status).toBe("same");
  });

  test("detects fast_forward_local", () => {
    const comparison: OperationalEvidenceBranchComparison = {
      left: { depth: 1, event: { id: "left-id" } as unknown as OperationalEvidenceEvent },
      right: { depth: 0, event: { id: "right-id" } as unknown as OperationalEvidenceEvent },
      commonAncestor: { depth: 0, event: { id: "right-id" } as unknown as OperationalEvidenceEvent },
      leftScene: { ...mockScene, name: "Local change" },
      rightScene: mockScene,
      ancestorScene: mockScene,
      delta: { cameras: 0, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 0, snapshots: 0 },
      leftSceneSummary: null,
      rightSceneSummary: null,
      ancestorSummary: null,
    };
    const result = resolveSyncConflict(comparison);
    expect(result.status).toBe("fast_forward_local");
    expect(result.mergedScene?.name).toBe("Local change");
  });

  test("detects diverged branches with auto-merge", () => {
    const comparison: OperationalEvidenceBranchComparison = {
      left: { depth: 1, event: { id: "left-id" } as unknown as OperationalEvidenceEvent },
      right: { depth: 1, event: { id: "right-id" } as unknown as OperationalEvidenceEvent },
      commonAncestor: { depth: 0, event: { id: "ancestor-id" } as unknown as OperationalEvidenceEvent },
      leftScene: { ...mockScene, name: "Local change" },
      rightScene: { ...mockScene, name: "Remote change" },
      ancestorScene: mockScene,
      delta: { cameras: 0, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 0, snapshots: 0 },
      leftSceneSummary: null,
      rightSceneSummary: null,
      ancestorSummary: null,
    };
    const result = resolveSyncConflict(comparison);
    expect(result.status).toBe("diverged");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].collection).toBe("scene");
    expect(result.conflicts[0].nodeId).toBe("name");
    expect(result.mergedScene?.name).toBe("Local change");
  });

  test("does not manufacture a conflict when equivalent nodes differ only by property order", () => {
    const baseScene = createBlankSecurityScene();
    const camera = createCameraNode([2, 2, 2]);
    const { id, nodeType, name, position, ...cameraRest } = camera;

    const leftScene = {
      ...structuredClone(baseScene),
      cameras: [
        {
          id,
          nodeType,
          name,
          position,
          ...cameraRest,
        },
      ],
    } as SecurityScene;

    const rightScene = {
      ...structuredClone(baseScene),
      cameras: [
        {
          name,
          nodeType,
          position,
          id,
          ...cameraRest,
        },
      ],
    } as SecurityScene;

    const comparison: OperationalEvidenceBranchComparison = {
      left: { depth: 1, event: { id: "left-id" } as unknown as OperationalEvidenceEvent },
      right: { depth: 1, event: { id: "right-id" } as unknown as OperationalEvidenceEvent },
      commonAncestor: { depth: 0, event: { id: "ancestor-id" } as unknown as OperationalEvidenceEvent },
      leftScene,
      rightScene,
      ancestorScene: baseScene,
      delta: { cameras: 0, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 0, snapshots: 0 },
      leftSceneSummary: null,
      rightSceneSummary: null,
      ancestorSummary: null,
    };

    const result = resolveSyncConflict(comparison);

    expect(result.status).toBe("diverged");
    expect(result.conflicts).toHaveLength(0);
    expect(result.recommendation).toContain("Auto-merged");
    expect(result.mergedScene?.cameras).toHaveLength(1);
  });
});
