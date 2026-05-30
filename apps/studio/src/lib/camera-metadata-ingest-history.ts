import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CameraMetadataIngestRequest, CameraMetadataIngestResponse } from "@/lib/camera-metadata-live-ingest";
import type { OperationalEvidenceEventInput } from "@/lib/operational-evidence";

export type CameraMetadataArchiveRecord = {
  ok: true;
  source: string;
  ingestMode: "paste" | "external";
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  feedUrl: string | null;
  feedLabel: string | null;
  summary: string;
  records: CameraMetadataIngestResponse["records"];
  evidenceEvents: OperationalEvidenceEventInput[];
  errors: string[];
  sourceCount: number;
  submittedAt: number;
  storedAt: number;
  raw: string;
  cameras: CameraMetadataIngestRequest["cameras"];
};

const CAMERA_METADATA_HISTORY_FILE = "camera-metadata-history.json";

export function resolveCameraMetadataStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_CAMERA_METADATA_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "camera-metadata-live-ingest.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "camera-metadata-live-ingest.ts"))) return studioRoot;

  return cwd;
}

function resolveCameraMetadataHistoryPath(rootDir = resolveCameraMetadataStoreRoot()) {
  return join(rootDir, ".camera-metadata-history", CAMERA_METADATA_HISTORY_FILE);
}

export function loadCameraMetadataHistory(rootDir = resolveCameraMetadataStoreRoot()): CameraMetadataArchiveRecord[] {
  try {
    const filePath = resolveCameraMetadataHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<CameraMetadataArchiveRecord>;
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
        || !Array.isArray(candidate.records)
        || typeof candidate.evidenceEvents !== "undefined" && !Array.isArray(candidate.evidenceEvents)
        || !Array.isArray(candidate.errors)
        || typeof candidate.sourceCount !== "number"
        || !Array.isArray(candidate.cameras)
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
        records: candidate.records as CameraMetadataIngestResponse["records"],
        evidenceEvents: Array.isArray(candidate.evidenceEvents) ? candidate.evidenceEvents as OperationalEvidenceEventInput[] : [],
        errors: candidate.errors as string[],
        sourceCount: candidate.sourceCount,
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
        raw: candidate.raw,
        cameras: candidate.cameras as CameraMetadataIngestRequest["cameras"],
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function appendCameraMetadataHistory(record: CameraMetadataArchiveRecord, rootDir = resolveCameraMetadataStoreRoot()) {
  const nextHistory = [record, ...loadCameraMetadataHistory(rootDir)].slice(0, 12);
  const filePath = resolveCameraMetadataHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-metadata-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextHistory, null, 2));
  return nextHistory;
}
