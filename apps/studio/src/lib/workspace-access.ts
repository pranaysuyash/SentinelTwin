import type { SecurityScene } from "@/schema/security-scene";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import type { WorkspaceRole } from "@/lib/workspace-governance";

export type WorkspaceClearance = "standard" | "restricted" | "privacy_sensitive";

export type WorkspaceAction =
  | "edit"
  | "annotate"
  | "request_review"
  | "approve"
  | "reject"
  | "publish"
  | "recover";

export type WorkspaceMember = {
  id: string;
  displayName: string;
  role: WorkspaceRole;
  clearance: WorkspaceClearance;
  tags: string[];
  canPublish: boolean;
  canReview: boolean;
  canRestore: boolean;
};

export type WorkspaceAccessPolicy = {
  mode: "single_user" | "shared";
  publishRequiresApproval: boolean;
  privacySensitiveRequiresReviewer: boolean;
  requiredReviewerRoles: WorkspaceRole[];
};

export type WorkspaceAccessState = {
  activeMemberId: string;
  members: WorkspaceMember[];
  policy: WorkspaceAccessPolicy;
};

export type WorkspaceAccessDecision = {
  allowed: boolean;
  reason: string;
  member: WorkspaceMember | null;
  requiredReviewerRole: WorkspaceRole | null;
  matchedAttributes: string[];
};

export type WorkspaceAccessSummary = {
  activeMemberLabel: string;
  modeLabel: string;
  teamSize: number;
  reviewRouteLabel: string;
  publishRouteLabel: string;
};

export type WorkspaceAccessRouteSummary = {
  activeMemberLabel: string;
  requiredReviewerLabel: string;
  hasPrivacyExposure: boolean;
  memberRoutes: Array<{
    memberId: string;
    displayName: string;
    role: WorkspaceRole;
    clearance: WorkspaceClearance;
    canPublish: boolean;
    canReview: boolean;
    canRestore: boolean;
    routeLabel: string;
    reason: string;
    matchedAttributes: string[];
  }>;
};

function isWorkspaceRole(value: string): value is WorkspaceRole {
  return [
    "operator",
    "reviewer",
    "auditor",
    "installer",
    "insurer",
    "privacy_reviewer",
    "admin",
  ].includes(value as WorkspaceRole);
}

export function createDefaultWorkspaceMembers(): WorkspaceMember[] {
  return [
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
    {
      id: "member_reviewer",
      displayName: "Reviewer",
      role: "reviewer",
      clearance: "restricted",
      tags: ["review", "approval"],
      canPublish: true,
      canReview: true,
      canRestore: true,
    },
    {
      id: "member_privacy",
      displayName: "Privacy Reviewer",
      role: "privacy_reviewer",
      clearance: "privacy_sensitive",
      tags: ["privacy", "audit"],
      canPublish: false,
      canReview: true,
      canRestore: false,
    },
    {
      id: "member_admin",
      displayName: "Admin",
      role: "admin",
      clearance: "restricted",
      tags: ["owner", "admin"],
      canPublish: true,
      canReview: true,
      canRestore: true,
    },
  ];
}

export function createDefaultWorkspaceAccessState(): WorkspaceAccessState {
  return {
    activeMemberId: "member_operator",
    members: createDefaultWorkspaceMembers(),
    policy: {
      mode: "single_user",
      publishRequiresApproval: true,
      privacySensitiveRequiresReviewer: true,
      requiredReviewerRoles: ["reviewer", "privacy_reviewer", "admin"],
    },
  };
}

