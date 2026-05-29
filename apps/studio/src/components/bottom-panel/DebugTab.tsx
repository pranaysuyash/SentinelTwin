"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BadgeInfo, Database, Layers3, RefreshCw, ShieldAlert, Sparkles, TimerReset, TriangleAlert, Upload, Video, Waves } from "lucide-react";

import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { Badge } from "@/components/shared/Badge";
import { buildDiagnosticBundle, buildSupportBundle, stringifyDiagnosticBundle, stringifySupportBundle } from "@/lib/diagnostic-bundle";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
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
import {
  assessOperationalEvidenceMergeReadiness,
  compareOperationalEvidenceBranches,
} from "@/lib/operational-evidence";
import {
  createModelProvider,
  describeAiProviderGovernance,
  describeAiProviderHealth,
  describeAiProviderSelection,
  describeAiProviderTelemetry,
} from "@/agents/provider-selection";
import {
  compareModelEvalRuns,
  runModelEvalSuite,
  summarizeModelEvalRun,
  type ModelEvalSuiteResult,
} from "@/agents/model-eval";
import { PROMPT_REGISTRY, summarizePromptRegistry } from "@/agents/prompt-registry";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import { parseSensorLiveFeed } from "@/lib/sensor-live-ingest";
import type { SupportDeliveryArchiveRecord, SupportDeliveryResponse } from "@/lib/support-delivery";
import type { SupportIngestResponse } from "@/lib/support-ingest";
import type { SupportIngestHistoryRecord } from "@/lib/support-ingest-history";
import type { TrustAuditReport } from "@/lib/truth-audit";
import { OPERATIONAL_EVIDENCE_STORAGE_KEY, useStudioStore } from "@/store/studio-store";

