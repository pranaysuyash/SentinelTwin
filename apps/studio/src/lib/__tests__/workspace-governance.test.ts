// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { type SecurityScene } from "@/schema/security-scene";

import {
  canApproveWorkspaceScene,
  canPublishWorkspaceScene,
  createDefaultWorkspaceGovernance,
  normalizeWorkspaceGovernance,
  summarizeWorkspaceGovernance,
  resolveApprovalRoute,
} from "@/lib/workspace-governance";
import type { SecurityScene } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

describe("workspace governance", () => {
  test("starts with a review-required operator workflow", () => {
    const governance = createDefaultWorkspaceGovernance();

    expect(governance.activeRole).toBe("operator");
    expect(governance.approvalMode).toBe("review_required");
    expect(governance.sceneStatus).toBe("draft");
    expect(canApproveWorkspaceScene(governance.activeRole)).toBe(false);
    expect(canPublishWorkspaceScene(governance)).toBe(false);
  });

  test("normalizes persisted governance state and summarizes access", () => {
    const governance = normalizeWorkspaceGovernance({
      activeRole: "reviewer",
      approvalMode: "open",
      sceneStatus: "approved",
      reviewNotes: [" first note ", "", "second note", "second note"],
    });

    const summary = summarizeWorkspaceGovernance(governance);

    expect(governance.activeRole).toBe("reviewer");
    expect(governance.approvalMode).toBe("open");
    expect(governance.sceneStatus).toBe("approved");
    expect(governance.reviewNotes).toEqual(["first note", "second note"]);
    expect(summary.roleLabel).toBe("Reviewer");
    expect(summary.approvalModeLabel).toBe("Open publish");
    expect(summary.sceneStatusLabel).toBe("Approved");
    expect(summary.canPublish).toBe(true);
    expect(summary.needsApproval).toBe(false);
    expect(canApproveWorkspaceScene(governance.activeRole)).toBe(true);
    expect(canPublishWorkspaceScene(governance)).toBe(true);
  });

  describe("resolveApprovalRoute", () => {
    const createMockScene = (overrides?: Partial<SecurityScene>): SecurityScene => ({
      id: "test-scene",
      name: "Test Scene",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
      cameras: [],
      securityLights: [],
      obstructions: [],
      criticalZones: [],
      privacyZones: [],
      paths: [],
      sensors: [],
      snapshots: [],
      ...overrides,
    } as any);

    test("requires privacy_reviewer review if there are privacy zones", () => {
      const scene = createMockScene({ privacyZones: [{ id: "p1", type: "privacy_zone", position: [0,0,0], scale: [1,1,1] } as any] });
      const governance = createDefaultWorkspaceGovernance();
      const roles = resolveApprovalRoute(governance, scene);
      expect(roles).toContain("privacy_reviewer");
    });

    test("requires admin review if there are critical priority zones", () => {
      const scene = createMockScene({ criticalZones: [{ id: "c1", type: "critical_zone", position: [0,0,0], scale: [1,1,1], priority: "critical" } as any] });
      const governance = createDefaultWorkspaceGovernance();
      const roles = resolveApprovalRoute(governance, scene);
      expect(roles).toContain("admin");
      expect(roles).not.toContain("reviewer");
    });

    test("routes privacy-sensitive scenes through privacy review before broader reviewer fallback", () => {
      const scene = createMockScene({
        privacyZones: [{ id: "p1", type: "privacy_zone", position: [0, 0, 0], scale: [1, 1, 1] } as any],
      });
      const governance = createDefaultWorkspaceGovernance();
      const roles = resolveApprovalRoute(governance, scene);

      expect(roles[0]).toBe("privacy_reviewer");
      expect(roles).toContain("reviewer");
      expect(roles).toContain("admin");
    });

    test("keeps critical and privacy-sensitive scenes admin-gated", () => {
      const scene = createMockScene({
        privacyZones: [{ id: "p1", type: "privacy_zone", position: [0, 0, 0], scale: [1, 1, 1] } as any],
        criticalZones: [{
          id: "c1",
          type: "critical_zone",
          position: [0, 0, 0],
          scale: [1, 1, 1],
          priority: "high",
        } as any],
      });
      const governance = createDefaultWorkspaceGovernance();
      const roles = resolveApprovalRoute(governance, scene);

      expect(roles).toEqual(["admin", "privacy_reviewer"]);
    });

    test("allows standard reviewer review for basic scenes without critical priority or privacy zones", () => {
      const scene = createMockScene();
      const governance = createDefaultWorkspaceGovernance();
      const roles = resolveApprovalRoute(governance, scene);
      expect(roles).toContain("reviewer");
      expect(roles).toContain("admin");
    });
  });

  test("canPublishWorkspaceScene respects admin-only routes for critical scenes", () => {
    const governance = {
      ...createDefaultWorkspaceGovernance(),
      activeRole: "reviewer" as const,
    };
    const scene = {
      ...createBlankSecurityScene(),
      id: "test-scene",
      name: "Critical Scene",
      source: "manual" as const,
      criticalZones: [{ id: "c1", type: "critical_zone", position: [0, 0, 0], scale: [1, 1, 1], priority: "critical" } as any],
    } as unknown as SecurityScene;

    expect(canPublishWorkspaceScene(governance, scene)).toBe(false);
    expect(canPublishWorkspaceScene({ ...governance, activeRole: "admin" }, scene)).toBe(true);
  });
});
