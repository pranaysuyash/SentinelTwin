import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import type { SupportIngestResponse } from "@/lib/support-ingest";

export type SupportIngestHistoryRecord = SupportIngestResponse & {
  submittedAt: number;
  storedAt: number;
};

const SUPPORT_INGEST_HISTORY_FILE = "support-ingest-history.json";

export const SupportIngestHistoryRecordSchema = z.object({
  ok: z.literal(true),
  source: z.string().min(1),
  receivedAt: z.string().min(1),
  sceneId: z.string().min(1).nullable(),
  sceneName: z.string().min(1).nullable(),
  summary: z.string().min(1),
  routing: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    alertCount: z.number().int().nonnegative(),
    highPriorityCount: z.number().int().nonnegative(),
    latestAlert: z.object({
      id: z.string().min(1),
      timestamp: z.number().int().nonnegative(),
      source: z.string().min(1),
      severity: z.enum(["info", "warning", "error"]),
      title: z.string().min(1),
      details: z.string().min(1),
      category: z.string().min(1),
      path: z.string().nullable(),
      stack: z.string().nullable(),
    }).nullable(),
    recentAlerts: z.array(z.object({
      id: z.string().min(1),
      timestamp: z.number().int().nonnegative(),
      source: z.string().min(1),
      severity: z.enum(["info", "warning", "error"]),
      title: z.string().min(1),
      details: z.string().min(1),
      category: z.string().min(1),
      path: z.string().nullable(),
      stack: z.string().nullable(),
    })),
    recommendation: z.string().min(1),
    statusLabel: z.enum(["healthy", "watch", "attention"]),
  }),
  counts: z.object({
    runtimeIncidents: z.number().int().nonnegative(),
    externalLogs: z.number().int().nonnegative(),
    telemetryEvents: z.number().int().nonnegative(),
  }),
  submittedAt: z.number().int().nonnegative(),
  storedAt: z.number().int().nonnegative(),
});

export function resolveSupportIngestStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_SUPPORT_INGEST_STORE_DIR?.trim();
  if (overrideRoot) {
    return overrideRoot;
  }

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "support-ingest.ts"))) {
    return cwd;
  }

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "support-ingest.ts"))) {
    return studioRoot;
  }

  return cwd;
}

function resolveSupportIngestHistoryPath(rootDir = resolveSupportIngestStoreRoot()) {
  return join(rootDir, ".support-ingest", SUPPORT_INGEST_HISTORY_FILE);
}

export function loadSupportIngestHistory(rootDir = resolveSupportIngestStoreRoot()): SupportIngestHistoryRecord[] {
  try {
    const filePath = resolveSupportIngestHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<SupportIngestHistoryRecord>;
      if (
        candidate.ok !== true
        || typeof candidate.source !== "string"
        || typeof candidate.receivedAt !== "string"
        || typeof candidate.summary !== "string"
        || typeof candidate.submittedAt !== "number"
        || typeof candidate.storedAt !== "number"
        || typeof candidate.sceneId !== "string" && candidate.sceneId !== null
        || typeof candidate.sceneName !== "string" && candidate.sceneName !== null
        || typeof candidate.routing !== "object"
        || typeof candidate.counts !== "object"
      ) {
        return [];
      }
      const routing = candidate.routing as SupportIngestResponse["routing"];
      const counts = candidate.counts as SupportIngestResponse["counts"];
      if (
        typeof routing.title !== "string"
        || typeof routing.summary !== "string"
        || typeof routing.alertCount !== "number"
        || typeof routing.highPriorityCount !== "number"
        || typeof routing.recommendation !== "string"
        || typeof routing.statusLabel !== "string"
        || !Array.isArray(routing.recentAlerts)
        || typeof counts.runtimeIncidents !== "number"
        || typeof counts.externalLogs !== "number"
        || typeof counts.telemetryEvents !== "number"
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
        routing,
        counts,
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistSupportIngestHistory(history: SupportIngestHistoryRecord[], rootDir = resolveSupportIngestStoreRoot()) {
  const filePath = resolveSupportIngestHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".support-ingest"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendSupportIngestHistory(record: SupportIngestHistoryRecord, rootDir = resolveSupportIngestStoreRoot()) {
  const nextHistory = [record, ...loadSupportIngestHistory(rootDir)].slice(0, 12);
  persistSupportIngestHistory(nextHistory, rootDir);
  return nextHistory;
}
