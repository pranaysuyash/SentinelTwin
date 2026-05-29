import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { loadSupportIngestHistory, type SupportIngestHistoryRecord, SupportIngestHistoryRecordSchema } from "@/lib/support-ingest-history";

export const SupportDeliveryTargetSchema = z.object({
  label: z.string().min(1),
  endpoint: z.string().url().nullable().optional(),
  mode: z.enum(["webhook", "archive", "manual"]).default("webhook"),
});

export type SupportDeliveryTarget = z.infer<typeof SupportDeliveryTargetSchema>;

export const SupportDeliveryRequestSchema = z.object({
  source: z.string().min(1).default("debug-panel"),
  submittedAt: z.number().int().nonnegative().optional(),
  supportIngest: SupportIngestHistoryRecordSchema.optional(),
  supportIngestId: z.string().min(1).optional(),
  destinations: z.array(SupportDeliveryTargetSchema).default([]),
});

export type SupportDeliveryRequest = z.infer<typeof SupportDeliveryRequestSchema>;

export type SupportDeliveryAttempt = {
  label: string;
  endpoint: string | null;
  mode: SupportDeliveryTarget["mode"];
  status: "queued" | "delivered" | "failed";
  message: string;
  responseStatus: number | null;
  deliveredAt: number;
};

export type SupportDeliveryResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  summary: string;
  archiveStatus: "server archive" | "local cache";
  historyId: string;
  deliveredCount: number;
  queuedCount: number;
  failedCount: number;
  destinations: SupportDeliveryAttempt[];
};

export type SupportDeliveryArchiveRecord = SupportDeliveryResponse & {
  submittedAt: number;
  storedAt: number;
};

const SUPPORT_DELIVERY_HISTORY_FILE = "support-delivery-history.json";

export function resolveSupportDeliveryStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "support-ingest.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "support-ingest.ts"))) return studioRoot;

  return cwd;
}

function resolveSupportDeliveryHistoryPath(rootDir = resolveSupportDeliveryStoreRoot()) {
  return join(rootDir, ".support-delivery", SUPPORT_DELIVERY_HISTORY_FILE);
}

export function loadSupportDeliveryHistory(rootDir = resolveSupportDeliveryStoreRoot()): SupportDeliveryArchiveRecord[] {
  try {
    const filePath = resolveSupportDeliveryHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<SupportDeliveryArchiveRecord>;
      if (
        candidate.ok !== true
        || typeof candidate.source !== "string"
        || typeof candidate.receivedAt !== "string"
        || typeof candidate.summary !== "string"
        || typeof candidate.archiveStatus !== "string"
        || typeof candidate.historyId !== "string"
        || typeof candidate.submittedAt !== "number"
        || typeof candidate.storedAt !== "number"
        || typeof candidate.sceneId !== "string" && candidate.sceneId !== null
        || typeof candidate.sceneName !== "string" && candidate.sceneName !== null
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
        deliveredCount: candidate.deliveredCount,
        queuedCount: candidate.queuedCount,
        failedCount: candidate.failedCount,
        destinations: candidate.destinations as SupportDeliveryAttempt[],
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistSupportDeliveryHistory(history: SupportDeliveryArchiveRecord[], rootDir = resolveSupportDeliveryStoreRoot()) {
  const filePath = resolveSupportDeliveryHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".support-delivery"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendSupportDeliveryHistory(record: SupportDeliveryArchiveRecord, rootDir = resolveSupportDeliveryStoreRoot()) {
  const nextHistory = [record, ...loadSupportDeliveryHistory(rootDir)].slice(0, 12);
  persistSupportDeliveryHistory(nextHistory, rootDir);
  return nextHistory;
}

function resolveDefaultSupportIngestRecord(request: SupportDeliveryRequest): SupportIngestHistoryRecord | null {
  if (request.supportIngest) return request.supportIngest as SupportIngestHistoryRecord;
  if (request.supportIngestId) {
    return loadSupportIngestHistory().find((entry) => entry.receivedAt === request.supportIngestId || entry.sceneId === request.supportIngestId) ?? null;
  }
  return loadSupportIngestHistory()[0] ?? null;
}

export async function summarizeSupportDelivery(request: SupportDeliveryRequest): Promise<SupportDeliveryResponse> {
  const supportIngest = resolveDefaultSupportIngestRecord(request);
  if (!supportIngest) {
    throw new Error("No support ingest record available for delivery.");
  }

  const destinations = request.destinations.length > 0
    ? request.destinations
    : [{ label: "Local relay", endpoint: null, mode: "archive" as const }];

  const attempts: SupportDeliveryAttempt[] = [];
  for (const destination of destinations) {
    const deliveredAt = Date.now();
    if (destination.endpoint) {
      try {
        const response = await fetch(destination.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: request.source,
            supportIngest,
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
  const archiveStatus: SupportDeliveryResponse["archiveStatus"] = attempts.some((attempt) => attempt.status === "delivered")
    ? "server archive"
    : "local cache";

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: supportIngest.sceneId,
    sceneName: supportIngest.sceneName,
    summary: `${attempts.length} delivery target${attempts.length === 1 ? "" : "s"} processed from support ingest ${supportIngest.sceneName ?? supportIngest.sceneId ?? "payload"}.`,
    archiveStatus,
    historyId: supportIngest.receivedAt,
    deliveredCount,
    queuedCount,
    failedCount,
    destinations: attempts,
  } as SupportDeliveryResponse;
}
