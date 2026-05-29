import { describe, expect, test } from "bun:test";

import { buildSupportBundle } from "@/lib/diagnostic-bundle";
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
      operationalEvidenceEvents: [],
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
    });

    expect(bundle.title).toContain("Support Bundle");
    expect(bundle.diagnostic.scene.name).toBe("Support Scene");
    expect(bundle.incidents.incidentCount).toBe(2);
    expect(bundle.incidents.performanceTraceCount).toBe(1);
    expect(bundle.incidents.stackTraceCount).toBe(1);
    expect(bundle.incidents.latestIncident?.title).toBe("Render");
    expect(bundle.incidents.externalLogCount).toBe(2);
    expect(bundle.incidents.latestExternalLog?.title).toBe("Browser console error");
    expect(bundle.incidents.aiTelemetry.totalEvents).toBe(2);
    expect(bundle.incidents.aiTelemetry.trendLabel).toBe("insufficient-data");
    expect(bundle.incidents.summary).toContain("incidents");
    expect(bundle.incidents.summary).toContain("external logs");
    expect(bundle.alerts.alertCount).toBe(4);
    expect(bundle.alerts.statusLabel).toBe("attention");
    expect(bundle.alerts.latestAlert?.title).toBe("Browser console error");
    expect(bundle.alerts.recommendation).toContain("attach external logs");
  });
});
