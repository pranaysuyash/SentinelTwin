import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

export const GovernanceArchiveTargetSchema = z.object({
  label: z.string().min(1),
  endpoint: z.string().url().nullable().optional(),
  mode: z.enum(["webhook", "archive", "manual"]).default("webhook"),
});

export type GovernanceArchiveTarget = z.infer<typeof GovernanceArchiveTargetSchema>;

export const GovernanceTrailEventSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  branchLabel: z.string().min(1).optional().nullable(),
  lifecycleStage: z.string().min(1).optional().nullable(),
});

export const GovernanceTrailSummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  requestCount: z.number().int().nonnegative(),
  approvalCount: z.number().int().nonnegative(),
  rejectionCount: z.number().int().nonnegative(),
  annotationCount: z.number().int().nonnegative(),
  roleChangeCount: z.number().int().nonnegative(),
  policyChangeCount: z.number().int().nonnegative(),
  latestEvent: GovernanceTrailEventSchema.nullable(),
  recentEvents: z.array(GovernanceTrailEventSchema),
});

export type GovernanceTrailSummary = z.infer<typeof GovernanceTrailSummarySchema>;

export const GovernanceArchiveRequestSchema = z.object({
  source: z.string().min(1).default("debug-panel"),
  submittedAt: z.number().int().nonnegative().optional(),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  workspaceAccessSummary: z.object({
    activeMemberLabel: z.string().min(1),
    modeLabel: z.string().min(1),
    teamSize: z.number().int().nonnegative(),
    reviewRouteLabel: z.string().min(1),
    publishRouteLabel: z.string().min(1),
  }),
  workspaceGovernanceSummary: z.object({
    roleLabel: z.string().min(1),
    approvalModeLabel: z.string().min(1),
    sceneStatusLabel: z.string().min(1),
    canPublish: z.boolean(),
    needsApproval: z.boolean(),
    reviewAgeLabel: z.string().nullable(),
    reviewerLabel: z.string().nullable(),
  }),
  governanceTrail: GovernanceTrailSummarySchema,
  destinations: z.array(GovernanceArchiveTargetSchema).default([]),
});

export type GovernanceArchiveRequest = z.infer<typeof GovernanceArchiveRequestSchema>;

export type GovernanceDispatchAttempt = {
  label: string;
  endpoint: string | null;
  mode: GovernanceArchiveTarget["mode"];
  status: "queued" | "delivered" | "failed";
  message: string;
  responseStatus: number | null;
  deliveredAt: number;
};

export type GovernanceArchiveResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string;
  sceneName: string;
  summary: string;
  governanceTrail?: GovernanceTrailSummary;
  archiveStatus: "server archive" | "local cache";
  historyId: string;
  deliveredCount: number;
  queuedCount: number;
  failedCount: number;
  destinations: GovernanceDispatchAttempt[];
};

export type GovernanceArchiveRecord = GovernanceArchiveResponse & {
  submittedAt: number;
  storedAt: number;
};

const GOVERNANCE_ARCHIVE_HISTORY_FILE = "governance-archive-history.json";

export function resolveGovernanceArchiveStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_GOVERNANCE_ARCHIVE_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "operational-evidence.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "operational-evidence.ts"))) return studioRoot;

  return cwd;
}

function resolveGovernanceArchiveHistoryPath(rootDir = resolveGovernanceArchiveStoreRoot()) {
  return join(rootDir, ".governance-archive", GOVERNANCE_ARCHIVE_HISTORY_FILE);
}

export function loadGovernanceArchiveHistory(rootDir = resolveGovernanceArchiveStoreRoot()): GovernanceArchiveRecord[] {
  try {
    const filePath = resolveGovernanceArchiveHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<GovernanceArchiveRecord>;
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
        governanceTrail: candidate.governanceTrail && typeof candidate.governanceTrail === "object"
          ? candidate.governanceTrail as GovernanceTrailSummary
          : undefined,
        archiveStatus: (candidate.archiveStatus === "server archive" ? "server archive" : "local cache") as "server archive" | "local cache",
        historyId: candidate.historyId,
        deliveredCount: candidate.deliveredCount,
        queuedCount: candidate.queuedCount,
        failedCount: candidate.failedCount,
        destinations: candidate.destinations as GovernanceDispatchAttempt[],
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistGovernanceArchiveHistory(history: GovernanceArchiveRecord[], rootDir = resolveGovernanceArchiveStoreRoot()) {
  const filePath = resolveGovernanceArchiveHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".governance-archive"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendGovernanceArchiveHistory(record: GovernanceArchiveRecord, rootDir = resolveGovernanceArchiveStoreRoot()) {
  const nextHistory = [record, ...loadGovernanceArchiveHistory(rootDir)].slice(0, 12);
  persistGovernanceArchiveHistory(nextHistory, rootDir);
  return nextHistory;
}

export async function summarizeGovernanceArchive(request: GovernanceArchiveRequest): Promise<GovernanceArchiveResponse> {
  const destinations = request.destinations.length > 0
    ? request.destinations
    : [{ label: "Local relay", endpoint: null, mode: "archive" as const }];

  const attempts: GovernanceDispatchAttempt[] = [];
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
            workspaceAccessSummary: request.workspaceAccessSummary,
            workspaceGovernanceSummary: request.workspaceGovernanceSummary,
            governanceTrail: request.governanceTrail,
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
  const archiveStatus: GovernanceArchiveResponse["archiveStatus"] = attempts.some((attempt) => attempt.status === "delivered")
    ? "server archive"
    : "local cache";
  const historyId = request.governanceTrail.latestEvent?.id ?? `${request.sceneId}:${request.submittedAt ?? Date.now()}`;

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId,
    sceneName: request.sceneName,
    summary: `${attempts.length} governance target${attempts.length === 1 ? "" : "s"} processed from ${request.workspaceGovernanceSummary.sceneStatusLabel.toLowerCase()} trail for ${request.sceneName}.`,
    governanceTrail: request.governanceTrail,
    archiveStatus,
    historyId,
    deliveredCount,
    queuedCount,
    failedCount,
    destinations: attempts,
  };
}
