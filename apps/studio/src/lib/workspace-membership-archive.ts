import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { normalizeWorkspaceAccessState, type WorkspaceAccessState } from "@/lib/workspace-access";
import { summarizeWorkspaceApprovalRouting } from "@/lib/workspace-membership-routing";
import { WORKSPACE_ROLES, normalizeWorkspaceGovernance, type WorkspaceRole } from "@/lib/workspace-governance";
import type { SecurityScene } from "@/schema/security-scene";
import type {
  WorkspaceMembershipArchiveRecord,
  WorkspaceMembershipArchiveResponse,
  WorkspaceMembershipDispatchAttempt,
} from "@/lib/workspace-membership-types";

const WORKSPACE_ROLE_ENUM = WORKSPACE_ROLES as [WorkspaceRole, ...WorkspaceRole[]];

const WorkspaceMembershipMemberSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  role: z.enum(WORKSPACE_ROLE_ENUM),
  clearance: z.enum(["standard", "restricted", "privacy_sensitive"]),
  tags: z.array(z.string()),
  canPublish: z.boolean(),
  canReview: z.boolean(),
  canRestore: z.boolean(),
});

const WorkspaceMembershipPolicySchema = z.object({
  mode: z.enum(["single_user", "shared"]),
  publishRequiresApproval: z.boolean(),
  privacySensitiveRequiresReviewer: z.boolean(),
  requiredReviewerRoles: z.array(z.enum(WORKSPACE_ROLE_ENUM)),
});

const WorkspaceAccessStateSchema = z.object({
  activeMemberId: z.string().min(1),
  members: z.array(WorkspaceMembershipMemberSchema),
  policy: WorkspaceMembershipPolicySchema,
});

const WorkspaceGovernanceStateSchema = z.object({
  activeRole: z.enum(WORKSPACE_ROLE_ENUM),
  approvalMode: z.enum(["open", "review_required"]),
  sceneStatus: z.enum(["draft", "review_requested", "approved", "rejected", "published", "recovered"]),
  requestedAt: z.number().int().nonnegative().nullable(),
  requestedBy: z.enum(WORKSPACE_ROLE_ENUM).nullable(),
  reviewedAt: z.number().int().nonnegative().nullable(),
  reviewedBy: z.enum(WORKSPACE_ROLE_ENUM).nullable(),
  publishedAt: z.number().int().nonnegative().nullable(),
  publishedBy: z.enum(WORKSPACE_ROLE_ENUM).nullable(),
  reviewNotes: z.array(z.string()),
});

const WorkspaceMembershipDriftSchema = z.object({
  activeMemberChanged: z.boolean(),
  teamSizeChanged: z.boolean(),
  policyChanged: z.boolean(),
});

const WorkspaceApprovalRouteSummarySchema = z.object({
  routeStatus: z.enum(["ready", "reconcile_before_route", "review_required", "open_publish"]),
  routeLabel: z.string().min(1),
  routeReason: z.string().min(1),
  targetReviewerLabel: z.string().min(1),
  activeMemberLabel: z.string().min(1),
  archivedMemberLabel: z.string().min(1),
  currentPolicyLabel: z.string().min(1),
  archivedPolicyLabel: z.string().min(1),
  drift: WorkspaceMembershipDriftSchema.nullable(),
  hasPrivacyExposure: z.boolean(),
});

export const WorkspaceMembershipArchiveTargetSchema = z.object({
  label: z.string().min(1),
  endpoint: z.string().url().nullable().optional(),
  mode: z.enum(["webhook", "archive", "manual"]).default("webhook"),
});

export const WorkspaceMembershipArchiveRequestSchema = z.object({
  source: z.string().min(1).default("debug-panel"),
  submittedAt: z.number().int().nonnegative().optional(),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  workspaceAccessState: WorkspaceAccessStateSchema,
  workspaceGovernanceState: WorkspaceGovernanceStateSchema,
  approvalRoute: WorkspaceApprovalRouteSummarySchema.optional(),
  destinations: z.array(WorkspaceMembershipArchiveTargetSchema).default([]),
});

export type WorkspaceMembershipArchiveRequest = z.infer<typeof WorkspaceMembershipArchiveRequestSchema>;

const WORKSPACE_MEMBERSHIP_ARCHIVE_HISTORY_FILE = "workspace-membership-archive-history.json";

export function resolveWorkspaceMembershipArchiveStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_WORKSPACE_MEMBERSHIP_ARCHIVE_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "workspace-membership-archive.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "workspace-membership-archive.ts"))) return studioRoot;

  return cwd;
}

function resolveWorkspaceMembershipArchiveHistoryPath(rootDir = resolveWorkspaceMembershipArchiveStoreRoot()) {
  return join(rootDir, ".workspace-membership-archive", WORKSPACE_MEMBERSHIP_ARCHIVE_HISTORY_FILE);
}

