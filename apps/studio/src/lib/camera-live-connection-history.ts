import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CameraLiveConnectionProbeRequest, CameraLiveConnectionProbeResponse } from "@/lib/camera-live-connection";

export type CameraLiveConnectionArchiveRecord = CameraLiveConnectionProbeResponse & {
  submittedAt: number;
  storedAt: number;
  raw: string;
};

const CAMERA_LIVE_CONNECTION_HISTORY_FILE = "camera-live-connection-history.json";

export function resolveCameraLiveConnectionStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "camera-live-connection.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "camera-live-connection.ts"))) return studioRoot;

  return cwd;
}

function resolveCameraLiveConnectionHistoryPath(rootDir = resolveCameraLiveConnectionStoreRoot()) {
  return join(rootDir, ".camera-live-connection-history", CAMERA_LIVE_CONNECTION_HISTORY_FILE);
}

export function loadCameraLiveConnectionHistory(rootDir = resolveCameraLiveConnectionStoreRoot()): CameraLiveConnectionArchiveRecord[] {
  try {
    const filePath = resolveCameraLiveConnectionHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<CameraLiveConnectionArchiveRecord>;
      const action = candidate.action === "bind" || candidate.action === "refresh" || candidate.action === "heartbeat" || candidate.action === "disconnect" ? candidate.action : null;
      const protocol = candidate.protocol === "rtsp" || candidate.protocol === "mjpeg" || candidate.protocol === "http" || candidate.protocol === "proxy" || candidate.protocol === "onvif" ? candidate.protocol : null;
      if (
        candidate.ok !== true
        || typeof candidate.source !== "string"
        || action == null
        || protocol == null
        || typeof candidate.receivedAt !== "string"
        || typeof candidate.summary !== "string"
        || typeof candidate.sceneId !== "string" && candidate.sceneId !== null
        || typeof candidate.sceneName !== "string" && candidate.sceneName !== null
        || typeof candidate.endpointUrl !== "string" && candidate.endpointUrl !== null && typeof candidate.endpointUrl !== "undefined"
        || typeof candidate.liveFeedUrl !== "string" && candidate.liveFeedUrl !== null && typeof candidate.liveFeedUrl !== "undefined"
        || typeof candidate.feedLabel !== "string" && candidate.feedLabel !== null && typeof candidate.feedLabel !== "undefined"
        || typeof candidate.submittedAt !== "number"
        || typeof candidate.storedAt !== "number"
        || typeof candidate.raw !== "string"
        || typeof candidate.record !== "object" || !candidate.record
      ) {
        return [];
      }
      return [{
        ok: true as const,
        source: candidate.source,
        action,
        protocol,
        receivedAt: candidate.receivedAt,
        sceneId: candidate.sceneId,
        sceneName: candidate.sceneName,
        endpointUrl: typeof candidate.endpointUrl === "string" ? candidate.endpointUrl : null,
        liveFeedUrl: typeof candidate.liveFeedUrl === "string" ? candidate.liveFeedUrl : null,
        feedLabel: typeof candidate.feedLabel === "string" ? candidate.feedLabel : null,
        summary: candidate.summary,
        record: candidate.record as CameraLiveConnectionProbeResponse["record"],
        errors: Array.isArray(candidate.errors) ? candidate.errors as string[] : [],
        sourceCount: typeof candidate.sourceCount === "number" ? candidate.sourceCount : 0,
        submittedAt: candidate.submittedAt,
        storedAt: candidate.storedAt,
        raw: candidate.raw,
      }];
    }).sort((a, b) => b.storedAt - a.storedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export function appendCameraLiveConnectionHistory(record: CameraLiveConnectionArchiveRecord, rootDir = resolveCameraLiveConnectionStoreRoot()) {
  const nextHistory = [record, ...loadCameraLiveConnectionHistory(rootDir)].slice(0, 12);
  const filePath = resolveCameraLiveConnectionHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextHistory, null, 2));
  return nextHistory;
}

export type { CameraLiveConnectionProbeRequest };