export function normalizeWorkspaceAccessState(raw: unknown): WorkspaceAccessState {
  if (!raw || typeof raw !== "object") return createDefaultWorkspaceAccessState();
  const candidate = raw as Partial<WorkspaceAccessState> & {
    members?: unknown;
    policy?: unknown;
  };
  const candidatePolicy = candidate.policy as {
    mode?: unknown;
    publishRequiresApproval?: unknown;
    privacySensitiveRequiresReviewer?: unknown;
    requiredReviewerRoles?: unknown;
  } | undefined;

  const members: WorkspaceMember[] = Array.isArray(candidate.members)
    ? candidate.members.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const member = entry as Partial<WorkspaceMember>;
        if (
          typeof member.id !== "string"
          || typeof member.displayName !== "string"
          || typeof member.role !== "string"
          || !isWorkspaceRole(member.role)
        ) {
          return [];
        }
        const clearance: WorkspaceClearance = member.clearance === "privacy_sensitive" || member.clearance === "restricted"
          ? member.clearance
          : "standard";
        return [{
          id: member.id,
          displayName: member.displayName,
          role: member.role,
          clearance,
          tags: Array.isArray(member.tags) ? [...new Set(member.tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8) : [],
          canPublish: Boolean(member.canPublish),
          canReview: Boolean(member.canReview),
          canRestore: Boolean(member.canRestore),
        } as WorkspaceMember];
      })
    : createDefaultWorkspaceMembers();

  const policy: WorkspaceAccessPolicy = candidatePolicy
    ? {
        mode: candidatePolicy.mode === "shared" ? "shared" : "single_user",
        publishRequiresApproval: candidatePolicy.publishRequiresApproval !== false,
        privacySensitiveRequiresReviewer: candidatePolicy.privacySensitiveRequiresReviewer !== false,
        requiredReviewerRoles: Array.isArray(candidatePolicy.requiredReviewerRoles)
          ? [...new Set(candidatePolicy.requiredReviewerRoles
              .map((role) => String(role))
              .filter((role): role is WorkspaceRole => isWorkspaceRole(role)))]
          : ["reviewer", "privacy_reviewer", "admin"],
      }
    : createDefaultWorkspaceAccessState().policy;

  const activeMemberId = typeof candidate.activeMemberId === "string" && members.some((member) => member.id === candidate.activeMemberId)
    ? candidate.activeMemberId
    : members[0]?.id ?? "member_operator";

  return { activeMemberId, members, policy };
}

export function getActiveWorkspaceMember(access: WorkspaceAccessState) {
  return access.members.find((member) => member.id === access.activeMemberId) ?? access.members[0] ?? null;
}

export function summarizeWorkspaceAccess(access: WorkspaceAccessState): WorkspaceAccessSummary {
  const activeMember = getActiveWorkspaceMember(access);
  const reviewRouteLabel = access.policy.requiredReviewerRoles.map((role) => role.replace(/_/g, " ")).join(", ");
  return {
    activeMemberLabel: activeMember ? `${activeMember.displayName} · ${activeMember.role.replace(/_/g, " ")}` : "No active member",
    modeLabel: access.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace",
    teamSize: access.members.length,
    reviewRouteLabel,
    publishRouteLabel: access.policy.publishRequiresApproval ? "Publish requires review" : "Open publish",
  };
}

export function routeWorkspaceApproval(scene: SecurityScene, access: WorkspaceAccessState) {
  const activeMember = getActiveWorkspaceMember(access);
  const hasPrivacyExposure = scene.privacyZones.length > 0;
  const requiredReviewerRole = hasPrivacyExposure && access.policy.privacySensitiveRequiresReviewer
    ? "privacy_reviewer"
    : (access.policy.requiredReviewerRoles[0] ?? "reviewer");
  const matchedAttributes = [
    access.policy.mode === "shared" ? "shared-workspace" : "single-user",
    hasPrivacyExposure ? "privacy-sensitive-scene" : "standard-scene",
    activeMember?.tags?.length ? activeMember.tags.join(",") : "no-tags",
  ];
  return {
    member: activeMember,
    requiredReviewerRole,
    matchedAttributes,
  };
}

export function summarizeWorkspaceAccessRoutes(access: WorkspaceAccessState, scene: SecurityScene): WorkspaceAccessRouteSummary {
  const activeMember = getActiveWorkspaceMember(access);
  const route = routeWorkspaceApproval(scene, access);
  const activeMemberLabel = activeMember ? `${activeMember.displayName} · ${activeMember.role.replace(/_/g, " ")}` : "No active member";
  const requiredReviewerLabel = route.requiredReviewerRole.replace(/_/g, " ");
  const hasPrivacyExposure = scene.privacyZones.length > 0;

  return {
    activeMemberLabel,
    requiredReviewerLabel,
    hasPrivacyExposure,
    memberRoutes: access.members.map((member) => {
      const canPublish = member.canPublish || member.role === "admin";
      const canReview = member.canReview && access.policy.requiredReviewerRoles.includes(member.role);
      const canRestore = member.canRestore || member.role === "admin";
      const matchedAttributes = [
        access.policy.mode === "shared" ? "shared-workspace" : "single-user",
        hasPrivacyExposure ? "privacy-sensitive-scene" : "standard-scene",
        member.clearance,
        member.tags.length > 0 ? member.tags.join(",") : "no-tags",
      ];
      const routeLabel = canPublish
        ? access.policy.publishRequiresApproval && member.role !== "admin"
          ? `Publish via ${requiredReviewerLabel}`
          : "Direct publish"
        : canReview
          ? `Review gate via ${requiredReviewerLabel}`
          : canRestore
            ? "Restore-only member"
            : "Draft-only member";
      const reason = canPublish
        ? access.policy.publishRequiresApproval && member.role !== "admin"
          ? `Publish must route through ${requiredReviewerLabel} before publish approval.`
          : "Member can publish directly."
        : canReview
          ? `Member can process reviews as ${member.role.replace(/_/g, " ")}.`
          : canRestore
            ? "Member can restore checkpoints but cannot publish."
            : "Member stays in draft and annotation routing.";
      return {
        memberId: member.id,
        displayName: member.displayName,
        role: member.role,
        clearance: member.clearance,
        canPublish,
        canReview,
        canRestore,
        routeLabel,
        reason,
        matchedAttributes,
      };
    }),
  };
}

