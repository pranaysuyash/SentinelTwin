import type { WorkspaceAccessState } from "@/lib/workspace-access";
import { routeWorkspaceApproval } from "@/lib/workspace-access";
import type { SecurityScene } from "@/schema/security-scene";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import { z } from "zod";

export type WorkspaceMembershipDriftSummary = {
  activeMemberChanged: boolean;
  teamSizeChanged: boolean;
  policyChanged: boolean;
};

export type WorkspaceApprovalRouteSummary = {
  routeKey: string;
  routeStatus: "ready" | "reconcile_before_route" | "review_required" | "open_publish";
  routeScope: "direct" | "review" | "reconcile";
  routeLabel: string;
  routeReason: string;
  targetReviewerLabel: string;
  activeMemberLabel: string;
  archivedMemberLabel: string;
  currentPolicyLabel: string;
  archivedPolicyLabel: string;
  drift: WorkspaceMembershipDriftSummary | null;
  hasPrivacyExposure: boolean;
  activeMemberEligible: boolean;
  activeMemberReason: string;
};

export const WorkspaceMembershipDriftSummarySchema = z.object({
  activeMemberChanged: z.boolean(),
  teamSizeChanged: z.boolean(),
  policyChanged: z.boolean(),
});

export const WorkspaceApprovalRouteSummarySchema = z.object({
  routeKey: z.string().min(1).optional(),
  routeStatus: z.enum(["ready", "reconcile_before_route", "review_required", "open_publish"]),
  routeScope: z.enum(["direct", "review", "reconcile"]).optional(),
  routeLabel: z.string().min(1),
  routeReason: z.string().min(1),
  targetReviewerLabel: z.string().min(1),
  activeMemberLabel: z.string().min(1),
  archivedMemberLabel: z.string().min(1),
  currentPolicyLabel: z.string().min(1),
  archivedPolicyLabel: z.string().min(1),
  drift: WorkspaceMembershipDriftSummarySchema.nullable(),
  hasPrivacyExposure: z.boolean(),
  activeMemberEligible: z.boolean().optional(),
  activeMemberReason: z.string().optional(),
});

function buildWorkspaceApprovalRouteKey(params: {
  sceneId: string;
  activeMemberId: string;
  activeMemberRole: string | null;
  routeStatus: WorkspaceApprovalRouteSummary["routeStatus"];
  routeScope: WorkspaceApprovalRouteSummary["routeScope"];
  currentPolicyMode: WorkspaceAccessState["policy"]["mode"];
  currentPublishRequiresApproval: boolean;
  currentPrivacySensitiveRequiresReviewer: boolean;
  currentRequiredReviewerRoles: WorkspaceAccessState["policy"]["requiredReviewerRoles"];
  archivedPolicyMode: WorkspaceAccessState["policy"]["mode"] | "none";
  archivedPublishRequiresApproval: boolean | null;
  archivedPrivacySensitiveRequiresReviewer: boolean | null;
  archivedRequiredReviewerRoles: WorkspaceAccessState["policy"]["requiredReviewerRoles"] | null;
  targetReviewerRole: string;
  governanceApprovalMode: WorkspaceGovernanceState["approvalMode"];
  governanceSceneStatus: WorkspaceGovernanceState["sceneStatus"];
  hasPrivacyExposure: boolean;
  drift: WorkspaceMembershipDriftSummary | null;
}) {
  const driftLabel = params.drift
    ? `${params.drift.activeMemberChanged ? 1 : 0}${params.drift.teamSizeChanged ? 1 : 0}${params.drift.policyChanged ? 1 : 0}`
    : "000";
  const currentRoles = params.currentRequiredReviewerRoles.join(",");
  const archivedRoles = params.archivedRequiredReviewerRoles ? params.archivedRequiredReviewerRoles.join(",") : "none";

  return [
    `scene:${params.sceneId}`,
    `member:${params.activeMemberId}`,
    `role:${params.activeMemberRole ?? "none"}`,
    `status:${params.routeStatus}`,
    `scope:${params.routeScope}`,
    `governance:${params.governanceApprovalMode}:${params.governanceSceneStatus}`,
    `current:${params.currentPolicyMode}:${params.currentPublishRequiresApproval ? 1 : 0}:${params.currentPrivacySensitiveRequiresReviewer ? 1 : 0}:${currentRoles}`,
    `archived:${params.archivedPolicyMode}:${params.archivedPublishRequiresApproval ?? "none"}:${params.archivedPrivacySensitiveRequiresReviewer ?? "none"}:${archivedRoles}`,
    `reviewer:${params.targetReviewerRole}`,
    `privacy:${params.hasPrivacyExposure ? "1" : "0"}`,
    `drift:${driftLabel}`,
  ].join("|");
}

