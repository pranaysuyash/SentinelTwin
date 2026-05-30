import { describe, expect, test } from "bun:test";
import { resolveSyncConflict } from "@/lib/workspace-sync-conflict";
import type { OperationalEvidenceBranchComparison } from "@/lib/operational-evidence";
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
      left: { depth: 0, event: {} as any },
      right: { depth: 0, event: {} as any },
      commonAncestor: { depth: 0, event: {} as any },
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
      left: { depth: 1, event: { id: "left-id" } as any },
      right: { depth: 0, event: { id: "right-id" } as any },
      commonAncestor: { depth: 0, event: { id: "right-id" } as any },
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
      left: { depth: 1, event: { id: "left-id" } as any },
      right: { depth: 1, event: { id: "right-id" } as any },
      commonAncestor: { depth: 0, event: { id: "ancestor-id" } as any },
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
});
