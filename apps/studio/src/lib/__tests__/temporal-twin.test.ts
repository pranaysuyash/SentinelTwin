import { describe, expect, test } from "bun:test";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { buildOperationalEvidenceEvent, summarizeOperationalEvidenceTemporalTwin } from "@/lib/operational-evidence";

describe("Temporal Twin continuity and replay integrity", () => {
  test("cross-surface replay integrity check and continuity fields", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Temporal Tests";

    const cameraHistory = [{
      ok: true as const,
      source: "camera-1",
      action: "bind" as const,
      protocol: "onvif" as const,
      receivedAt: new Date().toISOString(),
      sceneId: scene.id,
      sceneName: scene.name,
      endpointUrl: "http://cam1",
      liveFeedUrl: "rtsp://cam1/live",
      feedLabel: "Front Door",
      summary: "Connected",
      record: {},
      errors: [],
      sourceCount: 1,
      submittedAt: Date.now(),
      storedAt: Date.now(),
      raw: "{}",
    }];

    const sensorHistory = [{
      ok: true as const,
      source: "sensor-1",
      ingestMode: "external" as const,
      receivedAt: new Date().toISOString(),
      sceneId: scene.id,
      sceneName: scene.name,
      feedUrl: "http://sensor1",
      feedLabel: "Lobby Motion",
      summary: "Triggered",
      events: [],
      errors: [],
      sourceCount: 1,
      submittedAt: Date.now(),
      storedAt: Date.now(),
      raw: "{}",
      sensors: [],
    }];

    const event = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Snapshot with continuity",
      details: "Checkpoint testing",
      actor: "system",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 1,
      sceneSnapshot: structuredClone(scene),
      liveCameraConnectionContinuity: cameraHistory,
      sensorIngestContinuity: sensorHistory,
    });

    const summary = summarizeOperationalEvidenceTemporalTwin([event], scene);

    expect(summary.totalEvents).toBe(1);
    expect(summary.checkpointCount).toBe(1);
    expect(summary.liveCameraConnectionContinuity).toBeDefined();
    expect(summary.liveCameraConnectionContinuity?.[0]?.source).toBe("camera-1");
    expect(summary.sensorIngestContinuity).toBeDefined();
    expect(summary.sensorIngestContinuity?.[0]?.source).toBe("sensor-1");
  });
});
