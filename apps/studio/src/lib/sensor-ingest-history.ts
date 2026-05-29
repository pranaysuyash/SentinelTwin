import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SensorLiveIngestRequest, SensorLiveIngestResponse } from "@/lib/sensor-live-ingest";

export type SensorIngestArchiveRecord = {
  ok: true;
  source: string;
  ingestMode: "paste" | "external";
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  feedUrl: string | null;
  feedLabel: string | null;
  summary: string;
  events: SensorLiveIngestResponse["events"];
  errors: string[];
  sourceCount: number;
  submittedAt: number;
  storedAt: number;
  raw: string;
  sensors: SensorLiveIngestRequest["sensors"];
};

const SENSOR_INGEST_HISTORY_FILE = "sensor-ingest-history.json";

export function resolveSensorIngestStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_SENSOR_INGEST_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "sensor-live-ingest.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "sensor-live-ingest.ts"))) return studioRoot;

  return cwd;
}

function resolveSensorIngestHistoryPath(rootDir = resolveSensorIngestStoreRoot()) {
  return join(rootDir, ".sensor-ingest-history", SENSOR_INGEST_HISTORY_FILE);
}

export function loadSensorIngestHistory(rootDir = resolveSensorIngestStoreRoot()): SensorIngestArchiveRecord[] {
  try {
    const filePath = resolveSensorIngestHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<SensorIngestArchiveRecord>;
      const ingestMode = candidate.ingestMode === "paste" || candidate.ingestMode === "external" ? candidate.ingestMode : null;
      if (
        candidate.ok !== true
        || typeof candidate.source !== "string"
        || ingestMode == null
        || typeof candidate.receivedAt !== "string"
        || typeof candidate.summary !== "string"
        || typeof candidate.sceneId !== "string" && candidate.sceneId !== null
        || typeof candidate.sceneName !== "string" && candidate.sceneName !== null
        || typeof candidate.feedUrl !== "string" && candidate.feedUrl !== null && typeof candidate.feedUrl !== "undefined"
        || typeof candidate.feedLabel !== "string" && candidate.feedLabel !== null && typeof candidate.feedLabel !== "undefined"
        || typeof candidate.submittedAt !== "number"
        || typeof candidate.storedAt !== "number"
        || typeof candidate.raw !== "string"
        || !Array.isArray(candidate.events)
        || !Array.isArray(candidate.errors)
        || typeof candidate.sourceCount !== "number"
        || !Array.isArray(candidate.sensors)
      ) {
        return [];
      }
      return [{
        ok: true as const,
        source: candidate.source,
        ingestMode,
        receivedAt: candidate.receivedAt,
        sceneId: candidate.sceneId,
        sceneName: candidate.sceneName,
        feedUrl: typeof candidate.feedUrl === "string" ? candidate.feedUrl : null,
        feedLabel: typeof candidate.feedLabel === "string" ? candidate.feedLabel : null,
        summary: candidate.summary,
        events: candidate.events as SensorLiveIngestResponse["events"],
        errors: candidate.errors as string[],
        sourceCount: candidate.sourceCount,
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
        raw: candidate.raw,
        sensors: candidate.sensors as SensorLiveIngestRequest["sensors"],
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function persistSensorIngestHistory(history: SensorIngestArchiveRecord[], rootDir = resolveSensorIngestStoreRoot()) {
  const filePath = resolveSensorIngestHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".sensor-ingest-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(history.slice(0, 12), null, 2));
}

export function appendSensorIngestHistory(record: SensorIngestArchiveRecord, rootDir = resolveSensorIngestStoreRoot()) {
  const nextHistory = [record, ...loadSensorIngestHistory(rootDir)].slice(0, 12);
  persistSensorIngestHistory(nextHistory, rootDir);
  return nextHistory;
}
