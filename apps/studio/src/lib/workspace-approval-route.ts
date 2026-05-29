import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { summarizeWorkspaceApprovalRouting } from "@/lib/workspace-membership-routing";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceApprovalRouteSummary } from "@/lib/workspace-membership-routing";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

const WorkspaceApprovalRouteTargetSchema = z.object({
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

export const WorkspaceApprovalRouteRequestSchema = z.object({
  source: z.string().min(1).default("governance-panel"),
  submittedAt: z.number().int().nonnegative().optional(),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  hasPrivacyExposure: z.boolean().default(false),
  workspaceAccessState: WorkspaceAccessStateSchema,
  workspaceGovernanceState: WorkspaceGovernanceStateSchema,
  archivedWorkspaceAccessState: WorkspaceAccessStateSchema.nullable().optional(),
  destinations: z.array(WorkspaceApprovalRouteTargetSchema).default([]),
});

export type WorkspaceApprovalRouteRequest = z.infer<typeof WorkspaceApprovalRouteRequestSchema>;

export type WorkspaceApprovalRouteDispatchAttempt = {
  label: string;
  endpoint: string | null;
  mode: "webhook" | "archive" | "manual";
  status: "queued" | "delivered" | "failed";
  message: string;
  responseStatus: number | null;
  deliveredAt: number;
};

export type WorkspaceApprovalRouteArchiveResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string;
  sceneName: string;
  summary: string;
  archiveStatus: "server archive" | "local cache";
  historyId: string;
  approvalRoute: WorkspaceApprovalRouteSummary;
  workspaceAccessState: WorkspaceAccessState;
  workspaceGovernanceState: WorkspaceGovernanceState;
  archivedWorkspaceAccessState: WorkspaceAccessState | null;
  deliveredCount: number;
  queuedCount: number;
  failedCount: number;
  destinations: WorkspaceApprovalRouteDispatchAttempt[];
};

export type WorkspaceApprovalRouteArchiveRecord = WorkspaceApprovalRouteArchiveResponse & {
  submittedAt: number;
  storedAt: number;
};

const WORKSPACE_APPROVAL_ROUTE_HISTORY_FILE = "workspace-approval-route-history.json";

export function resolveWorkspaceApprovalRouteStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_WORKSPACE_APPROVAL_ROUTE_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "workspace-approval-route.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "workspace-approval-route.ts"))) return studioRoot;

  return cwd;
}

function resolveWorkspaceApprovalRouteHistoryPath(rootDir = resolveWorkspaceApprovalRouteStoreRoot()) {
  return join(rootDir, ".workspace-approval-route", WORKSPACE_APPROVAL_ROUTE_HISTORY_FILE);
}

export function loadWorkspaceApprovalRouteHistory(rootDir = resolveWorkspaceApprovalRouteStoreRoot()): WorkspaceApprovalRouteArchiveRecord[] {
  try {
    const filePath = resolveWorkspaceApprovalRouteHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceApprovalRouteArchiveRecord>;
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
        || !candidate.approvalRoute
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
        approvalRoute: candidate.approvalRoute,
        workspaceAccessState: candidate.workspaceAccessState as WorkspaceAccessState,
        workspaceGovernanceState: candidate.workspaceGovernanceState as WorkspaceGovernanceState,
        archivedWorkspaceAccessState: candidate.archivedWorkspaceAccessState ? candidate.archivedWorkspaceAccessState as WorkspaceAccessState : null,
        deliveredCount: candidate.deliveredCount,
        queuedCount: candidate.queuedCount,
        failedCount: candidate.failedCount,
        destinations: candidate.destinations as WorkspaceApprovalRouteDispatchAttempt[],
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistWorkspaceApprovalRouteHistory(history: WorkspaceApprovalRouteArchiveRecord[], rootDir = resolveWorkspaceApprovalRouteStoreRoot()) {
  const filePath = resolveWorkspaceApprovalRouteHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".workspace-approval-route"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendWorkspaceApprovalRouteHistory(record: WorkspaceApprovalRouteArchiveRecord, rootDir = resolveWorkspaceApprovalRouteStoreRoot()) {
  const nextHistory = [record, ...loadWorkspaceApprovalRouteHistory(rootDir)].slice(0, 12);
  persistWorkspaceApprovalRouteHistory(nextHistory, rootDir);
  return nextHistory;
}

export async function summarizeWorkspaceApprovalRoute(request: WorkspaceApprovalRouteRequest): Promise<WorkspaceApprovalRouteArchiveResponse> {
  const workspaceAccess = request.workspaceAccessState as WorkspaceAccessState;
  const workspaceGovernance = request.workspaceGovernanceState as WorkspaceGovernanceState;
  const archivedWorkspaceAccess = request.archivedWorkspaceAccessState ? request.archivedWorkspaceAccessState as WorkspaceAccessState : null;
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

  const attempts: WorkspaceApprovalRouteDispatchAttempt[] = [];
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
            approvalRoute,
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
  const archiveStatus: WorkspaceApprovalRouteArchiveResponse["archiveStatus"] = attempts.some((attempt) => attempt.status === "delivered")
    ? "server archive"
    : "local cache";

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId,
    sceneName: request.sceneName,
    summary: `${approvalRoute.routeLabel} archived for ${request.sceneName}.`,
    archiveStatus,
    historyId: `${request.sceneId}:${request.submittedAt ?? Date.now()}`,
    approvalRoute,
    workspaceAccessState: workspaceAccess,
    workspaceGovernanceState: workspaceGovernance,
    archivedWorkspaceAccessState: archivedWorkspaceAccess,
    deliveredCount,
    queuedCount,
    failedCount,
    destinations: attempts,
  };
}
