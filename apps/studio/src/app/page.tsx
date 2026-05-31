"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import { ProductViewRouter } from "@/components/product/ProductViewRouter";
import type { ProductViewHandlers } from "@/components/product/ProductViewRouter";
import { createSiteIntakeSession } from "@/lib/site-compiler";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { useProductViewStore } from "@/store/product-view-store";
import { promoteToActiveScene } from "@/lib/site-draft-approval";
import { parseArchiveHandoffLink } from "@/lib/archive-handoff-link";
import { parseCompareShareLink } from "@/lib/compare-share-link";
import { parseTimelineShareLink } from "@/lib/timeline-share-link";
import { type SecurityScene } from "@/schema/security-scene";
import { parseImportSceneDraft } from "@/lib/import-scene-draft";

function parseTimelineFocusFromUrl(search: string) {
  return parseTimelineShareLink(search);
}

function StudioPageContent() {
  const navigate = useProductViewStore((s) => s.navigate);

  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scene = useStudioStore((s) => s.scene);
  const setArchiveHandoffRequest = useStudioStore((s) => s.setArchiveHandoffRequest);
  const setTimelineFocusRequest = useStudioStore((s) => s.setTimelineFocusRequest);
  const setCompareReportSelection = useStudioStore((s) => s.setCompareReportSelection);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const savedProjects = useStudioStore((s) => s.savedProjects);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const setScene = useStudioStore((s) => s.setScene);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const setDemoStep = useStudioStore((s) => s.setDemoStep);
  const setActiveWorkflow = useStudioStore((s) => s.setActiveWorkflow);
  const setActiveWorkflowStep = useStudioStore((s) => s.setActiveWorkflowStep);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId);
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const runSimulationFromStore = useStudioStore((s) => s.runSimulation);
  const siteIntakeSession = useStudioStore((s) => s.siteIntakeSession);
  const setSiteIntakeSession = useStudioStore((s) => s.setSiteIntakeSession);
  const recordRuntimeIncident = useStudioStore((s) => s.recordRuntimeIncident);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const historyDepth = useStudioStore((s) => s.historyPast.length);

  const currentResult = simulationResult ?? scene.simulation ?? null;
  const bootstrapRef = useRef(false);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);

  // --- Handlers ---

  const confirmWorkspaceReplacement = (nextActionLabel: string) => {
    if (!simulationDirty) return true;
    return window.confirm(`Current workspace has unapplied changes. Continue to ${nextActionLabel}?`);
  };

  const launchWorkspace = (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => {
    setWorkspacePreset(preset);
    setViewMode(viewMode);
    if (bottomTab) setBottomTab(bottomTab);
    navigate("studio");
  };

  const openStudio = () => launchWorkspace("map", "edit", "metrics");
  const openCoverageWorkspace = () => launchWorkspace("map", "coverage", "metrics");
  const openCameraWall = () => launchWorkspace("wall", "camera_wall", "metrics");
  const openPathReplay = () => {
    launchWorkspace("replay", "replay", "timeline");
    if (activeWorkflowId === "audit") {
      setActiveWorkflowStep(2);
    }
  };
  const openCompareFixes = () => {
    launchWorkspace("compare", "compare", "beforeafter");
    if (activeWorkflowId === "audit") {
      setActiveWorkflowStep(4);
    }
  };
  const openReport = () => {
    launchWorkspace("report", "report", "report");
    if (activeWorkflowId === "audit") {
      setActiveWorkflowStep(5);
    }
  };
  const openIssues = () => launchWorkspace("map", "edit", "issues");

  const runSimulation = () => {
    runSimulationFromStore();
    if (activeWorkflowId !== "idle") {
      const workflowSteps: Partial<Record<string, number>> = {
        audit: 1, design: 4, scan: 4, floor_plan: 4,
        ai_draft: 4, verify_footage: 1, report: 4, demo: 2,
      };
      setActiveWorkflowStep(workflowSteps[activeWorkflowId] ?? 1);
    }
    launchWorkspace("map", "coverage", "metrics");
  };

  const openScanWizard = () => {
    if (!confirmWorkspaceReplacement("start scan intake")) return;
    setActiveWorkflow("scan");
    setActiveWorkflowStep(0);
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
      afterSummary: "Guided photo marking intake opened.",
      notes: ["Launcher-scoped scan intake event recorded in the evidence ledger."],
    });
    setLaunchNotice("Guided photo marking opened. You control candidate marking, review, and draft creation.");
    navigate("scan_site");
  };

  const openGuidedScanAssistant = () => {
    if (!confirmWorkspaceReplacement("start guided scan intake")) return;
    setActiveWorkflow("scan");
    setActiveWorkflowStep(0);
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
    setLaunchNotice("Guided capture reconstruction opened. Upload photos to run the reconstruction pipeline.");
    navigate("scan_site", "guided");
  };

  const openReferenceWorkspace = () => {
    setActiveWorkflow("reference");
    setActiveWorkflowStep(0);
    const referenceRecord =
      savedProjects.find((project) => project.scene.source === "demo" && project.scene.name.toLowerCase().includes("open studio"))
      ?? savedProjects.find((project) => project.scene.source === "demo" && project.folder === "Featured")
      ?? savedProjects.find((project) => project.scene.source === "demo");

    if (referenceRecord) {
      setScene(referenceRecord.scene);
      setLaunchNotice(`Loaded reference scene: ${referenceRecord.scene.name}`);
      setDemoMode(false);
      setDemoStep(0);
      openCoverageWorkspace();
      return;
    }

    setLaunchNotice("No seeded reference workspace is available. Continue with current scene.");
    openCoverageWorkspace();
  };

  const startDesignFlow = () => {
    if (!confirmWorkspaceReplacement("create a new scene")) return;
    setActiveWorkflow("design");
    setActiveWorkflowStep(0);
    navigate("manual_builder");
  };

  const openFloorPlanFlow = () => {
    if (!confirmWorkspaceReplacement("import a floor plan")) return;
    setActiveWorkflow("floor_plan");
    setActiveWorkflowStep(0);
    navigate("floor_plan_import");
  };

  const handleImportScene = () => {
    if (!confirmWorkspaceReplacement("import a scene JSON")) return;
    fileInputRef.current?.click();
  };

  const openScene = (nextScene = scene) => {
    setScene(nextScene);
    openStudio();
  };

  // Create a SiteIntakeSession from a candidate scene without store mutation.
  // All creation/import flows must pass through this before SiteDraftReview.
  const createDraftFromScene = (scene: SecurityScene, source: import("@/lib/site-compiler").SiteIntakeSource, sourceArtifacts: string[] = []) => {
    const session = createSiteIntakeSession(scene, source, sourceArtifacts);
    setSiteIntakeSession(session);
  };

  const approveIntakeSession = () => {
    const session = useStudioStore.getState().siteIntakeSession;
    if (!session?.draft) return;
    const promotion = promoteToActiveScene(session);
    if (!promotion.result.success) {
      setLaunchNotice(`Draft approval blocked: ${promotion.result.error}`);
      return;
    }

    const approvedScene = promotion.result.scene;
    approvedScene.changeLog = [...approvedScene.changeLog, ...promotion.result.provenanceLog];
    setScene(approvedScene);
    recordOperationalEvidenceEvent({
      kind: "scan_compiled",
      title: "Site intake draft approved",
      details: `Approved ${session.draft.source} draft and promoted it to the active canonical scene.`,
      actor: "user",
      source: approvedScene.source,
      sceneId: approvedScene.id,
      sceneName: approvedScene.name,
      revisionDepth: historyDepth,
      affectedNodeIds: [],
      confidence: session.draft.confidence,
      beforeSummary: `${scene.name || "Workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
      afterSummary: `${approvedScene.name || "Approved scene"} · ${approvedScene.cameras.length} cameras · ${approvedScene.criticalZones.length} critical zones`,
      notes: [
        `Draft id: ${session.draft.id}`,
        `Source artifacts: ${session.draft.provenance.sourceArtifacts.join(", ") || "none"}`,
        `Warnings: ${session.draft.warnings.length}`,
      ],
    });

    setSiteIntakeSession(null);
    if (promotion.result.baselineReady) {
      runSimulationFromStore();
      launchWorkspace("map", "coverage", "metrics");
      setLaunchNotice("Draft approved and activated. Baseline simulation started from the approved scene.");
    } else {
      launchWorkspace("map", "edit", "metrics");
      setLaunchNotice("Draft approved and activated. Add missing camera/zone prerequisites, then run baseline simulation.");
    }
  };

  const rejectIntakeSession = () => {
    setSiteIntakeSession(null);
  };

  const approveAndRunBaseline = () => {
    approveIntakeSession();
  };

  // --- Effects ---

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

  // URL deep-link handling
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const archiveRequest = parseArchiveHandoffLink(search);
    const focusRequest = parseTimelineFocusFromUrl(search);
    const compareRequest = parseCompareShareLink(search);

    if (archiveRequest) {
      queueMicrotask(() => {
        setArchiveHandoffRequest(archiveRequest);
        navigate("studio");
        setWorkspacePreset("debug");
        setViewMode("map");
        setBottomTab("debug");
        setLaunchNotice(
          `Archive handoff opened for ${archiveRequest.archive.scene.name || "Untitled Scene"} in ${archiveRequest.restoreBranch} branch preflight.`,
        );
      });
      return;
    }

    if (focusRequest) {
      queueMicrotask(() => {
        setTimelineFocusRequest(focusRequest);
      });
    }

    if (compareRequest) {
      queueMicrotask(() => {
        setCompareReportSelection({
          snapshotAId: compareRequest.snapshotAId,
          snapshotBId: compareRequest.snapshotBId,
          provenanceNote: compareRequest.provenanceNote ?? null,
        });
        navigate("studio");
        if (compareRequest.mode === "report") {
          setWorkspacePreset("report");
          setViewMode("report");
          setBottomTab("report");
        } else {
          setWorkspacePreset("compare");
          setViewMode("compare");
          setBottomTab("beforeafter");
        }
      });
      return;
    }

    if (focusRequest) {
      queueMicrotask(() => {
        navigate("studio");
        setWorkspacePreset("coverage");
        setViewMode("map");
        setBottomTab("timeline");
      });
    }
  }, [
    navigate,
    setArchiveHandoffRequest,
    setBottomTab,
    setCompareReportSelection,
    setLaunchNotice,
    setTimelineFocusRequest,
    setViewMode,
    setWorkspacePreset,
  ]);

  // Build the handlers object
  const handlers: ProductViewHandlers = {
    openStudio,
    openCoverageWorkspace,
    openCameraWall,
    openPathReplay,
    openCompareFixes,
    openIssues,
    openReport,
    runSimulation,
    openScene,
    openReferenceWorkspace,
    startDesignFlow,
    openFloorPlanFlow,
    openScanWizard,
    openGuidedScanAssistant,
    handleImportScene,
    createDraftFromScene,
    approveIntakeSession,
    rejectIntakeSession,
    approveAndRunBaseline,
    fileInputRef,
    importError,
  };

  return (
    <>
      <ProductViewRouter handlers={handlers} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        style={{ caretColor: "transparent" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const json = JSON.parse((e.target?.result as string) || "");
              const parsedDraft = parseImportSceneDraft(json);
              if (!parsedDraft.success) {
                setImportError(parsedDraft.error);
                return;
              }
              createDraftFromScene(parsedDraft.scene, parsedDraft.source, [file.name]);
              setImportError(null);
              navigate("site_draft_review");
            } catch {
              setImportError("Failed to parse JSON.");
            }
          };
          reader.readAsText(file);
          event.target.value = "";
        }}
      />

      {importError ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-red-400/25 bg-red-500/12 px-4 py-2 text-xs text-red-200 shadow-lg">
          {importError}
        </div>
      ) : null}
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioPageContent />
    </Suspense>
  );
}