export function safeParseWorkspaceApprovalRouteSummary(summary: unknown): WorkspaceApprovalRouteSummary | null {
  const parsed = WorkspaceApprovalRouteSummarySchema.safeParse(summary);
  if (!parsed.success) return null;
  return normalizeWorkspaceApprovalRouteSummary(parsed.data);
}

export function summarizeWorkspaceMembershipDrift(
  currentAccess: WorkspaceAccessState,
  archivedAccess: WorkspaceAccessState,
): WorkspaceMembershipDriftSummary {
  return {
    activeMemberChanged: currentAccess.activeMemberId !== archivedAccess.activeMemberId,
    teamSizeChanged: currentAccess.members.length !== archivedAccess.members.length,
    policyChanged: currentAccess.policy.mode !== archivedAccess.policy.mode
      || currentAccess.policy.publishRequiresApproval !== archivedAccess.policy.publishRequiresApproval
      || currentAccess.policy.privacySensitiveRequiresReviewer !== archivedAccess.policy.privacySensitiveRequiresReviewer
      || currentAccess.policy.requiredReviewerRoles.join(",") !== archivedAccess.policy.requiredReviewerRoles.join(","),
  };
}

export function summarizeWorkspaceApprovalRouting(
  scene: SecurityScene,
  currentAccess: WorkspaceAccessState,
  workspaceGovernance: WorkspaceGovernanceState,
  archivedAccess?: WorkspaceAccessState | null,
): WorkspaceApprovalRouteSummary {
  const currentRoute = routeWorkspaceApproval(scene, currentAccess);
  const activeMember = currentAccess.members.find((member) => member.id === currentAccess.activeMemberId) ?? currentAccess.members[0] ?? null;
  const archivedMember = archivedAccess
    ? archivedAccess.members.find((member) => member.id === archivedAccess.activeMemberId) ?? archivedAccess.members[0] ?? null
    : null;
  const drift = archivedAccess ? summarizeWorkspaceMembershipDrift(currentAccess, archivedAccess) : null;
  const hasPrivacyExposure = scene.privacyZones.length > 0;
  const requiresReview = workspaceGovernance.approvalMode === "review_required" || currentAccess.policy.publishRequiresApproval;
  const routeStatus: WorkspaceApprovalRouteSummary["routeStatus"] = drift && (drift.activeMemberChanged || drift.teamSizeChanged || drift.policyChanged)
    ? "reconcile_before_route"
    : requiresReview
      ? "review_required"
      : "open_publish";
  const routeScope: WorkspaceApprovalRouteSummary["routeScope"] = routeStatus === "reconcile_before_route"
    ? "reconcile"
    : routeStatus === "review_required"
      ? "review"
      : "direct";

  const routeLabel = routeStatus === "reconcile_before_route"
    ? "Reconcile membership before routing approval"
    : routeStatus === "review_required"
      ? `Route approval to ${currentRoute.requiredReviewerRole.replace(/_/g, " ")}`
      : "Open publish route";

  const routeReason = routeStatus === "reconcile_before_route"
    ? "Workspace membership drift must be reconciled before approval routing can be trusted."
    : routeStatus === "review_required"
      ? `Approval should route through ${currentRoute.requiredReviewerRole.replace(/_/g, " ")} before publish.`
      : "Publish can route directly because the workspace is open and aligned.";
  const activeMemberRole = activeMember?.role ?? null;
  const activeMemberEligible = routeStatus === "open_publish"
    ? Boolean(activeMember?.canPublish || activeMember?.role === "admin")
    : routeStatus === "review_required"
      ? Boolean(activeMember?.canReview && (activeMemberRole === currentRoute.requiredReviewerRole || activeMemberRole === "admin"))
      : false;
  const activeMemberReason = !activeMember
    ? "No active member is selected."
    : routeStatus === "reconcile_before_route"
      ? "The active member must reconcile membership drift before routing can be trusted."
      : routeStatus === "review_required"
        ? activeMemberEligible
          ? `The active member can route approval as ${activeMember.role.replace(/_/g, " ")}.`
          : `Approval should route through ${currentRoute.requiredReviewerRole.replace(/_/g, " ")}, and the active member is not eligible.`
        : activeMemberEligible
          ? "The active member can publish directly in the aligned workspace."
          : `Direct publish requires a publishing-capable member, and ${activeMember.role.replace(/_/g, " ")} is not eligible.`;
  const routeKey = buildWorkspaceApprovalRouteKey({
    sceneId: scene.id,
    activeMemberId: activeMember?.id ?? "none",
    activeMemberRole: activeMember?.role ?? null,
    routeStatus,
    routeScope,
    currentPolicyMode: currentAccess.policy.mode,
    currentPublishRequiresApproval: currentAccess.policy.publishRequiresApproval,
    currentPrivacySensitiveRequiresReviewer: currentAccess.policy.privacySensitiveRequiresReviewer,
    currentRequiredReviewerRoles: currentAccess.policy.requiredReviewerRoles,
    archivedPolicyMode: archivedAccess?.policy.mode ?? "none",
    archivedPublishRequiresApproval: archivedAccess?.policy.publishRequiresApproval ?? null,
    archivedPrivacySensitiveRequiresReviewer: archivedAccess?.policy.privacySensitiveRequiresReviewer ?? null,
    archivedRequiredReviewerRoles: archivedAccess?.policy.requiredReviewerRoles ?? null,
    targetReviewerRole: currentRoute.requiredReviewerRole,
    governanceApprovalMode: workspaceGovernance.approvalMode,
    governanceSceneStatus: workspaceGovernance.sceneStatus,
    hasPrivacyExposure,
    drift,
  });

  return {
    routeKey,
    routeStatus,
    routeScope,
    routeLabel,
    routeReason,
    targetReviewerLabel: currentRoute.requiredReviewerRole.replace(/_/g, " "),
    activeMemberLabel: activeMember ? `${activeMember.displayName} · ${activeMember.role.replace(/_/g, " ")}` : "No active member",
    archivedMemberLabel: archivedMember ? `${archivedMember.displayName} · ${archivedMember.role.replace(/_/g, " ")}` : "No archived member",
    currentPolicyLabel: currentAccess.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace",
    archivedPolicyLabel: archivedAccess ? (archivedAccess.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace") : "No archived snapshot",
    drift,
    hasPrivacyExposure,
    activeMemberEligible,
    activeMemberReason,
  };
}

export function normalizeWorkspaceApprovalRouteSummary(
  summary: Partial<WorkspaceApprovalRouteSummary> & {
    routeStatus?: WorkspaceApprovalRouteSummary["routeStatus"];
    routeLabel?: string;
    routeReason?: string;
    targetReviewerLabel?: string;
    activeMemberLabel?: string;
    archivedMemberLabel?: string;
    currentPolicyLabel?: string;
    archivedPolicyLabel?: string;
    drift?: WorkspaceMembershipDriftSummary | null;
    hasPrivacyExposure?: boolean;
    routeKey?: string;
    routeScope?: WorkspaceApprovalRouteSummary["routeScope"];
    activeMemberEligible?: boolean;
    activeMemberReason?: string;
  },
): WorkspaceApprovalRouteSummary {
  const parsed = WorkspaceApprovalRouteSummarySchema.safeParse(summary);
  if (parsed.success) {
    return {
      ...parsed.data,
      routeKey: parsed.data.routeKey ?? [
        `status:${parsed.data.routeStatus}`,
        `scope:${parsed.data.routeScope ?? (parsed.data.routeStatus === "reconcile_before_route" ? "reconcile" : parsed.data.routeStatus === "review_required" ? "review" : "direct")}`,
        `active:${parsed.data.activeMemberLabel}`,
        `archived:${parsed.data.archivedMemberLabel}`,
        `current:${parsed.data.currentPolicyLabel}`,
        `archivedPolicy:${parsed.data.archivedPolicyLabel}`,
        `reviewer:${parsed.data.targetReviewerLabel}`,
        `privacy:${parsed.data.hasPrivacyExposure ? "1" : "0"}`,
        `drift:${parsed.data.drift ? `${parsed.data.drift.activeMemberChanged ? 1 : 0}${parsed.data.drift.teamSizeChanged ? 1 : 0}${parsed.data.drift.policyChanged ? 1 : 0}` : "000"}`,
      ].join("|"),
      routeScope: parsed.data.routeScope ?? (parsed.data.routeStatus === "reconcile_before_route"
        ? "reconcile"
        : parsed.data.routeStatus === "review_required"
          ? "review"
          : "direct"),
      activeMemberEligible: parsed.data.activeMemberEligible ?? false,
      activeMemberReason: parsed.data.activeMemberReason ?? "No route eligibility summary available.",
    };
  }
  const routeStatus = summary.routeStatus ?? "ready";
  const routeScope = summary.routeScope
    ?? (routeStatus === "reconcile_before_route"
      ? "reconcile"
      : routeStatus === "review_required"
        ? "review"
        : "direct");
  const currentPolicyLabel = summary.currentPolicyLabel ?? "Unknown policy";
  const archivedPolicyLabel = summary.archivedPolicyLabel ?? "No archived snapshot";
  const targetReviewerLabel = summary.targetReviewerLabel ?? "reviewer";
  const activeMemberLabel = summary.activeMemberLabel ?? "No active member";
  const archivedMemberLabel = summary.archivedMemberLabel ?? "No archived member";
  const hasPrivacyExposure = summary.hasPrivacyExposure ?? false;
  const drift = summary.drift ?? null;
  const routeKey = summary.routeKey ?? [
    `status:${routeStatus}`,
    `scope:${routeScope}`,
    `active:${activeMemberLabel}`,
    `archived:${archivedMemberLabel}`,
    `current:${currentPolicyLabel}`,
    `archivedPolicy:${archivedPolicyLabel}`,
    `reviewer:${targetReviewerLabel}`,
    `privacy:${hasPrivacyExposure ? "1" : "0"}`,
    `drift:${drift ? `${drift.activeMemberChanged ? 1 : 0}${drift.teamSizeChanged ? 1 : 0}${drift.policyChanged ? 1 : 0}` : "000"}`,
  ].join("|");

  return {
    routeKey,
    routeStatus,
    routeScope,
    routeLabel: summary.routeLabel ?? "Approval route",
    routeReason: summary.routeReason ?? "Approval route summary",
    targetReviewerLabel,
    activeMemberLabel,
    archivedMemberLabel,
    currentPolicyLabel,
    archivedPolicyLabel,
    drift,
    hasPrivacyExposure,
    activeMemberEligible: summary.activeMemberEligible ?? false,
    activeMemberReason: summary.activeMemberReason ?? "No route eligibility summary available.",
  };
}
