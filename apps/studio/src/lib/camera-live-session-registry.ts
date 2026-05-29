import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CameraLiveConnectionProbeResponse } from "@/lib/camera-live-connection";

export type CameraLiveSessionStatus = "active" | "closed" | "expired";

export type CameraLiveSessionRecord = {
  sessionId: string;
  status: CameraLiveSessionStatus;
  cameraId: string;
  cameraName: string;
  sceneId: string | null;
  sceneName: string | null;
  liveFeedUrl: string | null;
  feedLabel: string | null;
  liveConnectionMode: CameraLiveConnectionProbeResponse["protocol"] | null;
  liveConnectionStatus: CameraLiveConnectionProbeResponse["record"]["liveConnectionStatus"];
  liveSessionState: CameraLiveConnectionProbeResponse["record"]["liveSessionState"];
  liveSessionStartedAt: number | null;
  liveSessionConfirmedAt: number | null;
  liveSessionExpiresAt: number | null;
  lastObservedAt: number;
  sessionExpiresAt: number | null;
  lastAction: CameraLiveConnectionProbeResponse["action"];
  summary: string;
};

const CAMERA_LIVE_SESSION_REGISTRY_FILE = "camera-live-session-registry.json";
const DEFAULT_SESSION_TTL_MS = 120_000;

function resolveCameraLiveSessionStoreRoot() {
  const overrideRoot = process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "camera-live-connection.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "camera-live-connection.ts"))) return studioRoot;

  return cwd;
}

function resolveCameraLiveSessionRegistryPath(rootDir = resolveCameraLiveSessionStoreRoot()) {
  return join(rootDir, ".camera-live-connection-history", CAMERA_LIVE_SESSION_REGISTRY_FILE);
}

export function loadCameraLiveSessionRegistry(rootDir = resolveCameraLiveSessionStoreRoot()): CameraLiveSessionRecord[] {
  try {
    const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<CameraLiveSessionRecord>;
      if (
        typeof candidate.sessionId !== "string"
        || typeof candidate.status !== "string"
        || typeof candidate.cameraId !== "string"
        || typeof candidate.cameraName !== "string"
        || typeof candidate.lastObservedAt !== "number"
        || typeof candidate.summary !== "string"
      ) {
        return [];
      }
      const status = candidate.status === "active" || candidate.status === "closed" || candidate.status === "expired" ? candidate.status : "expired";
      const sessionExpiresAt = typeof candidate.sessionExpiresAt === "number" ? candidate.sessionExpiresAt : null;
      const normalizedStatus = status === "active" && sessionExpiresAt != null && sessionExpiresAt < now ? "expired" : status;
      return [{
        sessionId: candidate.sessionId,
        status: normalizedStatus,
        cameraId: candidate.cameraId,
        cameraName: candidate.cameraName,
        sceneId: typeof candidate.sceneId === "string" ? candidate.sceneId : null,
        sceneName: typeof candidate.sceneName === "string" ? candidate.sceneName : null,
        liveFeedUrl: typeof candidate.liveFeedUrl === "string" ? candidate.liveFeedUrl : null,
        feedLabel: typeof candidate.feedLabel === "string" ? candidate.feedLabel : null,
        liveConnectionMode:
          candidate.liveConnectionMode === "rtsp"
          || candidate.liveConnectionMode === "mjpeg"
          || candidate.liveConnectionMode === "http"
          || candidate.liveConnectionMode === "onvif"
          || candidate.liveConnectionMode === "proxy"
            ? candidate.liveConnectionMode
            : null,
        liveConnectionStatus:
          candidate.liveConnectionStatus === "disconnected"
          || candidate.liveConnectionStatus === "connecting"
          || candidate.liveConnectionStatus === "connected"
          || candidate.liveConnectionStatus === "error"
            ? candidate.liveConnectionStatus
            : "disconnected",
        liveSessionState:
          candidate.liveSessionState === "idle"
          || candidate.liveSessionState === "probing"
          || candidate.liveSessionState === "connected"
          || candidate.liveSessionState === "error"
            ? candidate.liveSessionState
            : null,
        liveSessionStartedAt: typeof candidate.liveSessionStartedAt === "number" ? candidate.liveSessionStartedAt : null,
        liveSessionConfirmedAt: typeof candidate.liveSessionConfirmedAt === "number" ? candidate.liveSessionConfirmedAt : null,
        liveSessionExpiresAt: typeof candidate.liveSessionExpiresAt === "number" ? candidate.liveSessionExpiresAt : null,
        lastObservedAt: candidate.lastObservedAt,
        sessionExpiresAt,
        lastAction: candidate.lastAction === "bind" || candidate.lastAction === "refresh" || candidate.lastAction === "disconnect"
          ? candidate.lastAction
          : "bind",
        summary: candidate.summary,
      }];
    }).sort((a, b) => b.lastObservedAt - a.lastObservedAt).slice(0, 40);
  } catch {
    return [];
  }
}

export function appendCameraLiveSessionRecord(
  input: Omit<CameraLiveSessionRecord, "status" | "lastObservedAt" | "sessionExpiresAt"> & { status?: CameraLiveSessionStatus; lastObservedAt?: number; sessionExpiresAt?: number | null },
  rootDir = resolveCameraLiveSessionStoreRoot(),
) {
  const now = input.lastObservedAt ?? Date.now();
  const sessionExpiresAt = typeof input.sessionExpiresAt === "number"
    ? input.sessionExpiresAt
    : input.status === "active"
      ? now + DEFAULT_SESSION_TTL_MS
      : null;
  const nextRecord: CameraLiveSessionRecord = {
    ...input,
    status: input.status ?? "active",
    lastObservedAt: now,
    sessionExpiresAt,
  };
  const nextRegistry = [
    nextRecord,
    ...loadCameraLiveSessionRegistry(rootDir).filter((record) => record.sessionId !== nextRecord.sessionId),
  ].slice(0, 40);
  const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextRegistry, null, 2));
  return nextRegistry;
}

export function closeCameraLiveSessionRecord(
  sessionId: string,
  summary: string,
  rootDir = resolveCameraLiveSessionStoreRoot(),
) {
  const now = Date.now();
  const nextRegistry = loadCameraLiveSessionRegistry(rootDir).map((record) => (
    record.sessionId === sessionId
      ? {
          ...record,
          status: "closed" as const,
          lastObservedAt: now,
          sessionExpiresAt: null,
          liveSessionExpiresAt: null,
          summary,
        }
      : record
  ));
  const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextRegistry, null, 2));
  return nextRegistry;
}
