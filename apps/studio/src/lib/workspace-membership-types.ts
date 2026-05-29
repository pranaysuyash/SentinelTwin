import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceApprovalRouteSummary } from "@/lib/workspace-membership-routing";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

export type WorkspaceMembershipDispatchAttempt = {
  label: string;
  endpoint: string | null;
  mode: "webhook" | "archive" | "manual";
  status: "queued" | "delivered" | "failed";
  message: string;
  responseStatus: number | null;
  deliveredAt: number;
};

export type WorkspaceMembershipArchiveResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string;
  sceneName: string;
  summary: string;
  archiveStatus: "server archive" | "local cache";
  historyId: string;
  activeMemberId: string;
  activeMemberLabel: string;
  policyMode: WorkspaceAccessState["policy"]["mode"];
  teamSize: number;
  workspaceAccessState: WorkspaceAccessState;
  workspaceGovernanceState: WorkspaceGovernanceState;
  approvalRoute: WorkspaceApprovalRouteSummary;
  deliveredCount: number;
  queuedCount: number;
  failedCount: number;
  destinations: WorkspaceMembershipDispatchAttempt[];
};

export type WorkspaceMembershipArchiveRecord = WorkspaceMembershipArchiveResponse & {
  submittedAt: number;
  storedAt: number;
};