export function loadWorkspaceMembershipArchiveHistory(rootDir = resolveWorkspaceMembershipArchiveStoreRoot()): WorkspaceMembershipArchiveRecord[] {
  try {
    const filePath = resolveWorkspaceMembershipArchiveHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceMembershipArchiveRecord>;
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
        || typeof candidate.activeMemberId !== "string"
        || typeof candidate.activeMemberLabel !== "string"
        || typeof candidate.policyMode !== "string"
        || typeof candidate.teamSize !== "number"
        || !candidate.workspaceAccessState
        || !candidate.workspaceGovernanceState
        || typeof candidate.deliveredCount !== "number"
        || typeof candidate.queuedCount !== "number"
        || typeof candidate.failedCount !== "number"
        || !Array.isArray(candidate.destinations)
      ) {
        return [];
      }
      return [{
        ok: true as const,
        source: candidate.source,
        receivedAt: candidate.receivedAt,
        sceneId: candidate.sceneId,
        sceneName: candidate.sceneName,
        summary: candidate.summary,
        archiveStatus: (candidate.archiveStatus === "server archive" ? "server archive" : "local cache") as "server archive" | "local cache",
        historyId: candidate.historyId,
        activeMemberId: candidate.activeMemberId,
        activeMemberLabel: candidate.activeMemberLabel,
        policyMode: (candidate.policyMode === "shared" ? "shared" : "single_user") as WorkspaceAccessState["policy"]["mode"],
        teamSize: candidate.teamSize,
        workspaceAccessState: normalizeWorkspaceAccessState(candidate.workspaceAccessState),
        workspaceGovernanceState: normalizeWorkspaceGovernance(candidate.workspaceGovernanceState),
        approvalRoute: candidate.approvalRoute
          ? candidate.approvalRoute as WorkspaceMembershipArchiveRecord["approvalRoute"]
          : summarizeWorkspaceApprovalRouting(
            {
              id: candidate.sceneId,
              name: candidate.sceneName,
              privacyZones: [],
            } as SecurityScene,
            normalizeWorkspaceAccessState(candidate.workspaceAccessState),
            normalizeWorkspaceGovernance(candidate.workspaceGovernanceState),
            null,
          ),
        deliveredCount: candidate.deliveredCount,
        queuedCount: candidate.queuedCount,
        failedCount: candidate.failedCount,
        destinations: candidate.destinations as WorkspaceMembershipDispatchAttempt[],
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistWorkspaceMembershipArchiveHistory(history: WorkspaceMembershipArchiveRecord[], rootDir = resolveWorkspaceMembershipArchiveStoreRoot()) {
  const filePath = resolveWorkspaceMembershipArchiveHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".workspace-membership-archive"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendWorkspaceMembershipArchiveHistory(record: WorkspaceMembershipArchiveRecord, rootDir = resolveWorkspaceMembershipArchiveStoreRoot()) {
  const nextHistory = [record, ...loadWorkspaceMembershipArchiveHistory(rootDir)].slice(0, 12);
  persistWorkspaceMembershipArchiveHistory(nextHistory, rootDir);
  return nextHistory;
}

export async function summarizeWorkspaceMembershipArchive(request: WorkspaceMembershipArchiveRequest): Promise<WorkspaceMembershipArchiveResponse> {
  const workspaceAccess = normalizeWorkspaceAccessState(request.workspaceAccessState);
  const workspaceGovernance = normalizeWorkspaceGovernance(request.workspaceGovernanceState);
  const approvalRoute = request.approvalRoute ?? summarizeWorkspaceApprovalRouting(
    {
      id: request.sceneId,
      name: request.sceneName,
      privacyZones: [],
    } as SecurityScene,
    workspaceAccess,
    workspaceGovernance,
    null,
  );
  const destinations = request.destinations.length > 0
    ? request.destinations
    : [{ label: "Local relay", endpoint: null, mode: "archive" as const }];

  const activeMember = workspaceAccess.members.find((member) => member.id === workspaceAccess.activeMemberId) ?? workspaceAccess.members[0] ?? null;
  const attempts: WorkspaceMembershipDispatchAttempt[] = [];
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
            workspaceAccess,
            workspaceGovernance,
            approvalRoute,
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
  const archiveStatus: WorkspaceMembershipArchiveResponse["archiveStatus"] = attempts.some((attempt) => attempt.status === "delivered")
    ? "server archive"
    : "local cache";
  const historyId = `${request.sceneId}:${request.submittedAt ?? Date.now()}`;

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId,
    sceneName: request.sceneName,
    summary: `${workspaceAccess.members.length} member${workspaceAccess.members.length === 1 ? "" : "s"} captured for ${workspaceAccess.policy.mode === "shared" ? "shared" : "single-user"} workspace membership on ${request.sceneName} with ${approvalRoute.routeStatus.replace(/_/g, " ")} approval routing.`,
    archiveStatus,
    historyId,
    activeMemberId: workspaceAccess.activeMemberId,
    activeMemberLabel: activeMember ? `${activeMember.displayName} · ${activeMember.role.replace(/_/g, " ")}` : "No active member",
    policyMode: workspaceAccess.policy.mode,
    teamSize: workspaceAccess.members.length,
    workspaceAccessState: workspaceAccess,
    workspaceGovernanceState: workspaceGovernance,
    approvalRoute,
    deliveredCount,
    queuedCount,
    failedCount,
    destinations: attempts,
  };
}
