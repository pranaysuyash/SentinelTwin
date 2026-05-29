import { describe, expect, test } from "bun:test";

import {
  canApproveWorkspaceScene,
  canPublishWorkspaceScene,
  createDefaultWorkspaceGovernance,
  normalizeWorkspaceGovernance,
  summarizeWorkspaceGovernance,
} from "@/lib/workspace-governance";

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
});
