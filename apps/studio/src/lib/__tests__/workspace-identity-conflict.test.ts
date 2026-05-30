import { describe, expect, test } from "bun:test";

import { summarizeWorkspaceApprovalRouting } from "@/lib/workspace-membership-routing";
import { replayWorkspaceIdentityConflict, summarizeWorkspaceIdentityConflictDiff, type WorkspaceIdentityConflictArchiveRecord } from "@/lib/workspace-identity-conflict";

describe("workspace identity conflict diff", () => {
  test("summarizes live vs archived identity drift for the replay view", () => {
    const currentAccess = {
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
    };

    const archivedAccess = {
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
        requiredReviewerRoles: ["admin"],
      },
    };

    const approvalRoute = summarizeWorkspaceApprovalRouting(
      {
        id: "scene-conflict",
        name: "Conflict Scene",
        privacyZones: [{ id: "zone-privacy" }],
      } as never,
      currentAccess as never,
      {
        activeRole: "reviewer",
        approvalMode: "review_required",
        sceneStatus: "draft",
        requestedAt: null,
        requestedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        publishedAt: null,
        publishedBy: null,
        reviewNotes: [],
      } as never,
      archivedAccess as never,
    );

    const diff = summarizeWorkspaceIdentityConflictDiff({
      approvalRoute,
      hasPrivacyExposure: true,
      workspaceAccessState: currentAccess as never,
      archivedWorkspaceAccessState: archivedAccess as never,
      resolutionLabel: "Reconcile membership before routing approval",
      resolutionReason: "Workspace membership drift must be reconciled before approval routing can be trusted.",
      recommendedAction: "Sync the live workspace to the latest archived identity snapshot.",
    });

    expect(diff.title).toBe("Conflict Diff");
    expect(diff.changedCount).toBeGreaterThan(0);
    expect(diff.rows.some((row) => row.label === "Active member" && row.changed)).toBe(true);
    expect(diff.rows.some((row) => row.label === "Team size" && row.changed)).toBe(true);
    expect(diff.rows.some((row) => row.label === "Workspace mode" && row.changed)).toBe(true);
    expect(diff.routeLabel).toContain("Reconcile membership");
    expect(diff.resolutionLabel).toContain("Reconcile membership");
    expect(diff.recommendedAction).toContain("Sync the live workspace");
  });

  test("replays a selected archived conflict against the current workspace state", async () => {
    const record: WorkspaceIdentityConflictArchiveRecord = {
      ok: true,
      approvalRoute: {
        routeKey: "scene:scene-conflict|member:member_operator|role:operator|status:review_required|scope:review|current:Shared workspace|archived:Single-user workspace|reviewer:Reviewer|privacy:1|drift:000",
        routeStatus: "review_required",
        routeScope: "review",
        routeLabel: "Route approval to reviewer",
        routeReason: "Approval should route through reviewer before publish.",
        targetReviewerLabel: "Reviewer",
        activeMemberLabel: "Operator · operator",
        archivedMemberLabel: "Archived Operator · operator",
        currentPolicyLabel: "Shared workspace",
        archivedPolicyLabel: "Single-user workspace",
        drift: null,
        hasPrivacyExposure: true,
        activeMemberEligible: false,
        activeMemberReason: "Approval should route through Reviewer, and the active member is not eligible.",
      },
      conflictDiff: {
        title: "Conflict Diff",
        subtitle: "Route approval to reviewer",
        changedCount: 3,
        currentMemberLabel: "Operator · operator",
        archivedMemberLabel: "Archived Operator · operator",
        currentPolicyLabel: "Shared workspace",
        archivedPolicyLabel: "Single-user workspace",
        routeLabel: "Route approval to reviewer",
        routeReason: "Approval should route through reviewer before publish.",
        resolutionLabel: "Route through reviewer before publish",
        resolutionReason: "Approval should route through reviewer before publish.",
        recommendedAction: "Send the decision to Reviewer.",
        hasPrivacyExposure: true,
        rows: [],
      },
      conflictStatus: "reconcile_needed",
      resolutionStatus: "reconcile_before_route",
      resolutionLabel: "Reconcile membership before routing approval",
      resolutionReason: "Workspace membership drift must be reconciled before approval routing can be trusted.",
      recommendedAction: "Sync the live workspace to the latest archived identity snapshot.",
      hasPrivacyExposure: true,
      source: "governance-panel",
      receivedAt: "2026-05-29T00:00:00.000Z",
      sceneId: "scene-conflict",
      sceneName: "Conflict Scene",
      summary: "Reconcile membership before routing approval for Conflict Scene.",
      archiveStatus: "server archive",
      historyId: "scene-conflict:1:conflict",
      membershipDrift: null,
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
        requestedAt: null,
        requestedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        publishedAt: null,
        publishedBy: null,
        reviewNotes: [],
      },
      archivedWorkspaceAccessState: {
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
          requiredReviewerRoles: ["admin"],
        },
      },
      deliveredCount: 0,
      queuedCount: 1,
      failedCount: 0,
      destinations: [],
      submittedAt: 1_725_000_004_000,
      storedAt: 1_725_000_004_500,
    };

    const replay = await replayWorkspaceIdentityConflict(record, {
      sceneId: "scene-conflict",
      sceneName: "Conflict Scene",
      hasPrivacyExposure: true,
      workspaceAccessState: {
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
          mode: "single_user",
          publishRequiresApproval: false,
          privacySensitiveRequiresReviewer: false,
          requiredReviewerRoles: ["admin"],
        },
      },
      workspaceGovernanceState: {
        activeRole: "admin",
        approvalMode: "open",
        sceneStatus: "published",
        requestedAt: null,
        requestedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        publishedAt: 1_725_000_005_000,
        publishedBy: "admin",
        reviewNotes: [],
      },
      archivedWorkspaceAccessState: record.archivedWorkspaceAccessState,
    });

    expect(replay.summary).toContain("Reconcile membership before routing approval");
    expect(replay.approvalRoute.routeLabel).toContain("Reconcile membership");
    expect(replay.conflictDiff.title).toBe("Conflict Diff");
    expect(replay.conflictDiff.changedCount).toBeGreaterThanOrEqual(0);
  });
});
