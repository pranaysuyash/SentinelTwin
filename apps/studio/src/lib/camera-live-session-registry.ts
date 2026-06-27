import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CameraLiveAuthChallengeScheme, CameraLiveAuthMode, CameraLiveAuthState, CameraLiveConnectionProbeResponse, CameraLiveConnectionRecord } from "@/lib/camera-live-connection";

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
  transportSessionId: string | null;
  transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null;
  lastHeartbeatAt: number | null;
  probeCount: number;
  protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null;
  authMode: CameraLiveAuthMode;
  authState: CameraLiveAuthState;
  authRealm: string | null;
  authSessionId: string | null;
  authSessionExpiresAt: number | null;
  transportResponseStatus: number | null;
  transportResponseStatusText: string | null;
  authChallengeHeader: string | null;
  authChallengeScheme: CameraLiveAuthChallengeScheme;
  authChallengeRealm: string | null;
  onvifUsername: string | null;
  onvifPassword: string | null;
  eventSubscriptionUri: string | null;
  eventSubscriptionReference: string | null;
  eventSubscriptionExpiresAt: number | null;
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
        transportSessionId: typeof candidate.transportSessionId === "string" ? candidate.transportSessionId : null,
        transportSessionState:
          candidate.transportSessionState === "idle"
          || candidate.transportSessionState === "negotiating"
          || candidate.transportSessionState === "active"
          || candidate.transportSessionState === "closing"
          || candidate.transportSessionState === "error"
            ? candidate.transportSessionState
            : null,
        lastHeartbeatAt: typeof candidate.lastHeartbeatAt === "number" ? candidate.lastHeartbeatAt : null,
        probeCount: typeof candidate.probeCount === "number" ? candidate.probeCount : 0,
        protocolProfile:
          candidate.protocolProfile === "onvif_device"
          || candidate.protocolProfile === "rtsp_session"
          || candidate.protocolProfile === "mjpeg_stream"
          || candidate.protocolProfile === "http_poll"
          || candidate.protocolProfile === "proxy"
            ? candidate.protocolProfile
            : null,
        authMode:
          candidate.authMode === "none"
          || candidate.authMode === "basic"
          || candidate.authMode === "digest"
          || candidate.authMode === "token"
          || candidate.authMode === "cookie"
          || candidate.authMode === "onvif_digest"
          || candidate.authMode === "proxy_passthrough"
            ? candidate.authMode
            : "none",
        authState:
          candidate.authState === "unauthenticated"
          || candidate.authState === "authenticating"
          || candidate.authState === "authenticated"
          || candidate.authState === "failed"
            ? candidate.authState
            : "unauthenticated",
        authRealm: typeof candidate.authRealm === "string" ? candidate.authRealm : null,
        authSessionId: typeof candidate.authSessionId === "string" ? candidate.authSessionId : null,
        authSessionExpiresAt: typeof candidate.authSessionExpiresAt === "number" ? candidate.authSessionExpiresAt : null,
        transportResponseStatus: typeof candidate.transportResponseStatus === "number" ? candidate.transportResponseStatus : null,
        transportResponseStatusText: typeof candidate.transportResponseStatusText === "string" ? candidate.transportResponseStatusText : null,
        authChallengeHeader: typeof candidate.authChallengeHeader === "string" ? candidate.authChallengeHeader : null,
        authChallengeScheme:
          candidate.authChallengeScheme === "basic"
          || candidate.authChallengeScheme === "digest"
          || candidate.authChallengeScheme === "bearer"
          || candidate.authChallengeScheme === "token"
            ? candidate.authChallengeScheme
            : null,
        authChallengeRealm: typeof candidate.authChallengeRealm === "string" ? candidate.authChallengeRealm : null,
        onvifUsername: typeof candidate.onvifUsername === "string" ? candidate.onvifUsername : null,
        onvifPassword: typeof candidate.onvifPassword === "string" ? candidate.onvifPassword : null,
        eventSubscriptionUri: typeof candidate.eventSubscriptionUri === "string" ? candidate.eventSubscriptionUri : null,
        eventSubscriptionReference: typeof candidate.eventSubscriptionReference === "string" ? candidate.eventSubscriptionReference : null,
        eventSubscriptionExpiresAt: typeof candidate.eventSubscriptionExpiresAt === "number" ? candidate.eventSubscriptionExpiresAt : null,
        lastObservedAt: candidate.lastObservedAt,
        sessionExpiresAt,
        lastAction: candidate.lastAction === "bind" || candidate.lastAction === "refresh" || candidate.lastAction === "heartbeat" || candidate.lastAction === "disconnect"
          ? candidate.lastAction
          : "bind",
        summary: candidate.summary,
      }];
    }).sort((a, b) => b.lastObservedAt - a.lastObservedAt).slice(0, 40);
  } catch {
    return [];
  }
}

