import { beforeEach, describe, expect, test } from "bun:test";

import { createCameraNode, createObstructionNode, createSensorNode } from "@/lib/node-factory";
import { resolvePromptRegistryLineage } from "@/agents/prompt-registry";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createDefaultWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { useStudioStore } from "@/store/studio-store";

describe("studio store editor mutations", () => {
  beforeEach(() => {
    useStudioStore.getState().setScene(createBlankSecurityScene());
    useStudioStore.getState().clearSensorEvents();
    useStudioStore.getState().clearCameraMetadataEvents();
    useStudioStore.getState().clearCameraLiveConnectionEvents();
    useStudioStore.getState().clearOperationalEvidence();
    useStudioStore.getState().clearAiActionTelemetry();
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
      previousEventSubscriptionUri: cameraBeforeUpdate?.eventSubscriptionUri ?? null,
      previousEventSubscriptionReference: cameraBeforeUpdate?.eventSubscriptionReference ?? null,
      previousEventSubscriptionExpiresAt: cameraBeforeUpdate?.eventSubscriptionExpiresAt ?? null,
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
      eventSubscriptionUri: "http://camera.example.com/onvif/events",
      eventSubscriptionReference: "http://camera.example.com/onvif/events/subscription/test",
      eventSubscriptionExpiresAt: Date.now() + 240_000,
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
    expect(cameraLiveConnectionEvent?.eventSubscriptionUri).toBe("http://camera.example.com/onvif/events");
    expect(cameraLiveConnectionEvent?.eventSubscriptionReference).toBe("http://camera.example.com/onvif/events/subscription/test");
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.kind).toBe("camera_live_connection_updated");
    expect(operationalEvidenceEvent?.beforeSummary).toContain("disconnected");
    expect(operationalEvidenceEvent?.afterSummary).toContain("connected");
    expect(operationalEvidenceEvent?.afterSummary).toContain("auth authenticated via digest");
    expect(operationalEvidenceEvent?.afterSummary).toContain("events http://camera.example.com/onvif/events");
  });

  test("ONVIF camera live connection events use the protocol session mapper", () => {
    const camera = createCameraNode([3, 2.8, 4]);
    useStudioStore.getState().addNode(camera);
    const cameraBeforeUpdate = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id) ?? null;
    useStudioStore.getState().updateNode(camera.id, {
      liveFeedUrl: "rtsp://example.com/onvif",
      liveFeedLabel: "ONVIF relay",
      liveConnectionMode: "onvif",
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
      previousEventSubscriptionUri: cameraBeforeUpdate?.eventSubscriptionUri ?? null,
      previousEventSubscriptionReference: cameraBeforeUpdate?.eventSubscriptionReference ?? null,
      previousEventSubscriptionExpiresAt: cameraBeforeUpdate?.eventSubscriptionExpiresAt ?? null,
      liveSessionId: "session_" + camera.id,
      liveSessionState: "connected",
      liveSessionStartedAt: Date.now(),
      liveSessionConfirmedAt: Date.now(),
      liveSessionExpiresAt: Date.now() + 120_000,
      liveFeedUrl: "rtsp://example.com/onvif",
      liveFeedLabel: "ONVIF relay",
      liveConnectionMode: "onvif",
      liveConnectionStatus: "connected",
      transportSessionId: "transport_session_cam_front_test_onvif",
      transportSessionState: "active",
      transportResponseStatus: 200,
      transportResponseStatusText: "OK",
      lastHeartbeatAt: Date.now(),
      probeCount: 1,
      protocolProfile: "onvif_device",
      authMode: "onvif_digest",
      authState: "authenticated",
      authRealm: "front-entrance",
      authSessionId: "auth_session_cam_front_test_onvif",
      authSessionExpiresAt: Date.now() + 120_000,
      authChallengeHeader: "Digest realm=\"front-entrance\", nonce=\"abc123\"",
      authChallengeScheme: "digest",
      authChallengeRealm: "front-entrance",
      eventSubscriptionUri: "http://camera.example.com/onvif/events",
      eventSubscriptionReference: "http://camera.example.com/onvif/events/subscription/test",
      eventSubscriptionExpiresAt: Date.now() + 240_000,
      ingestMode: "external",
      summary: "Camera bound to the ONVIF relay.",
      notes: "ONVIF proxy connected successfully.",
    });

    expect(ok).toBe(true);
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.title).toBe("Camera Live Connection: connected");
    expect(operationalEvidenceEvent?.details).toContain("ONVIF session for camera");
    expect(operationalEvidenceEvent?.notes?.join(" · ")).toContain("Session:");
    expect(operationalEvidenceEvent?.notes?.join(" · ")).toContain("Event URI: http://camera.example.com/onvif/events");
    expect(operationalEvidenceEvent?.afterSummary).toContain("events http://camera.example.com/onvif/events");
    expect(operationalEvidenceEvent?.afterSummary).toContain("auth authenticated via onvif_digest");
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
      previousEventSubscriptionUri: cameraBeforeUpdate?.eventSubscriptionUri ?? null,
      previousEventSubscriptionReference: cameraBeforeUpdate?.eventSubscriptionReference ?? null,
      previousEventSubscriptionExpiresAt: cameraBeforeUpdate?.eventSubscriptionExpiresAt ?? null,
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
      eventSubscriptionUri: "http://camera.example.com/onvif/events",
      eventSubscriptionReference: "http://camera.example.com/onvif/events/subscription/challenge",
      eventSubscriptionExpiresAt: Date.now() + 240_000,
      ingestMode: "external",
      summary: "Camera probe returned a digest challenge.",
      notes: "Probe requires credentials.",
    });

    expect(ok).toBe(true);
    const cameraLiveConnectionEvent = useStudioStore.getState().cameraLiveConnectionEvents.find((event) => event.cameraId === camera.id);
    expect(cameraLiveConnectionEvent?.transportResponseStatus).toBe(401);
    expect(cameraLiveConnectionEvent?.authChallengeScheme).toBe("digest");
    expect(cameraLiveConnectionEvent?.authChallengeRealm).toBe("front-entrance");
    expect(cameraLiveConnectionEvent?.eventSubscriptionUri).toBe("http://camera.example.com/onvif/events");
    const operationalEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(operationalEvidenceEvent?.afterSummary).toContain("challenge");
    expect(operationalEvidenceEvent?.afterSummary).toContain("transport 401 Unauthorized");
    expect(operationalEvidenceEvent?.afterSummary).toContain("events http://camera.example.com/onvif/events");
  });

  test("operational evidence archive round-trips the workspace account profile", () => {
    useStudioStore.getState().setWorkspaceAccountProfile({
      ...createDefaultWorkspaceAccountProfile({
        primaryOrganization: "North Region Security",
        primaryOwner: "Pranay",
        capabilities: {
          sharedWorkspaces: true,
          publishedWorkspaces: true,
          archiveRecovery: true,
          reportExports: true,
          scanIntake: true,
          liveEvidence: true,
        },
        workspaceCount: 1,
      }),
      accountName: "North Region Security",
      ownerName: "Pranay",
      planTier: "enterprise",
    });

    const archive = useStudioStore.getState().exportOperationalEvidenceArchive();

    useStudioStore.getState().setWorkspaceAccountProfile({
      accountName: "Temp Account",
      ownerName: "Temp Owner",
      planTier: "free",
      quotas: { ...useStudioStore.getState().workspaceAccount.quotas, maxWorkspaces: 6 },
    });

    const result = useStudioStore.getState().importOperationalEvidenceArchive(archive);

    expect(result.success).toBe(true);
    expect(useStudioStore.getState().workspaceAccount.accountName).toBe("North Region Security");
    expect(useStudioStore.getState().workspaceAccount.ownerName).toBe("Pranay");
    expect(useStudioStore.getState().workspaceAccount.planTier).toBe("enterprise");
    const restoredEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(restoredEvidenceEvent?.archiveExportedAt).toBe(archive.exportedAt);
    expect(restoredEvidenceEvent?.archiveRestoreBranch).toBe("recovered");
  });

  test("operational evidence archive restore preserves explicit branch and export context", () => {
    const archive = useStudioStore.getState().exportOperationalEvidenceArchive();

    const result = useStudioStore.getState().importOperationalEvidenceArchive(archive, {
      archiveExportedAt: "2026-05-30T10:15:00.000Z",
      archiveRestoreBranch: "published",
    });

    expect(result.success).toBe(true);
    const restoredEvidenceEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(restoredEvidenceEvent?.archiveExportedAt).toBe("2026-05-30T10:15:00.000Z");
    expect(restoredEvidenceEvent?.archiveRestoreBranch).toBe("published");
  });

  test("ai telemetry records preserve prompt lineage", () => {
    const promptLineage = resolvePromptRegistryLineage("command_parse");
    useStudioStore.getState().recordAiActionTelemetry({
      stage: "command_parse",
      providerId: "openai",
      providerLabel: "OpenAI · gpt-4o",
      model: "gpt-4o",
      ...(promptLineage ?? {}),
      localOnlyMode: false,
      cloudAvailable: true,
      durationMs: 42,
      estimatedPromptTokens: 18,
      estimatedCompletionTokens: 10,
      estimatedTotalTokens: 28,
      tokenSource: "estimated",
      status: "success",
      note: "Prompt lineage should be visible in the execution ledger.",
    });

    const telemetry = useStudioStore.getState().aiActionTelemetry[0];
    expect(telemetry?.promptId).toBe("command_parse");
    expect(telemetry?.promptVersion).toBe("v1");
    expect(telemetry?.promptTitle).toBe("Command Parse");
    expect(telemetry?.promptOutputSchema).toBe("SceneOperation[]");
    expect(telemetry?.promptAgent).toBe("CommandAgent");
    expect(useStudioStore.getState().aiActionTelemetry).toHaveLength(1);
  });
});
