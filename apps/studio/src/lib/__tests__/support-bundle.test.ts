// @ts-nocheck
import { describe, expect, test } from "bun:test";

import { buildSupportBundle, stringifySupportBundle } from "@/lib/diagnostic-bundle";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { AiActionTelemetryRecord, ExternalLogEntry, RuntimeIncident } from "@/store/studio-store";
import type { SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

function createRuntimeIncident(category: RuntimeIncident["category"], severity: RuntimeIncident["severity"], title: string, details: string, stack?: string | null): RuntimeIncident {
  return {
    id: `${category}-${title}`,
    timestamp: 1710000000000,
    category,
    severity,
    title,
    details,
    stack: stack ?? null,
    durationMs: 25,
    source: "test",
    path: "/studio",
    action: "test",
  };
}

function createTelemetry(stage: AiActionTelemetryRecord["stage"], durationMs: number, tokens: number): AiActionTelemetryRecord {
  return {
    id: `${stage}-${durationMs}`,
    stage,
    providerId: "openai",
    providerLabel: "OpenAI · gpt-4o",
    model: "gpt-4o",
    localOnlyMode: false,
    cloudAvailable: true,
    timestamp: 1710000000000,
    durationMs,
    estimatedPromptTokens: Math.ceil(tokens / 2),
    estimatedCompletionTokens: Math.floor(tokens / 2),
    estimatedTotalTokens: tokens,
    tokenSource: "estimated",
    status: "success",
    note: null,
  };
}

function createExternalLog(source: ExternalLogEntry["source"], title: string, details: string): ExternalLogEntry {
  return {
    id: `${source}-${title}`,
    timestamp: 1710000002000,
    source,
    title,
    details,
    raw: `${title}\n${details}`,
    lineCount: 2,
    severity: "error",
  };
}

describe("buildSupportBundle", () => {
  test("packages incidents, traces, and telemetry into a support bundle", () => {
    const scene = createBlankSecurityScene() as SecurityScene;
    scene.name = "Support Scene";
    const simulationResult = {
      totalCoveragePct: 75,
      blindspotPct: 25,
      averageWalkableQuality: 1.5,
      worstAreaQuality: "observation",
      recognitionAreaPct: 50,
      identificationAreaPct: 25,
      coverageByQuality: { none: 25, detection: 10, observation: 25, recognition: 25, identification: 15 },
      issues: [],
      recommendations: [],
      criticalZoneResults: [],
      cameraResults: [],
      coverageCells: [],
      adversarialPath: null,
      computedAt: 1710000000100,
      cameraEvaluations: [],
    } as unknown as SimulationResult;
    const sceneIntelligenceGraph = {
      nodes: [],
      edges: [],
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        revisionDepth: 0,
        snapshotCount: 0,
        sourceCounts: {},
      },
      rootId: "root",
      updatedAt: 1710000000000,
    } as unknown as SceneIntelligenceGraph;
    const workspaceGovernance = {
      activeRole: "operator",
      approvalMode: "single_user",
      sceneStatus: "draft",
      reviewNotes: [],
      requestedAt: null,
      reviewedAt: null,
      publishedAt: null,
      requestedBy: null,
      reviewedBy: null,
      publishedBy: null,
    } as unknown as WorkspaceGovernanceState;
    const workspaceAccess = {
      activeMemberId: "member-1",
      members: [],
      policy: {
        mode: "single_user",
        requiredReviewerRoles: [],
        publishRequiresApproval: false,
        privacySensitiveRequiresReviewer: false,
      },
      branch: { current: "draft", draftHeadId: null, recoveredHeadId: null, publishedHeadId: null },
    } as unknown as WorkspaceAccessState;

    const bundle = buildSupportBundle({
      scene,
      simulationResult,
      sceneIntelligenceGraph,
      operationalEvidenceEvents: [
        buildOperationalEvidenceEvent({
          kind: "scene_published",
          title: "Scene published",
          details: "Promoted the current scene state to the published branch.",
          actor: "user",
          source: scene.source,
          sceneId: scene.id,
          sceneName: scene.name,
          revisionDepth: 0,
          affectedNodeIds: [],
          confidence: 0.98,
          branchLabel: "published",
          lifecycleStage: "published",
          published: true,
          beforeSummary: "Before publish",
          afterSummary: "After publish",
          sceneSnapshot: scene,
        }),
      ],
      workspaceGovernance,
      workspaceAccess,
      lastRunMs: 42,
      showDebugOverlays: true,
      overlayDensity: "compact",
      autoRecompute: false,
      cameraFailures: [],
      runtimeIncidents: [
        createRuntimeIncident("runtime_failure", "error", "Crash", "Boom", "stack-trace"),
        createRuntimeIncident("performance_trace", "info", "Render", "Slow render"),
      ],
      localOnlyMode: false,
      aiProviderLabel: "OpenAI · gpt-4o",
      aiActionTelemetry: [
        createTelemetry("ai_draft", 120, 700),
        createTelemetry("command_parse", 80, 200),
      ],
      externalLogEntries: [
        createExternalLog("paste", "Browser console error", "TypeError: boom"),
        createExternalLog("file", "Device log", "Captured from mobile device"),
      ],
      simulationDirty: false,
      simulationRunning: false,
      launchNotice: "Support bundle ready",
      pathname: "/",
      userAgent: "test-agent",
      sensorIngestHistory: [
        {
          source: "debug-panel",
          receivedAt: "2024-03-09T16:00:00.000Z",
          sceneId: "scene-1",
          sceneName: "Sensor Scene",
          summary: "Imported 1 sensor event from 1 record.",
          sourceCount: 1,
          storedAt: 1710000003000,
        },
      ],
      cameraLiveConnectionHistory: [
        {
          ok: true,
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          receivedAt: "2024-03-09T16:05:00.000Z",
          sceneId: "scene-1",
          sceneName: "Support Scene",
          endpointUrl: "http://camera.example.com/probe",
          liveFeedUrl: "rtsp://camera.example.com/live",
          feedLabel: "Front entrance",
          summary: "Probed Front Entrance via ONVIF and archived the live connection.",
          record: {
            cameraId: "cam_front",
            cameraName: "Front Entrance",
            liveSessionId: "live_session_cam_front_test",
            liveSessionState: "connected",
            liveSessionStartedAt: 1710000003500,
            liveSessionConfirmedAt: 1710000003800,
            liveSessionExpiresAt: 1710000123800,
            transportSessionId: "transport_session_cam_front_test",
            transportSessionState: "active",
            lastHeartbeatAt: 1710000003900,
            probeCount: 2,
            protocolProfile: "onvif_device",
            authMode: "onvif_digest",
            authState: "authenticated",
            authRealm: "camera.example.com",
            onvifUsername: "operator",
            onvifPassword: "secret",
            authSessionId: "auth_session_cam_front_test",
            authSessionExpiresAt: 1710000123800,
            transportResponseStatus: 401,
            transportResponseStatusText: "Unauthorized",
            authChallengeHeader: 'Digest realm="camera.example.com", nonce="abc123"',
            authChallengeScheme: "digest",
            authChallengeRealm: "camera.example.com",
            liveFeedUrl: "rtsp://camera.example.com/live",
            liveFeedLabel: "Front entrance",
            liveConnectionMode: "onvif",
            liveConnectionStatus: "connected",
            notes: "Connection healthy",
            timestamp: 1710000004000,
          },
          errors: [],
          sourceCount: 1,
          submittedAt: 1710000004000,
          storedAt: 1710000005000,
          raw: "<ProbeResponse />",
        },
      ],
      cameraLiveSessionRegistry: [
        {
          sessionId: "live_session_cam_front_test",
          status: "active",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-1",
          sceneName: "Support Scene",
          liveFeedUrl: "rtsp://camera.example.com/live",
          feedLabel: "Front entrance",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          liveSessionState: "connected",
          liveSessionStartedAt: 1710000003500,
          liveSessionConfirmedAt: 1710000003800,
          liveSessionExpiresAt: 1710000123800,
          transportSessionId: "transport_onvif_front",
          transportSessionState: "active",
          lastHeartbeatAt: 1710000004800,
          probeCount: 2,
          protocolProfile: "onvif_device",
          authMode: "onvif_digest",
          authState: "authenticated",
          authRealm: "camera.example.com",
          authSessionId: "auth_session_cam_front_test",
          authSessionExpiresAt: 1710000123800,
          transportResponseStatus: 401,
          transportResponseStatusText: "Unauthorized",
          authChallengeHeader: 'Digest realm="camera.example.com", nonce="abc123"',
          authChallengeScheme: "digest",
          authChallengeRealm: "camera.example.com",
          lastObservedAt: 1710000005000,
          sessionExpiresAt: 1710000125000,
          lastAction: "bind",
          summary: "Probed Front Entrance via ONVIF and archived the live connection.",
        },
      ],
    });

    expect(bundle.title).toContain("Support Bundle");
    expect(bundle.diagnostic.scene.name).toBe("Support Scene");
    expect(bundle.diagnostic.governance.approvalRoute.routeStatus).toBe("open_publish");
    expect(bundle.reportEvidence?.mode).toBe("single");
    expect(bundle.reportEvidence?.scene.name).toBe("Support Scene");
    expect(bundle.reportEvidence?.report.temporalTwin?.publishedCheckpointCount).toBe(1);
    expect(bundle.sensorIngestArchive.historyCount).toBe(1);
    expect(bundle.sensorIngestArchive.latestSubmission?.sceneName).toBe("Sensor Scene");
    expect(bundle.cameraLiveConnectionArchive.historyCount).toBe(1);
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.sceneName).toBe("Support Scene");
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.authMode).toBe("onvif_digest");
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.authState).toBe("authenticated");
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.authSessionId).toBe("auth_session_cam_front_test");
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.authSessionExpiresAt).toBe(1710000123800);
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.transportResponseStatus).toBe(401);
    expect(bundle.cameraLiveConnectionArchive.latestSubmission?.record.authChallengeScheme).toBe("digest");
    expect(bundle.cameraLiveSessionRegistry.activeSessionCount).toBe(1);
    expect(bundle.cameraLiveSessionRegistry.latestSession?.sessionId).toBe("live_session_cam_front_test");
    expect(bundle.cameraLiveSessionRegistry.latestSession?.authMode).toBe("onvif_digest");
    expect(bundle.cameraLiveSessionRegistry.latestSession?.authState).toBe("authenticated");
    expect(bundle.cameraLiveSessionRegistry.latestSession?.authSessionId).toBe("auth_session_cam_front_test");
    expect(bundle.cameraLiveSessionRegistry.latestSession?.authSessionExpiresAt).toBe(1710000123800);
    expect(bundle.incidents.incidentCount).toBe(2);
    expect(bundle.incidents.performanceTraceCount).toBe(1);
    expect(bundle.incidents.stackTraceCount).toBe(1);
    expect(bundle.incidents.latestIncident?.title).toBe("Render");
    expect(bundle.incidents.externalLogCount).toBe(2);
    expect(bundle.incidents.latestExternalLog?.title).toBe("Browser console error");
    expect(bundle.diagnostic.runtime.alerts.alertCount).toBe(4);
    expect(bundle.diagnostic.runtime.alerts.statusLabel).toBe("attention");
    expect(bundle.incidents.aiTelemetry.totalEvents).toBe(2);
    expect(bundle.incidents.aiTelemetry.trendLabel).toBe("insufficient-data");
    expect(bundle.incidents.summary).toContain("incidents");
    expect(bundle.incidents.summary).toContain("external logs");
    expect(bundle.alerts.alertCount).toBe(4);
    expect(bundle.alerts.statusLabel).toBe("attention");
    expect(bundle.alerts.latestAlert?.title).toBe("Browser console error");
    expect(bundle.alerts.recommendation).toContain("attach external logs");
    expect(stringifySupportBundle(bundle)).toContain("\"reportEvidence\"");
    expect(stringifySupportBundle(bundle)).toContain("\"sensorIngestArchive\"");
    expect(stringifySupportBundle(bundle)).toContain("\"cameraLiveConnectionArchive\"");
    expect(stringifySupportBundle(bundle)).toContain("\"cameraLiveSessionRegistry\"");
    expect(stringifySupportBundle(bundle)).toContain("\"approvalRoute\"");
  });
});