export function pruneExpiredCameraLiveSessionRegistry(rootDir = resolveCameraLiveSessionStoreRoot()) {
  const now = Date.now();
  const currentRegistry = loadCameraLiveSessionRegistry(rootDir);
  const nextRegistry = currentRegistry.map((record) => (
    record.status === "active" && record.sessionExpiresAt !== null && record.sessionExpiresAt < now
      ? {
          ...record,
          status: "expired" as const,
          lastObservedAt: now,
          liveConnectionStatus: "disconnected" as const,
          liveSessionState: "idle" as const,
          transportSessionState: "idle" as const,
          authState: "unauthenticated" as const,
          authSessionExpiresAt: null,
          transportResponseStatus: record.transportResponseStatus,
          transportResponseStatusText: record.transportResponseStatusText,
          authChallengeHeader: record.authChallengeHeader,
          authChallengeScheme: record.authChallengeScheme,
          authChallengeRealm: record.authChallengeRealm,
          summary: `${record.summary} Lease expired.`,
        }
      : record
  ));
  if (JSON.stringify(nextRegistry) !== JSON.stringify(currentRegistry)) {
    const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
    mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
    writeFileSync(filePath, JSON.stringify(nextRegistry, null, 2));
  }
  return nextRegistry;
}

export function toCameraLiveSessionRecord(
  record: CameraLiveConnectionRecord,
  input: {
    sceneId: string | null;
    sceneName: string | null;
    summary: string;
    lastAction: CameraLiveConnectionProbeResponse["action"];
    status?: CameraLiveSessionStatus;
    lastObservedAt?: number;
    sessionExpiresAt?: number | null;
  },
): CameraLiveSessionRecord {
  const now = input.lastObservedAt ?? Date.now();
  const status = input.status ?? (record.liveConnectionStatus === "connected" || record.liveConnectionStatus === "connecting" ? "active" : "closed");
  const sessionExpiresAt = typeof input.sessionExpiresAt === "number"
    ? input.sessionExpiresAt
    : status === "active"
      ? now + DEFAULT_SESSION_TTL_MS
      : null;
  return {
    sessionId: record.liveSessionId ?? `live_session_${record.cameraId}_${now}`,
    status,
    cameraId: record.cameraId,
    cameraName: record.cameraName,
    sceneId: input.sceneId,
    sceneName: input.sceneName,
    liveFeedUrl: record.liveFeedUrl,
    feedLabel: record.liveFeedLabel,
    liveConnectionMode: record.liveConnectionMode,
    liveConnectionStatus: record.liveConnectionStatus,
    liveSessionState: record.liveSessionState,
    liveSessionStartedAt: record.liveSessionStartedAt,
    liveSessionConfirmedAt: record.liveSessionConfirmedAt,
    liveSessionExpiresAt: record.liveSessionExpiresAt,
    transportSessionId: record.transportSessionId,
    transportSessionState: record.transportSessionState,
    lastHeartbeatAt: record.lastHeartbeatAt,
    probeCount: record.probeCount,
    protocolProfile: record.protocolProfile,
    authMode: record.authMode,
    authState: record.authState,
    authRealm: record.authRealm,
    authSessionId: record.authSessionId,
    authSessionExpiresAt: record.authSessionExpiresAt,
    transportResponseStatus: record.transportResponseStatus,
    transportResponseStatusText: record.transportResponseStatusText,
    authChallengeHeader: record.authChallengeHeader,
    authChallengeScheme: record.authChallengeScheme,
    authChallengeRealm: record.authChallengeRealm,
    onvifUsername: record.onvifUsername ?? null,
    onvifPassword: record.onvifPassword ?? null,
    eventSubscriptionUri: record.eventSubscriptionUri,
    eventSubscriptionReference: record.eventSubscriptionReference,
    eventSubscriptionExpiresAt: record.eventSubscriptionExpiresAt,
    lastObservedAt: now,
    sessionExpiresAt,
    lastAction: input.lastAction,
    summary: input.summary,
  };
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
        liveConnectionStatus: "disconnected",
        liveSessionState: "idle",
        transportSessionState: "idle",
        authState: "unauthenticated",
        authSessionExpiresAt: null,
        transportResponseStatus: record.transportResponseStatus,
        transportResponseStatusText: record.transportResponseStatusText,
        authChallengeHeader: record.authChallengeHeader,
        authChallengeScheme: record.authChallengeScheme,
        authChallengeRealm: record.authChallengeRealm,
        summary,
      }
      : record
  ));
  const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextRegistry, null, 2));
  return nextRegistry;
}

export function renewCameraLiveSessionRecord(
  input: Omit<CameraLiveSessionRecord, "status" | "lastObservedAt" | "sessionExpiresAt" | "lastAction" | "summary"> & {
    summary: string;
    lastObservedAt?: number;
    sessionExpiresAt?: number | null;
  },
  rootDir = resolveCameraLiveSessionStoreRoot(),
) {
  const now = input.lastObservedAt ?? Date.now();
  const nextSessionExpiresAt = typeof input.sessionExpiresAt === "number"
    ? input.sessionExpiresAt
    : now + DEFAULT_SESSION_TTL_MS;
  const baseRecord: CameraLiveSessionRecord = {
    ...input,
    status: "active",
    lastObservedAt: now,
    sessionExpiresAt: nextSessionExpiresAt,
    lastAction: "heartbeat",
    summary: input.summary,
  };
  const currentRegistry = loadCameraLiveSessionRegistry(rootDir);
  const nextRegistry = [
    baseRecord,
    ...currentRegistry.filter((record) => record.sessionId !== baseRecord.sessionId),
  ].slice(0, 40);
  const filePath = resolveCameraLiveSessionRegistryPath(rootDir);
  mkdirSync(join(rootDir, ".camera-live-connection-history"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextRegistry, null, 2));
  return nextRegistry;
}
