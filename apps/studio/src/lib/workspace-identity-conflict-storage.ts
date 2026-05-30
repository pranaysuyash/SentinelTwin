import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  summarizeWorkspaceIdentityConflictDiff,
  deriveWorkspaceIdentityConflictResolution,
  resolveWorkspaceIdentityConflictStoreRoot,
  resolveWorkspaceIdentityConflictHistoryPath,
  type WorkspaceIdentityConflictArchiveRecord,
  type WorkspaceIdentityConflictDiffSummary,
  type WorkspaceIdentityConflictStatus,
  type WorkspaceIdentityConflictDispatchAttempt,
} from "@/lib/workspace-identity-conflict";
import { normalizeWorkspaceApprovalRouteSummary, type WorkspaceApprovalRouteSummary } from "@/lib/workspace-membership-routing";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

export function loadWorkspaceIdentityConflictHistory(rootDir = resolveWorkspaceIdentityConflictStoreRoot()): WorkspaceIdentityConflictArchiveRecord[] {
  try {
    const filePath = resolveWorkspaceIdentityConflictHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceIdentityConflictArchiveRecord> & {
        conflictDiff?: WorkspaceIdentityConflictDiffSummary;
      };
      if (
        candidate.ok !== true
        || typeof candidate.source !== "string"
        || typeof candidate.receivedAt !== "string"
        || typeof candidate.sceneId !== "string"
        || typeof candidate.sceneName !== "string"
        || typeof candidate.summary !== "string"
        || typeof candidate.archiveStatus !== "string"
        || typeof candidate.historyId !== "string"
        || typeof candidate.submittedAt !== "number"
        || typeof candidate.storedAt !== "number"
        || typeof candidate.conflictStatus !== "string"
        || typeof candidate.hasPrivacyExposure !== "boolean"
        || !candidate.approvalRoute
        || !Array.isArray(candidate.destinations)
      ) {
        return [];
      }
      const record: WorkspaceIdentityConflictArchiveRecord = {
        approvalRoute: normalizeWorkspaceApprovalRouteSummary(candidate.approvalRoute as WorkspaceApprovalRouteSummary),
        conflictDiff: candidate.conflictDiff ?? summarizeWorkspaceIdentityConflictDiff({
          approvalRoute: normalizeWorkspaceApprovalRouteSummary(candidate.approvalRoute as WorkspaceApprovalRouteSummary),
          hasPrivacyExposure: candidate.hasPrivacyExposure,
          workspaceAccessState: candidate.workspaceAccessState as WorkspaceAccessState,
          archivedWorkspaceAccessState: candidate.archivedWorkspaceAccessState ? candidate.archivedWorkspaceAccessState as WorkspaceAccessState : null,
          resolutionLabel: candidate.resolutionLabel as string,
          resolutionReason: candidate.resolutionReason as string,
          recommendedAction: candidate.recommendedAction as string,
        }),
        ...deriveWorkspaceIdentityConflictResolution(
          (candidate.conflictStatus === "reconcile_needed" ? "reconcile_needed" : candidate.conflictStatus === "archive_pending" ? "archive_pending" : "aligned") as WorkspaceIdentityConflictStatus,
          normalizeWorkspaceApprovalRouteSummary(candidate.approvalRoute as WorkspaceApprovalRouteSummary),
        ),
        ok: true as const,
        source: candidate.source,
        receivedAt: candidate.receivedAt,
        sceneId: candidate.sceneId,
        sceneName: candidate.sceneName,
        summary: candidate.summary,
        archiveStatus: (candidate.archiveStatus === "server archive" ? "server archive" : "local cache") as "server archive" | "local cache",
        historyId: candidate.historyId,
        conflictStatus: (candidate.conflictStatus === "reconcile_needed" ? "reconcile_needed" : candidate.conflictStatus === "archive_pending" ? "archive_pending" : "aligned") as WorkspaceIdentityConflictStatus,
        hasPrivacyExposure: candidate.hasPrivacyExposure,
        membershipDrift: candidate.membershipDrift ?? null,
        workspaceAccessState: candidate.workspaceAccessState as WorkspaceAccessState,
        workspaceGovernanceState: candidate.workspaceGovernanceState as WorkspaceGovernanceState,
        archivedWorkspaceAccessState: candidate.archivedWorkspaceAccessState ? candidate.archivedWorkspaceAccessState as WorkspaceAccessState : null,
        deliveredCount: candidate.deliveredCount ?? 0,
        queuedCount: candidate.queuedCount ?? 0,
        failedCount: candidate.failedCount ?? 0,
        destinations: candidate.destinations as WorkspaceIdentityConflictDispatchAttempt[],
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      };
      return [record];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistWorkspaceIdentityConflictHistory(history: WorkspaceIdentityConflictArchiveRecord[], rootDir = resolveWorkspaceIdentityConflictStoreRoot()) {
  const filePath = resolveWorkspaceIdentityConflictHistoryPath(rootDir);
  mkdirSync(`${rootDir.replace(/\/$/, "")}/.workspace-identity-conflict`, { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendWorkspaceIdentityConflictHistory(record: WorkspaceIdentityConflictArchiveRecord, rootDir = resolveWorkspaceIdentityConflictStoreRoot()) {
  const nextHistory = [record, ...loadWorkspaceIdentityConflictHistory(rootDir)].slice(0, 12);
  persistWorkspaceIdentityConflictHistory(nextHistory, rootDir);
  return nextHistory;
}