export function canPerformWorkspaceAction(
  access: WorkspaceAccessState,
  scene: SecurityScene,
  action: WorkspaceAction,
  governance: WorkspaceGovernanceState,
): WorkspaceAccessDecision {
  const activeMember = getActiveWorkspaceMember(access);
  if (!activeMember) {
    return {
      allowed: false,
      reason: "No active workspace member is selected.",
      member: null,
      requiredReviewerRole: null,
      matchedAttributes: [],
    };
  }

  const route = routeWorkspaceApproval(scene, access);
  const hasPrivacyExposure = scene.privacyZones.length > 0;
  const requiresPrivacyReviewer = hasPrivacyExposure && access.policy.privacySensitiveRequiresReviewer;
  const requiresPublishReview = access.policy.publishRequiresApproval || governance.approvalMode === "review_required";
  const publishIsApproved = governance.sceneStatus === "approved" || governance.sceneStatus === "published";
  const canReview = activeMember.canReview && (
    activeMember.role === "admin"
    || (requiresPrivacyReviewer
      ? activeMember.role === route.requiredReviewerRole
      : access.policy.requiredReviewerRoles.includes(activeMember.role))
  );
  const canPublish = activeMember.canPublish || activeMember.role === "admin";
  const canRestore = activeMember.canRestore || activeMember.role === "admin";

  switch (action) {
    case "edit":
    case "annotate":
      return {
        allowed: true,
        reason: "Workspace edits and annotations are allowed for the active member.",
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
    case "request_review":
      return {
        allowed: true,
        reason: "Any active member can request a review.",
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
    case "approve":
    case "reject":
      return {
        allowed: canReview,
        reason: canReview
          ? requiresPrivacyReviewer && activeMember.role !== "admin"
            ? `Privacy-sensitive approval routing is assigned to ${route.requiredReviewerRole.replace(/_/g, " ")}, and ${activeMember.role} matches the required role.`
            : `The active member can process approvals as ${activeMember.role}.`
          : requiresPrivacyReviewer
            ? `Privacy-sensitive approval routing requires ${route.requiredReviewerRole.replace(/_/g, " ")}, and ${activeMember.role} is not eligible.`
            : `Approval routing requires a reviewer role, and ${activeMember.role} is not eligible.`,
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
    case "recover":
      return {
        allowed: canRestore,
        reason: canRestore
          ? "The active member can restore archives or checkpoints."
          : `Restore routing requires a member with restore rights, and ${activeMember.role} does not have them.`,
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
    case "publish":
      return {
        allowed: canPublish && (!requiresPublishReview || publishIsApproved || activeMember.role === "admin"),
        reason: !canPublish
          ? `Publish routing requires a publishing-capable member, and ${activeMember.role} is not eligible.`
          : requiresPublishReview && !publishIsApproved && activeMember.role !== "admin"
            ? `Publish requires approval routed through ${route.requiredReviewerRole.replace(/_/g, " ")} before the scene can be published.`
            : requiresPublishReview && publishIsApproved
              ? `Publish approval is complete and can proceed through ${route.requiredReviewerRole.replace(/_/g, " ")}.`
              : "The active member can publish this scene.",
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
    default:
      return {
        allowed: false,
        reason: "Unsupported workspace action.",
        member: activeMember,
        requiredReviewerRole: route.requiredReviewerRole,
        matchedAttributes: route.matchedAttributes,
      };
  }
}
