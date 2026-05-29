import { describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import {
  createDefaultWorkspaceAccessState,
  canPerformWorkspaceAction,
  normalizeWorkspaceAccessState,
  routeWorkspaceApproval,
  summarizeWorkspaceAccess,
  summarizeWorkspaceAccessRoutes,
} from "@/lib/workspace-access";
import { createDefaultWorkspaceGovernance } from "@/lib/workspace-governance";

describe("workspace access", () => {
  test("summarizes the active member and routes privacy-sensitive scenes to privacy review", () => {
    const access = createDefaultWorkspaceAccessState();
    const scene = {
      ...smallRetailShopScene,
      privacyZones: [{
        id: "privacy_1",
        nodeType: "privacy_zone" as const,
        label: "Privacy",
        polygon: [[0, 0], [1, 0], [0, 1]] as [number, number][],
        restriction: "no_video" as const,
        regulation: "policy",
      }],
    } as typeof smallRetailShopScene;

    const summary = summarizeWorkspaceAccess(access);
    const route = routeWorkspaceApproval(scene, access);

    expect(summary.modeLabel).toBe("Single-user workspace");
    expect(summary.teamSize).toBeGreaterThan(0);
    expect(route.requiredReviewerRole).toBe("privacy_reviewer");
  });

  test("normalizes persisted access state and evaluates publish permissions", () => {
    const access = normalizeWorkspaceAccessState({
      activeMemberId: "member_reviewer",
      members: [
        { id: "member_reviewer", displayName: "Reviewer", role: "reviewer", clearance: "restricted", tags: ["review"], canPublish: true, canReview: true, canRestore: true },
      ],
      policy: {
        mode: "shared",
        publishRequiresApproval: false,
        privacySensitiveRequiresReviewer: true,
        requiredReviewerRoles: ["reviewer", "admin"],
      },
    });
    const governance = {
      ...createDefaultWorkspaceGovernance(),
      approvalMode: "open" as const,
      sceneStatus: "draft" as const,
    };
    const publishableScene = {
      ...smallRetailShopScene,
      source: "manual" as const,
    };

    const decision = canPerformWorkspaceAction(access, publishableScene, "publish", governance);

    expect(access.activeMemberId).toBe("member_reviewer");
    expect(access.policy.mode).toBe("shared");
    expect(decision.allowed).toBe(true);
  });

  test("blocks publish until review approval is granted when approval is required", () => {
    const access = {
      ...createDefaultWorkspaceAccessState(),
      activeMemberId: "member_reviewer",
      policy: {
        ...createDefaultWorkspaceAccessState().policy,
        publishRequiresApproval: true,
      },
    };
    const governance = {
      ...createDefaultWorkspaceGovernance(),
      approvalMode: "review_required" as const,
      sceneStatus: "draft" as const,
    };
    const scene = {
      ...smallRetailShopScene,
      source: "manual" as const,
    };

    const decision = canPerformWorkspaceAction(access, scene, "publish", governance);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("approval");
  });

  test("allows publish after review approval is granted", () => {
    const access = {
      ...createDefaultWorkspaceAccessState(),
      activeMemberId: "member_reviewer",
      policy: {
        ...createDefaultWorkspaceAccessState().policy,
        publishRequiresApproval: true,
      },
    };
    const governance = {
      ...createDefaultWorkspaceGovernance(),
      approvalMode: "review_required" as const,
      sceneStatus: "approved" as const,
    };
    const scene = {
      ...smallRetailShopScene,
      source: "manual" as const,
    };

    const decision = canPerformWorkspaceAction(access, scene, "publish", governance);

    expect(decision.allowed).toBe(true);
  });

  test("requires the privacy reviewer for privacy-sensitive approval routes", () => {
    const access = createDefaultWorkspaceAccessState();
    const privacyScene = {
      ...smallRetailShopScene,
      privacyZones: [{
        id: "privacy_1",
        nodeType: "privacy_zone" as const,
        label: "Privacy",
        polygon: [[0, 0], [1, 0], [0, 1]] as [number, number][],
        restriction: "no_video" as const,
        regulation: "policy",
      }],
    } as typeof smallRetailShopScene;
    const governance = createDefaultWorkspaceGovernance();

    const reviewerAccess = {
      ...access,
      activeMemberId: "member_reviewer",
    };
    const reviewerDecision = canPerformWorkspaceAction(reviewerAccess, privacyScene, "approve", governance);
    const privacyReviewerAccess = {
      ...access,
      activeMemberId: "member_privacy",
    };
    const privacyReviewerDecision = canPerformWorkspaceAction(privacyReviewerAccess, privacyScene, "approve", governance);

    expect(reviewerDecision.allowed).toBe(false);
    expect(reviewerDecision.reason).toContain("Privacy-sensitive");
    expect(privacyReviewerDecision.allowed).toBe(true);
  });

  test("summarizes access routes for every workspace member", () => {
    const access = createDefaultWorkspaceAccessState();
    const scene = {
      ...smallRetailShopScene,
      privacyZones: [{
        id: "privacy_1",
        nodeType: "privacy_zone" as const,
        label: "Privacy",
        polygon: [[0, 0], [1, 0], [0, 1]] as [number, number][],
        restriction: "no_video" as const,
        regulation: "policy",
      }],
    } as typeof smallRetailShopScene;

    const routes = summarizeWorkspaceAccessRoutes(access, scene);

    expect(routes.activeMemberLabel).toContain("Operator");
    expect(routes.requiredReviewerLabel).toBe("privacy reviewer");
    expect(routes.hasPrivacyExposure).toBe(true);
    expect(routes.memberRoutes).toHaveLength(access.members.length);
    expect(routes.memberRoutes[0]?.routeLabel).toContain("Publish via privacy reviewer");
    expect(routes.memberRoutes.find((route) => route.role === "privacy_reviewer")?.canReview).toBe(true);
  });
});
