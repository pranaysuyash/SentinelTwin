import { describe, expect, test } from "bun:test";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import {
  summarizeWorkspaceApprovalRouting,
  summarizeWorkspaceMembershipDrift,
} from "@/lib/workspace-membership-routing";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

describe("workspace membership routing helpers", () => {
  test("summarizes drift and blocks routing until the archived membership snapshot is reconciled", () => {
    const currentAccess: WorkspaceAccessState = {
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
    const archivedAccess: WorkspaceAccessState = {
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
    };
    const scene = {
      ...createBlankSecurityScene(),
      id: "scene-membership",
      name: "Membership Scene",
    };
    const governance: WorkspaceGovernanceState = {
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
    };

    const drift = summarizeWorkspaceMembershipDrift(currentAccess, archivedAccess);
    const route = summarizeWorkspaceApprovalRouting(scene, currentAccess, governance, archivedAccess);

    expect(drift.activeMemberChanged).toBe(true);
    expect(drift.teamSizeChanged).toBe(true);
    expect(drift.policyChanged).toBe(true);
    expect(route.routeStatus).toBe("reconcile_before_route");
    expect(route.routeScope).toBe("reconcile");
    expect(route.routeLabel).toContain("Reconcile membership");
    expect(route.routeReason).toContain("drift");
    expect(route.activeMemberLabel).toContain("Reviewer");
    expect(route.archivedMemberLabel).toContain("Operator");
    expect(route.currentPolicyLabel).toBe("Shared workspace");
    expect(route.archivedPolicyLabel).toBe("Single-user workspace");
    expect(route.routeKey).toContain("scene:scene-membership");
    expect(route.activeMemberEligible).toBe(false);
    expect(route.activeMemberReason).toContain("reconcile");
  });

  test("summarizes an open approval route when the workspace is aligned", () => {
    const currentAccess: WorkspaceAccessState = {
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
    };
    const scene = {
      ...createBlankSecurityScene(),
      id: "scene-open-route",
      name: "Open Route Scene",
    };
    const governance: WorkspaceGovernanceState = {
      activeRole: "operator",
      approvalMode: "open",
      sceneStatus: "draft",
      requestedAt: null,
      requestedBy: null,
      reviewedAt: null,
      reviewedBy: null,
      publishedAt: null,
      publishedBy: null,
      reviewNotes: [],
    };

    const route = summarizeWorkspaceApprovalRouting(scene, currentAccess, governance, null);

    expect(route.routeStatus).toBe("open_publish");
    expect(route.routeScope).toBe("direct");
    expect(route.routeLabel).toBe("Open publish route");
    expect(route.routeReason).toContain("open");
    expect(route.drift).toBeNull();
    expect(route.archivedPolicyLabel).toBe("No archived snapshot");
    expect(route.activeMemberEligible).toBe(true);
    expect(route.activeMemberReason).toContain("publish directly");
  });
});