const OVERLAY_DENSITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
] as const;

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
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
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
          : "border-[#1e2130] bg-[#0f141f] text-[#8090a8] hover:border-[#2a3245] hover:text-white"
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
  const cameraFailures = useStudioStore((s) => s.cameraFailures);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const launchNotice = useStudioStore((s) => s.launchNotice);
  const clearAllCameraFailures = useStudioStore((s) => s.clearAllCameraFailures);
  const clearRuntimeIncidents = useStudioStore((s) => s.clearRuntimeIncidents);
  const sceneIntelligenceGraph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const assumptions = useStudioStore((s) => s.scene.assumptions);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const layers = useStudioStore((s) => s.layerVisibility);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
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
  const recordSupportIngestResponse = useStudioStore((s) => s.recordSupportIngestResponse);
  const clearSupportIngestHistory = useStudioStore((s) => s.clearSupportIngestHistory);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingArchive, setPendingArchive] = useState<OperationalEvidenceArchive | null>(null);
  const [pendingArchiveError, setPendingArchiveError] = useState<string | null>(null);
  const [archiveRestoreBranch, setArchiveRestoreBranch] = useState<"draft" | "recovered" | "published">("recovered");
  const [externalLogDraft, setExternalLogDraft] = useState("");
  const [trustAuditReport, setTrustAuditReport] = useState<TrustAuditReport | null>(null);
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
  const [cameraLiveConnectionHistoryLoading, setCameraLiveConnectionHistoryLoading] = useState(false);
  const [cameraLiveConnectionHistoryError, setCameraLiveConnectionHistoryError] = useState<string | null>(null);
  const modelEvalHistory = useStudioStore((s) => s.modelEvalHistory);
  const recordModelEvalRun = useStudioStore((s) => s.recordModelEvalRun);
  const clearModelEvalHistory = useStudioStore((s) => s.clearModelEvalHistory);
  const recordExternalLogEntry = useStudioStore((s) => s.recordExternalLogEntry);
  const clearExternalLogEntries = useStudioStore((s) => s.clearExternalLogEntries);
  const recordSensorEvent = useStudioStore((s) => s.recordSensorEvent);
  const providerSummary = describeAiProviderSelection(aiProviderSelection);
  const providerGovernance = describeAiProviderGovernance(aiProviderSelection, localOnlyMode);
  const providerHealth = describeAiProviderHealth(aiProviderSelection, localOnlyMode);
  const providerTelemetry = describeAiProviderTelemetry(aiProviderSelection, localOnlyMode);
  const promptRegistrySummary = summarizePromptRegistry();
  const aiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry);
  const aiActionTelemetrySummary = useMemo(() => summarizeAiActionTelemetry(aiActionTelemetry), [aiActionTelemetry]);

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
      };
      setCameraLiveConnectionHistory(payload.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera live connection archive failed.";
      setCameraLiveConnectionHistoryError(message);
    } finally {
      setCameraLiveConnectionHistoryLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await refreshSupportIngestArchive();
      await refreshSupportDeliveryArchive();
      await refreshCameraLiveConnectionArchive();
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
        };
        if (!active) return;
        setCameraLiveConnectionHistory(payload.history);
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
  }, [operationalEvidenceEvents]);

  const diagnosticBundle = useMemo(
    () =>
      buildDiagnosticBundle({
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
        workspaceGovernance,
        overlayDensity,
        simulationDirty,
        simulationRunning,
        localOnlyMode,
        sceneIntelligenceGraph,
        showDebugOverlays,
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

  const runTrustAudit = async () => {
    setTrustAuditLoading(true);
    setTrustAuditError(null);
    try {
      const response = await fetch("/api/truth-audit");
      if (!response.ok) {
        throw new Error(`Trust audit failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as TrustAuditReport & { formatted: string };
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
      const provider = providerGovernance.cloudAvailable
        ? createModelProvider(aiProviderSelection)
        : ({
            name: providerGovernance.activeProviderName.toLowerCase(),
            async complete() {
              throw new Error("Cloud-backed provider unavailable.");
            },
            async *completeStreaming() {
              throw new Error("Cloud-backed provider unavailable.");
            },
            async completeStructured() {
              throw new Error("Cloud-backed provider unavailable.");
            },
          } as ReturnType<typeof createModelProvider>);
      const report = await runModelEvalSuite(provider, aiProviderSelection, localOnlyMode);
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

    const result = importOperationalEvidenceArchive(pendingArchive);
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
  const journalAppendCount = journalEntries.filter((entry) => entry.kind === "append").length;
  const journalMergeCount = journalEntries.filter((entry) => entry.kind === "merge").length;
  const journalReplaceCount = journalEntries.filter((entry) => entry.kind === "replace").length;
  const runtime = diagnosticBundle.runtime;
  const currentModelEvalRecord = modelEvalReport ? summarizeModelEvalRun(modelEvalReport) : null;
  const latestModelEvalRun = modelEvalHistory[0] ?? currentModelEvalRecord;
  const previousModelEvalRun = modelEvalHistory[1] ?? null;
  const modelEvalComparison = useMemo(
    () => (latestModelEvalRun && previousModelEvalRun ? compareModelEvalRuns(previousModelEvalRun, latestModelEvalRun) : null),
    [latestModelEvalRun, previousModelEvalRun],
  );

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
            <PillButton active={false} onClick={downloadSupportBundle}>
              Download Support Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadReportEvidenceBundle}>
              Download Evidence Bundle
            </PillButton>
            <PillButton active={false} onClick={downloadOperationalEvidenceArchive}>
              Download Archive
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
            <div className="mt-2 rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Archive Merge Preflight</div>
                  <div className="mt-1 text-[10px] text-[#74809a]">
                    {pendingArchive.scene.name || "Untitled Scene"} · {pendingArchive.scene.source} · exported {pendingArchive.exportedAt}
                  </div>
                </div>
                <div className="text-[10px] text-[#dbe2f0]">
                  {pendingArchiveComparison?.readiness?.status ?? "pending"}
                </div>
              </div>
              {pendingArchiveComparison?.readiness ? (
                <>
                  <div className="mt-2 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2 text-[10px] text-[#dbe2f0]">
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
            <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Overlay Density</div>
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
            <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Archive Branch</div>
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

        <Section title="Evidence Journal" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
          <div className="space-y-2">
            <div className="text-[10px] text-[#74809a]">
              Append-only journal batches keep the browser evidence trail as records instead of a single rewritten array.
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-md border border-[#1e2130] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">Batches</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{journalEntries.length}</div>
              </div>
              <div className="rounded-md border border-[#1e2130] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">Append</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{journalAppendCount}</div>
              </div>
              <div className="rounded-md border border-[#1e2130] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">Merge</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{journalMergeCount}</div>
              </div>
              <div className="rounded-md border border-[#1e2130] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">Replace</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{journalReplaceCount}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {journalEntries.length > 0 ? (
                [...journalEntries].slice(-4).reverse().map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#edf2ff]">{entry.reason}</div>
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
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No journal entries yet.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Live Stats" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
          <div className="space-y-1.5 text-[9px]">
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Last run</span>
              <span className="font-mono text-[#d2d9e8]">{lastRunMs ? `${lastRunMs} ms` : "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Scene nodes</span>
              <span className="font-mono text-[#d2d9e8]">{summary.nodeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Edges</span>
              <span className="font-mono text-[#d2d9e8]">{summary.edgeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Coverage links</span>
              <span className="font-mono text-[#d2d9e8]">{summary.coverageLinkCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Failed zones</span>
              <span className="font-mono text-[#d2d9e8]">{summary.failedZoneCount}</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <Section title="Scene Graph" icon={<Layers3 className="h-3 w-3 text-cyan-400" />}>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Scene source</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.sceneSourceLabel}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Cameras</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.cameraCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Zones</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.zoneCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Sources</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.sourceCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Revision depth</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.revisionDepth}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Snapshots</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.snapshotCount}</div>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Source Breakdown</div>
            <div className="flex flex-wrap gap-1.5">
              {sourceEntries.length > 0 ? sourceEntries.map(([source, count]) => (
                <span key={source} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1 text-[9px] text-[#d2d9e8]">
                  {source}: <span className="font-mono text-[#8b96ab]">{count}</span>
                </span>
              )) : (
                <span className="text-[9px] text-[#59637a]">No source breakdown yet.</span>
              )}
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-2.5">
          <Section title="Camera Failures" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] text-[#8b96ab]">
                {cameraFailures.length > 0 ? `${cameraFailures.length} simulated camera failures active` : "No simulated camera failures active"}
              </div>
              {cameraFailures.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAllCameraFailures}
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear All
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cameraFailures.length > 0 ? cameraFailures.slice(0, 5).map((cameraId) => (
                <span key={cameraId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1 text-[9px] text-[#d2d9e8]">
                  {cameraId}
                </span>
              )) : (
                <span className="text-[9px] text-[#59637a]">Use the camera failure shortcut or toolbar action to stage failure analysis.</span>
              )}
            </div>
          </Section>

        <Section title="Simulation Notes" icon={<TimerReset className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Assumptions: {assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} · {assumptions.timeOfDay} · {assumptions.interiorLightLevel}
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Debug overlays show coverage, timing, and source-state context so you can understand why a scene changed after recompute.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Toggle <span className="text-[#d2d9e8]">Debug Overlays</span>, export a support bundle, or lower <span className="text-[#d2d9e8]">Overlay Density</span> if the shell is too noisy for a live review.
              </div>
            </div>
          </Section>

          <Section title="Runtime Health" icon={<TriangleAlert className="h-3 w-3 text-emerald-400" />}>
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Simulation</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                  {runtime.simulationRunning ? "Running" : runtime.simulationDirty ? "Dirty" : "Up to date"}
                </div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Last Run</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{lastRunMs ? `${lastRunMs} ms` : "—"}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">AI Policy</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{runtime.aiPolicyLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">AI Provider</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{runtime.aiProviderLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Provider Status</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                  {providerSummary.cloudAvailable ? "Cloud key available" : "Local fallback"}
                </div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Workspace</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceGovernance.sceneStatus.replace(/_/g, " ")}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Incidents</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{runtime.incidentCount}</div>
              </div>
            </div>
            <div className="mt-2 space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Access route: {workspaceAccess.policy.mode === "shared" ? "shared workspace" : "single-user workspace"} · {workspaceAccess.members.length} member{workspaceAccess.members.length === 1 ? "" : "s"}
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Sensor count: {scene.sensors.length} · Camera failures: {cameraFailures.length} · Auto recompute: {autoRecompute ? "on" : "off"}
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                {runtime.launchNotice ? runtime.launchNotice : "No launch notices yet. Use the shell or workspace controls to surface an action here."}
              </div>
            </div>
          </Section>

          <Section title="Support Bundle" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                {supportBundle.title}
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Incident snapshot · {supportBundle.incidents.summary}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest incident</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.incidents.latestIncident?.title ?? "None"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest performance trace</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                    {supportBundle.incidents.latestPerformanceTrace?.title ?? "None"}
                  </div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">AI telemetry trend</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.incidents.aiTelemetry.trendLabel}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Badge variant="gray">{supportBundle.incidents.incidentCount} incidents</Badge>
                <Badge variant="gray">{supportBundle.incidents.performanceTraceCount} traces</Badge>
                <Badge variant="gray">{supportBundle.incidents.stackTraceCount} stack traces</Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">External logs</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.incidents.externalLogCount}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest external log</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.incidents.latestExternalLog?.title ?? "None"}</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Sensor Ingest Archive" icon={<Waves className="h-3 w-3 text-cyan-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                The sensor ingest archive now ships inside the support bundle so live metadata handoff can be reviewed with the rest of the operational evidence.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived records</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.sensorIngestArchive.historyCount}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest scene</div>
                  <div className="mt-0.5 truncate font-semibold text-[#d2d9e8]">{supportBundle.sensorIngestArchive.latestSubmission?.sceneName ?? "No archive yet"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Loading</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{sensorIngestHistoryLoading ? "Yes" : "No"}</div>
                </div>
              </div>
              {sensorIngestHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {sensorIngestHistoryError}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {supportBundle.sensorIngestArchive.recentSubmissions.length > 0 ? supportBundle.sensorIngestArchive.recentSubmissions.map((record) => (
                  <div key={`${record.receivedAt}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant="gray">{record.sourceCount} record{record.sourceCount === 1 ? "" : "s"}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.source}</Badge>
                      <Badge variant="gray">{new Date(record.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No sensor ingest archive yet. Paste metadata or pull an external feed in the sensor panel to create the first record.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Camera Live Connection Archive" icon={<Video className="h-3 w-3 text-cyan-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                The live camera connection archive now ships inside the support bundle so ONVIF-style binds and disconnects can be reviewed with the rest of the operational evidence.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived records</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.cameraLiveConnectionArchive.historyCount}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest scene</div>
                  <div className="mt-0.5 truncate font-semibold text-[#d2d9e8]">{supportBundle.cameraLiveConnectionArchive.latestSubmission?.sceneName ?? "No archive yet"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Loading</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{cameraLiveConnectionHistoryLoading ? "Yes" : "No"}</div>
                </div>
              </div>
              {cameraLiveConnectionHistoryError ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                  {cameraLiveConnectionHistoryError}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {supportBundle.cameraLiveConnectionArchive.recentSubmissions.length > 0 ? supportBundle.cameraLiveConnectionArchive.recentSubmissions.map((record) => (
                  <div key={`${record.receivedAt}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant="gray">{record.protocol.toUpperCase()}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.action}</Badge>
                      <Badge variant="gray">{record.record.liveConnectionStatus}</Badge>
                      <Badge variant="gray">{new Date(record.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No camera live connection archive yet. Bind or disconnect a camera in the inspector to create the first record.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="External Log Capture" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Paste browser console, app server, or device log lines here so the support bundle can carry external log capture alongside the local incident history.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Review the latest high-priority alert and attach external logs before escalation.
              </div>
              <textarea
                value={externalLogDraft}
                onChange={(event) => setExternalLogDraft(event.target.value)}
                rows={5}
                placeholder="Paste external log lines here..."
                className="w-full rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#d2d9e8] outline-none placeholder:text-[#556076] focus:border-sky-400/40"
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
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear External Logs
                </button>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                {externalLogEntries.length > 0
                  ? `${externalLogEntries.length} external log capture${externalLogEntries.length === 1 ? "" : "s"} stored locally.`
                  : "No external logs captured yet."}
              </div>
              <div className="space-y-1.5">
                {externalLogEntries.length > 0 ? externalLogEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{entry.title}</div>
                      <Badge variant={entry.severity === "error" ? "red" : entry.severity === "warning" ? "amber" : "blue"}>
                        {entry.source}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{entry.details}</div>
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
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Paste JSON arrays or newline-delimited JSON sensor records here to convert live metadata into canonical sensor evidence.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
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
                className="w-full rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#d2d9e8] outline-none placeholder:text-[#556076] focus:border-cyan-400/40"
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
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear Draft
                </button>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
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
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                {supportBundle.alerts.summary}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Alert status</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.alerts.statusLabel}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">High priority</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.alerts.highPriorityCount}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest alert</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportBundle.alerts.latestAlert?.title ?? "None"}</div>
                </div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                {supportBundle.alerts.recommendation}
              </div>
              <div className="space-y-1.5">
                {supportBundle.alerts.recentAlerts.length > 0 ? supportBundle.alerts.recentAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{alert.title}</div>
                      <Badge variant={alert.severity === "error" ? "red" : alert.severity === "warning" ? "amber" : "blue"}>
                        {alert.source}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{alert.details}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                      <Badge variant="gray">{alert.severity}</Badge>
                      <Badge variant="gray">{alert.category}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No alert candidates yet.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Remote Support Ingest
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
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
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
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
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                    {supportIngestReport.summary}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Ingest status</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.routing.statusLabel}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Alert candidates</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.routing.alertCount}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest routed</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.routing.latestAlert?.title ?? "None"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Ingest source</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.source}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Received at</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.receivedAt}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Telemetry events</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportIngestReport.counts.telemetryEvents}</div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                <div>Support Ingest History</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="gray">{remoteSupportIngestHistory.length > 0 ? "server archive" : "local cache"}</Badge>
                  <button
                    type="button"
                    onClick={() => void refreshSupportIngestArchive()}
                    className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
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
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear Ingest History
                </button>
              </div>
              <div className="space-y-1.5">
                {(remoteSupportIngestHistory.length > 0 ? remoteSupportIngestHistory : supportIngestHistory).length > 0 ? (remoteSupportIngestHistory.length > 0 ? remoteSupportIngestHistory : supportIngestHistory).slice(0, 3).map((record) => (
                  <div key={`${record.receivedAt}-${record.sceneId ?? "scene"}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant={record.routing.statusLabel === "attention" ? "amber" : record.routing.statusLabel === "watch" ? "blue" : "green"}>
                        {record.routing.statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.routing.alertCount} alerts</Badge>
                      <Badge variant="gray">{record.counts.externalLogs} logs</Badge>
                      <Badge variant="gray">{record.counts.telemetryEvents} telemetry</Badge>
                      <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No support ingest history yet. Send a bundle to ingest to keep the routed handoff visible over time.
                  </div>
                )}
              </div>
              <div className="mt-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Remote Support Delivery
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Dispatch the latest routed support payload into the delivery queue so fan-out targets can be verified against a canonical archive.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Paste a remote webhook URL to exercise actual fan-out. Leave it blank to keep the run local and queued.
              </div>
              <input
                type="url"
                value={supportDeliveryEndpointDraft}
                onChange={(event) => setSupportDeliveryEndpointDraft(event.target.value)}
                placeholder="https://example.com/support-webhook"
                className="w-full rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#d2d9e8] outline-none placeholder:text-[#556076] focus:border-sky-400/40"
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
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear Delivery Result
                </button>
                <button
                  type="button"
                  onClick={() => void refreshSupportDeliveryArchive()}
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
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
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                    {supportDeliveryReport.summary}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Delivery status</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportDeliveryReport.archiveStatus}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Delivered</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportDeliveryReport.deliveredCount}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Queued</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportDeliveryReport.queuedCount}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Failed</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{supportDeliveryReport.failedCount}</div>
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
                  <div key={`${record.receivedAt}-${record.historyId}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                      <Badge variant={record.archiveStatus === "server archive" ? "green" : "amber"}>{record.archiveStatus}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{record.deliveredCount} delivered</Badge>
                      <Badge variant="gray">{record.queuedCount} queued</Badge>
                      <Badge variant="gray">{record.failedCount} failed</Badge>
                      <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No support delivery archive yet. Dispatch a routed support payload to create the fan-out history.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Trust Audit" icon={<ShieldAlert className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
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
                    <div key={surface.surface} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold text-[#edf2ff]">{surface.surface}</div>
                        <Badge variant={surface.status === "pass" ? "green" : "red"}>{surface.status}</Badge>
                      </div>
                      <div className="mt-1 text-[9px] text-[#8b96ab]">{surface.file}</div>
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
                </div>
              ) : null}
          </div>
        </Section>

          <Section title="Provider Governance" icon={<Sparkles className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active provider</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.activeProviderLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active model</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.activeModel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Local-only policy</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.localOnlyMode ? "Enabled" : "Disabled"}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Cloud availability</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.cloudAvailable ? "Available" : "Unavailable"}</div>
              </div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Fallback order</span>
                <span className="font-semibold text-[#d2d9e8]">{providerGovernance.fallbackOrder.map((entry) => entry.name).join(" → ")}</span>
              </div>
              <div className="mt-1 text-[#8b96ab]">
                Cloud-backed parsing and fix proposals follow this order when policy allows. Local-only mode keeps the same order visible but blocks cloud calls.
              </div>
            </div>
            <div className="space-y-1.5">
              {providerGovernance.fallbackOrder.map((entry) => (
                <div key={entry.providerId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{entry.name}</div>
                    <Badge variant={entry.isActive ? "green" : entry.available ? "blue" : "gray"}>
                      {entry.isActive ? "Active" : entry.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{entry.model}</Badge>
                    <Badge variant="gray">{entry.envKey}</Badge>
                    <Badge variant={entry.available ? "green" : "gray"}>{entry.available ? "API key present" : "API key missing"}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{entry.label}</div>
                </div>
              ))}
            </div>
            </div>
          </Section>

          <Section title="Provider Health Dashboard" icon={<ShieldAlert className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Cross-provider health is summarized here so the active provider, fallback readiness, and local-only posture stay visible alongside the model eval gate.
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Overall</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerHealth.overallStatus}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Healthy</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerHealth.healthyProviders}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Partial</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerHealth.partialProviders}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Blocked</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerHealth.blockedProviders}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {providerHealth.providers.map((provider) => (
                  <div key={provider.providerId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{provider.name}</div>
                      <Badge variant={provider.status === "healthy" ? "green" : provider.status === "partial" ? "amber" : "red"}>
                        {provider.active ? "Active" : provider.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{provider.model}</Badge>
                      <Badge variant="gray">{provider.envKey}</Badge>
                      <Badge variant={provider.available ? "green" : "gray"}>{provider.available ? "API key present" : "API key missing"}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{provider.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Cost / Latency Policy" icon={<TimerReset className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Estimated provider cost and latency are summarized here against the stage policy thresholds for command parsing, counterfactuals, report generation, and AI layout drafting.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active cost</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerTelemetry.activeCostLabel}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active latency</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerTelemetry.activeLatencyLabel}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Budget status</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerTelemetry.overallStatus}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Policy note</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerTelemetry.stagePolicies.find((stage) => stage.stage === "draft")?.note ?? "—"}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {providerTelemetry.stagePolicies.map((stage) => (
                  <div key={stage.stage} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{stage.label}</div>
                      <Badge variant={stage.ready ? "green" : "amber"}>{stage.ready ? "Ready" : "Guarded"}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{stage.maxCostTier} max cost</Badge>
                      <Badge variant="gray">{stage.maxLatencyTier} max latency</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{stage.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="AI Action Telemetry" icon={<TimerReset className="h-3 w-3 text-cyan-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Recent measured AI actions are recorded with wall-clock duration and estimated token usage so point-of-use telemetry can show actual latency instead of only policy classes.
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Events</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{aiActionTelemetrySummary.totalEvents}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest stage</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{aiActionTelemetry[0]?.stage ?? "—"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Trend</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                    {aiActionTelemetrySummary.trendLabel}
                  </div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Recent avg</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                    {aiActionTelemetrySummary.recentWindow
                      ? `${aiActionTelemetrySummary.recentWindow.averageDurationMs} ms · ~${aiActionTelemetrySummary.recentWindow.averageTokens} tokens`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1 text-[9px] text-[#b3bfd6]">
                {aiActionTelemetrySummary.trendNote}
              </div>
              <div className="space-y-1.5">
                {aiActionTelemetry.length > 0 ? aiActionTelemetry.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-[#edf2ff]">{entry.stage.replace(/_/g, " ")}</div>
                      <Badge variant={entry.status === "success" ? "green" : "red"}>{entry.durationMs} ms</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{entry.providerLabel}</Badge>
                      <Badge variant="gray">{entry.tokenSource}</Badge>
                      <Badge variant="gray">~{entry.estimatedTotalTokens} tokens</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{entry.note ?? "Measured at the AI action surface."}</div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No measured AI actions yet.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Prompt Registry" icon={<Layers3 className="h-3 w-3 text-emerald-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Canonical prompt definitions are shared by the command, counterfactual, report, and draft agents so the same prompt version can be audited and replayed.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Prompt count</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{promptRegistrySummary.total}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest version</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{promptRegistrySummary.latestVersion}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Stages</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">
                    {Object.entries(promptRegistrySummary.stages).map(([stage, count]) => `${stage}:${count}`).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {PROMPT_REGISTRY.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold text-[#edf2ff]">{entry.title}</div>
                        <div className="mt-0.5 text-[9px] text-[#8b96ab]">{entry.agent}</div>
                      </div>
                      <Badge variant="gray">{entry.version}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{entry.stage}</Badge>
                      <Badge variant="gray">{entry.outputSchema}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8b96ab]">{entry.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Model Eval Suite" icon={<RefreshCw className="h-3 w-3 text-emerald-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Gates prompt changes, provider swaps, and stage selection against canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Canonical fixtures: Heuristic Layout Baseline, Command Parse, Counterfactual Candidates, Report Generation, Model Layout Draft.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active provider</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.activeProviderLabel}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Cloud availability</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.cloudAvailable ? "Available" : "Unavailable"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Local-only</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.localOnlyMode ? "Enabled" : "Disabled"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Fallback order</div>
                  <div className="mt-0.5 font-semibold text-[#d2d9e8]">{providerGovernance.fallbackOrder.length} providers</div>
                </div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Budget Policy</span>
                  <Badge variant={currentModelEvalRecord?.stageBudget.met ? "green" : "amber"}>
                    {currentModelEvalRecord?.stageBudget.modeLabel ?? "Awaiting first run"}
                  </Badge>
                </div>
                <div className="mt-1 text-[#8b96ab]">
                  {currentModelEvalRecord ? (
                    <>
                      {currentModelEvalRecord.stageBudget.expectedPasses} expected passes · {currentModelEvalRecord.stageBudget.expectedSkips} expected skips · {currentModelEvalRecord.stageBudget.maxFailures} max failures.
                    </>
                  ) : (
                    "Run the suite once to establish the active stage budget."
                  )}
                </div>
                {currentModelEvalRecord ? (
                  <div className="mt-1 text-[#8b96ab]">{currentModelEvalRecord.stageBudget.note}</div>
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
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Fixtures</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalReport.summary.total}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Pass</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalReport.summary.passed}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Fail</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalReport.summary.failed}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Skip</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalReport.summary.skipped}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {modelEvalReport.fixtures.map((fixture) => (
                      <div key={fixture.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-semibold text-[#edf2ff]">{fixture.label}</div>
                            <div className="mt-0.5 text-[9px] text-[#8b96ab]">{fixture.summary}</div>
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
                        <div className="mt-1 rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#b3bfd6]">
                          <div className="text-[#556076]">Prompt</div>
                          <div>{fixture.prompt}</div>
                        </div>
                        <div className="mt-1 rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#b3bfd6]">
                          <div className="text-[#556076]">Output preview</div>
                          <div className="whitespace-pre-wrap">{fixture.outputPreview}</div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {fixture.checks.map((check) => (
                            <Badge key={`${fixture.id}-${check.label}`} variant={check.passed ? "green" : "red"}>
                              {check.label}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-1 space-y-1 text-[9px] text-[#8b96ab]">
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
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  Run the suite to compare structured outputs against the current provider/model choice.
                </div>
              )}
            </div>
          </Section>

          <Section title="Model Eval History" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Historical runs stay in local storage so provider swaps, prompt edits, and stage budgets can be compared across sessions.
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Recent runs</div>
                  <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalHistory.length}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Historical comparison</div>
                  <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">{modelEvalComparison?.trendLabel ?? "No comparison yet"}</div>
                </div>
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Trend</div>
                  <div className="mt-0.5 text-[13px] font-semibold text-[#edf2ff]">
                    {modelEvalComparison ? `${modelEvalComparison.deltaFailed <= 0 ? "Healthy" : "Needs attention"}` : "Awaiting history"}
                  </div>
                </div>
              </div>
              {modelEvalComparison ? (
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Run Delta</span>
                    <Badge variant={modelEvalComparison.deltaFailed > 0 ? "red" : "green"}>{modelEvalComparison.trendLabel}</Badge>
                  </div>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Pass delta</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{modelEvalComparison.deltaPassed >= 0 ? `+${modelEvalComparison.deltaPassed}` : modelEvalComparison.deltaPassed}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Fail delta</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{modelEvalComparison.deltaFailed >= 0 ? `+${modelEvalComparison.deltaFailed}` : modelEvalComparison.deltaFailed}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Skip delta</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{modelEvalComparison.deltaSkipped >= 0 ? `+${modelEvalComparison.deltaSkipped}` : modelEvalComparison.deltaSkipped}</div>
                    </div>
                    <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Duration delta</div>
                      <div className="mt-0.5 font-semibold text-[#d2d9e8]">{modelEvalComparison.deltaTotalDurationMs >= 0 ? `+${modelEvalComparison.deltaTotalDurationMs}` : modelEvalComparison.deltaTotalDurationMs} ms</div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                {modelEvalHistory.length > 0 ? modelEvalHistory.slice(0, 3).map((run, index) => {
                  const previous = modelEvalHistory[index + 1] ?? null;
                  const runComparison = previous ? compareModelEvalRuns(previous, run) : null;
                  return (
                    <div key={`${run.generatedAt}-${run.providerId}-${index}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold text-[#edf2ff]">{run.providerLabel}</div>
                          <div className="mt-0.5 text-[9px] text-[#8b96ab]">
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
                        <Badge variant="gray">{run.localOnlyMode ? "Local-only" : "Cloud-backed"}</Badge>
                        <Badge variant="gray">{run.summary.passed} pass</Badge>
                        <Badge variant="gray">{run.summary.failed} fail</Badge>
                        <Badge variant="gray">{run.summary.skipped} skip</Badge>
                      </div>
                      <div className="mt-1 text-[9px] text-[#8b96ab]">
                        {run.stageBudget.modeLabel}: {run.stageBudget.expectedPasses} expected pass(es), {run.stageBudget.expectedSkips} expected skip(s).
                      </div>
                      {runComparison ? (
                        <div className="mt-1 text-[9px] text-[#8b96ab]">
                          Compared with the previous run: {runComparison.trendLabel}; fail delta {runComparison.deltaFailed >= 0 ? "+" : ""}{runComparison.deltaFailed}; duration delta {runComparison.deltaTotalDurationMs >= 0 ? "+" : ""}{runComparison.deltaTotalDurationMs} ms.
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No historical model eval runs yet. Run the suite to start the comparison log.
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Journey Health" icon={<RefreshCw className="h-3 w-3 text-cyan-400" />}>
            <div className="grid grid-cols-1 gap-1.5">
              {runtime.journeyHealth.map((journey) => (
                <div key={journey.kind} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{journey.label}</div>
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
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{journey.detail}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Runtime Trace" icon={<TriangleAlert className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5">
              {runtime.recentTrace.length > 0 ? runtime.recentTrace.map((entry) => (
                <div key={entry.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{entry.title}</div>
                    <Badge variant="gray">{entry.kind}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    {entry.branchLabel ? <Badge variant="gray">{entry.branchLabel}</Badge> : null}
                    {entry.lifecycleStage ? <Badge variant="gray">{entry.lifecycleStage}</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No runtime trace entries yet. Trigger import, scan, AI, save, render, or publish actions to populate this view.
                </div>
              )}
            </div>
          </Section>

          <Section title="Incident Log" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[9px] text-[#8b96ab]">
                {runtime.incidentCount > 0
                  ? `${runtime.incidentCount} runtime incident${runtime.incidentCount === 1 ? "" : "s"} recorded`
                  : "No runtime incidents recorded yet."}
              </div>
              <button
                type="button"
                onClick={clearRuntimeIncidents}
                className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
              >
                Clear Incidents
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {runtime.recentIncidents.length > 0 ? runtime.recentIncidents.map((incident) => (
                <div key={incident.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{incident.title}</div>
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
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{incident.details}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(incident.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    <Badge variant="gray">{incident.severity}</Badge>
                    {incident.action ? <Badge variant="gray">{incident.action}</Badge> : null}
                    {incident.durationMs !== null ? <Badge variant="gray">{incident.durationMs} ms</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No incidents yet. Open the command bar, trigger a validation error, or run a simulation to populate the log.
                </div>
              )}
            </div>
          </Section>

          <Section title="Performance Trace" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
            <div className="space-y-1.5">
              {runtime.performanceTraces.length > 0 ? runtime.performanceTraces.map((trace) => (
                <div key={trace.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{trace.title}</div>
                    <Badge variant="gray">{trace.durationMs !== null ? `${trace.durationMs} ms` : "trace"}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{trace.details}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{new Date(trace.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    {trace.action ? <Badge variant="gray">{trace.action}</Badge> : null}
                    {trace.path ? <Badge variant="gray">{trace.path}</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
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
                    : "border-[#1e2030] bg-[#0f141f] text-[#59637a] hover:border-[#2a3245] hover:text-white"
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
