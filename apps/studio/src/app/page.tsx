"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import StudioShell from "@/components/layout/StudioShell";
import { ProjectStartLauncher } from "@/components/launcher/ProjectStartLauncher";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { StudioDashboardHome } from "@/components/launcher/StudioDashboardHome";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel, summarizeDraftResult } from "@/lib/ai-layout-draft";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import {
  createModelProvider,
  describeAiProviderHealth,
  describeAiProviderTelemetry,
  describeAiProviderSelection,
  providerKeyAvailable,
} from "@/agents/provider-selection";
import { safeParseSecurityScene, type SecurityScene } from "@/schema/security-scene";
import { bakeoffToSecurityScene } from "@/lib/bakeoff-bridge";

function formatClock(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function countSceneEntities(scene: SecurityScene) {
  return {
    entryPoints: scene.entryPoints.length,
    cameras: scene.cameras.length,
    securityLights: scene.securityLights.length,
    obstructions: scene.obstructions.length,
    criticalZones: scene.criticalZones.length,
    paths: scene.paths.length,
  };
}

function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function parseTimelineFocusFromUrl(search: string) {
  const params = new URLSearchParams(search);
  const timestampParam = params.get("timelineTimestamp");
  const timestamp = timestampParam ? Number(timestampParam) : null;
  if (!timestamp || Number.isNaN(timestamp)) return null;
  return {
    timestamp,
    query: params.get("timelineQuery"),
    branchLabel: params.get("timelineBranch"),
    eventId: params.get("timelineEventId"),
    provenanceNodeId: params.get("provenanceNode"),
    provenanceEdgeId: params.get("provenanceEdge"),
    source: "launcher" as const,
  };
}

export default function StudioPage() {
  const [enterStudio, setEnterStudio] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFloorPlanWizard, setShowFloorPlanWizard] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);
  const [scanWizardMode, setScanWizardMode] = useState<"manual" | "guided">("manual");
  const [showProjectLauncher, setShowProjectLauncher] = useState(false);
  const [showGuidedScanKickoff, setShowGuidedScanKickoff] = useState(false);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [showVerifyFootagePreview, setShowVerifyFootagePreview] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Create a 10m x 7m electronics shop with front entry, two shelves, right-side cash counter, back storage, and two cameras.");
  const [aiDraftPreview, setAiDraftPreview] = useState<ReturnType<typeof draftSceneFromPrompt> | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);
  const [aiDraftCopyNotice, setAiDraftCopyNotice] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDraftJsonVisible, setAiDraftJsonVisible] = useState(false);
  const [aiDraftJsonEditable, setAiDraftJsonEditable] = useState(false);
  const [aiDraftJsonText, setAiDraftJsonText] = useState("");
  const [aiDraftJsonError, setAiDraftJsonError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scene = useStudioStore((s) => s.scene);
  const setTimelineFocusRequest = useStudioStore((s) => s.setTimelineFocusRequest);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const savedScenes = useStudioStore((s) => s.savedScenes);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const setScene = useStudioStore((s) => s.setScene);
  const importScene = useStudioStore((s) => s.importScene);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const setDemoStep = useStudioStore((s) => s.setDemoStep);
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const runSimulationFromStore = useStudioStore((s) => s.runSimulation);
  const savedProjects = useStudioStore((s) => s.savedProjects);
  const updateSavedSceneMetadata = useStudioStore((s) => s.updateSavedSceneMetadata);
  const duplicateSavedScene = useStudioStore((s) => s.duplicateSavedScene);
  const renameSavedScene = useStudioStore((s) => s.renameSavedScene);
  const recordRuntimeIncident = useStudioStore((s) => s.recordRuntimeIncident);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const recordAiActionTelemetry = useStudioStore((s) => s.recordAiActionTelemetry);
  const aiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry);
  const latestAiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry[0] ?? null);
  const aiActionTelemetrySummary = useMemo(() => summarizeAiActionTelemetry(aiActionTelemetry), [aiActionTelemetry]);
  const historyDepth = useStudioStore((s) => s.historyPast.length);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);

  const currentResult = simulationResult ?? scene.simulation ?? null;
  const bootstrapRef = useRef(false);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const currentRunLabel = useMemo(() => {
    const label = formatClock(currentResult?.computedAt);
    return label ? `Last run ${label}` : null;
  }, [currentResult?.computedAt]);
  const currentAiProvider = useMemo(() => describeAiProviderSelection(aiProviderSelection), [aiProviderSelection]);
  const currentAiProviderHealth = useMemo(
    () => describeAiProviderHealth(aiProviderSelection, localOnlyMode),
    [aiProviderSelection, localOnlyMode],
  );
  const currentAiProviderTelemetry = useMemo(
    () => describeAiProviderTelemetry(aiProviderSelection, localOnlyMode),
    [aiProviderSelection, localOnlyMode],
  );
  const aiDraftModelAvailable = useMemo(
    () => providerKeyAvailable(aiProviderSelection.providerId) && !localOnlyMode,
    [aiProviderSelection.providerId, localOnlyMode],
  );
  const aiDraftModeLabel = aiDraftModelAvailable ? "Model mode active" : "Heuristic fallback active";
  const aiDraftModeDescription = localOnlyMode
    ? `Cloud-backed AI is disabled by policy. ${currentAiProvider.envKey} is ignored while local-only mode is enabled.`
    : aiDraftModelAvailable
      ? `${currentAiProvider.providerLabel} is active for draft generation.`
      : `${currentAiProvider.envKey} is missing, so draft generation runs in deterministic heuristic mode.`;
  const aiDraftSummary = useMemo(
    () => (aiDraftPreview ? summarizeDraftResult(aiDraftPreview) : null),
    [aiDraftPreview],
  );
  const aiDraftScene = useMemo(() => {
    if (!aiDraftPreview) return null;
    if (!aiDraftJsonEditable) return aiDraftPreview.scene;
    try {
      const parsed = safeParseSecurityScene(JSON.parse(aiDraftJsonText));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [aiDraftJsonEditable, aiDraftJsonText, aiDraftPreview]);
  const aiDraftJsonValidation = useMemo(() => {
    if (!aiDraftPreview) return { valid: false, error: null as string | null };
    if (!aiDraftJsonEditable) return { valid: true, error: null as string | null };
    try {
      const parsed = JSON.parse(aiDraftJsonText);
      const result = safeParseSecurityScene(parsed);
      return result.success
        ? { valid: true, error: null as string | null }
        : { valid: false, error: result.error.issues[0]?.message ?? "JSON must validate as a SecurityScene." };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Draft JSON must be valid JSON." };
    }
  }, [aiDraftJsonEditable, aiDraftJsonText, aiDraftPreview]);
  const aiDraftCounts = useMemo(() => {
    if (!aiDraftScene) return null;
    return countSceneEntities(aiDraftScene);
  }, [aiDraftScene]);
  const aiDraftComparison = useMemo(() => {
    if (!aiDraftSummary || !aiDraftCounts) return null;
    const current = {
      entryPoints: scene.entryPoints.length,
      cameras: scene.cameras.length,
      securityLights: scene.securityLights.length,
      obstructions: scene.obstructions.length,
      criticalZones: scene.criticalZones.length,
      paths: scene.paths.length,
    };
    const delta = {
      entryPoints: aiDraftCounts.entryPoints - current.entryPoints,
      cameras: aiDraftCounts.cameras - current.cameras,
      securityLights: aiDraftCounts.securityLights - current.securityLights,
      obstructions: aiDraftCounts.obstructions - current.obstructions,
      criticalZones: aiDraftCounts.criticalZones - current.criticalZones,
      paths: aiDraftCounts.paths - current.paths,
    };
    return { current, draft: aiDraftCounts, delta };
  }, [aiDraftCounts, aiDraftSummary, scene]);
  const openScanWizard = () => {
    recordOperationalEvidenceEvent({
      kind: "scan_session_started",
      title: "Scan session started",
      details: "Opened manual-assisted scan intake from the launcher.",
      actor: "user",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: historyDepth,
      affectedNodeIds: [],
      confidence: 0.74,
      beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
      afterSummary: "Manual-assisted scan intake opened.",
      notes: ["Launcher-scoped scan intake event recorded in the evidence ledger."],
    });
    setScanWizardMode("manual");
    setShowScanWizard(true);
  };
  const openGuidedScanAssistant = () => {
    recordOperationalEvidenceEvent({
      kind: "scan_session_started",
      title: "Guided scan assistant started",
      details: "Opened guided scan assistant from the launcher.",
      actor: "user",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: historyDepth,
      affectedNodeIds: [],
      confidence: 0.76,
      beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
      afterSummary: "Guided scan assistant opened.",
      notes: ["Launcher-scoped guided scan assistant event recorded in the evidence ledger."],
    });
    setScanWizardMode("guided");
    setShowScanWizard(true);
  };
  const aiDraftSceneJson = useMemo(
    () => {
      if (aiDraftJsonEditable) return aiDraftJsonText;
      if (!aiDraftScene) return "";
      return JSON.stringify(aiDraftScene, null, 2);
    },
    [aiDraftJsonEditable, aiDraftJsonText, aiDraftScene],
  );
  const aiDraftDisplayCounts = aiDraftCounts ?? aiDraftSummary?.counts ?? null;
  const aiDraftJsonIssue = aiDraftJsonError ?? (aiDraftJsonEditable && !aiDraftJsonValidation.valid ? aiDraftJsonValidation.error : null);
  const confirmWorkspaceReplacement = (nextActionLabel: string) => {
    if (!simulationDirty) return true;
    return window.confirm(`Current workspace has unapplied changes. Continue to ${nextActionLabel}?`);
  };
  const resetAiDraftPreview = () => {
    setAiDraftPreview(null);
    setAiWarning(null);
    setAiDraftNotice(null);
    setAiDraftCopyNotice(null);
    setAiDraftJsonVisible(false);
    setAiDraftJsonEditable(false);
    setAiDraftJsonText("");
    setAiDraftJsonError(null);
  };

  const openDemoWorkspace = () => {
    const demoRecord =
      savedProjects.find((project) => project.scene.source === "demo" && project.scene.name.toLowerCase().includes("open studio"))
      ?? savedProjects.find((project) => project.scene.source === "demo" && project.folder === "Featured")
      ?? savedProjects.find((project) => project.scene.source === "demo");

    if (demoRecord) {
      setScene(demoRecord.scene);
      setLaunchNotice(`Loaded reference scene: ${demoRecord.scene.name}`);
      setDemoMode(false);
      setDemoStep(0);
      openCoverageWorkspace();
      return;
    }

    setLaunchNotice("No seeded reference workspace is available. Continue with current scene.");
    openCoverageWorkspace();
  };

  useEffect(() => {
    if (!aiDraftPreview) return;
    queueMicrotask(() => {
      const nextText = JSON.stringify(aiDraftPreview.scene, null, 2);
      setAiDraftJsonText(nextText);
      setAiDraftJsonError(null);
      setAiDraftJsonEditable(false);
      setAiDraftJsonVisible(false);
    });
  }, [aiDraftPreview]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (event: ErrorEvent) => {
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: event.message || "Unhandled runtime error",
        details: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : "Unhandled browser runtime error.",
        stack: event.error instanceof Error ? event.error.stack : null,
        action: "window_error",
        path: window.location.pathname,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(typeof event.reason === "string" ? event.reason : "Unhandled promise rejection");
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "Unhandled promise rejection",
        details: reason.message,
        stack: reason.stack,
        action: "window_unhandledrejection",
        path: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [recordRuntimeIncident]);

  useEffect(() => {
    refreshSavedScenesList();
  }, [refreshSavedScenesList]);

  useEffect(() => {
    if (bootstrapRef.current) return;
    if (currentResult || !simulationDirty || scene.source !== "demo") return;
    bootstrapRef.current = true;
    runSimulationFromStore();
  }, [currentResult, scene, scene.source, runSimulationFromStore, simulationDirty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focusRequest = parseTimelineFocusFromUrl(window.location.search);
    if (focusRequest) {
      setTimelineFocusRequest(focusRequest);
    }
  }, [setTimelineFocusRequest]);

  const launchWorkspace = (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => {
    setWorkspacePreset(preset);
    setViewMode(viewMode);
    if (bottomTab) setBottomTab(bottomTab);
    setEnterStudio(true);
  };

  const openStudio = () => launchWorkspace("map", "edit", "metrics");
  const openCoverageWorkspace = () => launchWorkspace("map", "coverage", "metrics");
  const openCameraWall = () => launchWorkspace("wall", "camera_wall", "metrics");
  const openPathReplay = () => launchWorkspace("replay", "replay", "timeline");
  const openCompareFixes = () => launchWorkspace("compare", "compare", "beforeafter");
  const openReport = () => launchWorkspace("report", "report", "report");
  const openIssues = () => launchWorkspace("map", "edit", "issues");

  const runSimulation = () => {
    runSimulationFromStore();
    setWorkspacePreset("coverage");
    setViewMode("map");
    setBottomTab("metrics");
    setEnterStudio(true);
  };

  const openScene = (nextScene = scene) => {
    setScene(nextScene);
    openStudio();
  };

  const openProjectLauncher = () => {
    setShowProjectLauncher(true);
  };

  const handleImportScene = () => {
    if (!confirmWorkspaceReplacement("import a scene JSON")) return;
    fileInputRef.current?.click();
  };

  if (enterStudio) {
    return <StudioShell />;
  }

  return (
    <>
      <StudioDashboardHome
        scene={scene}
        result={currentResult}
        simulationDirty={simulationDirty}
        simulationRunning={simulationRunning}
        savedScenes={savedScenes}
        savedProjects={savedProjects}
        currentRunLabel={currentRunLabel}
        onOpenStudio={openStudio}
        onOpenCoverageWorkspace={openCoverageWorkspace}
        onOpenCameraWall={openCameraWall}
        onOpenPathReplay={openPathReplay}
        onOpenCompareFixes={openCompareFixes}
        onOpenIssues={openIssues}
        onRunSimulation={runSimulation}
        onStartProject={openProjectLauncher}
        onCreateScene={() => {
          if (!confirmWorkspaceReplacement("create a new scene")) return;
          setShowWizard(true);
        }}
        onImportFloorPlan={() => {
          if (!confirmWorkspaceReplacement("import a floor plan")) return;
          setShowFloorPlanWizard(true);
        }}
        onImportScene={handleImportScene}
        onScanSite={() => {
          if (!confirmWorkspaceReplacement("start scan intake")) return;
          openScanWizard();
        }}
        onGuidedScanAssistant={() => {
          if (!confirmWorkspaceReplacement("open the guided scan assistant")) return;
          setShowGuidedScanKickoff(true);
        }}
        onAiDraft={() => {
          if (!confirmWorkspaceReplacement("open AI layout draft")) return;
          setShowAiDraft(true);
        }}
        onOpenDemoScene={openDemoWorkspace}
        onOpenReport={openReport}
        onOpenScene={openScene}
        onUpdateProjectMetadata={updateSavedSceneMetadata}
        onDuplicateProject={duplicateSavedScene}
        onRenameProject={renameSavedScene}
        onOpenMode={(viewMode, preset, bottomTab) => launchWorkspace(viewMode, preset, bottomTab)}
        onOpenDemoWalkthrough={() => {
          setDemoMode(true);
          setDemoStep(0);
          launchWorkspace("map", "coverage", "metrics");
        }}
      />

      <ProjectStartLauncher
        open={showProjectLauncher}
        onClose={() => setShowProjectLauncher(false)}
        onOpenCoverageWorkspace={openCoverageWorkspace}
        onOpenDemoScene={() => {
          setShowProjectLauncher(false);
          openDemoWorkspace();
        }}
        onCreateScene={() => {
          if (!confirmWorkspaceReplacement("create a new scene")) return;
          setShowProjectLauncher(false);
          setShowWizard(true);
        }}
        onImportFloorPlan={() => {
          if (!confirmWorkspaceReplacement("import a floor plan")) return;
          setShowProjectLauncher(false);
          setShowFloorPlanWizard(true);
        }}
        onImportScene={() => {
          if (!confirmWorkspaceReplacement("import a scene JSON")) return;
          setShowProjectLauncher(false);
          fileInputRef.current?.click();
        }}
        onScanSite={() => {
          if (!confirmWorkspaceReplacement("start scan intake")) return;
          setShowProjectLauncher(false);
          openScanWizard();
        }}
        onAiDraft={() => {
          if (!confirmWorkspaceReplacement("open AI layout draft")) return;
          setShowProjectLauncher(false);
          setShowAiDraft(true);
        }}
        onVerifyFootagePlanned={() => {
          setShowProjectLauncher(false);
          setShowVerifyFootagePreview(true);
        }}
        onOpenReport={() => {
          setShowProjectLauncher(false);
          openReport();
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const json = JSON.parse((e.target?.result as string) || "");
              if (json && typeof json.image_id === "string" && Array.isArray(json.walls)) {
                const scene = bakeoffToSecurityScene(json, {
                  knownDimensionM: 8,
                  axisHint: "width",
                }, json.image_id);
                const result = importScene(scene);
                if (!result.success) {
                  setImportError(result.error ?? "Bakeoff scene import failed");
                  return;
                }
                setImportError(null);
                openStudio();
                return;
              }
              const result = importScene(json);
              if (!result.success) {
                setImportError(result.error ?? "Scene import failed");
                return;
              }
              setImportError(null);
              openStudio();
            } catch {
              setImportError("Failed to parse JSON.");
            }
          };
          reader.readAsText(file);
          event.target.value = "";
        }}
      />

      {showWizard ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto h-full max-w-6xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] shadow-2xl">
            <SceneBuilderWizard
              onClose={() => {
                setShowWizard(false);
                setEnterStudio(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {showFloorPlanWizard ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto h-full max-w-6xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] shadow-2xl">
            <SceneBuilderWizard
              forceImportMethod="floor_plan"
              onClose={() => {
                setShowFloorPlanWizard(false);
                setEnterStudio(true);
              }}
            />
          </div>
        </div>
      ) : null}

        {showScanWizard ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto h-full max-w-6xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] shadow-2xl">
            <ScanSiteWizard
              mode={scanWizardMode}
              onClose={() => {
                setShowScanWizard(false);
                setEnterStudio(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {showGuidedScanKickoff ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] p-4 shadow-2xl">
            <h2 className="text-sm font-semibold text-white">Guided Scan Assistant</h2>
            <p className="mt-1 text-xs text-[#91a4c5]">
              This assistant guides photo capture, then hands off to the same manual review and compile flow used by Scan Site.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-emerald-200">What the assistant does</div>
                <div className="mt-1">Suggests a practical capture order for overview, entry, counter, and close-ups</div>
                <div>Enables auto-path hints while keeping manual review in the loop</div>
                <div>Compiles to the same editable SecurityScene used by the manual flow</div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Still manual by design</div>
                <div>No automatic segmentation or depth solve yet</div>
                <div>The user still confirms, edits, and rejects candidates before compile</div>
                <div>Advanced multi-photo correspondence remains a later upgrade</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#22314b] bg-[#101827] px-3 py-2 text-[10px] text-[#b6c6e6]">
              Guided assistant preview: the assistant shortens capture setup, but the scene still compiles through the manual-assisted review path.
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowGuidedScanKickoff(false)}
                className="rounded-lg border border-[#2a3347] px-3 py-1.5 text-xs text-[#9bb0cf]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowGuidedScanKickoff(false);
                  openGuidedScanAssistant();
                  setLaunchNotice("Guided scan assistant opened. The manual-assisted review and compile flow remains in control.");
                }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Open Guided Assistant
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAiDraft ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] p-4 shadow-2xl">
            <h2 className="text-sm font-semibold text-white">AI Layout Draft</h2>
            <p className="mt-1 text-xs text-[#91a4c5]">
              Prompt-to-scene draft. Output is a real editable `SecurityScene` JSON-backed scene.
            </p>
            <div className="mt-2 rounded-lg border border-[#22314b] bg-[#101a2b] px-3 py-2 text-[10px] text-[#97a8c9]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${aiDraftModelAvailable ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>
                  {aiDraftModeLabel}
                </span>
                <span className="rounded-full border border-[#2a3347] bg-[#0d1421] px-2 py-0.5 text-[9px] text-[#c4d5ff]">
                  {currentAiProvider.providerLabel}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] ${
                    currentAiProviderHealth.overallStatus === "healthy"
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : currentAiProviderHealth.overallStatus === "partial"
                        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                        : "border-red-400/20 bg-red-500/10 text-red-200"
                  }`}
                >
                  {currentAiProviderHealth.overallStatus === "healthy"
                    ? "Provider healthy"
                    : currentAiProviderHealth.overallStatus === "partial"
                      ? "Provider partial"
                      : "Provider blocked"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] ${
                    currentAiProviderTelemetry.overallStatus === "ready"
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : currentAiProviderTelemetry.overallStatus === "guarded"
                        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                        : "border-red-400/20 bg-red-500/10 text-red-200"
                  }`}
                >
                  {currentAiProviderTelemetry.overallStatus === "ready"
                    ? "Budget ready"
                    : currentAiProviderTelemetry.overallStatus === "guarded"
                      ? "Budget guarded"
                      : "Budget blocked"}
                </span>
              </div>
              {localOnlyMode ? (
                <p className="mt-2">
                  Cloud-backed AI is disabled by policy. The launcher will keep using the heuristic draft path even if <code className="text-[#c4d5ff]">{currentAiProvider.envKey}</code> is configured.
                </p>
              ) : (
                <p className="mt-2">
                  {aiDraftModeDescription} The generated scene is validated as a <code className="text-[#c4d5ff]">SecurityScene</code> before apply.
                </p>
              )}
              <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
                Provider health: {currentAiProviderHealth.healthyProviders} healthy / {currentAiProviderHealth.partialProviders} partial / {currentAiProviderHealth.blockedProviders} blocked.
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
                Cost / latency: {currentAiProviderTelemetry.activeCostLabel} · {currentAiProviderTelemetry.activeLatencyLabel}.
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
                Stage policy: {currentAiProviderTelemetry.stagePolicies.map((stage) => `${stage.stage}:${stage.ready ? "ready" : "guarded"}`).join(" · ")}.
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
                Latest measured action: {latestAiActionTelemetry ? `${latestAiActionTelemetry.stage} · ${latestAiActionTelemetry.durationMs} ms · ~${latestAiActionTelemetry.estimatedTotalTokens} tokens` : "none yet"}.
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
                Telemetry trend: {aiActionTelemetrySummary.trendLabel} · {aiActionTelemetrySummary.trendNote}
              </p>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(event) => {
                setAiPrompt(event.target.value);
                resetAiDraftPreview();
              }}
              className="mt-3 h-36 w-full rounded-lg border border-[#2a3347] bg-[#101827] p-3 text-xs text-[#d7e1f2] outline-none focus:border-blue-500/50"
            />
            {aiWarning ? <p className="mt-2 text-xs text-amber-300">{aiWarning}</p> : null}
            {aiDraftSummary ? (
              <div className="mt-3 rounded-2xl border border-[#22314b] bg-[#0e1726] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7e8fb0]">Draft Preview</div>
                    <div className="mt-1 text-sm font-semibold text-white">{aiDraftSummary.sceneName}</div>
                    <div className="mt-1 text-[10px] text-[#93a7c6]">
                      {aiDraftSummary.sourceLabel} · {aiDraftSummary.modeLabel} · {aiDraftSummary.confidenceLabel} · {aiDraftSummary.sizeLabel}
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-cyan-100">
                    Review before apply
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Cameras</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.cameras ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Lights</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.securityLights ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Obstructions</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.obstructions ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Zones</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.criticalZones ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Paths</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.paths ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Entries</div>
                    <div className="text-sm font-semibold text-white">{aiDraftDisplayCounts?.entryPoints ?? 0}</div>
                  </div>
                </div>
                {aiDraftComparison ? (
                  <div className="mt-3 rounded-2xl border border-[#22314b] bg-[#0b1220] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7e8fb0]">Workspace comparison</div>
                        <div className="mt-0.5 text-[10px] text-[#93a7c6]">What changes if you apply this draft?</div>
                      </div>
                      <span className="rounded-full border border-[#2a3347] bg-[#101827] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[#c4d5ff]">
                        Current vs Draft
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
                      {([
                        ["Cameras", "cameras"],
                        ["Lights", "securityLights"],
                        ["Obstructions", "obstructions"],
                        ["Zones", "criticalZones"],
                        ["Paths", "paths"],
                        ["Entries", "entryPoints"],
                      ] as const).map(([label, key]) => {
                        const currentValue = aiDraftComparison.current[key];
                        const draftValue = aiDraftComparison.draft[key];
                        const delta = aiDraftComparison.delta[key];
                        const deltaLabel = delta === 0 ? "No change" : delta > 0 ? `+${delta}` : `${delta}`;
                        const deltaTone = delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-300" : "text-[#8ea2c5]";
                        return (
                          <div key={key} className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5">
                            <div className="text-[#7e8fb0]">{label}</div>
                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                              <span className="text-[10px] text-[#8ea2c5]">{currentValue} → {draftValue}</span>
                              <span className={`text-[10px] font-semibold ${deltaTone}`}>{deltaLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7e8fb0]">Generated Scene JSON</div>
                    <div className="mt-0.5 text-[10px] text-[#93a7c6]">
                      Review the exact `SecurityScene` structure before applying it.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAiDraftJsonVisible((visible) => !visible)}
                      className="rounded-full border border-[#2a3347] bg-[#101827] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#c4d5ff]"
                    >
                      {aiDraftJsonVisible ? "Hide JSON" : "Show JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!aiDraftJsonVisible) setAiDraftJsonVisible(true);
                        setAiDraftJsonEditable((editable) => !editable);
                        setAiDraftJsonError(null);
                      }}
                      className="rounded-full border border-[#2a3347] bg-[#101827] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#c4d5ff]"
                    >
                      {aiDraftJsonEditable ? "Lock JSON" : "Edit JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!aiDraftSceneJson) return;
                        await navigator.clipboard.writeText(aiDraftSceneJson);
                        setAiDraftCopyNotice("Draft JSON copied to clipboard.");
                      }}
                      disabled={!aiDraftSceneJson}
                      className="rounded-full border border-[#2a3347] bg-[#101827] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#c4d5ff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Copy JSON
                    </button>
                  </div>
                </div>
                {aiDraftJsonVisible ? (
                  aiDraftJsonEditable ? (
                    <textarea
                      value={aiDraftJsonText}
                      onChange={(event) => {
                        setAiDraftJsonText(event.target.value);
                        if (aiDraftJsonError) setAiDraftJsonError(null);
                      }}
                      spellCheck={false}
                      className="mt-2 h-56 w-full rounded-xl border border-[#1e2a42] bg-[#08101b] p-3 font-mono text-[9px] leading-relaxed text-[#8ea2c5] outline-none focus:border-cyan-500/40"
                    />
                  ) : (
                    <pre className="mt-2 max-h-52 overflow-auto rounded-xl border border-[#1e2a42] bg-[#08101b] p-3 text-[9px] leading-relaxed text-[#8ea2c5]">
                      {aiDraftSceneJson}
                    </pre>
                  )
                ) : null}
                {aiDraftJsonIssue ? (
                  <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-100">
                    JSON must be valid SecurityScene data before apply: {aiDraftJsonIssue}
                  </div>
                ) : null}
                {aiDraftCopyNotice ? (
                  <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-100">
                    {aiDraftCopyNotice}
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-[#1e2a42] bg-[#0b1220] px-3 py-2 text-[10px] text-[#a8b8d5]">
                  {aiDraftSummary.summary}
                </div>
                {aiDraftSummary.warnings.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100">
                    <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Draft notes</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {aiDraftSummary.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[#22314b] bg-[#101827]/60 px-3 py-2 text-[10px] text-[#89a0c4]">
                Generate a preview to review the scene summary, counts, and notes before applying it to the workspace.
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setShowAiDraft(false);
                  resetAiDraftPreview();
                }}
                className="rounded-lg border border-[#2a3347] px-3 py-1.5 text-xs text-[#9bb0cf]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setAiGenerating(true);
                  const draftStartedAt = performance.now();
                  try {
                    const provider = createModelProvider(aiProviderSelection);
                    const useModelDraft = aiDraftModelAvailable;
                    const draft = useModelDraft
                      ? await draftSceneFromPromptWithModel(aiPrompt, provider)
                      : draftSceneFromPrompt(aiPrompt);
                    const draftValidation = safeParseSecurityScene(draft.scene);
                    if (!draftValidation.success) {
                      throw new Error(`Generated draft is invalid SecurityScene data: ${draftValidation.error.issues[0]?.message ?? "validation failed"}`);
                    }
                    setAiDraftPreview(draft);
                    recordAiActionTelemetry({
                      stage: "ai_draft",
                      providerId: aiProviderSelection.providerId,
                      providerLabel: currentAiProvider.providerLabel,
                      model: aiProviderSelection.model,
                      localOnlyMode,
                      cloudAvailable: useModelDraft,
                      durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
                      estimatedPromptTokens: estimateTokensFromText(aiPrompt),
                      estimatedCompletionTokens: estimateTokensFromText(JSON.stringify(draft.scene)),
                      estimatedTotalTokens: estimateTokensFromText(aiPrompt) + estimateTokensFromText(JSON.stringify(draft.scene)),
                      tokenSource: "estimated",
                      status: "success",
                      note: useModelDraft
                        ? `Model-backed if the provider is configured and local-only mode is off. Draft preview from ${currentAiProvider.providerLabel}.`
                        : localOnlyMode
                          ? "Heuristic draft preview enforced by local-only policy."
                          : `Heuristic draft preview used because ${currentAiProvider.envKey} is not set.`,
                    });
                    recordOperationalEvidenceEvent({
                      kind: "draft_proposed",
                      title: "AI draft preview generated",
                      details: `Preview generated from prompt: ${aiPrompt.trim().slice(0, 120) || "Untitled prompt"}`,
                      actor: "ai",
                      source: scene.source,
                      sceneId: scene.id,
                      sceneName: scene.name,
                      revisionDepth: historyDepth,
                      affectedNodeIds: [],
                      confidence: draft.provenance.confidenceLevel === "high"
                        ? 0.92
                        : draft.provenance.confidenceLevel === "medium"
                          ? 0.74
                          : 0.55,
                      beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
                      afterSummary: draft.provenance.summary,
                      notes: [useModelDraft ? `Provider: ${currentAiProvider.providerLabel}` : "Heuristic preview generated locally."],
                    });
                    const warning =
                      draft.warnings[0] ?? (localOnlyMode
                        ? "Local-only mode is on, so heuristic draft generation is enforced."
                        : useModelDraft
                          ? `Model draft generated with ${currentAiProvider.providerLabel}.`
                          : `Using heuristic draft because ${currentAiProvider.envKey} is not set.`);
                    const provenanceNote = `${draft.provenance.summary} (${draft.provenance.confidenceLevel} confidence)`;
                    setAiWarning(warning);
                    setAiDraftNotice(provenanceNote);
                  } catch (error) {
                    const fallback = draftSceneFromPrompt(aiPrompt);
                    const fallbackValidation = safeParseSecurityScene(fallback.scene);
                    if (!fallbackValidation.success) {
                      setAiWarning(`Draft failed validation and fallback was invalid: ${fallbackValidation.error.issues[0]?.message ?? "validation failed"}`);
                      setAiDraftNotice("Draft preview blocked until a valid SecurityScene can be generated.");
                      setAiDraftPreview(null);
                      recordAiActionTelemetry({
                        stage: "ai_draft",
                        providerId: aiProviderSelection.providerId,
                        providerLabel: currentAiProvider.providerLabel,
                        model: aiProviderSelection.model,
                        localOnlyMode,
                        cloudAvailable: false,
                        durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
                        estimatedPromptTokens: estimateTokensFromText(aiPrompt),
                        estimatedCompletionTokens: 0,
                        estimatedTotalTokens: estimateTokensFromText(aiPrompt),
                        tokenSource: "estimated",
                        status: "error",
                        note: `Draft validation failed and fallback invalid. ${error instanceof Error ? error.message : ""}`.trim(),
                      });
                      return;
                    }
                    setAiDraftPreview(fallback);
                    recordAiActionTelemetry({
                      stage: "ai_draft",
                      providerId: aiProviderSelection.providerId,
                      providerLabel: currentAiProvider.providerLabel,
                      model: aiProviderSelection.model,
                      localOnlyMode,
                      cloudAvailable: false,
                      durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
                      estimatedPromptTokens: estimateTokensFromText(aiPrompt),
                      estimatedCompletionTokens: estimateTokensFromText(JSON.stringify(fallback.scene)),
                      estimatedTotalTokens: estimateTokensFromText(aiPrompt) + estimateTokensFromText(JSON.stringify(fallback.scene)),
                      tokenSource: "estimated",
                      status: "error",
                      note: localOnlyMode
                        ? "Heuristic fallback draft generated in local-only mode."
                        : `Model draft failed; heuristic fallback used. ${error instanceof Error ? error.message : ""}`.trim(),
                    });
                    recordOperationalEvidenceEvent({
                      kind: "draft_proposed",
                      title: "AI draft preview generated",
                      details: `Preview generated from prompt: ${aiPrompt.trim().slice(0, 120) || "Untitled prompt"}`,
                      actor: "ai",
                      source: scene.source,
                      sceneId: scene.id,
                      sceneName: scene.name,
                      revisionDepth: historyDepth,
                      affectedNodeIds: [],
                      confidence: fallback.provenance.confidenceLevel === "high"
                        ? 0.92
                        : fallback.provenance.confidenceLevel === "medium"
                          ? 0.74
                          : 0.55,
                      beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
                      afterSummary: fallback.provenance.summary,
                      notes: [localOnlyMode ? "Heuristic preview generated in local-only mode." : "Heuristic fallback preview generated."],
                    });
                    const warning = localOnlyMode
                      ? "Local-only mode is on, so heuristic fallback was used."
                      : `Model draft failed; fallback used. ${error instanceof Error ? error.message : ""}`.trim();
                    const provenanceNote = `${fallback.provenance.summary} (${fallback.provenance.confidenceLevel} confidence)`;
                    setAiWarning(warning);
                    setAiDraftNotice(provenanceNote);
                  } finally {
                    setAiGenerating(false);
                  }
                }}
                disabled={aiGenerating}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                {aiGenerating ? "Generating..." : aiDraftSummary ? "Regenerate Preview" : "Generate Preview"}
              </button>
              <button
                onClick={() => {
                  if (!aiDraftPreview) return;
                  if (aiDraftJsonEditable && !aiDraftJsonValidation.valid) {
                    setAiDraftJsonError(aiDraftJsonValidation.error ?? "Draft JSON must validate as a SecurityScene.");
                    return;
                  }
                  if (!confirmWorkspaceReplacement("apply this AI layout draft")) return;
                  const provenanceNote = `${aiDraftPreview.provenance.summary} (${aiDraftPreview.provenance.confidenceLevel} confidence)`;
                  setScene(aiDraftScene ?? aiDraftPreview.scene);
                  setLaunchNotice(provenanceNote);
                  resetAiDraftPreview();
                  setShowAiDraft(false);
                  setTimeout(() => {
                    const store = useStudioStore.getState();
                    store.runSimulation();
                  }, 100);
                  openStudio();
                }}
                disabled={!aiDraftPreview || aiGenerating || (aiDraftJsonEditable && !aiDraftJsonValidation.valid)}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/60"
              >
                Use Draft Scene
              </button>
            </div>
            {aiDraftNotice ? (
              <div className="mt-3 rounded-lg border border-[#22314b] bg-[#101827] px-3 py-2 text-[10px] text-[#b6c6e6]">
                <span className="font-semibold text-cyan-200">AI draft status:</span> {aiDraftNotice}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showVerifyFootagePreview ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] p-4 shadow-2xl">
            <h2 className="text-sm font-semibold text-white">Verify Real Camera Footage (Preview)</h2>
            <p className="mt-1 text-xs text-[#91a4c5]">
              Current support is a planning-assist workflow in Camera View, not a forensic verification pipeline.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-emerald-200">Available now</div>
                <div className="mt-1">Reference frame upload</div>
                <div>Overlay/split comparison</div>
                <div>Manual candidate frame review</div>
                <div>Planning impact annotation</div>
                <div>Optional frame-by-frame inspection workflow</div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Not implemented yet</div>
                <div>Auto camera pose/FOV recovery</div>
                <div>Auto scoring and best-frame ranking</div>
                <div>ONVIF/RTSP integration</div>
                <div>Forensic-grade proof claims</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#22314b] bg-[#101827] px-3 py-2 text-[10px] text-[#b6c6e6]">
              Planning indicator only: modeled outcomes are deterministic simulation estimates and are not legal or forensic guarantees.
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowVerifyFootagePreview(false)}
                className="rounded-lg border border-[#2a3347] px-3 py-1.5 text-xs text-[#9bb0cf]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowVerifyFootagePreview(false);
                  setCameraViewVerificationIntent({ source: "launcher_preview", openPanel: true });
                  launchWorkspace("camera_view", "coverage", "metrics");
                  setLaunchNotice("Use Camera View footage verification overlay as current preview path.");
                }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Open Camera View Preview
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importError ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-red-400/25 bg-red-500/12 px-4 py-2 text-xs text-red-200 shadow-lg">
          {importError}
        </div>
      ) : null}
    </>
  );
}
