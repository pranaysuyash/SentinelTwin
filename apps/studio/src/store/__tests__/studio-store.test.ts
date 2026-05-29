import { beforeEach, describe, expect, test } from "bun:test";

import { createCameraNode, createObstructionNode, createSensorNode } from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { useStudioStore } from "@/store/studio-store";

describe("studio store editor mutations", () => {
  beforeEach(() => {
    useStudioStore.getState().setScene(createBlankSecurityScene());
    useStudioStore.getState().clearSensorEvents();
    useStudioStore.getState().clearCameraMetadataEvents();
    useStudioStore.getState().clearCameraLiveConnectionEvents();
    useStudioStore.getState().clearOperationalEvidence();
  });

  test("delete selection is undoable and redoable through the canonical store actions", () => {
    const camera = createCameraNode([2, 2.8, 3]);
    useStudioStore.getState().addNode(camera);
    useStudioStore.getState().selectNode(camera.id);

    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(true);

    useStudioStore.getState().removeSelectedNodes();

    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(false);
    expect(useStudioStore.getState().canUndo()).toBe(true);

    useStudioStore.getState().undo();
    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(true);
    expect(useStudioStore.getState().canRedo()).toBe(true);

    useStudioStore.getState().redo();
    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(false);
  });

  test("translates a multi-selection as a single nudge unit", () => {
    const camera = createCameraNode([2, 2.8, 3]);
    const obstruction = createObstructionNode([4, 1, 5], "shelf");
    useStudioStore.getState().addNode(camera);
    useStudioStore.getState().addNode(obstruction);
    useStudioStore.getState().setSelectedNodes([camera.id, obstruction.id]);

    const initialCamera = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id);
    const initialObstruction = useStudioStore.getState().scene.obstructions.find((entry) => entry.id === obstruction.id);

    useStudioStore.getState().translateSelectedNodes([0.5, -0.25]);

    const nextCamera = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id);
    const nextObstruction = useStudioStore.getState().scene.obstructions.find((entry) => entry.id === obstruction.id);
    expect(initialCamera).toBeDefined();
    expect(initialObstruction).toBeDefined();
    expect(nextCamera?.position).toEqual([
      (initialCamera?.position[0] ?? 0) + 0.5,
      initialCamera?.position[1] ?? 0,
      (initialCamera?.position[2] ?? 0) - 0.25,
    ]);
    expect(nextObstruction?.position).toEqual([
      (initialObstruction?.position[0] ?? 0) + 0.5,
      initialObstruction?.position[1] ?? 0,
      (initialObstruction?.position[2] ?? 0) - 0.25,
    ]);
    expect(useStudioStore.getState().selectedNodeIds).toEqual([camera.id, obstruction.id]);
    expect(useStudioStore.getState().simulationDirty).toBe(true);
  });

  test("sensor live events update the scene state and append operational evidence", () => {
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    useStudioStore.getState().addNode(sensor);

    const ok = useStudioStore.getState().recordSensorEvent({
      sensorId: sensor.id,
      sensorLabel: sensor.label,
      sensorType: sensor.sensorType,
      kind: "faulted",
      details: "Sensor reported a fault.",
      resultingState: "faulted",
    });

    expect(ok).toBe(true);
    expect(useStudioStore.getState().scene.sensors.find((entry) => entry.id === sensor.id)?.state).toBe("faulted");
    expect(useStudioStore.getState().sensorEvents.find((event) => event.sensorId === sensor.id)?.kind).toBe("faulted");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("sensor_faulted");
  });

  test("camera metadata events update the canonical evidence trail", () => {
    const camera = createCameraNode([2, 2.8, 3]);
    useStudioStore.getState().addNode(camera);
    useStudioStore.getState().updateNode(camera.id, {
      status: "dirty",
      clarity: "good",
      nightMode: "none",
    });

    const ok = useStudioStore.getState().recordCameraMetadataEvent({
      cameraId: camera.id,
      cameraName: camera.name,
      status: "dirty",
      clarity: "poor",
      nightMode: "low_light",
      feedMode: "low_light",
      ingestMode: "external",
      feedUrl: "https://example.com/camera-feed",
      feedLabel: "ONVIF relay",
      summary: "Camera metadata ingested from live feed.",
      notes: "Thermal drift reported.",
      previousStatus: "dirty",
      previousClarity: "good",
      previousNightMode: "none",
      previousFeedMode: "normal",
      previousNotes: "Baseline metadata.",
    });

    expect(ok).toBe(true);
    const cameraMetadataEvent = useStudioStore.getState().cameraMetadataEvents.find((event) => event.cameraId === camera.id);
    expect(cameraMetadataEvent?.ingestMode).toBe("external");
    expect(cameraMetadataEvent?.previousStatus).toBe("dirty");
    expect(cameraMetadataEvent?.previousClarity).toBe("good");
    expect(cameraMetadataEvent?.previousNightMode).toBe("none");
    expect(cameraMetadataEvent?.summary).toContain("live feed");
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.kind).toBe("camera_metadata_updated");
    expect(operationalEvidenceEvent?.beforeSummary).toContain("status dirty");
    expect(operationalEvidenceEvent?.afterSummary).toContain("status dirty");
    expect(
      useStudioStore.getState().sceneIntelligenceGraph.nodes.find((node) => node.id === `camera:${camera.id}`)?.historyCount,
    ).toBe(1);
  });

  test("camera live connection events update the canonical evidence trail", () => {
    const camera = createCameraNode([3, 2.8, 4]);
    useStudioStore.getState().addNode(camera);
    const cameraBeforeUpdate = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id) ?? null;
    useStudioStore.getState().updateNode(camera.id, {
      liveFeedUrl: "rtsp://example.com/live",
      liveFeedLabel: "Front entrance live feed",
      liveConnectionMode: "rtsp",
      liveConnectionStatus: "connected",
      liveConnectionUpdatedAt: Date.now(),
    });

    const ok = useStudioStore.getState().recordCameraLiveConnectionEvent({
      cameraId: camera.id,
      cameraName: camera.name,
      previousLiveSessionId: null,
      previousLiveSessionState: null,
      previousLiveSessionStartedAt: null,
      previousLiveSessionConfirmedAt: null,
      previousLiveSessionExpiresAt: cameraBeforeUpdate?.liveSessionExpiresAt ?? null,
      previousLiveFeedUrl: cameraBeforeUpdate?.liveFeedUrl ?? null,
      previousLiveFeedLabel: cameraBeforeUpdate?.liveFeedLabel ?? null,
      previousLiveConnectionMode: cameraBeforeUpdate?.liveConnectionMode ?? null,
      previousLiveConnectionStatus: cameraBeforeUpdate?.liveConnectionStatus ?? "disconnected",
      previousAuthMode: cameraBeforeUpdate?.authMode ?? null,
      previousAuthState: cameraBeforeUpdate?.authState ?? null,
      previousAuthRealm: cameraBeforeUpdate?.authRealm ?? null,
      previousAuthSessionId: cameraBeforeUpdate?.authSessionId ?? null,
      previousAuthSessionExpiresAt: cameraBeforeUpdate?.authSessionExpiresAt ?? null,
      previousTransportResponseStatus: cameraBeforeUpdate?.transportResponseStatus ?? null,
      previousTransportResponseStatusText: cameraBeforeUpdate?.transportResponseStatusText ?? null,
      previousAuthChallengeHeader: cameraBeforeUpdate?.authChallengeHeader ?? null,
      previousAuthChallengeScheme: cameraBeforeUpdate?.authChallengeScheme ?? null,
      previousAuthChallengeRealm: cameraBeforeUpdate?.authChallengeRealm ?? null,
      liveSessionId: "session_" + camera.id,
      liveSessionState: "connected",
      liveSessionStartedAt: Date.now(),
      liveSessionConfirmedAt: Date.now(),
      liveSessionExpiresAt: Date.now() + 120_000,
      liveFeedUrl: "rtsp://example.com/live",
      liveFeedLabel: "Front entrance live feed",
      liveConnectionMode: "rtsp",
      liveConnectionStatus: "connected",
      transportSessionId: "transport_session_cam_front_test",
      transportSessionState: "active",
      transportResponseStatus: 401,
      transportResponseStatusText: "Unauthorized",
      lastHeartbeatAt: Date.now(),
      probeCount: 1,
      protocolProfile: "rtsp_session",
      authMode: "digest",
      authState: "authenticated",
      authRealm: "front-entrance",
      authSessionId: "auth_session_cam_front_test",
      authSessionExpiresAt: Date.now() + 120_000,
      authChallengeHeader: "Digest realm=\"front-entrance\", nonce=\"abc123\"",
      authChallengeScheme: "digest",
      authChallengeRealm: "front-entrance",
      ingestMode: "external",
      summary: "Camera bound to the external live feed relay.",
      notes: "ONVIF proxy connected successfully.",
    });

    expect(ok).toBe(true);
    expect(useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id)?.liveConnectionStatus).toBe("connected");
    expect(useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id)?.liveFeedUrl).toBe("rtsp://example.com/live");
    const cameraLiveConnectionEvent = useStudioStore.getState().cameraLiveConnectionEvents.find((event) => event.cameraId === camera.id);
    expect(cameraLiveConnectionEvent?.liveConnectionStatus).toBe("connected");
    expect(cameraLiveConnectionEvent?.liveFeedUrl).toContain("rtsp://");
    expect(cameraLiveConnectionEvent?.transportSessionState).toBe("active");
    expect(cameraLiveConnectionEvent?.protocolProfile).toBe("rtsp_session");
    expect(cameraLiveConnectionEvent?.authState).toBe("authenticated");
    expect(cameraLiveConnectionEvent?.authMode).toBe("digest");
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.kind).toBe("camera_live_connection_updated");
    expect(operationalEvidenceEvent?.beforeSummary).toContain("disconnected");
    expect(operationalEvidenceEvent?.afterSummary).toContain("connected");
    expect(operationalEvidenceEvent?.afterSummary).toContain("auth authenticated via digest");
  });

  test("camera live connection challenges persist transport response metadata", () => {
    const camera = createCameraNode([3, 2.8, 4]);
    useStudioStore.getState().addNode(camera);
    const cameraBeforeUpdate = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id) ?? null;
    useStudioStore.getState().updateNode(camera.id, {
      liveFeedUrl: "http://example.com/probe",
      liveFeedLabel: "Challenge relay",
      liveConnectionMode: "onvif",
      liveConnectionStatus: "connecting",
      liveConnectionUpdatedAt: Date.now(),
      liveSessionState: "probing",
      transportSessionState: "negotiating",
      authState: "authenticating",
      transportResponseStatus: 401,
      transportResponseStatusText: "Unauthorized",
      authChallengeHeader: "Digest realm=\"front-entrance\", nonce=\"abc123\"",
      authChallengeScheme: "digest",
      authChallengeRealm: "front-entrance",
    });

    const ok = useStudioStore.getState().recordCameraLiveConnectionEvent({
      cameraId: camera.id,
      cameraName: camera.name,
      previousLiveSessionId: null,
      previousLiveSessionState: null,
      previousLiveSessionStartedAt: null,
      previousLiveSessionConfirmedAt: null,
      previousLiveSessionExpiresAt: cameraBeforeUpdate?.liveSessionExpiresAt ?? null,
      previousLiveFeedUrl: cameraBeforeUpdate?.liveFeedUrl ?? null,
      previousLiveFeedLabel: cameraBeforeUpdate?.liveFeedLabel ?? null,
      previousLiveConnectionMode: cameraBeforeUpdate?.liveConnectionMode ?? null,
      previousLiveConnectionStatus: cameraBeforeUpdate?.liveConnectionStatus ?? "disconnected",
      previousAuthMode: cameraBeforeUpdate?.authMode ?? null,
      previousAuthState: cameraBeforeUpdate?.authState ?? null,
      previousAuthRealm: cameraBeforeUpdate?.authRealm ?? null,
      previousAuthSessionId: cameraBeforeUpdate?.authSessionId ?? null,
      previousAuthSessionExpiresAt: cameraBeforeUpdate?.authSessionExpiresAt ?? null,
      previousTransportResponseStatus: cameraBeforeUpdate?.transportResponseStatus ?? null,
      previousTransportResponseStatusText: cameraBeforeUpdate?.transportResponseStatusText ?? null,
      previousAuthChallengeHeader: cameraBeforeUpdate?.authChallengeHeader ?? null,
      previousAuthChallengeScheme: cameraBeforeUpdate?.authChallengeScheme ?? null,
      previousAuthChallengeRealm: cameraBeforeUpdate?.authChallengeRealm ?? null,
      liveSessionId: "session_" + camera.id,
      liveSessionState: "probing",
      liveSessionStartedAt: Date.now(),
      liveSessionConfirmedAt: null,
      liveSessionExpiresAt: null,
      liveFeedUrl: "http://example.com/probe",
      liveFeedLabel: "Challenge relay",
      liveConnectionMode: "onvif",
      liveConnectionStatus: "connecting",
      transportSessionId: "transport_session_cam_front_test",
      transportSessionState: "negotiating",
      transportResponseStatus: 401,
      transportResponseStatusText: "Unauthorized",
      lastHeartbeatAt: null,
      probeCount: 1,
      protocolProfile: "onvif_device",
      authMode: "onvif_digest",
      authState: "authenticating",
      authRealm: "front-entrance",
      authSessionId: null,
      authSessionExpiresAt: null,
      authChallengeHeader: "Digest realm=\"front-entrance\", nonce=\"abc123\"",
      authChallengeScheme: "digest",
      authChallengeRealm: "front-entrance",
      ingestMode: "external",
      summary: "Camera probe returned a digest challenge.",
      notes: "Probe requires credentials.",
    });

    expect(ok).toBe(true);
    const cameraLiveConnectionEvent = useStudioStore.getState().cameraLiveConnectionEvents.find((event) => event.cameraId === camera.id);
    expect(cameraLiveConnectionEvent?.transportResponseStatus).toBe(401);
    expect(cameraLiveConnectionEvent?.authChallengeScheme).toBe("digest");
    expect(cameraLiveConnectionEvent?.authChallengeRealm).toBe("front-entrance");
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.afterSummary).toContain("challenge");
    expect(operationalEvidenceEvent?.afterSummary).toContain("transport 401 Unauthorized");
  });
});
