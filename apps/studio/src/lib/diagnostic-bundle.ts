import type { SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";
import type { ExternalLogEntry, RuntimeIncident } from "@/store/studio-store";
import type { AiActionTelemetryRecord } from "@/store/studio-store";
import type { WorkspaceAccessState } from "@/lib/workspace-access";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";
import { summarizeWorkspaceApprovalRouting } from "@/lib/workspace-membership-routing";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import { summarizeIncidentAlerts } from "@/lib/incident-alerts";
import { buildReportData } from "@/report";
import { buildReportEvidenceBundle, type ReportEvidenceBundle } from "@/lib/report-evidence-bundle";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { getSceneSourceMeta } from "@/lib/scene-source";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

export type DiagnosticBundle = {
  version: "1";
  generatedAt: string;
  app: {
    pathname?: string;
    userAgent?: string;
  };
  scene: {
    id: string;
    name: string;
    source: SecurityScene["source"];
    updatedAt: number;
    createdAt: number;
    sourceLabel: string;
    cameraCount: number;
    lightCount: number;
    obstructionCount: number;
    criticalZoneCount: number;
    snapshotCount: number;
    changeLogCount: number;
  };
  simulation: {
    totalCoveragePct: number | null;
    issueCount: number;
    failedZoneCount: number | null;
    lastRunMs: number | null;
  };
  graph: {
    nodeCount: number;
    edgeCount: number;
    revisionDepth: number;
    snapshotCount: number;
    sourceCounts: Record<string, number>;
  };
  evidence: {
    totalEvents: number;
    kindCounts: Record<string, number>;
    recentEvents: Array<Pick<OperationalEvidenceEvent, "id" | "kind" | "title" | "timestamp" | "branchLabel" | "lifecycleStage" | "confidence">>;
  };
  governance: {
    role: WorkspaceGovernanceState["activeRole"];
    approvalMode: WorkspaceGovernanceState["approvalMode"];
    sceneStatus: WorkspaceGovernanceState["sceneStatus"];
    reviewNotesCount: number;
    requestedAt: number | null;
    reviewedAt: number | null;
    publishedAt: number | null;
    approvalRoute: ReturnType<typeof summarizeWorkspaceApprovalRouting>;
  };
  access: {
    activeMemberId: string;
    activeMemberRole: string;
    mode: WorkspaceAccessState["policy"]["mode"];
    teamSize: number;
    reviewerRoles: string[];
  };
  runtime: {
    debugOverlays: boolean;
    overlayDensity: string;
    autoRecompute: boolean;
    cameraFailures: number;
    localOnlyMode: boolean;
    aiPolicyLabel: string;
    aiProviderLabel: string;
    simulationDirty: boolean;
    simulationRunning: boolean;
    launchNotice: string | null;
    sensorCount: number;
    journeyHealth: Array<{
      kind: "import" | "scan" | "ai" | "render" | "save" | "publish";
      label: string;
      status: "healthy" | "working" | "dirty" | "warning" | "idle" | "blocked";
      detail: string;
      lastEventTitle: string | null;
      lastEventKind: string | null;
      lastEventAt: number | null;
    }>;
    incidentCount: number;
    recentIncidents: Array<Pick<RuntimeIncident, "id" | "timestamp" | "category" | "severity" | "title" | "details" | "stack" | "durationMs" | "action" | "path">>;
    performanceTraces: Array<Pick<RuntimeIncident, "id" | "timestamp" | "title" | "details" | "durationMs" | "action" | "path">>;
    recentTrace: Array<Pick<OperationalEvidenceEvent, "id" | "kind" | "title" | "timestamp" | "branchLabel" | "lifecycleStage" | "confidence">>;
  };
};

export type SupportBundle = {
  version: "1";
  generatedAt: string;
  title: string;
  diagnostic: DiagnosticBundle;
  reportEvidence: ReportEvidenceBundle | null;
  sensorIngestArchive: {
    historyCount: number;
    latestSubmission: {
      source: string;
      receivedAt: string;
      sceneId: string | null;
      sceneName: string | null;
      summary: string;
      sourceCount: number;
      storedAt: number;
    } | null;
    recentSubmissions: Array<{
      source: string;
      receivedAt: string;
      sceneId: string | null;
      sceneName: string | null;
      summary: string;
      sourceCount: number;
      storedAt: number;
    }>;
  };
  cameraLiveConnectionArchive: {
    historyCount: number;
    latestSubmission: Pick<CameraLiveConnectionArchiveRecord, "source" | "action" | "protocol" | "receivedAt" | "sceneId" | "sceneName" | "summary" | "storedAt" | "endpointUrl" | "liveFeedUrl" | "feedLabel" | "record" | "sourceCount"> | null;
    recentSubmissions: Array<Pick<CameraLiveConnectionArchiveRecord, "source" | "action" | "protocol" | "receivedAt" | "sceneId" | "sceneName" | "summary" | "storedAt" | "endpointUrl" | "liveFeedUrl" | "feedLabel" | "record" | "sourceCount">>;
  };
  cameraLiveSessionRegistry: {
    activeSessionCount: number;
    latestSession: Pick<CameraLiveSessionRecord, "sessionId" | "status" | "cameraId" | "cameraName" | "sceneId" | "sceneName" | "liveFeedUrl" | "feedLabel" | "liveConnectionMode" | "liveConnectionStatus" | "liveSessionState" | "liveSessionStartedAt" | "liveSessionConfirmedAt" | "liveSessionExpiresAt" | "transportSessionId" | "transportSessionState" | "lastHeartbeatAt" | "probeCount" | "protocolProfile" | "lastObservedAt" | "sessionExpiresAt" | "lastAction" | "summary"> | null;
    activeSessions: Array<Pick<CameraLiveSessionRecord, "sessionId" | "status" | "cameraId" | "cameraName" | "sceneId" | "sceneName" | "liveFeedUrl" | "feedLabel" | "liveConnectionMode" | "liveConnectionStatus" | "liveSessionState" | "liveSessionStartedAt" | "liveSessionConfirmedAt" | "liveSessionExpiresAt" | "transportSessionId" | "transportSessionState" | "lastHeartbeatAt" | "probeCount" | "protocolProfile" | "lastObservedAt" | "sessionExpiresAt" | "lastAction" | "summary">>;
  };
  incidents: {
    title: string;
    summary: string;
    incidentCount: number;
    performanceTraceCount: number;
    stackTraceCount: number;
    externalLogCount: number;
    latestIncident: Pick<RuntimeIncident, "id" | "timestamp" | "category" | "severity" | "title" | "details" | "stack" | "durationMs" | "action" | "path"> | null;
    latestPerformanceTrace: Pick<RuntimeIncident, "id" | "timestamp" | "title" | "details" | "durationMs" | "action" | "path"> | null;
    latestExternalLog: Pick<ExternalLogEntry, "id" | "timestamp" | "source" | "title" | "details" | "lineCount" | "severity"> | null;
    aiTelemetry: ReturnType<typeof summarizeAiActionTelemetry>;
    journeyHealth: DiagnosticBundle["runtime"]["journeyHealth"];
    recentTrace: DiagnosticBundle["runtime"]["recentTrace"];
  };
  alerts: ReturnType<typeof summarizeIncidentAlerts>;
};

export type DiagnosticBundleInput = {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  sceneIntelligenceGraph: SceneIntelligenceGraph;
  operationalEvidenceEvents: OperationalEvidenceEvent[];
  workspaceGovernance: WorkspaceGovernanceState;
  workspaceAccess: WorkspaceAccessState;
  lastRunMs: number | null;
  showDebugOverlays: boolean;
  overlayDensity: string;
  autoRecompute: boolean;
  cameraFailures: string[];
  runtimeIncidents: RuntimeIncident[];
  localOnlyMode: boolean;
  aiProviderLabel: string;
  simulationDirty: boolean;
  simulationRunning: boolean;
  launchNotice: string | null;
  pathname?: string;
  userAgent?: string;
};

export type SupportBundleInput = DiagnosticBundleInput & {
  aiActionTelemetry: AiActionTelemetryRecord[];
  externalLogEntries: ExternalLogEntry[];
  sensorIngestHistory?: Array<{
    source: string;
    receivedAt: string;
    sceneId: string | null;
    sceneName: string | null;
    summary: string;
    sourceCount: number;
    storedAt: number;
  }>;
  cameraLiveConnectionHistory?: CameraLiveConnectionArchiveRecord[];
  cameraLiveSessionRegistry?: CameraLiveSessionRecord[];
};

function latestEvent(events: OperationalEvidenceEvent[], kinds: OperationalEvidenceEvent["kind"][]) {
  const kindSet = new Set(kinds);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && kindSet.has(event.kind)) {
      return event;
    }
  }
  return null;
}

