import { describe, expect, test } from "bun:test";

import {
  summarizeWorkspaceMembershipArchive,
} from "@/lib/workspace-membership-archive";
import { summarizeWorkspaceMembershipDrift } from "@/lib/workspace-membership-routing";

describe("workspace membership archive helpers", () => {
  test("summarizes the current workspace identity record", async () => {
    const summary = await summarizeWorkspaceMembershipArchive({
      source: "debug-panel",
      submittedAt: 1_725_000_000_000,
      sceneId: "scene-membership",
      sceneName: "Membership Scene",
      workspaceAccessState: {
        activeMemberId: "member_reviewer",
        members: [
          {
            id: "member_reviewer",
            displayName: "Reviewer",
            role: "reviewer",
            clearance: "restricted",
            tags: ["review"],
            canPublish: true,
            canReview: true,
            canRestore: true,
          },
          {
            id: "member_operator",
            displayName: "Operator",
            role: "operator",
            clearance: "standard",
            tags: ["field"],
            canPublish: true,
            canReview: false,
            canRestore: true,
          },
        ],
        policy: {
          mode: "shared",
          publishRequiresApproval: true,
          privacySensitiveRequiresReviewer: true,
          requiredReviewerRoles: ["reviewer", "admin"],
        },
      },
      workspaceGovernanceState: {
        activeRole: "reviewer",
        approvalMode: "review_required",
        sceneStatus: "draft",
        requestedAt: 1_725_000_000_000,
        requestedBy: "operator",
        reviewedAt: null,
        reviewedBy: null,
        publishedAt: null,
        publishedBy: null,
        reviewNotes: ["Membership routed for approval."],
      },
      destinations: [],
    });

    expect(summary.summary).toContain("shared workspace membership");
    expect(summary.summary).toContain("approval routing");
    expect(summary.activeMemberLabel).toContain("Reviewer");
    expect(summary.policyMode).toBe("shared");
    expect(summary.teamSize).toBe(2);
    expect(summary.archiveStatus).toBe("local cache");
    expect(summary.approvalRoute.routeStatus).toBe("review_required");
  });

  test("summarizes drift between the current access policy and an archived record", () => {
    const drift = summarizeWorkspaceMembershipDrift(
      {
        activeMemberId: "member_admin",
        members: [
          {
            id: "member_admin",
            displayName: "Admin",
            role: "admin",
            clearance: "restricted",
            tags: ["owner"],
            canPublish: true,
            canReview: true,
            canRestore: true,
          },
        ],
        policy: {
          mode: "shared",
          publishRequiresApproval: true,
          privacySensitiveRequiresReviewer: true,
          requiredReviewerRoles: ["reviewer", "admin"],
        },
      },
      {
        activeMemberId: "member_operator",
        members: [
          {
            id: "member_operator",
            displayName: "Operator",
            role: "operator",
            clearance: "standard",
            tags: ["field"],
            canPublish: true,
            canReview: false,
            canRestore: true,
          },
        ],
        policy: {
          mode: "single_user",
          publishRequiresApproval: false,
          privacySensitiveRequiresReviewer: false,
          requiredReviewerRoles: ["operator"],
        },
      },
    );

    expect(drift.activeMemberChanged).toBe(true);
    expect(drift.teamSizeChanged).toBe(false);
    expect(drift.policyChanged).toBe(true);
  });
});
