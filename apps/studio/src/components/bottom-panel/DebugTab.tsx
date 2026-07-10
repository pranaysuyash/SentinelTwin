"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BadgeInfo, Layers3, RefreshCw, ShieldAlert, Sparkles, TimerReset, TriangleAlert, Upload, Video, Waves } from "lucide-react";

import { AgentCoordinatorPanel } from "@/components/agents/AgentCoordinatorPanel";
import { ProviderConfigPanel } from "@/components/agents/ProviderConfigPanel";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { Badge } from "@/components/shared/Badge";
import { buildDiagnosticBundle, buildIncidentBundle, buildRuntimeTruthBundle, buildSupportBundle, stringifyDiagnosticBundle, stringifyIncidentBundle, stringifyRuntimeTruthBundle, stringifySupportBundle } from "@/lib/diagnostic-bundle";
import { buildArchiveHandoffLink, type ArchiveHandoffRequest } from "@/lib/archive-handoff-link";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";
import {
  normalizeOperationalEvidenceArchive,
  stringifyOperationalEvidenceArchive,
  type OperationalEvidenceArchive,
} from "@/lib/operational-evidence-archive";
import {
  normalizeOperationalEvidenceJournal,
  type OperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";
import { getTrustQualityLabel } from "@/lib/quality-display";
import {
  assessOperationalEvidenceMergeReadiness,
  compareOperationalEvidenceBranches,
} from "@/lib/operational-evidence";
import { writeClipboardText } from "@/lib/share-link";
import {
  describeAiProviderGovernance,
  describeAiProviderHealth,
  describeAiProviderSelection,
  describeAiProviderTelemetry,
} from "@/agents/provider-selection";
import type { AiProviderSelection } from "@/agents/provider-selection";
import {
  compareModelEvalRuns,
  getCloudRequiredFixtureCount,
  summarizeModelEvalRun,
  type ModelEvalSuiteResult,
} from "@/agents/model-eval";
import { PROMPT_REGISTRY, summarizePromptRegistry } from "@/agents/prompt-registry";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import { parseSensorLiveFeed } from "@/lib/sensor-live-ingest";
import type { SupportDeliveryArchiveRecord } from "@/lib/support-delivery";
import type { SupportIngestResponse } from "@/lib/support-ingest";
import type { SupportIngestHistoryRecord } from "@/lib/support-ingest-history";
import type { TrustAuditReport } from "@/lib/truth-audit";
import { OPERATIONAL_EVIDENCE_STORAGE_KEY, useStudioStore } from "@/store/studio-store";
import { DEBUG_TOGGLE_LABELS } from "@/store/slices/core/debug-toggles-slice";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

type TrustAuditPayload = TrustAuditReport & {
  formatted: string;
};

const OVERLAY_DENSITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
] as const;

function formatReasonCode(reasonCode: string): string {
  if (reasonCode.startsWith("REFLECTIVE_WINDOW:")) {
    const [, label] = reasonCode.split(":");
    return `Reflective window: ${label ?? "unknown"}`;
  }
  return reasonCode.toLowerCase().replaceAll("_", " ");
}

function formatMultiplier(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function parseTelemetryPolicyInteger(value: string, fallback: number, minimum = 1): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function parseTelemetryPolicyFloat(value: string, fallback: number, minimum = 0, maximum = 1): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className={`mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[9px] transition-colors ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : `${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} ${UI_SURFACES.textMuted5} ${UI_SURFACES.hoverBorderDark} hover:text-white`
      }`}
    >
      {children}
    </button>
  );
}