function formatEventTime(timestamp: number | null) {
  return timestamp === null
    ? "Unknown"
    : new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

function summarizeJourneyStatus(
  events: OperationalEvidenceEvent[],
  runtimeIncidents: RuntimeIncident[],
  input: Pick<DiagnosticBundleInput, "simulationResult" | "simulationDirty" | "simulationRunning" | "launchNotice" | "cameraFailures" | "localOnlyMode" | "aiProviderLabel"> & {
    scene: SecurityScene;
    workspaceGovernance: WorkspaceGovernanceState;
  },
) {
  const importEvent = latestEvent(events, ["scene_imported", "scan_compiled", "scene_created"]);
  const scanStartedEvent = latestEvent(events, ["scan_session_started"]);
  const scanCompletedEvent = latestEvent(events, ["scan_session_compiled", "scan_compiled"]);
  const aiDraftEvent = latestEvent(events, ["draft_proposed", "draft_applied"]);
  const renderEvent = latestEvent(events, ["simulation_completed", "counterfactual_completed"]);
  const saveEvent = latestEvent(events, ["snapshot_saved"]);
  const publishEvent = latestEvent(events, ["scene_published"]);

  const journeys: DiagnosticBundle["runtime"]["journeyHealth"] = [
    {
      kind: "import",
      label: "Import",
      status: importEvent ? "healthy" : "idle",
      detail: importEvent
        ? `${importEvent.title} · ${formatEventTime(importEvent.timestamp)}`
        : "No import or load trace yet.",
      lastEventTitle: importEvent?.title ?? null,
      lastEventKind: importEvent?.kind ?? null,
      lastEventAt: importEvent?.timestamp ?? null,
    },
    {
      kind: "scan",
      label: "Scan",
      status: scanCompletedEvent ? "healthy" : scanStartedEvent ? "working" : "idle",
      detail: scanCompletedEvent
        ? `${scanCompletedEvent.title} · ${formatEventTime(scanCompletedEvent.timestamp)}`
        : scanStartedEvent
          ? `${scanStartedEvent.title} · awaiting compile`
          : "No scan session trace yet.",
      lastEventTitle: scanCompletedEvent?.title ?? scanStartedEvent?.title ?? null,
      lastEventKind: scanCompletedEvent?.kind ?? scanStartedEvent?.kind ?? null,
      lastEventAt: scanCompletedEvent?.timestamp ?? scanStartedEvent?.timestamp ?? null,
    },
    {
      kind: "ai",
      label: "AI",
      status: input.localOnlyMode ? "warning" : aiDraftEvent ? "healthy" : "idle",
      detail: input.localOnlyMode
        ? `Local-only mode is on · cloud-backed AI stays disabled.`
        : aiDraftEvent
          ? `${aiDraftEvent.title} · ${formatEventTime(aiDraftEvent.timestamp)}`
          : "No AI draft trace yet.",
      lastEventTitle: aiDraftEvent?.title ?? null,
      lastEventKind: aiDraftEvent?.kind ?? null,
      lastEventAt: aiDraftEvent?.timestamp ?? null,
    },
    {
      kind: "render",
      label: "Render",
      status: input.simulationRunning
        ? "working"
        : input.simulationDirty
          ? "dirty"
          : input.simulationResult
            ? "healthy"
            : "idle",
      detail: input.simulationRunning
        ? "Simulation is currently running."
        : input.simulationDirty
          ? "Scene has changed since the last simulation."
          : input.simulationResult
            ? `Last run updated ${formatEventTime(renderEvent?.timestamp ?? null)}.`
            : "No simulation result yet.",
      lastEventTitle: renderEvent?.title ?? null,
      lastEventKind: renderEvent?.kind ?? null,
      lastEventAt: renderEvent?.timestamp ?? null,
    },
    {
      kind: "save",
      label: "Save",
      status: saveEvent || input.scene.snapshots.length > 0 ? "healthy" : "idle",
      detail: saveEvent
        ? `${saveEvent.title} · ${formatEventTime(saveEvent.timestamp)}`
        : input.scene.snapshots.length > 0
          ? `${input.scene.snapshots.length} snapshot${input.scene.snapshots.length === 1 ? "" : "s"} available.`
          : "No save snapshot trace yet.",
      lastEventTitle: saveEvent?.title ?? null,
      lastEventKind: saveEvent?.kind ?? null,
      lastEventAt: saveEvent?.timestamp ?? null,
    },
    {
      kind: "publish",
      label: "Publish",
      status: input.workspaceGovernance.sceneStatus === "published" || publishEvent ? "healthy" : input.workspaceGovernance.approvalMode === "review_required" ? "warning" : "idle",
      detail: publishEvent
        ? `${publishEvent.title} · ${formatEventTime(publishEvent.timestamp)}`
        : input.workspaceGovernance.sceneStatus === "published"
          ? "Workspace scene is published."
          : input.workspaceGovernance.approvalMode === "review_required"
            ? "Publish requires review approval."
            : "No publish trace yet.",
      lastEventTitle: publishEvent?.title ?? null,
      lastEventKind: publishEvent?.kind ?? null,
      lastEventAt: publishEvent?.timestamp ?? null,
    },
  ];

  const recentTrace = events
    .slice(-8)
    .reverse()
    .map((event) => ({
      id: event.id,
      kind: event.kind,
      title: event.title,
      timestamp: event.timestamp,
      branchLabel: event.branchLabel,
      lifecycleStage: event.lifecycleStage,
      confidence: event.confidence,
    }));

  const recentIncidents = runtimeIncidents
    .slice(-8)
    .reverse()
    .map((incident) => ({
      id: incident.id,
      timestamp: incident.timestamp,
      category: incident.category,
      severity: incident.severity,
      title: incident.title,
      details: incident.details,
      stack: incident.stack ?? null,
      durationMs: incident.durationMs ?? null,
      action: incident.action ?? null,
      path: incident.path ?? null,
    }));

  const performanceTraces = runtimeIncidents
    .filter((incident) => incident.category === "performance_trace")
    .slice(-8)
    .reverse()
    .map((incident) => ({
      id: incident.id,
      timestamp: incident.timestamp,
      title: incident.title,
      details: incident.details,
      durationMs: incident.durationMs ?? null,
      action: incident.action ?? null,
      path: incident.path ?? null,
    }));

  return { journeys, recentTrace, recentIncidents, performanceTraces };
}

export function buildDiagnosticBundle(input: DiagnosticBundleInput): DiagnosticBundle {
  const kindCounts = input.operationalEvidenceEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.kind] = (acc[event.kind] ?? 0) + 1;
    return acc;
  }, {});
  const runtime = summarizeJourneyStatus(
    input.operationalEvidenceEvents,
    input.runtimeIncidents,
    {
      scene: input.scene,
      workspaceGovernance: input.workspaceGovernance,
      simulationResult: input.simulationResult,
      simulationDirty: input.simulationDirty,
      simulationRunning: input.simulationRunning,
      launchNotice: input.launchNotice,
      cameraFailures: input.cameraFailures,
      localOnlyMode: input.localOnlyMode,
      aiProviderLabel: input.aiProviderLabel,
    },
  );
  const approvalRoute = summarizeWorkspaceApprovalRouting(input.scene, input.workspaceAccess, input.workspaceGovernance, null);

  return {
    version: "1",
    generatedAt: new Date().toISOString(),
    app: {
      pathname: input.pathname,
      userAgent: input.userAgent,
    },
    scene: {
      id: input.scene.id,
      name: input.scene.name,
      source: input.scene.source,
      updatedAt: input.scene.updatedAt,
      createdAt: input.scene.createdAt,
      sourceLabel: getSceneSourceMeta(input.scene.source).label,
      cameraCount: input.scene.cameras.length,
      lightCount: input.scene.securityLights.length,
      obstructionCount: input.scene.obstructions.length,
      criticalZoneCount: input.scene.criticalZones.length,
      snapshotCount: input.scene.snapshots.length,
      changeLogCount: input.scene.changeLog.length,
    },
    simulation: {
      totalCoveragePct: input.simulationResult?.totalCoveragePct ?? null,
      issueCount: input.simulationResult?.issues.length ?? 0,
      failedZoneCount: input.simulationResult
        ? input.simulationResult.criticalZoneResults.filter((zone) => zone.status !== "pass").length
        : null,
      lastRunMs: input.lastRunMs,
    },
    graph: {
      nodeCount: input.sceneIntelligenceGraph.summary.nodeCount,
      edgeCount: input.sceneIntelligenceGraph.summary.edgeCount,
      revisionDepth: input.sceneIntelligenceGraph.summary.revisionDepth,
      snapshotCount: input.sceneIntelligenceGraph.summary.snapshotCount,
      sourceCounts: input.sceneIntelligenceGraph.summary.sourceCounts,
    },
    evidence: {
      totalEvents: input.operationalEvidenceEvents.length,
      kindCounts,
      recentEvents: input.operationalEvidenceEvents.slice(-6).reverse().map((event) => ({
        id: event.id,
        kind: event.kind,
        title: event.title,
        timestamp: event.timestamp,
        branchLabel: event.branchLabel,
        lifecycleStage: event.lifecycleStage,
        confidence: event.confidence,
      })),
    },
    governance: {
      role: input.workspaceGovernance.activeRole,
      approvalMode: input.workspaceGovernance.approvalMode,
      sceneStatus: input.workspaceGovernance.sceneStatus,
      reviewNotesCount: input.workspaceGovernance.reviewNotes.length,
      requestedAt: input.workspaceGovernance.requestedAt,
      reviewedAt: input.workspaceGovernance.reviewedAt,
      publishedAt: input.workspaceGovernance.publishedAt,
      approvalRoute,
    },
    access: {
      activeMemberId: input.workspaceAccess.activeMemberId,
      activeMemberRole: input.workspaceAccess.members.find((member) => member.id === input.workspaceAccess.activeMemberId)?.role ?? "operator",
      mode: input.workspaceAccess.policy.mode,
      teamSize: input.workspaceAccess.members.length,
      reviewerRoles: input.workspaceAccess.policy.requiredReviewerRoles,
    },
    runtime: {
      debugOverlays: input.showDebugOverlays,
      overlayDensity: input.overlayDensity,
      autoRecompute: input.autoRecompute,
      cameraFailures: input.cameraFailures.length,
      localOnlyMode: input.localOnlyMode,
      aiPolicyLabel: input.localOnlyMode ? "Local-only" : "Hybrid",
      aiProviderLabel: input.aiProviderLabel,
      simulationDirty: input.simulationDirty,
      simulationRunning: input.simulationRunning,
      launchNotice: input.launchNotice,
      sensorCount: input.scene.sensors.length,
      journeyHealth: runtime.journeys,
      incidentCount: input.runtimeIncidents.length,
      recentIncidents: runtime.recentIncidents,
      performanceTraces: runtime.performanceTraces,
      recentTrace: runtime.recentTrace,
    },
  };
}

