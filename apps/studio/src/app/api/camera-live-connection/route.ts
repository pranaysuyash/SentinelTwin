import { NextResponse } from "next/server";

import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { appendCameraLiveSessionRecord, closeCameraLiveSessionRecord, pruneExpiredCameraLiveSessionRegistry, renewCameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection } from "@/lib/camera-live-connection";

export async function GET() {
  const history = loadCameraLiveConnectionHistory();
  const sessions = pruneExpiredCameraLiveSessionRegistry().filter((record) => record.status === "active");
  return NextResponse.json({
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
    activeSessions: sessions,
    activeSessionCount: sessions.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CameraLiveConnectionProbeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid camera live connection payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const storedAt = Date.now();
    const sessionRegistry = pruneExpiredCameraLiveSessionRegistry();
    const activeSession = sessionRegistry.find((record) => record.cameraId === parsed.data.cameraId && record.status === "active") ?? null;

    if (parsed.data.action === "heartbeat") {
      const sessionId = parsed.data.liveSessionId ?? activeSession?.sessionId ?? `live_session_${parsed.data.cameraId}_${storedAt}`;
      const transportSessionId = parsed.data.transportSessionId ?? activeSession?.transportSessionId ?? `transport_session_${parsed.data.cameraId}_${storedAt}`;
      const heartbeatRecord = {
        ok: true as const,
        source: parsed.data.source,
        action: "heartbeat" as const,
        protocol: parsed.data.protocol,
        receivedAt: new Date(storedAt).toISOString(),
        sceneId: parsed.data.sceneId ?? null,
        sceneName: parsed.data.sceneName ?? null,
        endpointUrl: parsed.data.endpointUrl ?? parsed.data.liveFeedUrl ?? null,
        liveFeedUrl: parsed.data.liveFeedUrl ?? parsed.data.endpointUrl ?? null,
        feedLabel: parsed.data.feedLabel ?? activeSession?.feedLabel ?? null,
        summary: `Heartbeat renewed the live session for ${parsed.data.cameraName}.`,
        record: {
          cameraId: parsed.data.cameraId,
          cameraName: parsed.data.cameraName,
          liveSessionId: sessionId,
          liveSessionState: "connected" as const,
          liveSessionStartedAt: activeSession?.liveSessionStartedAt ?? storedAt,
          liveSessionConfirmedAt: storedAt,
          liveSessionExpiresAt: storedAt + 120_000,
          transportSessionId,
          transportSessionState: "active" as const,
          lastHeartbeatAt: storedAt,
          probeCount: (activeSession?.probeCount ?? 0) + 1,
          protocolProfile: activeSession?.protocolProfile ?? (parsed.data.protocol === "onvif" ? "onvif_device" : parsed.data.protocol === "rtsp" ? "rtsp_session" : parsed.data.protocol === "mjpeg" ? "mjpeg_stream" : parsed.data.protocol === "http" ? "http_poll" : "proxy"),
          liveFeedUrl: parsed.data.liveFeedUrl ?? activeSession?.liveFeedUrl ?? null,
          liveFeedLabel: parsed.data.feedLabel ?? activeSession?.feedLabel ?? null,
          liveConnectionMode: parsed.data.protocol,
          liveConnectionStatus: "connected" as const,
          notes: parsed.data.notes ?? activeSession?.summary ?? null,
          timestamp: storedAt,
        },
        errors: [],
        sourceCount: 0,
      };

      renewCameraLiveSessionRecord({
        sessionId,
        cameraId: parsed.data.cameraId,
        cameraName: parsed.data.cameraName,
        sceneId: parsed.data.sceneId ?? null,
        sceneName: parsed.data.sceneName ?? null,
        liveFeedUrl: heartbeatRecord.record.liveFeedUrl,
        feedLabel: heartbeatRecord.record.liveFeedLabel,
        liveConnectionMode: heartbeatRecord.record.liveConnectionMode,
        liveConnectionStatus: heartbeatRecord.record.liveConnectionStatus,
        liveSessionState: heartbeatRecord.record.liveSessionState,
        liveSessionStartedAt: heartbeatRecord.record.liveSessionStartedAt,
        liveSessionConfirmedAt: heartbeatRecord.record.liveSessionConfirmedAt,
        liveSessionExpiresAt: heartbeatRecord.record.liveSessionExpiresAt,
        transportSessionId,
        transportSessionState: heartbeatRecord.record.transportSessionState,
        lastHeartbeatAt: storedAt,
        probeCount: heartbeatRecord.record.probeCount,
        protocolProfile: heartbeatRecord.record.protocolProfile,
        sessionExpiresAt: heartbeatRecord.record.liveSessionExpiresAt,
        lastAction: "heartbeat",
        summary: heartbeatRecord.summary,
      });

      const history = appendCameraLiveConnectionHistory({
        ...heartbeatRecord,
        submittedAt: parsed.data.submittedAt ?? storedAt,
        storedAt,
        raw: parsed.data.raw.trim(),
      });

      return NextResponse.json({
        ...heartbeatRecord,
        storedAt,
        historyCount: history.length,
      });
    }

    const summary = await probeCameraLiveConnection(parsed.data);
    const sessionId = summary.record.liveSessionId
      ?? parsed.data.liveSessionId
      ?? (parsed.data.action === "disconnect"
        ? sessionRegistry.find((record) => record.cameraId === parsed.data.cameraId && record.status === "active")?.sessionId ?? null
        : null);
    if (sessionId) {
      if (parsed.data.action === "disconnect") {
        closeCameraLiveSessionRecord(sessionId, summary.summary);
      } else {
        appendCameraLiveSessionRecord({
          sessionId,
          status: summary.record.liveConnectionStatus === "connected" ? "active" : "expired",
          cameraId: summary.record.cameraId,
          cameraName: summary.record.cameraName,
          sceneId: parsed.data.sceneId ?? null,
          sceneName: parsed.data.sceneName ?? null,
          liveFeedUrl: summary.record.liveFeedUrl,
          feedLabel: summary.record.liveFeedLabel,
          liveConnectionMode: summary.record.liveConnectionMode,
          liveConnectionStatus: summary.record.liveConnectionStatus,
          liveSessionState: summary.record.liveSessionState,
          liveSessionStartedAt: summary.record.liveSessionStartedAt,
          liveSessionConfirmedAt: summary.record.liveSessionConfirmedAt,
          liveSessionExpiresAt: summary.record.liveSessionExpiresAt,
          transportSessionId: summary.record.transportSessionId,
          transportSessionState: summary.record.transportSessionState,
          lastHeartbeatAt: summary.record.lastHeartbeatAt,
          probeCount: summary.record.probeCount,
          protocolProfile: summary.record.protocolProfile,
          sessionExpiresAt: summary.record.liveSessionExpiresAt,
          lastAction: parsed.data.action,
          summary: summary.summary,
        } as Parameters<typeof appendCameraLiveSessionRecord>[0]);
      }
    }
    const history = appendCameraLiveConnectionHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
    });

    return NextResponse.json({
      ...summary,
      storedAt,
      historyCount: history.length,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to parse camera live connection payload.",
      },
      { status: 400 },
    );
  }
}
