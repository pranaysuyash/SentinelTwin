"use client";

import { useRef, useState } from "react";
import type { ProductViewHandlers } from "@/components/product/ProductViewRouter";
import type { SecurityScene } from "@/schema/security-scene";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { useProductViewStore } from "@/store/product-view-store";
import { createSiteIntakeSession } from "@/lib/site-compiler";
import { promoteToActiveScene } from "@/lib/site-draft-approval";
import { parseImportSceneDraft } from "@/lib/import-scene-draft";

export function useStudioNavigation(): ProductViewHandlers & {
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
} {
  const navigate = useProductViewStore((s) => s.navigate);

  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setActiveWorkflow = useStudioStore((s) => s.setActiveWorkflow);
  const setActiveWorkflowStep = useStudioStore((s) => s.setActiveWorkflowStep);
  const setScene = useStudioStore((s) => s.setScene);
  const setSiteIntakeSession = useStudioStore((s) => s.setSiteIntakeSession);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const setDemoStep = useStudioStore((s) => s.setDemoStep);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const runSimulationFromStore = useStudioStore((s) => s.runSimulation);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);

  const scene = useStudioStore((s) => s.scene);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const savedProjects = useStudioStore((s) => s.savedProjects);
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId);
  const historyDepth = useStudioStore((s) => s.historyPast.length);

  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (activeWorkflowId === "audit") setActiveWorkflowStep(2);
  };

  const openCompareFixes = () => {
    launchWorkspace("compare", "compare", "beforeafter");
    if (activeWorkflowId === "audit") setActiveWorkflowStep(4);
  };

  const openReport = () => {
    launchWorkspace("report", "report", "report");
    if (activeWorkflowId === "audit") setActiveWorkflowStep(5);
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
      beforeSummary: `${scene.name || "Current workspace"} \u00b7 ${scene.cameras.length} cameras \u00b7 ${scene.criticalZones.length} critical zones`,
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
      beforeSummary: `${scene.name || "Current workspace"} \u00b7 ${scene.cameras.length} cameras \u00b7 ${scene.criticalZones.length} critical zones`,
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
      beforeSummary: `${scene.name || "Workspace"} \u00b7 ${scene.cameras.length} cameras \u00b7 ${scene.criticalZones.length} critical zones`,
      afterSummary: `${approvedScene.name || "Approved scene"} \u00b7 ${approvedScene.cameras.length} cameras \u00b7 ${approvedScene.criticalZones.length} critical zones`,
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    reader.onerror = () => {
      setImportError("Failed to read file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return {
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
    handleFileChange,
  };
}
