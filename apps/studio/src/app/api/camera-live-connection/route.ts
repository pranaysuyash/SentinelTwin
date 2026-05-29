import { NextResponse } from "next/server";

import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { appendCameraLiveSessionRecord, closeCameraLiveSessionRecord, loadCameraLiveSessionRegistry } from "@/lib/camera-live-session-registry";
import { CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection } from "@/lib/camera-live-connection";

export async function GET() {
  const history = loadCameraLiveConnectionHistory();
  const sessions = loadCameraLiveSessionRegistry().filter((record) => record.status === "active");
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

    const summary = await probeCameraLiveConnection(parsed.data);
    const storedAt = Date.now();
    if (summary.record.liveSessionId) {
      if (parsed.data.action === "disconnect") {
        closeCameraLiveSessionRecord(summary.record.liveSessionId, summary.summary);
      } else {
        appendCameraLiveSessionRecord({
          sessionId: summary.record.liveSessionId,
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
          lastAction: parsed.data.action,
          summary: summary.summary,
        });
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