export function stringifyDiagnosticBundle(bundle: DiagnosticBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function buildSupportBundle(input: SupportBundleInput): SupportBundle {
  const diagnostic = buildDiagnosticBundle(input);
  const report = input.simulationResult ? buildReportData(input.scene, input.simulationResult) : null;
  const reportEvidence = report
    ? buildReportEvidenceBundle({
        scene: input.scene,
        report,
        simulationResult: input.simulationResult,
        notes: ["Support bundle export includes the canonical report evidence artifact."],
      })
    : null;
  const aiTelemetry = summarizeAiActionTelemetry(input.aiActionTelemetry);
  const alerts = summarizeIncidentAlerts({
    runtimeIncidents: input.runtimeIncidents,
    externalLogEntries: input.externalLogEntries,
  });
  const latestIncident = [...diagnostic.runtime.recentIncidents].at(0) ?? null;
  const latestPerformanceTrace = [...diagnostic.runtime.performanceTraces].at(0) ?? null;
  const stackTraceCount = diagnostic.runtime.recentIncidents.filter((incident) => Boolean(incident.stack)).length;
  const normalizedExternalLogs = [...input.externalLogEntries].sort((left, right) => right.timestamp - left.timestamp);
  const latestExternalLog = normalizedExternalLogs.at(0) ?? null;
  const sensorIngestArchive = [...(input.sensorIngestHistory ?? [])].sort((left, right) => right.storedAt - left.storedAt);
  const cameraLiveConnectionArchive = [...(input.cameraLiveConnectionHistory ?? [])].sort((left, right) => right.storedAt - left.storedAt);
  const cameraLiveSessionRegistry = [...(input.cameraLiveSessionRegistry ?? [])].sort((left, right) => right.lastObservedAt - left.lastObservedAt);

  return {
    version: "1",
    generatedAt: diagnostic.generatedAt,
    title: `SentinelTwin Support Bundle · ${diagnostic.scene.name}`,
    diagnostic,
    reportEvidence,
    sensorIngestArchive: {
      historyCount: sensorIngestArchive.length,
      latestSubmission: sensorIngestArchive.at(0) ?? null,
      recentSubmissions: sensorIngestArchive.slice(0, 3),
    },
    cameraLiveConnectionArchive: {
      historyCount: cameraLiveConnectionArchive.length,
      latestSubmission: cameraLiveConnectionArchive.at(0) ?? null,
      recentSubmissions: cameraLiveConnectionArchive.slice(0, 3),
    },
    cameraLiveSessionRegistry: {
      activeSessionCount: cameraLiveSessionRegistry.length,
      latestSession: cameraLiveSessionRegistry.at(0) ?? null,
      activeSessions: cameraLiveSessionRegistry.slice(0, 3),
    },
    incidents: {
      title: "Incident snapshot",
      summary: `${diagnostic.runtime.incidentCount} incidents, ${diagnostic.runtime.performanceTraces.length} performance traces, ${stackTraceCount} stack traces, ${normalizedExternalLogs.length} external logs.`,
      incidentCount: diagnostic.runtime.incidentCount,
      performanceTraceCount: diagnostic.runtime.performanceTraces.length,
      stackTraceCount,
      externalLogCount: normalizedExternalLogs.length,
      latestIncident,
      latestPerformanceTrace,
      latestExternalLog,
      aiTelemetry,
      journeyHealth: diagnostic.runtime.journeyHealth,
      recentTrace: diagnostic.runtime.recentTrace,
    },
    alerts,
  };
}

export function stringifySupportBundle(bundle: SupportBundle) {
  return JSON.stringify(bundle, null, 2);
}
