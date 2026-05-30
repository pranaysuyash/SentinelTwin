import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceApprovalRouteSummary } from "@/lib/workspace-membership-routing";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import type { WorkspaceMembershipDriftSummary } from "@/lib/workspace-membership-routing";

export type WorkspaceIdentityConflictTarget = {
  label: string;
  endpoint?: string | null;
  mode: "webhook" | "archive" | "manual";
};

export type WorkspaceIdentityConflictRequest = {
  source?: string;
  submittedAt?: number;
  sceneId: string;
  sceneName: string;
  hasPrivacyExposure: boolean;
  workspaceAccessState: WorkspaceAccessState;
  workspaceGovernanceState: WorkspaceGovernanceState;
  archivedWorkspaceAccessState?: WorkspaceAccessState | null;
  destinations: WorkspaceIdentityConflictTarget[];
};

export type WorkspaceIdentityConflictDispatchAttempt = {
  label: string;
  endpoint: string | null;
  mode: "webhook" | "archive" | "manual";
  status: "queued" | "delivered" | "failed";
  message: string;
  responseStatus: number | null;
  deliveredAt: number;
};

export type WorkspaceIdentityConflictStatus = "aligned" | "reconcile_needed" | "archive_pending";

export type WorkspaceIdentityConflictResolutionStatus =
  | "ready_for_publish"
  | "route_for_review"
  | "reconcile_before_route"
  | "archive_pending";

export type WorkspaceIdentityConflictDiffRow = {
  label: string;
  currentValue: string;
  archivedValue: string;
  changed: boolean;
};

export type WorkspaceIdentityConflictDiffSummary = {
  title: string;
  subtitle: string;
  changedCount: number;
  currentMemberLabel: string;
  archivedMemberLabel: string;
  currentPolicyLabel: string;
  archivedPolicyLabel: string;
  routeKey: string;
  routeLabel: string;
  routeReason: string;
  resolutionLabel: string;
  resolutionReason: string;
  recommendedAction: string;
  hasPrivacyExposure: boolean;
  rows: WorkspaceIdentityConflictDiffRow[];
};

export type WorkspaceIdentityConflictArchiveResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string;
  sceneName: string;
  summary: string;
  archiveStatus: "server archive" | "local cache";
  historyId: string;
  conflictStatus: WorkspaceIdentityConflictStatus;
  resolutionStatus: WorkspaceIdentityConflictResolutionStatus;
  resolutionLabel: string;
  resolutionReason: string;
  recommendedAction: string;
  hasPrivacyExposure: boolean;
  approvalRoute: WorkspaceApprovalRouteSummary;
  conflictDiff: WorkspaceIdentityConflictDiffSummary;
  membershipDrift: WorkspaceMembershipDriftSummary | null;
  workspaceAccessState: WorkspaceAccessState;
  workspaceGovernanceState: WorkspaceGovernanceState;
  archivedWorkspaceAccessState: WorkspaceAccessState | null;
  deliveredCount: number;
  queuedCount: number;
  failedCount: number;
  destinations: WorkspaceIdentityConflictDispatchAttempt[];
};

export type WorkspaceIdentityConflictArchiveRecord = WorkspaceIdentityConflictArchiveResponse & {
  submittedAt: number;
  storedAt: number;
};

export type WorkspaceIdentityConflictReplayRequest = {
  source?: string;
  submittedAt?: number;
  sceneId: string;
  sceneName: string;
  hasPrivacyExposure: boolean;
  workspaceAccessState: WorkspaceAccessState;
  workspaceGovernanceState: WorkspaceGovernanceState;
  archivedWorkspaceAccessState: WorkspaceAccessState | null;
};
