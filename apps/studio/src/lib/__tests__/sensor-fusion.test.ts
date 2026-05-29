import { describe, expect, test } from "bun:test";

import { computeOperationalEvidenceFusionSummary, computeSensorFusionSummary } from "@/lib/sensor-fusion";
import type { CameraNode, SensorNode } from "@/schema/security-scene";

describe("computeSensorFusionSummary", () => {
  test("returns the nearest sensor and counts active sensors", () => {
    const sensors: SensorNode[] = [
      {
        id: "sensor_1",
        nodeType: "sensor",
        label: "Front Entry Motion",
        position: [1, 1.2, 1],
        sensorType: "motion",
        state: "active",
        coverageMode: "detection",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
      {
        id: "sensor_2",
        nodeType: "sensor",
        label: "Counter Contact",
        position: [8, 1.2, 2],
        sensorType: "door_contact",
        state: "faulted",
        coverageMode: "audit",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const summary = computeSensorFusionSummary([1.5, 1.2, 1.2], sensors);

    expect(summary.totalCount).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.nearestSensor?.label).toBe("Front Entry Motion");
    expect(summary.nearestDistanceM).toBeLessThan(1);
  });

  test("returns null nearest sensor when there are no sensors", () => {
    const summary = computeSensorFusionSummary([0, 0, 0], []);

    expect(summary.totalCount).toBe(0);
    expect(summary.activeCount).toBe(0);
    expect(summary.nearestSensor).toBeNull();
    expect(summary.nearestDistanceM).toBeNull();
  });

  test("summarizes camera metadata and live connection posture together", () => {
    const sensors: SensorNode[] = [
      {
        id: "sensor_1",
        nodeType: "sensor",
        label: "Front Entry Motion",
        position: [1, 1.2, 1],
        sensorType: "motion",
        state: "active",
        coverageMode: "detection",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];
    const camera: CameraNode = {
      id: "cam_1",
      nodeType: "camera",
      name: "Entrance Camera",
      position: [1.5, 2, 1.2],
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      mountType: "wall",
      mountHeightM: 2.8,
      fovHorizontalDeg: 90,
      fovVerticalDeg: 60,
      rangeM: 12,
      resolutionMP: 4,
      lensType: "fixed",
      status: "on",
      nightMode: "none",
      irRangeM: 0,
      thermalCapable: false,
      ptz: false,
      clarity: "good",
      source: "manual",
      tags: [],
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    };

    const summary = computeOperationalEvidenceFusionSummary(
      camera,
      sensors,
      [
        {
          cameraId: camera.id,
          cameraName: camera.name,
          status: "dirty",
          clarity: "poor",
          nightMode: "low_light",
          feedMode: "low_light",
          ingestMode: "external",
          timestamp: Date.now(),
          summary: "Camera metadata ingested from live feed.",
        },
      ],
      [
        {
          cameraId: camera.id,
          cameraName: camera.name,
          liveConnectionStatus: "connected",
          liveSessionState: "connected",
          liveSessionStartedAt: Date.now() - 1_000,
          liveSessionConfirmedAt: Date.now(),
          liveSessionExpiresAt: Date.now() + 60_000,
          transportSessionState: "active",
          transportSessionId: "transport_1",
          lastHeartbeatAt: Date.now(),
          protocolProfile: "rtsp_session",
          authMode: "onvif_digest",
          authState: "authenticated",
          authRealm: "camera.example.com",
          authSessionId: "auth_session_1",
          authSessionExpiresAt: Date.now() + 60_000,
          transportResponseStatus: 401,
          transportResponseStatusText: "Unauthorized",
          authChallengeHeader: "Digest realm=\"camera.example.com\", nonce=\"abc123\"",
          authChallengeScheme: "digest",
          authChallengeRealm: "camera.example.com",
          liveFeedUrl: "rtsp://example.com/live",
          liveFeedLabel: "Entrance relay",
          ingestMode: "external",
          timestamp: Date.now(),
          summary: "Live feed connected.",
        },
      ],
    );

    expect(summary.sensorFusion.totalCount).toBe(1);
    expect(summary.cameraMetadataEvent?.status).toBe("dirty");
    expect(summary.cameraLiveConnectionEvent?.liveConnectionStatus).toBe("connected");
    expect(summary.operationalHealth).toBe("attention");
    expect(summary.operationalHealthLabel).toBe("Attention");
    expect(summary.operationalHealthDetail).toContain("Metadata dirty");
    expect(summary.operationalHealthDetail).toContain("Auth authenticated/onvif_digest");
    expect(summary.operationalHealthDetail).toContain("Transport 401 Unauthorized");
    expect(summary.operationalHealthDetail).toContain("Challenge Digest realm=\"camera.example.com\", nonce=\"abc123\"");
  });
});
