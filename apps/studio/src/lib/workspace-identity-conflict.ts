import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { summarizeWorkspaceApprovalRouting, summarizeWorkspaceMembershipDrift, type WorkspaceApprovalRouteSummary } from "@/lib/workspace-membership-routing";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

const WorkspaceIdentityConflictTargetSchema = z.object({
  label: z.string().min(1),
  endpoint: z.string().url().nullable().optional(),
  mode: z.enum(["webhook", "archive", "manual"]).default("webhook"),
});

const WorkspaceAccessStateSchema = z.object({
  activeMemberId: z.string().min(1),
  members: z.array(z.unknown()),
  policy: z.object({
    mode: z.enum(["single_user", "shared"]),
    publishRequiresApproval: z.boolean(),
    privacySensitiveRequiresReviewer: z.boolean(),
    requiredReviewerRoles: z.array(z.string()),
  }),
});

const WorkspaceGovernanceStateSchema = z.object({
  activeRole: z.string().min(1),
  approvalMode: z.enum(["open", "review_required"]),
  sceneStatus: z.string().min(1),
  requestedAt: z.number().int().nonnegative().nullable(),
  requestedBy: z.string().nullable(),
  reviewedAt: z.number().int().nonnegative().nullable(),
  reviewedBy: z.string().nullable(),
  publishedAt: z.number().int().nonnegative().nullable(),
  publishedBy: z.string().nullable(),
  reviewNotes: z.array(z.string()),
});

export const WorkspaceIdentityConflictRequestSchema = z.object({
  source: z.string().min(1).default("governance-panel"),
  submittedAt: z.number().int().nonnegative().optional(),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  hasPrivacyExposure: z.boolean().default(false),
  workspaceAccessState: WorkspaceAccessStateSchema,
  workspaceGovernanceState: WorkspaceGovernanceStateSchema,
  archivedWorkspaceAccessState: WorkspaceAccessStateSchema.nullable().optional(),
  destinations: z.array(WorkspaceIdentityConflictTargetSchema).default([]),
});

export type WorkspaceIdentityConflictRequest = z.infer<typeof WorkspaceIdentityConflictRequestSchema>;

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
  membershipDrift: ReturnType<typeof summarizeWorkspaceMembershipDrift> | null;
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

const WORKSPACE_IDENTITY_CONFLICT_HISTORY_FILE = "workspace-identity-conflict-history.json";

export function resolveWorkspaceIdentityConflictStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_WORKSPACE_IDENTITY_CONFLICT_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "workspace-identity-conflict.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "workspace-identity-conflict.ts"))) return studioRoot;

  return cwd;
}

function resolveWorkspaceIdentityConflictHistoryPath(rootDir = resolveWorkspaceIdentityConflictStoreRoot()) {
  return join(rootDir, ".workspace-identity-conflict", WORKSPACE_IDENTITY_CONFLICT_HISTORY_FILE);
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

export function loadWorkspaceIdentityConflictHistory(rootDir = resolveWorkspaceIdentityConflictStoreRoot()): WorkspaceIdentityConflictArchiveRecord[] {
  try {
    const filePath = resolveWorkspaceIdentityConflictHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceIdentityConflictArchiveRecord>;
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
        approvalRoute: candidate.approvalRoute as WorkspaceApprovalRouteSummary,
        ...deriveWorkspaceIdentityConflictResolution(
          (candidate.conflictStatus === "reconcile_needed" ? "reconcile_needed" : candidate.conflictStatus === "archive_pending" ? "archive_pending" : "aligned") as WorkspaceIdentityConflictStatus,
          candidate.approvalRoute as WorkspaceApprovalRouteSummary,
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
  mkdirSync(join(rootDir, ".workspace-identity-conflict"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendWorkspaceIdentityConflictHistory(record: WorkspaceIdentityConflictArchiveRecord, rootDir = resolveWorkspaceIdentityConflictStoreRoot()) {
  const nextHistory = [record, ...loadWorkspaceIdentityConflictHistory(rootDir)].slice(0, 12);
  persistWorkspaceIdentityConflictHistory(nextHistory, rootDir);
  return nextHistory;
}

export async function summarizeWorkspaceIdentityConflict(request: WorkspaceIdentityConflictRequest): Promise<WorkspaceIdentityConflictArchiveResponse> {
  const workspaceAccess = request.workspaceAccessState as WorkspaceAccessState;
  const workspaceGovernance = request.workspaceGovernanceState as WorkspaceGovernanceState;
  const archivedWorkspaceAccess = request.archivedWorkspaceAccessState ? request.archivedWorkspaceAccessState as WorkspaceAccessState : null;
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
  const destinations = request.destinations.length > 0
    ? request.destinations
    : [{ label: "Local relay", endpoint: null, mode: "archive" as const }];

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

  const attempts: WorkspaceIdentityConflictDispatchAttempt[] = [];
  for (const destination of destinations) {
    const deliveredAt = Date.now();
    if (destination.endpoint) {
      try {
        const response = await fetch(destination.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: request.source,
            sceneId: request.sceneId,
            sceneName: request.sceneName,
            conflictStatus,
            resolutionStatus,
            resolutionLabel,
            resolutionReason,
            recommendedAction,
            approvalRoute,
            membershipDrift,
            hasPrivacyExposure: request.hasPrivacyExposure,
            workspaceAccessState: workspaceAccess,
            workspaceGovernanceState: workspaceGovernance,
            archivedWorkspaceAccessState: archivedWorkspaceAccess,
            deliveredAt,
          }),
        });
        attempts.push({
          label: destination.label,
          endpoint: destination.endpoint,
          mode: destination.mode,
          status: response.ok ? "delivered" : "failed",
          message: response.ok
            ? `Delivered to ${destination.label}.`
            : `Delivery failed with HTTP ${response.status}.`,
          responseStatus: response.status,
          deliveredAt,
        });
      } catch (error) {
        attempts.push({
          label: destination.label,
          endpoint: destination.endpoint,
          mode: destination.mode,
          status: "failed",
          message: error instanceof Error ? error.message : `Delivery failed for ${destination.label}.`,
          responseStatus: null,
          deliveredAt,
        });
      }
    } else {
      attempts.push({
        label: destination.label,
        endpoint: null,
        mode: destination.mode,
        status: "queued",
        message: `Queued for ${destination.label} because no delivery endpoint is configured.`,
        responseStatus: null,
        deliveredAt,
      });
    }
  }

  const deliveredCount = attempts.filter((attempt) => attempt.status === "delivered").length;
  const queuedCount = attempts.filter((attempt) => attempt.status === "queued").length;
  const failedCount = attempts.filter((attempt) => attempt.status === "failed").length;
  const archiveStatus: WorkspaceIdentityConflictArchiveResponse["archiveStatus"] = attempts.some((attempt) => attempt.status === "delivered")
    ? "server archive"
    : "local cache";

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId,
    sceneName: request.sceneName,
    summary: `${resolutionLabel} for ${request.sceneName}.`,
    archiveStatus,
    historyId: `${request.sceneId}:${request.submittedAt ?? Date.now()}:conflict`,
    conflictStatus,
    resolutionStatus,
    resolutionLabel,
    resolutionReason,
    recommendedAction,
    hasPrivacyExposure: request.hasPrivacyExposure,
    approvalRoute,
    membershipDrift,
    workspaceAccessState: workspaceAccess,
    workspaceGovernanceState: workspaceGovernance,
    archivedWorkspaceAccessState: archivedWorkspaceAccess,
    deliveredCount,
    queuedCount,
    failedCount,
    destinations: attempts,
  };
}
