import type { WorkspaceAccessState } from "@/lib/workspace-access";
import { routeWorkspaceApproval } from "@/lib/workspace-access";
import type { SecurityScene } from "@/schema/security-scene";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

export type WorkspaceMembershipDriftSummary = {
  activeMemberChanged: boolean;
  teamSizeChanged: boolean;
  policyChanged: boolean;
};

export type WorkspaceApprovalRouteSummary = {
  routeStatus: "ready" | "reconcile_before_route" | "review_required" | "open_publish";
  routeLabel: string;
  routeReason: string;
  targetReviewerLabel: string;
  activeMemberLabel: string;
  archivedMemberLabel: string;
  currentPolicyLabel: string;
  archivedPolicyLabel: string;
  drift: WorkspaceMembershipDriftSummary | null;
  hasPrivacyExposure: boolean;
};

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

  return {
    routeStatus,
    routeLabel,
    routeReason,
    targetReviewerLabel: currentRoute.requiredReviewerRole.replace(/_/g, " "),
    activeMemberLabel: activeMember ? `${activeMember.displayName} · ${activeMember.role.replace(/_/g, " ")}` : "No active member",
    archivedMemberLabel: archivedMember ? `${archivedMember.displayName} · ${archivedMember.role.replace(/_/g, " ")}` : "No archived member",
    currentPolicyLabel: currentAccess.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace",
    archivedPolicyLabel: archivedAccess ? (archivedAccess.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace") : "No archived snapshot",
    drift,
    hasPrivacyExposure,
  };
}
