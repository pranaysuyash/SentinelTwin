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
        publishRequiresApproval: true,
        privacySensitiveRequiresReviewer: true,
        requiredReviewerRoles: ["reviewer", "admin"],
      },
    });
    const publishableScene = {
      ...smallRetailShopScene,
      source: "manual" as const,
    };

    const decision = canPerformWorkspaceAction(access, publishableScene, "publish");

    expect(access.activeMemberId).toBe("member_reviewer");
    expect(access.policy.mode).toBe("shared");
    expect(decision.allowed).toBe(true);
  });

  test("blocks publish for a member without publishing permission", () => {
    const access = {
      ...createDefaultWorkspaceAccessState(),
      activeMemberId: "member_privacy",
    };
    const scene = {
      ...smallRetailShopScene,
      source: "manual" as const,
    };

    const decision = canPerformWorkspaceAction(access, scene, "publish");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("publishing-capable member");
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
