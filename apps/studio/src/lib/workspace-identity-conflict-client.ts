import {
  summarizeWorkspaceApprovalRouting,
  summarizeWorkspaceMembershipDrift,
  type WorkspaceApprovalRouteSummary,
} from "@/lib/workspace-membership-routing";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import type {
  WorkspaceIdentityConflictArchiveRecord,
  WorkspaceIdentityConflictArchiveResponse,
  WorkspaceIdentityConflictDiffRow,
  WorkspaceIdentityConflictDiffSummary,
  WorkspaceIdentityConflictReplayRequest,
  WorkspaceIdentityConflictResolutionStatus,
  WorkspaceIdentityConflictStatus,
} from "@/lib/workspace-identity-conflict-types";

export type {
  WorkspaceIdentityConflictArchiveRecord,
  WorkspaceIdentityConflictArchiveResponse,
} from "@/lib/workspace-identity-conflict-types";

function formatWorkspaceMembershipCount(membershipCount: number) {
  return `${membershipCount} member${membershipCount === 1 ? "" : "s"}`;
}

function formatReviewerRolesLabel(requiredReviewerRoles: string[]) {
  return requiredReviewerRoles.length > 0
    ? requiredReviewerRoles.map((role) => role.replace(/_/g, " ")).join(", ")
    : "None";
}

function formatPublishApprovalLabel(publishRequiresApproval: boolean) {
  return publishRequiresApproval ? "Required" : "Open publish";
}

function formatPrivacyReviewerLabel(privacySensitiveRequiresReviewer: boolean) {
  return privacySensitiveRequiresReviewer ? "Required" : "Not required";
}

function deriveWorkspaceIdentityConflictResolution(
  conflictStatus: WorkspaceIdentityConflictStatus,
  approvalRoute: WorkspaceApprovalRouteSummary,
): {
  resolutionStatus: WorkspaceIdentityConflictResolutionStatus;
  resolutionLabel: string;
  resolutionReason: string;
  recommendedAction: string;
} {
  const resolutionStatus: WorkspaceIdentityConflictResolutionStatus = conflictStatus === "archive_pending"
    ? "archive_pending"
    : conflictStatus === "reconcile_needed"
      ? "reconcile_before_route"
      : approvalRoute.routeStatus === "review_required"
        ? "route_for_review"
        : "ready_for_publish";

  const resolutionLabel = resolutionStatus === "archive_pending"
    ? "Archive membership snapshot before resolving shared identity"
    : resolutionStatus === "reconcile_before_route"
      ? "Reconcile membership before routing approval"
      : resolutionStatus === "route_for_review"
        ? "Route through reviewer before publish"
        : "Shared identity is aligned for publish";

  const resolutionReason = resolutionStatus === "archive_pending"
    ? "No archived membership snapshot exists yet, so the identity service cannot compute a trustworthy conflict resolution."
    : resolutionStatus === "reconcile_before_route"
      ? "The live workspace drifted from the archived identity snapshot, so the workspace should reconcile before approval routing can be trusted."
      : resolutionStatus === "route_for_review"
        ? `Approval should route through ${approvalRoute.targetReviewerLabel} before publish.`
        : "The live workspace matches the archived identity record and can proceed without reconciliation.";

  const recommendedAction = resolutionStatus === "archive_pending"
    ? "Create an archived membership snapshot."
    : resolutionStatus === "reconcile_before_route"
      ? "Sync the live workspace to the latest archived identity snapshot."
      : resolutionStatus === "route_for_review"
        ? `Send the decision to ${approvalRoute.targetReviewerLabel}.`
        : "Publish or hand off the aligned workspace identity record.";

  return { resolutionStatus, resolutionLabel, resolutionReason, recommendedAction };
}