export function DebugTab() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const lastRunMs = useStudioStore((s) => s.lastRunMs);
  const showDebugOverlays = useStudioStore((s) => s.showDebugOverlays);
  const setShowDebugOverlays = useStudioStore((s) => s.setShowDebugOverlays);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const setOverlayDensity = useStudioStore((s) => s.setOverlayDensity);
  const autoRecompute = useStudioStore((s) => s.autoRecompute);
  const toggleAutoRecompute = useStudioStore((s) => s.toggleAutoRecompute);
  const debugToggles = useStudioStore((s) => ({
    showCoverageGrid: s.showCoverageGrid,
    showRaycasts: s.showRaycasts,
    showOcclusionHits: s.showOcclusionHits,
    showFrustumBounds: s.showFrustumBounds,
    showPathSamplePoints: s.showPathSamplePoints,
    showRecomputeTime: s.showRecomputeTime,
    showVisionColliders: s.showVisionColliders,
    showPhysicsColliders: s.showPhysicsColliders,
    showRawPpmValues: s.showRawPpmValues,
    showBvhRebuildTime: s.showBvhRebuildTime,
  }));
  const setDebugToggle = useStudioStore((s) => s.setDebugToggle);
  const resetDebugToggles = useStudioStore((s) => s.resetDebugToggles);
  const cameraFailures = useStudioStore((s) => s.cameraFailures);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);
  const aiTelemetryPolicy = useStudioStore((s) => s.aiTelemetryPolicy);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const setAiProviderSelection = useStudioStore((s) => s.setAiProviderSelection);
  const setAiTelemetryPolicy = useStudioStore((s) => s.setAiTelemetryPolicy);
  const resetAiTelemetryPolicy = useStudioStore((s) => s.resetAiTelemetryPolicy);
  const launchNotice = useStudioStore((s) => s.launchNotice);
  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const heatmapHover = useStudioStore((s) => s.heatmapHover);
  const clearAllCameraFailures = useStudioStore((s) => s.clearAllCameraFailures);
  const clearRuntimeIncidents = useStudioStore((s) => s.clearRuntimeIncidents);
  const sceneIntelligenceGraph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const assumptions = useStudioStore((s) => s.scene.assumptions);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const layers = useStudioStore((s) => s.layerVisibility);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const archiveHandoffRequest = useStudioStore((s) => s.archiveHandoffRequest);
  const runtimeIncidents = useStudioStore((s) => s.runtimeIncidents);
  const externalLogEntries = useStudioStore((s) => s.externalLogEntries);
  const supportIngestHistory = useStudioStore((s) => s.supportIngestHistory);
  const workspaceAccess = useStudioStore((s) => s.workspaceAccess);
  const workspaceGovernance = useStudioStore((s) => s.workspaceGovernance);
  const publishCurrentScene = useStudioStore((s) => s.publishCurrentScene);
  const restoreSceneFromEvidence = useStudioStore((s) => s.restoreSceneFromEvidence);
  const exportOperationalEvidenceArchive = useStudioStore((s) => s.exportOperationalEvidenceArchive);
  const importOperationalEvidenceArchive = useStudioStore((s) => s.importOperationalEvidenceArchive);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const setArchiveHandoffRequest = useStudioStore((s) => s.setArchiveHandoffRequest);
  const recordSupportIngestResponse = useStudioStore((s) => s.recordSupportIngestResponse);
  const clearSupportIngestHistory = useStudioStore((s) => s.clearSupportIngestHistory);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingArchive, setPendingArchive] = useState<OperationalEvidenceArchive | null>(null);
  const [pendingArchiveError, setPendingArchiveError] = useState<string | null>(null);
  const [archiveRestoreBranch, setArchiveRestoreBranch] = useState<"draft" | "recovered" | "published">("recovered");
  const [externalLogDraft, setExternalLogDraft] = useState("");
  const [trustAuditReport, setTrustAuditReport] = useState<TrustAuditPayload | null>(null);
  const [trustAuditLoading, setTrustAuditLoading] = useState(false);
  const [trustAuditError, setTrustAuditError] = useState<string | null>(null);
  const [modelEvalReport, setModelEvalReport] = useState<ModelEvalSuiteResult | null>(null);
  const [modelEvalLoading, setModelEvalLoading] = useState(false);
  const [modelEvalError, setModelEvalError] = useState<string | null>(null);
  const [supportIngestReport, setSupportIngestReport] = useState<SupportIngestResponse | null>(null);
  const [supportIngestLoading, setSupportIngestLoading] = useState(false);
  const [supportIngestError, setSupportIngestError] = useState<string | null>(null);
  const [remoteSupportIngestHistory, setRemoteSupportIngestHistory] = useState<SupportIngestHistoryRecord[]>([]);
  const [remoteSupportIngestHistoryLoading, setRemoteSupportIngestHistoryLoading] = useState(false);
  const [remoteSupportIngestHistoryError, setRemoteSupportIngestHistoryError] = useState<string | null>(null);
  const [supportDeliveryReport, setSupportDeliveryReport] = useState<(SupportDeliveryArchiveRecord & { historyCount: number }) | null>(null);
  const [supportDeliveryLoading, setSupportDeliveryLoading] = useState(false);
  const [supportDeliveryError, setSupportDeliveryError] = useState<string | null>(null);
  const [remoteSupportDeliveryHistory, setRemoteSupportDeliveryHistory] = useState<SupportDeliveryArchiveRecord[]>([]);
  const [remoteSupportDeliveryHistoryLoading, setRemoteSupportDeliveryHistoryLoading] = useState(false);
  const [remoteSupportDeliveryHistoryError, setRemoteSupportDeliveryHistoryError] = useState<string | null>(null);
  const [supportDeliveryEndpointDraft, setSupportDeliveryEndpointDraft] = useState("");
  const [sensorMetadataDraft, setSensorMetadataDraft] = useState("");
  const [sensorMetadataStatus, setSensorMetadataStatus] = useState<string | null>(null);
  const [sensorMetadataError, setSensorMetadataError] = useState<string | null>(null);
  const [sensorIngestHistory, setSensorIngestHistory] = useState<Array<{
    source: string;
    receivedAt: string;
    sceneId: string | null;
    sceneName: string | null;
    summary: string;
    sourceCount: number;
    storedAt: number;
  }>>([]);
  const [sensorIngestHistoryLoading, setSensorIngestHistoryLoading] = useState(false);
  const [sensorIngestHistoryError, setSensorIngestHistoryError] = useState<string | null>(null);
  const [cameraLiveConnectionHistory, setCameraLiveConnectionHistory] = useState<CameraLiveConnectionArchiveRecord[]>([]);
  const [cameraLiveSessionRegistry, setCameraLiveSessionRegistry] = useState<CameraLiveSessionRecord[]>([]);
  const [cameraLiveConnectionHistoryLoading, setCameraLiveConnectionHistoryLoading] = useState(false);
  const [cameraLiveConnectionHistoryError, setCameraLiveConnectionHistoryError] = useState<string | null>(null);
  const [cameraLiveSessionHealth, setCameraLiveSessionHealth] = useState<{
    totals: { active: number; expiringSoon: number; expired: number; closed: number };
    expiringSoon: CameraLiveSessionRecord[];
    generatedAt: number;
  } | null>(null);
  const [cameraLiveSessionHealthLoading, setCameraLiveSessionHealthLoading] = useState(false);
  const [cameraLiveSessionHealthError, setCameraLiveSessionHealthError] = useState<string | null>(null);
  const modelEvalHistory = useStudioStore((s) => s.modelEvalHistory);
  const recordModelEvalRun = useStudioStore((s) => s.recordModelEvalRun);
  const clearModelEvalHistory = useStudioStore((s) => s.clearModelEvalHistory);
  const aiProviderGovernanceHistory = useStudioStore((s) => s.aiProviderGovernanceHistory);
  const recordAiProviderGovernanceSnapshot = useStudioStore((s) => s.recordAiProviderGovernanceSnapshot);
  const clearAiProviderGovernanceHistory = useStudioStore((s) => s.clearAiProviderGovernanceHistory);
  const promptRegistryHistory = useStudioStore((s) => s.promptRegistryHistory);
  const recordPromptRegistrySnapshot = useStudioStore((s) => s.recordPromptRegistrySnapshot);
  const clearPromptRegistryHistory = useStudioStore((s) => s.clearPromptRegistryHistory);
  const recordExternalLogEntry = useStudioStore((s) => s.recordExternalLogEntry);
  const clearExternalLogEntries = useStudioStore((s) => s.clearExternalLogEntries);
  const recordSensorEvent = useStudioStore((s) => s.recordSensorEvent);
  const providerSummary = describeAiProviderSelection(aiProviderSelection);
  const providerGovernance = describeAiProviderGovernance(aiProviderSelection, localOnlyMode);
  const providerHealth = describeAiProviderHealth(aiProviderSelection, localOnlyMode);
  const providerTelemetry = describeAiProviderTelemetry(aiProviderSelection, localOnlyMode);
  const promptRegistrySummary = summarizePromptRegistry();
  const aiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry);
  const aiActionTelemetrySummary = useMemo(() => summarizeAiActionTelemetry(aiActionTelemetry, aiTelemetryPolicy), [aiActionTelemetry, aiTelemetryPolicy]);

  const refreshSupportDeliveryArchive = async () => {
    setRemoteSupportDeliveryHistoryLoading(true);
    setRemoteSupportDeliveryHistoryError(null);
    try {
      const response = await fetch("/api/support-delivery");
      if (!response.ok) {
        throw new Error(`Support delivery archive failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        history: SupportDeliveryArchiveRecord[];
        historyCount: number;
      };
      setRemoteSupportDeliveryHistory(payload.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support delivery archive failed.";
      setRemoteSupportDeliveryHistoryError(message);
    } finally {
      setRemoteSupportDeliveryHistoryLoading(false);
    }
  };

  const refreshSupportIngestArchive = async () => {
    setRemoteSupportIngestHistoryLoading(true);
    setRemoteSupportIngestHistoryError(null);
    try {
      const response = await fetch("/api/support-ingest");
      if (!response.ok) {
        throw new Error(`Support ingest archive failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        history: SupportIngestHistoryRecord[];
        historyCount: number;
      };
      setRemoteSupportIngestHistory(payload.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support ingest archive failed.";
      setRemoteSupportIngestHistoryError(message);
    } finally {
      setRemoteSupportIngestHistoryLoading(false);
    }
  };

  const refreshCameraLiveConnectionArchive = async () => {
    setCameraLiveConnectionHistoryLoading(true);
    setCameraLiveConnectionHistoryError(null);
    try {
      const response = await fetch("/api/camera-live-connection");
      if (!response.ok) {
        throw new Error(`Camera live connection archive failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        history: CameraLiveConnectionArchiveRecord[];
        historyCount: number;
        activeSessions?: CameraLiveSessionRecord[];
      };
      setCameraLiveConnectionHistory(payload.history);
      if (Array.isArray(payload.activeSessions)) {
        setCameraLiveSessionRegistry(payload.activeSessions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera live connection archive failed.";
      setCameraLiveConnectionHistoryError(message);
    } finally {
      setCameraLiveConnectionHistoryLoading(false);
    }
  };

  const refreshCameraLiveSessionHealth = async () => {
    setCameraLiveSessionHealthLoading(true);
    setCameraLiveSessionHealthError(null);
    try {
      const response = await fetch("/api/camera-live-session-health");
      if (!response.ok) {
        throw new Error(`Camera live session health failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        sessions: CameraLiveSessionRecord[];
        totals: { active: number; expiringSoon: number; expired: number; closed: number };
        expiringSoon: CameraLiveSessionRecord[];
        generatedAt: number;
      };
      setCameraLiveSessionRegistry(payload.sessions);
      setCameraLiveSessionHealth({
        totals: payload.totals,
        expiringSoon: payload.expiringSoon,
        generatedAt: payload.generatedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera live session health failed.";
      setCameraLiveSessionHealthError(message);
    } finally {
      setCameraLiveSessionHealthLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await refreshSupportIngestArchive();
      await refreshSupportDeliveryArchive();
      await refreshCameraLiveConnectionArchive();
      await refreshCameraLiveSessionHealth();
    })();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setSensorIngestHistoryLoading(true);
      setSensorIngestHistoryError(null);
      try {
        const response = await fetch("/api/sensor-ingest");
        if (!response.ok) {
          throw new Error(`Sensor ingest archive failed with HTTP ${response.status}.`);
        }
        const payload = (await response.json()) as {
          ok: true;
          history: Array<{
            source: string;
            receivedAt: string;
            sceneId: string | null;
            sceneName: string | null;
            summary: string;
            sourceCount: number;
            storedAt: number;
          }>;
          historyCount: number;
        };
        if (!active) return;
        setSensorIngestHistory(payload.history);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Sensor ingest archive failed.";
        setSensorIngestHistoryError(message);
      } finally {
        if (active) setSensorIngestHistoryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const renewCameraLiveSession = async (sessionId: string) => {
    setCameraLiveSessionHealthLoading(true);
    setCameraLiveSessionHealthError(null);
    try {
      const response = await fetch("/api/camera-live-session-health", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ttlMs: 120_000,
          summary: "Lease refreshed from debug panel.",
        }),
      });
      if (!response.ok) {
        throw new Error(`Camera live session renew failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        sessions: CameraLiveSessionRecord[];
        totals: { active: number; expiringSoon: number; expired: number; closed: number };
        expiringSoon: CameraLiveSessionRecord[];
        generatedAt: number;
      };
      setCameraLiveSessionRegistry(payload.sessions);
      setCameraLiveSessionHealth({
        totals: payload.totals,
        expiringSoon: payload.expiringSoon,
        generatedAt: payload.generatedAt,
      });
      await refreshCameraLiveConnectionArchive();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera live session renew failed.";
      setCameraLiveSessionHealthError(message);
    } finally {
      setCameraLiveSessionHealthLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setCameraLiveConnectionHistoryLoading(true);
      setCameraLiveConnectionHistoryError(null);
      try {
        const response = await fetch("/api/camera-live-connection");
        if (!response.ok) {
          throw new Error(`Camera live connection archive failed with HTTP ${response.status}.`);
        }
        const payload = (await response.json()) as {
          ok: true;
          history: CameraLiveConnectionArchiveRecord[];
          historyCount: number;
          activeSessions?: CameraLiveSessionRecord[];
        };
        if (!active) return;
        setCameraLiveConnectionHistory(payload.history);
        if (Array.isArray(payload.activeSessions)) {
          setCameraLiveSessionRegistry(payload.activeSessions);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Camera live connection archive failed.";
        setCameraLiveConnectionHistoryError(message);
      } finally {
        if (active) setCameraLiveConnectionHistoryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dispatchSupportDelivery = async () => {
    const latestIngest = remoteSupportIngestHistory[0] ?? supportIngestHistory[0];
    if (!latestIngest) {
      const message = "No routed support ingest is available to dispatch yet.";
      setSupportDeliveryError(message);
      setLaunchNotice(message);
      return;
    }

    const trimmedEndpoint = supportDeliveryEndpointDraft.trim();
    if (trimmedEndpoint) {
      try {
        // Validate the remote target before the queue sees it.
        new URL(trimmedEndpoint);
      } catch {
        const message = "Support delivery endpoint must be a valid URL.";
        setSupportDeliveryError(message);
        setLaunchNotice(message);
        return;
      }
    }

    const destinations = [
      { label: "Local relay", mode: "archive" as const },
      ...(trimmedEndpoint
        ? [{ label: "Remote webhook", endpoint: trimmedEndpoint, mode: "webhook" as const }]
        : []),
    ];

    setSupportDeliveryLoading(true);
    setSupportDeliveryError(null);
    try {
      const response = await fetch("/api/support-delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          submittedAt: Date.now(),
          supportIngest: latestIngest,
          destinations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Support delivery failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as SupportDeliveryArchiveRecord & { historyCount: number };
      setSupportDeliveryReport(payload);
      void refreshSupportDeliveryArchive();
      setLaunchNotice(`Support delivery routed ${payload.deliveredCount + payload.queuedCount + payload.failedCount} target${payload.deliveredCount + payload.queuedCount + payload.failedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support delivery failed.";
      setSupportDeliveryError(message);
      setLaunchNotice(message);
    } finally {
      setSupportDeliveryLoading(false);
    }
  };
  const operationalEvidenceJournal = useMemo<OperationalEvidenceJournal | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
      if (!raw) return null;
      return normalizeOperationalEvidenceJournal(JSON.parse(raw));
    } catch {
      return null;
    }
  }, []);

  const diagnosticBundle = useMemo(
    () =>
      buildDiagnosticBundle({
        scene,
        simulationResult: result,
        sceneIntelligenceGraph,
        operationalEvidenceEvents,
        runtimeIncidents,
        externalLogEntries,
        workspaceAccess,
        workspaceGovernance,
        lastRunMs,
        showDebugOverlays,
        overlayDensity,
        autoRecompute,
        simulationDirty,
        simulationRunning,
        cameraFailures,
        localOnlyMode,
        aiProviderLabel: providerSummary.providerLabel,
        launchNotice,
        pathname: typeof window === "undefined" ? undefined : window.location.pathname,
        userAgent: typeof window === "undefined" ? undefined : window.navigator.userAgent,
      }),
      [
        autoRecompute,
        cameraFailures,
        lastRunMs,
        launchNotice,
        operationalEvidenceEvents,
        runtimeIncidents,
        providerSummary.providerLabel,
        result,
        scene,
        workspaceAccess,
        workspaceGovernance,
        overlayDensity,
        simulationDirty,
        simulationRunning,
        localOnlyMode,
        sceneIntelligenceGraph,
        showDebugOverlays,
        externalLogEntries,
      ],
  );
  const supportBundle = useMemo(
    () =>
      buildSupportBundle({
        scene,
        simulationResult: result,
        sceneIntelligenceGraph,
        operationalEvidenceEvents,
        runtimeIncidents,
        workspaceAccess,
        workspaceGovernance,
        lastRunMs,
        showDebugOverlays,
        overlayDensity,
        autoRecompute,
        simulationDirty,
        simulationRunning,
        cameraFailures,
        localOnlyMode,
        aiProviderLabel: providerSummary.providerLabel,
        launchNotice,
        pathname: typeof window === "undefined" ? undefined : window.location.pathname,
        userAgent: typeof window === "undefined" ? undefined : window.navigator.userAgent,
        aiActionTelemetry,
        externalLogEntries,
        sensorIngestHistory,
        cameraLiveConnectionHistory,
        cameraLiveSessionRegistry,
      }),
    [
      aiActionTelemetry,
      autoRecompute,
      cameraFailures,
      lastRunMs,
      launchNotice,
      localOnlyMode,
      operationalEvidenceEvents,
      overlayDensity,
      result,
      runtimeIncidents,
      scene,
      sceneIntelligenceGraph,
      showDebugOverlays,
      simulationDirty,
      simulationRunning,
      externalLogEntries,
      sensorIngestHistory,
      cameraLiveConnectionHistory,
      cameraLiveSessionRegistry,
      workspaceAccess,
      workspaceGovernance,
      providerSummary.providerLabel,
    ],
  );

  const downloadDiagnosticBundle = () => {
    const blob = new Blob([stringifyDiagnosticBundle(diagnosticBundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-diagnostic-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadRuntimeTruthBundle = () => {
    const bundle = buildRuntimeTruthBundle({
      scene,
      simulationResult: result,
      sceneIntelligenceGraph,
      operationalEvidenceEvents,
      workspaceGovernance,
      workspaceAccess,
      lastRunMs,
      showDebugOverlays,
      overlayDensity,
      autoRecompute,
      cameraFailures,
      runtimeIncidents,
      externalLogEntries,
      localOnlyMode,
      aiProviderLabel: providerSummary.providerLabel,
      simulationDirty,
      simulationRunning,
      launchNotice,
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
    });
    const blob = new Blob([stringifyRuntimeTruthBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-runtime-truth-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLaunchNotice("Runtime truth bundle downloaded.");
  };

  const downloadSupportBundle = () => {
    const blob = new Blob([stringifySupportBundle(supportBundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-support-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLaunchNotice("Support bundle downloaded.");
  };

  const downloadIncidentBundle = () => {
    const blob = new Blob([stringifyIncidentBundle(buildIncidentBundle({
      scene,
      simulationResult: result,
      sceneIntelligenceGraph,
      operationalEvidenceEvents,
      runtimeIncidents,
      externalLogEntries,
      workspaceAccess,
      workspaceGovernance,
      lastRunMs,
      showDebugOverlays,
      overlayDensity,
      autoRecompute,
      cameraFailures,
      localOnlyMode,
      aiProviderLabel: providerSummary.providerLabel,
      simulationDirty,
      simulationRunning,
      launchNotice,
      pathname: typeof window === "undefined" ? undefined : window.location.pathname,
      userAgent: typeof window === "undefined" ? undefined : window.navigator.userAgent,
    }))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-incident-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLaunchNotice("Incident bundle downloaded.");
  };

  const downloadReportEvidenceBundle = () => {
    if (!supportBundle.reportEvidence) {
      setLaunchNotice("No report evidence bundle is available yet.");
      return;
    }
    const blob = new Blob([stringifyReportEvidenceBundle(supportBundle.reportEvidence)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-report-evidence-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLaunchNotice("Report evidence bundle downloaded.");
  };

  const captureExternalLog = () => {
    const raw = externalLogDraft.trim();
    if (!raw) {
      setLaunchNotice("Paste an external log before capturing it.");
      return;
    }

    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const title = lines[0]?.slice(0, 80) || "External log capture";
    const severity = /(?:fatal|error|exception|panic|traceback)/i.test(raw)
      ? "error"
      : /(?:warn|warning)/i.test(raw)
        ? "warning"
        : "info";

    recordExternalLogEntry({
      source: "paste",
      title,
      details: `${lines.length} line${lines.length === 1 ? "" : "s"} captured from pasted external logs.`,
      raw,
      lineCount: lines.length,
      severity,
    });
    setExternalLogDraft("");
    setLaunchNotice(`Captured ${lines.length} external log line${lines.length === 1 ? "" : "s"}.`);
  };

  const ingestSensorMetadata = () => {
    const raw = sensorMetadataDraft.trim();
    if (!raw) {
      setSensorMetadataError("Paste sensor metadata as JSON or NDJSON first.");
      setSensorMetadataStatus(null);
      return;
    }

    void fetch("/api/sensor-ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "debug-panel",
        sceneId: scene.id,
        sceneName: scene.name,
        submittedAt: Date.now(),
        raw,
        sensors: scene.sensors,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Sensor ingest failed with HTTP ${response.status}.`);
        }
        return response.json() as Promise<{
          ok: true;
          source: string;
          receivedAt: string;
          sceneId: string | null;
          sceneName: string | null;
          summary: string;
          events: Array<Parameters<typeof recordSensorEvent>[0]>;
          errors: string[];
          sourceCount: number;
          storedAt: number;
          historyCount: number;
        }>;
      })
      .catch(async () => {
        const parsed = parseSensorLiveFeed(raw, scene.sensors);
        if (parsed.events.length === 0) {
          throw new Error(parsed.errors[0] ?? "Paste sensor metadata as JSON or NDJSON first.");
        }
        return {
          ok: true as const,
          source: "debug-panel",
          receivedAt: new Date().toISOString(),
          sceneId: scene.id,
          sceneName: scene.name,
          summary: `Imported ${parsed.events.length} sensor event${parsed.events.length === 1 ? "" : "s"} from ${parsed.sourceCount} record${parsed.sourceCount === 1 ? "" : "s"}.`,
          ...parsed,
          storedAt: Date.now(),
          historyCount: 0,
        };
      })
      .then((payload) => {
        if (payload.events.length === 0) {
          throw new Error(payload.errors[0] ?? "No matching sensor events found.");
        }
        for (const event of payload.events) {
          recordSensorEvent(event);
        }
        setSensorMetadataError(payload.errors[0] ?? null);
        setSensorMetadataStatus(`${payload.summary} Archived ${payload.historyCount} sensor ingest record${payload.historyCount === 1 ? "" : "s"}.`);
        setSensorMetadataDraft("");
        setLaunchNotice(`Imported ${payload.events.length} live sensor event${payload.events.length === 1 ? "" : "s"} and archived the ingest record.`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Sensor ingest failed.";
        setSensorMetadataError(message);
        setSensorMetadataStatus(null);
        setLaunchNotice(message);
      });
  };

  const sendSupportBundleToIngest = async () => {
    setSupportIngestLoading(true);
    setSupportIngestError(null);
    try {
      const submittedAt = Date.now();
      const response = await fetch("/api/support-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          sceneId: scene.id,
          sceneName: scene.name,
          submittedAt,
          runtimeIncidents,
          externalLogEntries,
          aiActionTelemetry,
        }),
      });

      if (!response.ok) {
        throw new Error(`Support ingest failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as SupportIngestResponse;
      setSupportIngestReport(payload);
      recordSupportIngestResponse({ ...payload, submittedAt });
      void refreshSupportIngestArchive();
      setLaunchNotice(`Support ingest routed ${payload.routing.alertCount} alert candidate${payload.routing.alertCount === 1 ? "" : "s"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support ingest failed.";
      setSupportIngestError(message);
      setLaunchNotice(message);
    } finally {
      setSupportIngestLoading(false);
    }
  };

  const downloadOperationalEvidenceArchive = () => {
    const archive = exportOperationalEvidenceArchive();
    const blob = new Blob([stringifyOperationalEvidenceArchive(archive)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentineltwin-archive-${scene.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLaunchNotice("Operational evidence archive downloaded.");
  };

  const buildArchiveHandoffDeepLink = (archive: ArchiveHandoffRequest["archive"], restoreBranch: ArchiveHandoffRequest["restoreBranch"]) => {
    if (typeof window === "undefined") return "";
    return buildArchiveHandoffLink(
      `${window.location.origin}${window.location.pathname}`,
      window.location.search,
      {
        archive,
        restoreBranch,
      },
      window.location.hash,
    );
  };

  const copyArchiveHandoffLink = async () => {
    if (typeof window === "undefined") return;
    const archive = exportOperationalEvidenceArchive();
    const deepLink = buildArchiveHandoffDeepLink(archive, archiveRestoreBranch);
    if (!deepLink) return;
    const copied = await writeClipboardText(deepLink);
    setLaunchNotice(copied ? "Archive handoff link copied." : "Clipboard unavailable.");
  };

  const shareArchiveHandoffLink = async () => {
    if (typeof window === "undefined") return;
    const archive = exportOperationalEvidenceArchive();
    const deepLink = buildArchiveHandoffDeepLink(archive, archiveRestoreBranch);
    if (!deepLink) return;

    const shareData = {
      title: "SentinelTwin archive handoff",
      text: `Open ${archive.scene.name || "Untitled Scene"} in SentinelTwin recovery preflight.`,
      url: deepLink,
    };

    try {
      const shareNavigator = window.navigator as Navigator & {
          canShare?: (data: typeof shareData) => boolean;
          share: (data: typeof shareData) => Promise<void>;
      };
      if (typeof shareNavigator.share === "function") {
        if (typeof shareNavigator.canShare === "function" && !shareNavigator.canShare(shareData)) {
          const copied = await writeClipboardText(deepLink);
          setLaunchNotice(copied ? "Archive handoff copied. Sharing was unavailable for this payload." : "Archive handoff sharing unavailable.");
          return;
        }

        await shareNavigator.share(shareData);
        setLaunchNotice("Archive handoff shared.");
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Archive handoff sharing failed.";
      setLaunchNotice(message);
      return;
    }

    const copied = await writeClipboardText(deepLink);
    setLaunchNotice(copied ? "Archive handoff link copied." : "Clipboard unavailable.");
  };

  const openArchiveHandoffLink = () => {
    if (typeof window === "undefined") return;
    const archive = exportOperationalEvidenceArchive();
    const deepLink = buildArchiveHandoffDeepLink(archive, archiveRestoreBranch);
    if (!deepLink) return;
    window.open(deepLink, "_blank", "noopener,noreferrer");
    setLaunchNotice("Archive handoff link opened in a new tab.");
  };

  const runTrustAudit = async () => {
    setTrustAuditLoading(true);
    setTrustAuditError(null);
    try {
      const response = await fetch("/api/truth-audit");
      if (!response.ok) {
        throw new Error(`Trust audit failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as TrustAuditPayload;
      setTrustAuditReport(payload);
      setLaunchNotice(payload.ok ? "Trust audit passed." : "Trust audit reported surface drift.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Trust audit failed.";
      setTrustAuditError(message);
      setLaunchNotice(message);
    } finally {
      setTrustAuditLoading(false);
    }
  };

  const runModelEval = async () => {
    setModelEvalLoading(true);
    setModelEvalError(null);
    try {
      const response = await fetch("/api/ai/model-eval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selection: aiProviderSelection, localOnlyMode }),
      });
      const payload = await response.json() as {
        ok: boolean;
        error?: string;
        report?: ModelEvalSuiteResult;
      };
      if (!payload.ok || !payload.report) {
        throw new Error(payload.error ?? "Model eval suite failed.");
      }
      const report = payload.report;
      setModelEvalReport(report);
      recordModelEvalRun(report);
      setLaunchNotice(
        report.summary.failed > 0
          ? "Model eval suite reported failures."
          : report.summary.skipped > 0
            ? "Model eval suite completed with skips."
            : "Model eval suite passed.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model eval suite failed.";
      setModelEvalError(message);
      setLaunchNotice(message);
    } finally {
      setModelEvalLoading(false);
    }
  };

  const handleArchiveFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const archive = normalizeOperationalEvidenceArchive(raw);
      if (!archive) {
        setPendingArchive(null);
        setPendingArchiveError("Archive restore failed: invalid archive shape.");
        setLaunchNotice("Archive restore failed: invalid archive shape.");
        return;
      }
      setPendingArchive(archive);
      setPendingArchiveError(null);
      setLaunchNotice(`Archive loaded for merge preflight: ${archive.scene.name || "Untitled Scene"}.`);
    } catch {
      setPendingArchive(null);
      setPendingArchiveError("Archive restore failed: invalid JSON.");
      setLaunchNotice("Archive restore failed: invalid JSON.");
    }
  };

  useEffect(() => {
    if (!archiveHandoffRequest) return;
    queueMicrotask(() => {
      setPendingArchive(archiveHandoffRequest.archive);
      setArchiveRestoreBranch(archiveHandoffRequest.restoreBranch);
      setPendingArchiveError(null);
      setLaunchNotice(`Archive handoff loaded for merge preflight: ${archiveHandoffRequest.archive.scene.name || "Untitled Scene"}.`);
      setArchiveHandoffRequest(null);
    });
  }, [archiveHandoffRequest, setArchiveHandoffRequest, setLaunchNotice]);

  const pendingArchiveComparison = useMemo(() => {
    if (!pendingArchive) return null;
    const currentHead = [...operationalEvidenceEvents].at(-1) ?? null;
    const archiveHead = [...pendingArchive.operationalEvidenceEvents].at(-1) ?? null;
    if (!currentHead || !archiveHead) return null;

    const eventsById = new Map<string, typeof operationalEvidenceEvents[number]>();
    for (const event of operationalEvidenceEvents) {
      eventsById.set(event.id, event);
    }
    for (const event of pendingArchive.operationalEvidenceEvents) {
      eventsById.set(event.id, event);
    }
    const combined = [...eventsById.values()];
    const comparison = compareOperationalEvidenceBranches(combined, currentHead.id, archiveHead.id);
    const readiness = assessOperationalEvidenceMergeReadiness(comparison);
    return { comparison, readiness };
  }, [operationalEvidenceEvents, pendingArchive]);

  const pendingArchiveActionLabel = pendingArchiveComparison?.readiness?.status === "diverged"
    ? "Merge Archive"
    : "Apply Archive";

  const applyPendingArchive = () => {
    if (!pendingArchive) {
      setLaunchNotice("No archive loaded to apply.");
      return;
    }

    if (!pendingArchiveComparison?.readiness) {
      setLaunchNotice("Archive restore failed: merge preflight unavailable.");
      return;
    }

    const { readiness } = pendingArchiveComparison;
    if (readiness.status === "unrelated" || readiness.status === "fast_forward_right") {
      setLaunchNotice(`Archive blocked: ${readiness.recommendation}`);
      return;
    }

    const result = importOperationalEvidenceArchive(pendingArchive, {
      archiveExportedAt: pendingArchive.exportedAt,
      archiveRestoreBranch,
    });
    if (result.success) {
      setPendingArchive(null);
      setPendingArchiveError(null);
    }
    setLaunchNotice(
      result.success
        ? readiness.status === "diverged"
          ? "Operational evidence archive merged into the workspace."
          : "Operational evidence archive applied to the workspace."
        : result.error ?? "Archive merge failed.",
    );
  };

  const restoreLatestArchiveCheckpoint = () => {
    const archive = exportOperationalEvidenceArchive();
    const latestCheckpoint = [...archive.operationalEvidenceEvents].reverse().find((entry) => Boolean(entry.sceneSnapshot));
    if (!latestCheckpoint) {
      setLaunchNotice("Archive restore failed: no checkpoint snapshot available.");
      return;
    }
    const restored = restoreSceneFromEvidence(latestCheckpoint.id, archiveRestoreBranch);
    setLaunchNotice(
      restored
        ? `Archive checkpoint restored into ${archiveRestoreBranch} branch.`
        : "Archive restore failed: checkpoint could not be reconstructed.",
    );
  };

  const summary = sceneIntelligenceGraph.summary;
  const sourceEntries = Object.entries(summary.sourceCounts).filter(([, count]) => count > 0);
  const journalEntries = operationalEvidenceJournal?.entries ?? [];
  const journalCounts = journalEntries.reduce(
    (counts, entry) => {
      if (entry.kind === "append") counts.append += 1;
      else if (entry.kind === "merge") counts.merge += 1;
      else counts.replace += 1;
      return counts;
    },
    { append: 0, merge: 0, replace: 0 },
  );
  const { append: journalAppendCount, merge: journalMergeCount, replace: journalReplaceCount } = journalCounts;
  const runtime = diagnosticBundle.runtime;
  const currentModelEvalRecord = modelEvalReport
    ? summarizeModelEvalRun(modelEvalReport, getCloudRequiredFixtureCount(modelEvalReport.fixtures))
    : null;
  const latestModelEvalRun = modelEvalHistory[0] ?? currentModelEvalRecord;
  const previousModelEvalRun = modelEvalHistory[1] ?? null;
  const modelEvalComparison = useMemo(
    () => (latestModelEvalRun && previousModelEvalRun ? compareModelEvalRuns(previousModelEvalRun, latestModelEvalRun) : null),
    [latestModelEvalRun, previousModelEvalRun],
  );
  const hoverCellEvaluations = useMemo(
    () => Object.entries(heatmapHover?.cell.cameraEvaluations ?? {}).sort(([, a], [, b]) => {
      const probabilityDelta = (b.probability ?? 0) - (a.probability ?? 0);
      if (probabilityDelta !== 0) return probabilityDelta;
      return (b.ppm ?? 0) - (a.ppm ?? 0);
    }),
    [heatmapHover],
  );
  const topHoverEvaluations = hoverCellEvaluations.slice(0, 3);

  if (!result) {
    return (
      <RunSimulationPrompt
        className="h-full px-4"
        message="Run the shared simulation to populate the debug overlays and graph stats."
      />
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-y-auto px-3 py-2">
      <div className="min-w-[240px] space-y-2.5">
        <Section title="Debug Controls" icon={<Sparkles className="h-3 w-3 text-emerald-400" />}>
          <div className="flex flex-wrap gap-1.5">
            <PillButton active={showDebugOverlays} onClick={() => setShowDebugOverlays(!showDebugOverlays)}>
              Debug Overlays {showDebugOverlays ? "On" : "Off"}
            </PillButton>
            <PillButton active={autoRecompute} onClick={toggleAutoRecompute}>
              Auto Recompute {autoRecompute ? "On" : "Off"}
            </PillButton>
            <PillButton active={false} onClick={downloadDiagnosticBundle}>
              Download Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadRuntimeTruthBundle}>
              Download Runtime Truth
            </PillButton>
            <PillButton active={false} onClick={downloadIncidentBundle}>
              Download Incident Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadSupportBundle}>
              Download Support Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadReportEvidenceBundle}>
              Download Evidence Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadOperationalEvidenceArchive}>
              Download Archive
            </PillButton>
            <PillButton active={false} onClick={shareArchiveHandoffLink}>
              Share Archive
            </PillButton>
            <PillButton active={false} onClick={copyArchiveHandoffLink}>
              Copy Archive Link
            </PillButton>
            <PillButton active={false} onClick={openArchiveHandoffLink}>
              Open Archive Link
            </PillButton>
            <PillButton active={false} onClick={() => archiveInputRef.current?.click()}>
              Restore Archive
            </PillButton>
            <PillButton active={false} onClick={applyPendingArchive}>
              Apply Archive
            </PillButton>
            <PillButton active={false} onClick={runTrustAudit}>
              {trustAuditLoading ? "Running Audit..." : "Run Trust Audit"}
            </PillButton>
            <PillButton active={false} onClick={runModelEval}>
              {modelEvalLoading ? "Running Eval..." : "Run Eval Suite"}
            </PillButton>
            <PillButton active={false} onClick={clearModelEvalHistory}>
              Clear Eval History
            </PillButton>
            <PillButton active={false} onClick={captureExternalLog}>
              Capture External Log
            </PillButton>
            <PillButton active={false} onClick={clearExternalLogEntries}>
              Clear External Logs
            </PillButton>
            <PillButton active={false} onClick={sendSupportBundleToIngest}>
              {supportIngestLoading ? "Sending Ingest..." : "Send to Ingest"}
            </PillButton>
            <PillButton active={false} onClick={restoreLatestArchiveCheckpoint}>
              Restore Latest Checkpoint
            </PillButton>
            <PillButton active={false} onClick={() => publishCurrentScene()}>
              Publish Scene
            </PillButton>
          </div>
          <input
            ref={archiveInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleArchiveFileChange}
          />
          {pendingArchive ? (
            <div className={`{mt-2 rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeepAlt} px-3 py-2}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted7}`}>Archive Merge Preflight</div>
                  <div className={`mt-1 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    {pendingArchive.scene.name || "Untitled Scene"} · {pendingArchive.scene.source} · exported {pendingArchive.exportedAt}
                  </div>
                </div>
                <div className={`text-[10px] ${UI_SURFACES.textBody2}`}>
                  {pendingArchiveComparison?.readiness?.status ?? "pending"}
                </div>
              </div>
              {pendingArchiveComparison?.readiness ? (
                <>
                  <div className={`{mt-2 rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-3 py-2 text-[10px] ${UI_SURFACES.textBody2}}`}>
                    {pendingArchiveComparison.readiness.recommendation}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <PillButton active={false} onClick={applyPendingArchive}>
                      {pendingArchiveComparison.readiness.status === "unrelated" || pendingArchiveComparison.readiness.status === "fast_forward_right"
                        ? "Archive Blocked"
                        : pendingArchiveActionLabel}
                    </PillButton>
                    <PillButton active={false} onClick={() => setPendingArchive(null)}>
                      Clear Archive
                    </PillButton>
                  </div>
                </>
              ) : null}
              {pendingArchiveError ? (
                <div className="mt-2 text-[10px] text-rose-300">{pendingArchiveError}</div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2">
            <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Overlay Density</div>
            <div className="flex gap-1">
              {OVERLAY_DENSITY_OPTIONS.map((option) => (
                <PillButton
                  key={option.value}
                  active={overlayDensity === option.value}
                  onClick={() => setOverlayDensity(option.value)}
                >
                  {option.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Archive Branch</div>
            <div className="flex gap-1">
              {(["draft", "recovered", "published"] as const).map((branch) => (
                <PillButton
                  key={branch}
                  active={archiveRestoreBranch === branch}
                  onClick={() => setArchiveRestoreBranch(branch)}
                >
                  {branch}
                </PillButton>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Debug Toggles (spec §11.6)"
          icon={<Sparkles className="h-3 w-3 text-amber-400" />}
        >
          <div className="space-y-1.5">
            <div className={`text-[9px] ${UI_SURFACES.textSoftDim}`}>
              Each toggle controls one debug overlay from the Camera Studio spec §11.6. Toggles are
              gated by the master &quot;Debug Overlays&quot; switch above; the per-overlay state lives
              in the store and can be wired into the 3D viewport by renderer authors.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEBUG_TOGGLE_LABELS.map((entry) => (
                <span key={entry.key} title={entry.description}>
                  <PillButton
                    active={debugToggles[entry.key]}
                    onClick={() => setDebugToggle(entry.key, !debugToggles[entry.key])}
                  >
                    {entry.label} {debugToggles[entry.key] ? "On" : "Off"}
                  </PillButton>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <PillButton
                active={false}
                onClick={resetDebugToggles}
              >
                Reset Toggles
              </PillButton>
              <span className={`text-[9px] ${UI_SURFACES.textDimMid}`}>
                {DEBUG_TOGGLE_LABELS.filter((entry) => debugToggles[entry.key]).length}
                {" "}of {DEBUG_TOGGLE_LABELS.length} overlays on
              </span>
            </div>
          </div>
        </Section>

        <Section title="Evidence Journal" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
          <div className="space-y-2">
            <div className={`text-[10px] ${UI_SURFACES.textSoftDim}`}>
              Append-only journal batches keep the browser evidence trail as records instead of a single rewritten array.
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1.5}`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted7}`}>Batches</div>
                <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{journalEntries.length}</div>
              </div>
              <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1.5}`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted7}`}>Append</div>
                <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{journalAppendCount}</div>
              </div>
              <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1.5}`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted7}`}>Merge</div>
                <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{journalMergeCount}</div>
              </div>
              <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1.5}`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted7}`}>Replace</div>
                <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{journalReplaceCount}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {journalEntries.length > 0 ? (
                [...journalEntries].slice(-4).reverse().map((entry) => (
                  <div key={entry.id} className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeepAlt} px-3 py-2}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[11px] font-semibold ${UI_SURFACES.textBright}`}>{entry.reason}</div>
                      <Badge variant={entry.kind === "append" ? "green" : entry.kind === "merge" ? "blue" : "amber"}>{entry.kind}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{entry.events.length} event{entry.events.length === 1 ? "" : "s"}</Badge>
                      <Badge variant="gray">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                      {entry.resolution ? <Badge variant="gray">{entry.resolution}</Badge> : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                  No journal entries yet.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Live Stats" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
          <div className="space-y-1.5 text-[9px]">
            <div className={`flex items-center justify-between rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
              <span className={`${UI_SURFACES.textSoftBright}`}>Last run</span>
              <span className={`font-mono ${UI_SURFACES.textBody2}`}>{lastRunMs ? `${lastRunMs} ms` : "—"}</span>
            </div>
            <div className={`flex items-center justify-between rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
              <span className={`${UI_SURFACES.textSoftBright}`}>Scene nodes</span>
              <span className={`font-mono ${UI_SURFACES.textBody2}`}>{summary.nodeCount}</span>
            </div>
            <div className={`flex items-center justify-between rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
              <span className={`${UI_SURFACES.textSoftBright}`}>Edges</span>
              <span className={`font-mono ${UI_SURFACES.textBody2}`}>{summary.edgeCount}</span>
            </div>
            <div className={`flex items-center justify-between rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
              <span className={`${UI_SURFACES.textSoftBright}`}>Coverage links</span>
              <span className={`font-mono ${UI_SURFACES.textBody2}`}>{summary.coverageLinkCount}</span>
            </div>
            <div className={`flex items-center justify-between rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
              <span className={`${UI_SURFACES.textSoftBright}`}>Failed zones</span>
              <span className={`font-mono ${UI_SURFACES.textBody2}`}>{summary.failedZoneCount}</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <Section title="Scene Graph" icon={<Layers3 className="h-3 w-3 text-cyan-400" />}>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Scene source</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.sceneSourceLabel}</div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Cameras</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.cameraCount}</div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Zones</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.zoneCount}</div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Sources</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.sourceCount}</div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Revision depth</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.revisionDepth}</div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Snapshots</div>
              <div className={`mt-0.5 text-[9px] font-semibold ${UI_SURFACES.textBody2}`}>{summary.snapshotCount}</div>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Source Breakdown</div>
            <div className="flex flex-wrap gap-1.5">
              {sourceEntries.length > 0 ? sourceEntries.map(([source, count]) => (
                <span key={source} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2}`}>
                  {source}: <span className={`font-mono ${UI_SURFACES.textSoftBright}`}>{count}</span>
                </span>
              )) : (
                <span className={`text-[9px] ${UI_SURFACES.textDimMid}`}>No source breakdown yet.</span>
              )}
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-2.5">
          <Section title="Camera Failures" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
            <div className="flex items-center justify-between gap-2">
              <div className={`text-[9px] ${UI_SURFACES.textSoftBright}`}>
                {cameraFailures.length > 0 ? `${cameraFailures.length} simulated camera failures active` : "No simulated camera failures active"}
              </div>
              {cameraFailures.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAllCameraFailures}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear All
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cameraFailures.length > 0 ? cameraFailures.slice(0, 5).map((cameraId) => (
                <span key={cameraId} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2}`}>
                  {cameraId}
                </span>
              )) : (
                <span className={`text-[9px] ${UI_SURFACES.textDimMid}`}>Use the camera failure shortcut or toolbar action to stage failure analysis.</span>
              )}
            </div>
          </Section>

        <Section title="Simulation Notes" icon={<TimerReset className="h-3 w-3 text-amber-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Assumptions: {assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} · {assumptions.timeOfDay} · {assumptions.interiorLightLevel}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Debug overlays show coverage, timing, and source-state context so you can understand why a scene changed after recompute.
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Toggle <span className={`${UI_SURFACES.textBody2}`}>Debug Overlays</span>, export a support bundle, or lower <span className={`${UI_SURFACES.textBody2}`}>Overlay Density</span> if the shell is too noisy for a live review.
              </div>
            </div>
          </Section>

          <Section title="Heatmap Explainability" icon={<BadgeInfo className="h-3 w-3 text-cyan-400" />}>
            {heatmapHover ? (
              <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                  Hovering {heatmapMode} cell @ x:{heatmapHover.cell.x.toFixed(2)} z:{heatmapHover.cell.z.toFixed(2)}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Quality</div>
                    <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                      {getTrustQualityLabel(heatmapHover.cell.quality, scene.assumptions.doriStandard)}
                    </div>
                  </div>
                  <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>PPM</div>
                    <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{heatmapHover.cell.ppm.toFixed(1)}</div>
                  </div>
                  <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Covering cams</div>
                    <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{heatmapHover.cell.coveringCameras.length}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {topHoverEvaluations.length > 0 ? topHoverEvaluations.map(([cameraId, evaluation]) => (
                    <div key={cameraId} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{cameraId}</div>
                        <Badge variant="gray">
                          {getTrustQualityLabel(evaluation.quality, scene.assumptions.doriStandard)} · {evaluation.ppm.toFixed(1)} PPM
                        </Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1 text-[8px] text-[#8ea2c4]">
                        <span>FOV: {evaluation.inFov ? "yes" : "no"}</span>
                        <span>Range: {evaluation.withinRange ? "yes" : "no"}</span>
                        <span>Dist: {evaluation.distanceM.toFixed(1)}m</span>
                        <span>Edge: {formatMultiplier(evaluation.edgePenaltyMultiplier)}</span>
                        <span>Clarity: {formatMultiplier(evaluation.clarityMultiplier)}</span>
                        <span>Material: {formatMultiplier(evaluation.materialTransmission)}</span>
                        <span>Glare: {typeof evaluation.glarePenalty === "number" ? `${(evaluation.glarePenalty * 100).toFixed(0)}%` : "—"}</span>
                        <span>Lighting: {typeof evaluation.lightingPenalty === "number" ? `${(evaluation.lightingPenalty * 100).toFixed(0)}%` : "—"}</span>
                        <span>Final: {formatMultiplier(evaluation.finalPpmMultiplier)}</span>
                      </div>
                      {evaluation.reasonCodes.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {evaluation.reasonCodes.slice(0, 3).map((reasonCode) => (
                            <span key={reasonCode} className="rounded border border-[#314267] bg-[#13203a] px-1 py-0.5 text-[8px] text-[#9dc3ff]">
                              {formatReasonCode(reasonCode)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )) : (
                    <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                      No per-camera evaluation details found for this hovered cell.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                Hover a heatmap cell in Map View to inspect per-camera trust factors here.
              </div>
            )}
          </Section>

          <Section title="Runtime Health" icon={<TriangleAlert className="h-3 w-3 text-emerald-400" />}>
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Simulation</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                  {runtime.simulationRunning ? "Running" : runtime.simulationDirty ? "Dirty" : "Up to date"}
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Last Run</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{lastRunMs ? `${lastRunMs} ms` : "—"}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>AI Policy</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{runtime.aiPolicyLabel}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>AI Provider</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{runtime.aiProviderLabel}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Provider Status</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                  {providerSummary.cloudAvailable ? "Cloud key available" : "Local fallback"}
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Workspace</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{workspaceGovernance.sceneStatus.replace(/_/g, " ")}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Incidents</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{runtime.incidentCount}</div>
              </div>
            </div>
            <div className={`mt-2 space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Access route: {workspaceAccess.policy.mode === "shared" ? "shared workspace" : "single-user workspace"} · {workspaceAccess.members.length} member{workspaceAccess.members.length === 1 ? "" : "s"}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Sensor count: {scene.sensors.length} · Camera failures: {cameraFailures.length} · Auto recompute: {autoRecompute ? "on" : "off"}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {runtime.launchNotice ? runtime.launchNotice : "No launch notices yet. Use the shell or workspace controls to surface an action here."}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Alert routing: {runtime.alerts.summary}
                <div className={`mt-1 ${UI_SURFACES.textSoftDim}`}>
                  {runtime.alerts.statusLabel} · {runtime.alerts.recommendation}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Agent Runtime" icon={<Sparkles className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-2">
              <ProviderConfigPanel
                initialProviderId={aiProviderSelection.providerId}
                initialModel={aiProviderSelection.model}
                onSelectionChange={(selection) => setAiProviderSelection({
                  providerId: selection.providerId as AiProviderSelection["providerId"],
                  model: selection.model,
                })}
              />
              <AgentCoordinatorPanel />
            </div>
          </Section>

          <Section title="Support Bundle" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {supportBundle.title}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Incident snapshot · {supportBundle.incidents.summary}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest incident</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.incidents.latestIncident?.title ?? "None"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest performance trace</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {supportBundle.incidents.latestPerformanceTrace?.title ?? "None"}
                  </div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>AI telemetry trend</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.incidents.aiTelemetry.trendLabel}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Badge variant="gray">{supportBundle.incidents.incidentCount} incidents</Badge>
                <Badge variant="gray">{supportBundle.incidents.performanceTraceCount} traces</Badge>
                <Badge variant="gray">{supportBundle.incidents.stackTraceCount} stack traces</Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>External logs</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.incidents.externalLogCount}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest external log</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.incidents.latestExternalLog?.title ?? "None"}</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Sensor Ingest Archive" icon={<Waves className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                The sensor ingest archive now ships inside the support bundle so live metadata handoff can be reviewed with the rest of the operational evidence.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Archived records</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.sensorIngestArchive.historyCount}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest scene</div>
                  <div className={`mt-0.5 truncate font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.sensorIngestArchive.latestSubmission?.sceneName ?? "No archive yet"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Loading</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{sensorIngestHistoryLoading ? "Yes" : "No"}</div>
                </div>
              </div>
              {sensorIngestHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {sensorIngestHistoryError}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {supportBundle.sensorIngestArchive.recentSubmissions.length > 0 ? supportBundle.sensorIngestArchive.recentSubmissions.map((record) => (
                  <div key={`${record.receivedAt}-${record.storedAt}`} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant="gray">{record.sourceCount} record{record.sourceCount === 1 ? "" : "s"}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.source}</Badge>
                      <Badge variant="gray">{new Date(record.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No sensor ingest archive yet. Paste metadata or pull an external feed in the sensor panel to create the first record.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Camera Live Connection Archive" icon={<Video className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                The live camera connection archive now ships inside the support bundle so ONVIF-style binds and disconnects can be reviewed with the rest of the operational evidence.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Archived records</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.cameraLiveConnectionArchive.historyCount}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest scene</div>
                  <div className={`mt-0.5 truncate font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.cameraLiveConnectionArchive.latestSubmission?.sceneName ?? "No archive yet"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Loading</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{cameraLiveConnectionHistoryLoading ? "Yes" : "No"}</div>
                </div>
              </div>
              {cameraLiveConnectionHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {cameraLiveConnectionHistoryError}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {supportBundle.cameraLiveConnectionArchive.recentSubmissions.length > 0 ? supportBundle.cameraLiveConnectionArchive.recentSubmissions.map((record) => (
                  <div key={`${record.receivedAt}-${record.storedAt}`} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant="gray">{record.protocol.toUpperCase()}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.action}</Badge>
                      <Badge variant="gray">{record.record.liveConnectionStatus}</Badge>
                      <Badge variant="gray">{new Date(record.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No camera live connection archive yet. Bind or disconnect a camera in the inspector to create the first record.
                  </div>
                )}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                The active session registry keeps the current live lease visible so refreshes and expiry are auditable alongside the archive.
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => void refreshCameraLiveSessionHealth()}
                  className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
                >
                  {cameraLiveSessionHealthLoading ? "Refreshing..." : "Refresh Session Health"}
                </button>
              </div>
              {cameraLiveSessionHealthError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {cameraLiveSessionHealthError}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active leases</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{cameraLiveSessionHealth?.totals.active ?? supportBundle.cameraLiveSessionRegistry.activeSessionCount}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Expiring soon</div>
                  <div className={`mt-0.5 truncate font-semibold ${UI_SURFACES.textBody2}`}>{cameraLiveSessionHealth?.totals.expiringSoon ?? 0}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest lease</div>
                  <div className={`mt-0.5 truncate font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.cameraLiveSessionRegistry.latestSession?.cameraName ?? "No active lease"}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {supportBundle.cameraLiveSessionRegistry.activeSessions.length > 0 ? supportBundle.cameraLiveSessionRegistry.activeSessions.map((record) => (
                  <div key={record.sessionId} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{record.cameraName}</div>
                      <Badge variant={record.status === "active" ? "green" : record.status === "expired" ? "red" : "gray"}>{record.status}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.lastAction}</Badge>
                      <Badge variant="gray">{record.liveSessionState ?? "unknown"}</Badge>
                      <Badge variant="gray">{record.sessionId.slice(-8)}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                      Registry expiry: {record.sessionExpiresAt == null ? "—" : new Date(record.sessionExpiresAt).toLocaleTimeString()}
                    </div>
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => void renewCameraLiveSession(record.sessionId)}
                        className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-500/20"
                      >
                        {cameraLiveSessionHealthLoading ? "Renewing..." : "Renew Lease +120s"}
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No active live session lease yet. Bind or refresh a camera in the inspector to create the first lease.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="External Log Capture" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Paste browser console, app server, or device log lines here so the support bundle can carry external log capture alongside the local incident history.
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Review the latest high-priority alert and attach external logs before escalation.
              </div>
              <textarea
                value={externalLogDraft}
                onChange={(event) => setExternalLogDraft(event.target.value)}
                rows={5}
                placeholder="Paste external log lines here..."
                className={`w-full rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-sky-400/40`}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={captureExternalLog}
                  className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
                >
                  Capture External Log
                </button>
                <button
                  type="button"
                  onClick={clearExternalLogEntries}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear External Logs
                </button>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {externalLogEntries.length > 0
                  ? `${externalLogEntries.length} external log capture${externalLogEntries.length === 1 ? "" : "s"} stored locally.`
                  : "No external logs captured yet."}
              </div>
              <div className="space-y-1.5">
                {externalLogEntries.length > 0 ? externalLogEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{entry.title}</div>
                      <Badge variant={entry.severity === "error" ? "red" : entry.severity === "warning" ? "amber" : "blue"}>
                        {entry.source}
                      </Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{entry.details}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                      <Badge variant="gray">{entry.lineCount} lines</Badge>
                      <Badge variant="gray">{entry.severity}</Badge>
                    </div>
                  </div>
                )) : null}
              </div>
            </div>
          </Section>

          <Section title="Sensor Metadata Intake" icon={<Upload className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Paste JSON arrays or newline-delimited JSON sensor records here to convert live metadata into canonical sensor evidence.
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Matching sensor ids or labels are resolved against the current scene before the event trail is updated.
              </div>
              <textarea
                value={sensorMetadataDraft}
                onChange={(event) => {
                  setSensorMetadataDraft(event.target.value);
                  setSensorMetadataError(null);
                  setSensorMetadataStatus(null);
                }}
                rows={5}
                placeholder={`[
  {"sensorId":"sensor_1","kind":"triggered","details":"Door motion detected"},
  {"sensorLabel":"Front Door","kind":"heartbeat"}
]`}
                className={`w-full rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-cyan-400/40`}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={ingestSensorMetadata}
                  className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-100 hover:border-cyan-400/30 hover:bg-cyan-500/20"
                >
                  Import Sensor Metadata
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSensorMetadataDraft("");
                    setSensorMetadataError(null);
                    setSensorMetadataStatus(null);
                  }}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear Draft
                </button>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {sensorMetadataStatus ?? "No live sensor metadata imported yet."}
              </div>
              {sensorMetadataError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {sensorMetadataError}
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Automated Alerting" icon={<TriangleAlert className="h-3 w-3 text-amber-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {supportBundle.alerts.summary}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Alert status</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.alerts.statusLabel}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>High priority</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.alerts.highPriorityCount}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest alert</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportBundle.alerts.latestAlert?.title ?? "None"}</div>
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {supportBundle.alerts.recommendation}
              </div>
              <div className="space-y-1.5">
                {supportBundle.alerts.recentAlerts.length > 0 ? supportBundle.alerts.recentAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{alert.title}</div>
                      <Badge variant={alert.severity === "error" ? "red" : alert.severity === "warning" ? "amber" : "blue"}>
                        {alert.source}
                      </Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{alert.details}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                      <Badge variant="gray">{alert.severity}</Badge>
                      <Badge variant="gray">{alert.category}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No alert candidates yet.
                  </div>
                )}
              </div>
            </div>
            <div className={`mt-2 space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Remote Support Ingest
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Send to Ingest routes the same incident and external-log payload through the local alert router so the support handoff can be tested against a backend-shaped endpoint.
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={sendSupportBundleToIngest}
                  className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
                >
                  {supportIngestLoading ? "Sending Ingest..." : "Send to Ingest"}
                </button>
                <button
                  type="button"
                  onClick={() => setSupportIngestReport(null)}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear Ingest Result
                </button>
              </div>
              {supportIngestError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {supportIngestError}
                </div>
              ) : null}
              {supportIngestReport ? (
                <div className="space-y-1.5">
                  <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                    {supportIngestReport.summary}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Ingest status</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.routing.statusLabel}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Alert candidates</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.routing.alertCount}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest routed</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.routing.latestAlert?.title ?? "None"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Ingest source</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.source}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Received at</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.receivedAt}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Telemetry events</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportIngestReport.counts.telemetryEvents}</div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                <div>Support Ingest History</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="gray">{remoteSupportIngestHistory.length > 0 ? "server archive" : "local cache"}</Badge>
                  <button
                    type="button"
                    onClick={() => void refreshSupportIngestArchive()}
                    className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                  >
                    {remoteSupportIngestHistoryLoading ? "Refreshing..." : "Refresh Archive"}
                  </button>
                </div>
              </div>
              {remoteSupportIngestHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {remoteSupportIngestHistoryError}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={clearSupportIngestHistory}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear Ingest History
                </button>
              </div>
              <div className="space-y-1.5">
                {(remoteSupportIngestHistory.length > 0 ? remoteSupportIngestHistory : supportIngestHistory).length > 0 ? (remoteSupportIngestHistory.length > 0 ? remoteSupportIngestHistory : supportIngestHistory).slice(0, 3).map((record) => (
                  <div key={`${record.receivedAt}-${record.sceneId ?? "scene"}-${record.storedAt}`} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant={record.routing.statusLabel === "attention" ? "amber" : record.routing.statusLabel === "watch" ? "blue" : "green"}>
                        {record.routing.statusLabel}
                      </Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.routing.alertCount} alerts</Badge>
                      <Badge variant="gray">{record.counts.externalLogs} logs</Badge>
                      <Badge variant="gray">{record.counts.telemetryEvents} telemetry</Badge>
                      <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No support ingest history yet. Send a bundle to ingest to keep the routed handoff visible over time.
                  </div>
                )}
              </div>
              <div className={`mt-2 rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Remote Support Delivery
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Dispatch the latest routed support payload into the delivery queue so fan-out targets can be verified against a canonical archive.
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Paste a remote webhook URL to exercise actual fan-out. Leave it blank to keep the run local and queued.
              </div>
              <input
                type="url"
                value={supportDeliveryEndpointDraft}
                onChange={(event) => setSupportDeliveryEndpointDraft(event.target.value)}
                placeholder="https://example.com/support-webhook"
                className={`w-full rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-sky-400/40`}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={dispatchSupportDelivery}
                  className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
                >
                  {supportDeliveryLoading ? "Dispatching..." : "Dispatch Support"}
                </button>
                <button
                  type="button"
                  onClick={() => setSupportDeliveryReport(null)}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  Clear Delivery Result
                </button>
                <button
                  type="button"
                  onClick={() => void refreshSupportDeliveryArchive()}
                  className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
                >
                  {remoteSupportDeliveryHistoryLoading ? "Refreshing..." : "Refresh Delivery Archive"}
                </button>
              </div>
              {supportDeliveryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {supportDeliveryError}
                </div>
              ) : null}
              {supportDeliveryReport ? (
                <div className="space-y-1.5">
                  <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                    {supportDeliveryReport.summary}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Delivery status</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportDeliveryReport.archiveStatus}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Delivered</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportDeliveryReport.deliveredCount}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Queued</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportDeliveryReport.queuedCount}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Failed</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{supportDeliveryReport.failedCount}</div>
                    </div>
                  </div>
                </div>
              ) : null}
              {remoteSupportDeliveryHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {remoteSupportDeliveryHistoryError}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {remoteSupportDeliveryHistory.length > 0 ? remoteSupportDeliveryHistory.slice(0, 3).map((record) => (
                  <div key={`${record.receivedAt}-${record.historyId}-${record.storedAt}`} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant={record.archiveStatus === "server archive" ? "green" : "amber"}>{record.archiveStatus}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.deliveredCount} delivered</Badge>
                      <Badge variant="gray">{record.queuedCount} queued</Badge>
                      <Badge variant="gray">{record.failedCount} failed</Badge>
                      <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No support delivery archive yet. Dispatch a routed support payload to create the fan-out history.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Trust Audit" icon={<ShieldAlert className="h-3 w-3 text-amber-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                {trustAuditReport
                  ? `${trustAuditReport.ok ? "PASS" : "FAIL"} · ${trustAuditReport.issues.length} issue${trustAuditReport.issues.length === 1 ? "" : "s"}`
                  : "Run the truth audit to check visible claim surfaces against the product manifest."}
              </div>
              {trustAuditError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {trustAuditError}
                </div>
              ) : null}
              {trustAuditReport ? (
                <div className="space-y-1.5">
                  {trustAuditReport.surfaces.map((surface) => (
                    <div key={surface.surface} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{surface.surface}</div>
                        <Badge variant={surface.status === "pass" ? "green" : "red"}>{surface.status}</Badge>
                      </div>
                      <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{surface.file}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {surface.missingRequiredPhrases.length > 0 ? (
                          <Badge variant="red">{surface.missingRequiredPhrases.length} missing</Badge>
                        ) : null}
                        {surface.forbiddenMatches.length > 0 ? (
                          <Badge variant="amber">{surface.forbiddenMatches.length} forbidden</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <details className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <summary className={`cursor-pointer text-[10px] font-semibold ${UI_SURFACES.textBright}`}>View audit report</summary>
                    <pre className={`mt-1 whitespace-pre-wrap break-words text-[9px] leading-4 ${UI_SURFACES.textSoftBright}`}>
                      {trustAuditReport.formatted}
                    </pre>
                  </details>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Provider Governance" icon={<Sparkles className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
            <div className="grid grid-cols-2 gap-1.5">
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active provider</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.activeProviderLabel}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active model</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.activeModel}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Local-only policy</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.localOnlyMode ? "Enabled" : "Disabled"}</div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Cloud availability</div>
                <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.cloudAvailable ? "Available" : "Unavailable"}</div>
              </div>
            </div>
            <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
              <div className="flex items-center justify-between">
                <span className={`${UI_SURFACES.textDimMid} uppercase tracking-[0.18em]`}>Fallback order</span>
                <span className={`font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.fallbackOrder.map((entry) => entry.name).join(" → ")}</span>
              </div>
              <div className={`mt-1 ${UI_SURFACES.textSoftBright}`}>
                Cloud-backed parsing and fix proposals follow this order when policy allows. Local-only mode keeps the same order visible but blocks cloud calls.
              </div>
            </div>
            <div className="space-y-1.5">
              {providerGovernance.fallbackOrder.map((entry) => (
                <div key={entry.providerId} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{entry.name}</div>
                    <Badge variant={entry.isActive ? "green" : entry.available ? "blue" : "gray"}>
                      {entry.isActive ? "Active" : entry.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{entry.model}</Badge>
                    <Badge variant="gray">{entry.envKey}</Badge>
                    <Badge variant={entry.available ? "green" : "gray"}>{entry.available ? "API key present" : "API key missing"}</Badge>
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{entry.label}</div>
                </div>
              ))}
            </div>
            </div>
          </Section>

          <Section title="Provider Governance History" icon={<Sparkles className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Provider selection and local-only policy changes are persisted as a governance history so the AI control plane can be audited over time instead of only at the current snapshot.
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => recordAiProviderGovernanceSnapshot("manual", "Captured from Debug panel.")}
                  className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted4} transition-colors hover:border-emerald-500/30 hover:text-emerald-200}`}
                >
                  Capture snapshot
                </button>
                <button
                  type="button"
                  onClick={clearAiProviderGovernanceHistory}
                  className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted4} transition-colors hover:border-rose-500/30 hover:text-rose-200}`}
                >
                  Clear history
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Snapshots</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{aiProviderGovernanceHistory.length}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest source</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{aiProviderGovernanceHistory[0]?.source ?? "none"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest observed</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiProviderGovernanceHistory[0]
                      ? new Date(aiProviderGovernanceHistory[0].observedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>
              </div>
              {aiProviderGovernanceHistory[0] ? (
                <div className={`rounded-md border px-2 py-1 ${aiProviderGovernanceHistory[0].activeProviderLabel === providerGovernance.activeProviderLabel && aiProviderGovernanceHistory[0].localOnlyMode === providerGovernance.localOnlyMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                  {aiProviderGovernanceHistory[0].activeProviderLabel === providerGovernance.activeProviderLabel && aiProviderGovernanceHistory[0].localOnlyMode === providerGovernance.localOnlyMode
                    ? "Current provider policy matches the latest captured snapshot."
                    : "Current provider policy differs from the latest captured snapshot."}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {aiProviderGovernanceHistory.length > 0 ? aiProviderGovernanceHistory.slice(0, 4).map((snapshot) => (
                  <div key={snapshot.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{snapshot.activeProviderLabel}</div>
                        <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                          {new Date(snapshot.observedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <Badge variant={snapshot.localOnlyMode ? "amber" : "green"}>{snapshot.source}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{snapshot.activeModel}</Badge>
                      <Badge variant="gray">{snapshot.cloudAvailable ? "cloud" : "local"}</Badge>
                      <Badge variant="gray">{snapshot.fallbackOrder.length} providers</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                      {snapshot.note ?? "Provider governance snapshot captured from the live selection state."}
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No provider governance snapshots yet. Capture one to start the control-plane trail.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Provider Health Dashboard" icon={<ShieldAlert className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Cross-provider health is summarized here so the active provider, fallback readiness, and local-only posture stay visible alongside the model eval gate.
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Overall</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerHealth.overallStatus}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Healthy</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerHealth.healthyProviders}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Partial</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerHealth.partialProviders}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Blocked</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerHealth.blockedProviders}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {providerHealth.providers.map((provider) => (
                  <div key={provider.providerId} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{provider.name}</div>
                      <Badge variant={provider.status === "healthy" ? "green" : provider.status === "partial" ? "amber" : "red"}>
                        {provider.active ? "Active" : provider.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{provider.model}</Badge>
                      <Badge variant="gray">{provider.envKey}</Badge>
                      <Badge variant={provider.available ? "green" : "gray"}>{provider.available ? "API key present" : "API key missing"}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{provider.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Cost / Latency Policy" icon={<TimerReset className="h-3 w-3 text-amber-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Estimated provider cost and latency are summarized here against the stage policy thresholds for command parsing, counterfactuals, report generation, and AI layout drafting.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active cost</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerTelemetry.activeCostLabel}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active latency</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerTelemetry.activeLatencyLabel}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Budget status</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerTelemetry.overallStatus}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Policy note</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerTelemetry.stagePolicies.find((stage) => stage.stage === "draft")?.note ?? "—"}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {providerTelemetry.stagePolicies.map((stage) => (
                  <div key={stage.stage} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{stage.label}</div>
                      <Badge variant={stage.ready ? "green" : "amber"}>{stage.ready ? "Ready" : "Guarded"}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{stage.maxCostTier} max cost</Badge>
                      <Badge variant="gray">{stage.maxLatencyTier} max latency</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{stage.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Telemetry Policy" icon={<TimerReset className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Tune the AI telemetry windows and regression thresholds that drive the short-window trend and longer-horizon policy summary below.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Recent window</div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={aiTelemetryPolicy.recentWindowSize}
                    onChange={(event) => setAiTelemetryPolicy({ recentWindowSize: parseTelemetryPolicyInteger(event.target.value, aiTelemetryPolicy.recentWindowSize, 1) })}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[10px] ${UI_SURFACES.textBright} outline-none transition-colors focus:border-cyan-500/60`}
                  />
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Baseline window</div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={aiTelemetryPolicy.baselineWindowSize}
                    onChange={(event) => setAiTelemetryPolicy({ baselineWindowSize: parseTelemetryPolicyInteger(event.target.value, aiTelemetryPolicy.baselineWindowSize, 1) })}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[10px] ${UI_SURFACES.textBright} outline-none transition-colors focus:border-cyan-500/60`}
                  />
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Duration threshold</div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={aiTelemetryPolicy.durationDeltaThresholdMs}
                    onChange={(event) => setAiTelemetryPolicy({ durationDeltaThresholdMs: parseTelemetryPolicyInteger(event.target.value, aiTelemetryPolicy.durationDeltaThresholdMs, 0) })}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[10px] ${UI_SURFACES.textBright} outline-none transition-colors focus:border-cyan-500/60`}
                  />
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Token threshold</div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={aiTelemetryPolicy.tokenDeltaThreshold}
                    onChange={(event) => setAiTelemetryPolicy({ tokenDeltaThreshold: parseTelemetryPolicyInteger(event.target.value, aiTelemetryPolicy.tokenDeltaThreshold, 0) })}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[10px] ${UI_SURFACES.textBright} outline-none transition-colors focus:border-cyan-500/60`}
                  />
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5 col-span-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Success-rate threshold</div>
                      <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textNearAlt}`}>Shown as a fraction in storage, but displayed here as {formatMultiplier(aiTelemetryPolicy.successRateDeltaThreshold)}.</div>
                    </div>
                    <button
                      type="button"
                      onClick={resetAiTelemetryPolicy}
                      className={`rounded-md border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[9px] font-semibold ${UI_SURFACES.textBody2} transition-colors hover:border-cyan-500/50 hover:text-white`}
                    >
                      Reset telemetry policy
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    inputMode="decimal"
                    value={aiTelemetryPolicy.successRateDeltaThreshold}
                    onChange={(event) => setAiTelemetryPolicy({ successRateDeltaThreshold: parseTelemetryPolicyFloat(event.target.value, aiTelemetryPolicy.successRateDeltaThreshold, 0, 1) })}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderDarkAlt} ${UI_SURFACES.panel} px-2 py-1 text-[10px] ${UI_SURFACES.textBright} outline-none transition-colors focus:border-cyan-500/60`}
                  />
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textNearAlt}`}>
                Recent window: {aiTelemetryPolicy.recentWindowSize} · Baseline window: {aiTelemetryPolicy.baselineWindowSize} · Duration delta: {aiTelemetryPolicy.durationDeltaThresholdMs} ms · Token delta: {aiTelemetryPolicy.tokenDeltaThreshold} tokens · Success delta: {formatMultiplier(aiTelemetryPolicy.successRateDeltaThreshold)}
              </div>
            </div>
          </Section>

          <Section title="AI Action Telemetry" icon={<TimerReset className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Recent measured AI actions are recorded with wall-clock duration and estimated token usage so point-of-use telemetry can show actual latency instead of only policy classes. The summary below compares those runs against the editable telemetry policy above.
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Events</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{aiActionTelemetrySummary.totalEvents}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest stage</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{aiActionTelemetry[0]?.stage ?? "—"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Trend</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiActionTelemetrySummary.trendLabel}
                  </div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Policy</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{aiActionTelemetrySummary.policyLabel}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Policy window</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiActionTelemetrySummary.policy.recentWindowSize} recent · {aiActionTelemetrySummary.policy.baselineWindowSize} baseline
                  </div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Policy thresholds</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiActionTelemetrySummary.policy.durationDeltaThresholdMs} ms · {aiActionTelemetrySummary.policy.tokenDeltaThreshold} tokens · {formatMultiplier(aiActionTelemetrySummary.policy.successRateDeltaThreshold)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Recent avg</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiActionTelemetrySummary.recentWindow
                      ? `${aiActionTelemetrySummary.recentWindow.averageDurationMs} ms · ~${aiActionTelemetrySummary.recentWindow.averageTokens} tokens`
                      : "—"}
                  </div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Long-horizon avg</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {aiActionTelemetrySummary.longHorizonWindow
                      ? `${aiActionTelemetrySummary.longHorizonWindow.averageDurationMs} ms · ~${aiActionTelemetrySummary.longHorizonWindow.averageTokens} tokens`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textNearAlt}`}>
                {aiActionTelemetrySummary.trendNote}
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textNearAlt}`}>
                {aiActionTelemetrySummary.policyNote}
              </div>
              <div className="space-y-1.5">
                {aiActionTelemetry.length > 0 ? aiActionTelemetry.slice(0, 4).map((entry) => (
                  <div key={entry.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>
                        {entry.stage.replace(/_/g, " ")}
                        {entry.promptTitle ? <span className={`${UI_SURFACES.textSoftBright}`}> · {entry.promptTitle}</span> : null}
                      </div>
                      <Badge variant={entry.status === "success" ? "green" : "red"}>{entry.durationMs} ms</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{entry.providerLabel}</Badge>
                      <Badge variant="gray">{entry.tokenSource}</Badge>
                      <Badge variant="gray">~{entry.estimatedTotalTokens} tokens</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {entry.promptId ? <Badge variant="gray">{entry.promptId}</Badge> : <Badge variant="gray">Prompt lineage missing</Badge>}
                      {entry.promptVersion ? <Badge variant="gray">{entry.promptVersion}</Badge> : null}
                      {entry.promptAgent ? <Badge variant="gray">{entry.promptAgent}</Badge> : null}
                      {entry.promptOutputSchema ? <Badge variant="gray">{entry.promptOutputSchema}</Badge> : null}
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{entry.note ?? "Measured at the AI action surface."}</div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No measured AI actions yet.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Prompt Registry" icon={<Layers3 className="h-3 w-3 text-emerald-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Canonical prompt definitions are shared by the command, counterfactual, report, and draft agents so the same prompt version can be audited and replayed.
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => recordPromptRegistrySnapshot("manual", "Captured from Debug panel.")}
                  className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted4} transition-colors hover:border-emerald-500/30 hover:text-emerald-200}`}
                >
                  Capture snapshot
                </button>
                <button
                  type="button"
                  onClick={clearPromptRegistryHistory}
                  className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted4} transition-colors hover:border-rose-500/30 hover:text-rose-200}`}
                >
                  Clear history
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Prompt count</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{promptRegistrySummary.total}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest version</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{promptRegistrySummary.latestVersion}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Registry digest</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {promptRegistrySummary.registryDigest.slice(0, 18)}…
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Stage map</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {Object.entries(promptRegistrySummary.stages).map(([stage, count]) => `${stage}:${count}`).join(" · ")}
                  </div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Last observed</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {latestModelEvalRun?.promptRegistry
                      ? new Date(latestModelEvalRun.promptRegistry.observedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "No eval snapshot yet"}
                  </div>
                </div>
              </div>
              {latestModelEvalRun?.promptRegistry ? (
                <div className={`rounded-md border px-2 py-1 ${latestModelEvalRun.promptRegistry.registryDigest === promptRegistrySummary.registryDigest ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                  {latestModelEvalRun.promptRegistry.registryDigest === promptRegistrySummary.registryDigest
                    ? "Live code matches the most recently recorded prompt-registry snapshot."
                    : "Live code differs from the most recently recorded prompt-registry snapshot."}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {PROMPT_REGISTRY.map((entry) => (
                  <div key={entry.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{entry.title}</div>
                        <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>{entry.agent}</div>
                      </div>
                      <Badge variant="gray">{entry.version}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{entry.stage}</Badge>
                      <Badge variant="gray">{entry.outputSchema}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{entry.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Prompt Registry History" icon={<TimerReset className="h-3 w-3 text-cyan-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Each snapshot records the canonical prompt registry digest at a point in time so prompt edits and eval runs can be audited as a durable history, not just a current table.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Snapshots</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{promptRegistryHistory.length}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest source</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{promptRegistryHistory[0]?.source ?? "none"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Latest observed</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>
                    {promptRegistryHistory[0]
                      ? new Date(promptRegistryHistory[0].observedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>
              </div>
              {promptRegistryHistory[0] ? (
                <div className={`rounded-md border px-2 py-1 ${promptRegistryHistory[0].registryDigest === promptRegistrySummary.registryDigest ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                  {promptRegistryHistory[0].registryDigest === promptRegistrySummary.registryDigest
                    ? "Current prompt registry matches the latest captured snapshot."
                    : "Current prompt registry differs from the latest captured snapshot."}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {promptRegistryHistory.length > 0 ? promptRegistryHistory.slice(0, 4).map((snapshot) => (
                  <div key={snapshot.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{snapshot.latestVersion}</div>
                        <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                          {new Date(snapshot.observedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <Badge variant="gray">{snapshot.source}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{snapshot.total} prompts</Badge>
                      <Badge variant="gray">{snapshot.registryDigest.slice(0, 12)}…</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                      {snapshot.note ?? "Registry snapshot captured from the live prompt definitions."}
                    </div>
                  </div>
                )) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No registry snapshots yet. Capture one to start the governance trail.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Model Eval Suite" icon={<RefreshCw className="h-3 w-3 text-emerald-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Gates prompt changes, provider swaps, and stage selection against canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting.
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Canonical fixtures: Heuristic Layout Baseline, Command Parse, Counterfactual Candidates, Report Generation, Model Layout Draft.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active provider</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.activeProviderLabel}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Cloud availability</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.cloudAvailable ? "Available" : "Unavailable"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Local-only</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.localOnlyMode ? "Enabled" : "Disabled"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Fallback order</div>
                  <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{providerGovernance.fallbackOrder.length} providers</div>
                </div>
              </div>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Budget Policy</span>
                  <Badge variant={currentModelEvalRecord?.stageBudget.met ? "green" : "amber"}>
                    {currentModelEvalRecord?.stageBudget.modeLabel ?? "Awaiting first run"}
                  </Badge>
                </div>
                <div className={`mt-1 ${UI_SURFACES.textSoftBright}`}>
                  {currentModelEvalRecord ? (
                    <>
                      {currentModelEvalRecord.stageBudget.expectedPasses} expected passes · {currentModelEvalRecord.stageBudget.expectedSkips} expected skips · {currentModelEvalRecord.stageBudget.maxFailures} max failures.
                    </>
                  ) : (
                    "Run the suite once to establish the active stage budget."
                  )}
                </div>
                {currentModelEvalRecord ? (
                  <div className={`mt-1 ${UI_SURFACES.textSoftBright}`}>{currentModelEvalRecord.stageBudget.note}</div>
                ) : null}
              </div>
              {modelEvalError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {modelEvalError}
                </div>
              ) : null}
              {modelEvalReport ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Fixtures</div>
                      <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalReport.summary.total}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Pass</div>
                      <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalReport.summary.passed}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Fail</div>
                      <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalReport.summary.failed}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Skip</div>
                      <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalReport.summary.skipped}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {modelEvalReport.fixtures.map((fixture) => (
                      <div key={fixture.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{fixture.label}</div>
                            <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>{fixture.summary}</div>
                          </div>
                          <Badge
                            variant={
                              fixture.status === "pass"
                                ? "green"
                                : fixture.status === "skip"
                                  ? "gray"
                                  : "red"
                            }
                          >
                            {fixture.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="gray">{fixture.kind}</Badge>
                          <Badge variant="gray">{fixture.durationMs} ms</Badge>
                        </div>
                        <div className={`mt-1 rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1 text-[9px] ${UI_SURFACES.textNearAlt}`}>
                          <div className={`${UI_SURFACES.textDimMid}`}>Prompt</div>
                          <div>{fixture.prompt}</div>
                        </div>
                        <div className={`mt-1 rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1 text-[9px] ${UI_SURFACES.textNearAlt}`}>
                          <div className={`${UI_SURFACES.textDimMid}`}>Output preview</div>
                          <div className="whitespace-pre-wrap">{fixture.outputPreview}</div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {fixture.checks.map((check) => (
                            <Badge key={`${fixture.id}-${check.label}`} variant={check.passed ? "green" : "red"}>
                              {check.label}
                            </Badge>
                          ))}
                        </div>
                        <div className={`mt-1 space-y-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                          {fixture.checks.map((check) => (
                            <div key={`${fixture.id}-${check.label}-detail`} className="flex items-start gap-1.5">
                              <span className={check.passed ? "text-emerald-300" : "text-rose-300"}>{check.passed ? "✓" : "!"}</span>
                              <span>{check.detail}</span>
                            </div>
                          ))}
                          {fixture.skippedReason ? (
                            <div className="text-[#f2c97d]">{fixture.skippedReason}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                  Run the suite to compare structured outputs against the current provider/model choice.
                </div>
              )}
            </div>
          </Section>

          <Section title="Model Eval History" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
            <div className={`space-y-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
              <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1`}>
                Historical runs stay in local storage so provider swaps, prompt edits, and stage budgets can be compared across sessions.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Recent runs</div>
                  <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalHistory.length}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Historical comparison</div>
                  <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>{modelEvalComparison?.trendLabel ?? "No comparison yet"}</div>
                </div>
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Trend</div>
                  <div className={`mt-0.5 text-[13px] font-semibold ${UI_SURFACES.textBright}`}>
                    {modelEvalComparison ? `${modelEvalComparison.deltaFailed <= 0 ? "Healthy" : "Needs attention"}` : "Awaiting history"}
                  </div>
                </div>
              </div>
              {modelEvalComparison ? (
                <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Run Delta</span>
                    <Badge variant={modelEvalComparison.deltaFailed > 0 ? "red" : "green"}>{modelEvalComparison.trendLabel}</Badge>
                  </div>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Pass delta</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{modelEvalComparison.deltaPassed >= 0 ? `+${modelEvalComparison.deltaPassed}` : modelEvalComparison.deltaPassed}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Fail delta</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{modelEvalComparison.deltaFailed >= 0 ? `+${modelEvalComparison.deltaFailed}` : modelEvalComparison.deltaFailed}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Skip delta</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{modelEvalComparison.deltaSkipped >= 0 ? `+${modelEvalComparison.deltaSkipped}` : modelEvalComparison.deltaSkipped}</div>
                    </div>
                    <div className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.panel} px-2 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Duration delta</div>
                      <div className={`mt-0.5 font-semibold ${UI_SURFACES.textBody2}`}>{modelEvalComparison.deltaTotalDurationMs >= 0 ? `+${modelEvalComparison.deltaTotalDurationMs}` : modelEvalComparison.deltaTotalDurationMs} ms</div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                {modelEvalHistory.length > 0 ? modelEvalHistory.slice(0, 3).map((run, index) => {
                  const previous = modelEvalHistory[index + 1] ?? null;
                  const runComparison = previous ? compareModelEvalRuns(previous, run) : null;
                  return (
                    <div key={`${run.generatedAt}-${run.providerId}-${index}`} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{run.providerLabel}</div>
                          <div className={`mt-0.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                            {new Date(run.generatedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <Badge variant={run.stageBudget.met ? "green" : "amber"}>
                          {run.stageBudget.met ? "Within budget" : "Budget drift"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="gray">{run.model}</Badge>
                        <Badge variant="gray">{run.promptRegistry.latestVersion}</Badge>
                        <Badge variant="gray">{run.localOnlyMode ? "Local-only" : "Cloud-backed"}</Badge>
                        <Badge variant="gray">{run.summary.passed} pass</Badge>
                        <Badge variant="gray">{run.summary.failed} fail</Badge>
                        <Badge variant="gray">{run.summary.skipped} skip</Badge>
                      </div>
                      <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                        {run.stageBudget.modeLabel}: {run.stageBudget.expectedPasses} expected pass(es), {run.stageBudget.expectedSkips} expected skip(s).
                      </div>
                      <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                        Prompt registry snapshot {run.promptRegistry.latestVersion} · {run.promptRegistry.total} prompt(s) · {run.promptRegistry.registryDigest.slice(0, 12)}…
                      </div>
                      {runComparison ? (
                        <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                          Compared with the previous run: {runComparison.trendLabel}; fail delta {runComparison.deltaFailed >= 0 ? "+" : ""}{runComparison.deltaFailed}; duration delta {runComparison.deltaTotalDurationMs >= 0 ? "+" : ""}{runComparison.deltaTotalDurationMs} ms.
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                    No historical model eval runs yet. Run the suite to start the comparison log.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Journey Health" icon={<RefreshCw className="h-3 w-3 text-cyan-400" />}>
            <div className="grid grid-cols-1 gap-1.5">
              {runtime.journeyHealth.map((journey) => (
                <div key={journey.kind} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{journey.label}</div>
                    <Badge
                      variant={
                        journey.status === "healthy"
                          ? "green"
                          : journey.status === "working"
                            ? "blue"
                            : journey.status === "dirty"
                              ? "amber"
                        : journey.status === "warning"
                                ? "amber"
                                : journey.status === "blocked"
                                  ? "red"
                                  : "gray"
                      }
                    >
                      {journey.status}
                    </Badge>
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{journey.detail}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Runtime Trace" icon={<TriangleAlert className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5">
              {runtime.recentTrace.length > 0 ? runtime.recentTrace.map((entry) => (
                <div key={entry.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{entry.title}</div>
                    <Badge variant="gray">{entry.kind}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    {entry.branchLabel ? <Badge variant="gray">{entry.branchLabel}</Badge> : null}
                    {entry.lifecycleStage ? <Badge variant="gray">{entry.lifecycleStage}</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                  No runtime trace entries yet. Trigger import, scan, AI, save, render, or publish actions to populate this view.
                </div>
              )}
            </div>
          </Section>

          <Section title="Incident Log" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className={`text-[9px] ${UI_SURFACES.textSoftBright}`}>
                {runtime.incidentCount > 0
                  ? `${runtime.incidentCount} runtime incident${runtime.incidentCount === 1 ? "" : "s"} recorded`
                  : "No runtime incidents recorded yet."}
              </div>
              <button
                type="button"
                onClick={clearRuntimeIncidents}
                className={`rounded-md border ${UI_SURFACES.borderSubtleAlt2} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderDark} hover:text-white`}
              >
                Clear Incidents
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {runtime.recentIncidents.length > 0 ? runtime.recentIncidents.map((incident) => (
                <div key={incident.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{incident.title}</div>
                    <Badge
                      variant={
                        incident.severity === "error"
                          ? "red"
                          : incident.severity === "warning"
                            ? "amber"
                            : "blue"
                      }
                    >
                      {incident.category}
                    </Badge>
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{incident.details}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(incident.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    <Badge variant="gray">{incident.severity}</Badge>
                    {incident.action ? <Badge variant="gray">{incident.action}</Badge> : null}
                    {incident.durationMs !== null ? <Badge variant="gray">{incident.durationMs} ms</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                  No incidents yet. Open the command bar, trigger a validation error, or run a simulation to populate the log.
                </div>
              )}
            </div>
          </Section>

          <Section title="Performance Trace" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5">
              {runtime.performanceTraces.length > 0 ? runtime.performanceTraces.map((trace) => (
                <div key={trace.id} className={`rounded-md border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{trace.title}</div>
                    <Badge variant="gray">{trace.durationMs !== null ? `${trace.durationMs} ms` : "trace"}</Badge>
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textSoftBright}`}>{trace.details}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(trace.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    {trace.action ? <Badge variant="gray">{trace.action}</Badge> : null}
                    {trace.path ? <Badge variant="gray">{trace.path}</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className={`rounded-md border border-dashed ${UI_SURFACES.borderMidAlt} ${UI_SURFACES.panel} px-3 py-3 text-[10px] ${UI_SURFACES.textSoftDim}`}>
                  No performance traces yet. Run a simulation, save a snapshot, or finish a scan import to record one.
                </div>
              )}
            </div>
          </Section>
        </div>

        <Section title="Layer Visibility" icon={<Waves className="h-3 w-3 text-sky-400" />}>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4">
            {[
              ["cameras", "Cameras"],
              ["camera_cones", "Camera Cones"],
              ["obstructions", "Obstructions"],
              ["lights", "Lights"],
              ["critical_zones", "Critical Zones"],
              ["privacy_zones", "Privacy Zones"],
              ["paths", "Paths"],
              ["heatmap", "Heatmap"],
              ["grid", "Grid"],
              ["walls_floors", "Walls & Floors"],
              ["labels", "Labels"],
            ].map(([layerId, label]) => (
              <button
                key={layerId}
                type="button"
                onClick={() => toggleLayer(layerId as keyof typeof layers)}
                className={`rounded-md border px-2 py-1.5 text-left text-[9px] transition-colors ${
                  layers[layerId as keyof typeof layers]
                    ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
                    : "border-[#1e2030] ${UI_SURFACES.bgDeep} ${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverBorderDark} hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