function summarizeWorkspaceIdentityConflictDiff(
  request: Pick<
    WorkspaceIdentityConflictArchiveResponse,
    "approvalRoute" | "hasPrivacyExposure" | "workspaceAccessState" | "archivedWorkspaceAccessState" | "resolutionLabel" | "resolutionReason" | "recommendedAction"
  >,
): WorkspaceIdentityConflictDiffSummary {
  const archivedAccess = request.archivedWorkspaceAccessState;
  const rows: WorkspaceIdentityConflictDiffRow[] = [
    {
      label: "Active member",
      currentValue: request.approvalRoute.activeMemberLabel,
      archivedValue: request.approvalRoute.archivedMemberLabel,
      changed: request.approvalRoute.activeMemberLabel !== request.approvalRoute.archivedMemberLabel,
    },
    {
      label: "Team size",
      currentValue: formatWorkspaceMembershipCount(request.workspaceAccessState.members.length),
      archivedValue: archivedAccess ? formatWorkspaceMembershipCount(archivedAccess.members.length) : "No archived snapshot",
      changed: archivedAccess ? request.workspaceAccessState.members.length !== archivedAccess.members.length : true,
    },
    {
      label: "Workspace mode",
      currentValue: request.approvalRoute.currentPolicyLabel,
      archivedValue: request.approvalRoute.archivedPolicyLabel,
      changed: request.approvalRoute.currentPolicyLabel !== request.approvalRoute.archivedPolicyLabel,
    },
    {
      label: "Publish approval",
      currentValue: formatPublishApprovalLabel(request.workspaceAccessState.policy.publishRequiresApproval),
      archivedValue: archivedAccess ? formatPublishApprovalLabel(archivedAccess.policy.publishRequiresApproval) : "No archived snapshot",
      changed: archivedAccess ? request.workspaceAccessState.policy.publishRequiresApproval !== archivedAccess.policy.publishRequiresApproval : true,
    },
    {
      label: "Privacy reviewer",
      currentValue: formatPrivacyReviewerLabel(request.workspaceAccessState.policy.privacySensitiveRequiresReviewer),
      archivedValue: archivedAccess ? formatPrivacyReviewerLabel(archivedAccess.policy.privacySensitiveRequiresReviewer) : "No archived snapshot",
      changed: archivedAccess ? request.workspaceAccessState.policy.privacySensitiveRequiresReviewer !== archivedAccess.policy.privacySensitiveRequiresReviewer : true,
    },
    {
      label: "Required reviewer roles",
      currentValue: formatReviewerRolesLabel(request.workspaceAccessState.policy.requiredReviewerRoles),
      archivedValue: archivedAccess ? formatReviewerRolesLabel(archivedAccess.policy.requiredReviewerRoles) : "No archived snapshot",
      changed: archivedAccess
        ? request.workspaceAccessState.policy.requiredReviewerRoles.join(",") !== archivedAccess.policy.requiredReviewerRoles.join(",")
        : true,
    },
  ];

  return {
    title: "Conflict Diff",
    subtitle: request.approvalRoute.routeLabel,
    changedCount: rows.filter((row) => row.changed).length,
    currentMemberLabel: request.approvalRoute.activeMemberLabel,
    archivedMemberLabel: request.approvalRoute.archivedMemberLabel,
    currentPolicyLabel: request.approvalRoute.currentPolicyLabel,
    archivedPolicyLabel: request.approvalRoute.archivedPolicyLabel,
    routeKey: request.approvalRoute.routeKey,
    routeLabel: request.approvalRoute.routeLabel,
    routeReason: request.approvalRoute.routeReason,
    resolutionLabel: request.resolutionLabel,
    resolutionReason: request.resolutionReason,
    recommendedAction: request.recommendedAction,
    hasPrivacyExposure: request.hasPrivacyExposure,
    rows,
  };
}

export async function replayWorkspaceIdentityConflict(
  record: WorkspaceIdentityConflictArchiveRecord,
  request: WorkspaceIdentityConflictReplayRequest,
): Promise<WorkspaceIdentityConflictArchiveResponse> {
  const workspaceAccess = request.workspaceAccessState as WorkspaceAccessState;
  const workspaceGovernance = request.workspaceGovernanceState as WorkspaceGovernanceState;
  const archivedWorkspaceAccess = record.archivedWorkspaceAccessState ?? request.archivedWorkspaceAccessState ?? null;
  const membershipDrift = archivedWorkspaceAccess ? summarizeWorkspaceMembershipDrift(workspaceAccess, archivedWorkspaceAccess) : null;
  const approvalRoute = summarizeWorkspaceApprovalRouting(
    {
      id: request.sceneId,
      name: request.sceneName,
      privacyZones: request.hasPrivacyExposure ? [{}] : [],
    } as Parameters<typeof summarizeWorkspaceApprovalRouting>[0],
    workspaceAccess,
    workspaceGovernance,
    archivedWorkspaceAccess,
  );

  const conflictStatus: WorkspaceIdentityConflictStatus = !archivedWorkspaceAccess
    ? "archive_pending"
    : membershipDrift && (membershipDrift.activeMemberChanged || membershipDrift.teamSizeChanged || membershipDrift.policyChanged)
      ? "reconcile_needed"
      : "aligned";

  const {
    resolutionStatus,
    resolutionLabel,
    resolutionReason,
    recommendedAction,
  } = deriveWorkspaceIdentityConflictResolution(conflictStatus, approvalRoute);

  const conflictDiff = summarizeWorkspaceIdentityConflictDiff({
    approvalRoute,
    hasPrivacyExposure: request.hasPrivacyExposure,
    workspaceAccessState: workspaceAccess,
    archivedWorkspaceAccessState: archivedWorkspaceAccess,
    resolutionLabel,
    resolutionReason,
    recommendedAction,
  });

  return {
    ok: true,
    source: request.source ?? record.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId,
    sceneName: request.sceneName,
    summary: `${resolutionLabel} for ${request.sceneName}.`,
    archiveStatus: record.archiveStatus,
    historyId: record.historyId,
    conflictStatus,
    resolutionStatus,
    resolutionLabel,
    resolutionReason,
    recommendedAction,
    hasPrivacyExposure: request.hasPrivacyExposure,
    approvalRoute,
    conflictDiff,
    membershipDrift,
    workspaceAccessState: workspaceAccess,
    workspaceGovernanceState: workspaceGovernance,
    archivedWorkspaceAccessState: archivedWorkspaceAccess,
    deliveredCount: record.deliveredCount,
    queuedCount: record.queuedCount,
    failedCount: record.failedCount,
    destinations: record.destinations,
  };
}
