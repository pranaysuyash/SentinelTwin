"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import StudioShell from "@/components/layout/StudioShell";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { StudioDashboardHome } from "@/components/launcher/StudioDashboardHome";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel } from "@/lib/ai-layout-draft";
import { PRODUCT_FEATURE_STATUS } from "@/lib/product-feature-status";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { simulateStudio } from "@/simulation/simulate-studio";

function formatClock(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function StudioPage() {
  const [enterStudio, setEnterStudio] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Create a 10m x 7m electronics shop with front entry, two shelves, right-side cash counter, back storage, and two cameras.");
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scene = useStudioStore((s) => s.scene);
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
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);

  const currentResult = simulationResult ?? scene.simulation ?? null;
  const currentRunLabel = useMemo(() => {
    const label = formatClock(currentResult?.computedAt);
    return label ? `Last run ${label}` : null;
  }, [currentResult?.computedAt]);

  const hasQueryBoot = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("studio") === "1";
  }, []);

  useEffect(() => {
    refreshSavedScenesList();
  }, [refreshSavedScenesList]);

  const launchWorkspace = (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => {
    setWorkspacePreset(preset);
    setViewMode(viewMode);
    if (bottomTab) setBottomTab(bottomTab);
    setEnterStudio(true);
  };

  const openStudio = () => launchWorkspace("map", "edit", "metrics");
  const openCoverageWorkspace = () => launchWorkspace("camera_view", "coverage", "metrics");
  const openCameraWall = () => launchWorkspace("wall", "camera_wall", "metrics");
  const openPathReplay = () => launchWorkspace("replay", "replay", "timeline");
  const openCompareFixes = () => launchWorkspace("compare", "compare", "beforeafter");
  const openReport = () => launchWorkspace("map", "report", "report");
  const openIssues = () => launchWorkspace("map", "edit", "issues");

  const runSimulation = () => {
    setSimulationRunning(true);
    const start = performance.now();
    const result = simulateStudio(scene);
    setSimulationResult(result, performance.now() - start);
    setWorkspacePreset("coverage");
    setViewMode("camera_view");
    setBottomTab("metrics");
    setEnterStudio(true);
  };

  const openScene = (nextScene = scene) => {
    setScene(nextScene);
    openStudio();
  };

  const handleImportScene = () => {
    fileInputRef.current?.click();
  };

  if (enterStudio || hasQueryBoot) {
    return <StudioShell />;
  }

  return (
    <>
      <StudioDashboardHome
        scene={scene}
        result={currentResult}
        simulationDirty={simulationDirty}
        savedScenes={savedScenes}
        currentRunLabel={currentRunLabel}
        onOpenStudio={openStudio}
        onOpenCoverageWorkspace={openCoverageWorkspace}
        onOpenCameraWall={openCameraWall}
        onOpenPathReplay={openPathReplay}
        onOpenCompareFixes={openCompareFixes}
        onOpenIssues={openIssues}
        onRunSimulation={runSimulation}
        onCreateScene={() => setShowWizard(true)}
        onImportScene={handleImportScene}
        onScanSite={() => setShowScanWizard(true)}
        onAiDraft={() => setShowAiDraft(true)}
        onOpenReport={openReport}
        onOpenScene={openScene}
        onOpenMode={(viewMode, preset, bottomTab) => launchWorkspace(viewMode, preset, bottomTab)}
        featureStatus={PRODUCT_FEATURE_STATUS}
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

      {showScanWizard ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4">
          <div className="mx-auto h-full max-w-6xl rounded-2xl border border-[#1f2637] bg-[#0b0f17] shadow-2xl">
            <ScanSiteWizard
              onClose={() => {
                setShowScanWizard(false);
                setEnterStudio(true);
              }}
            />
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
              Model-backed if <code className="text-[#c4d5ff]">NEXT_PUBLIC_OPENAI_API_KEY</code> is set, otherwise a heuristic fallback is used. The generated scene will replace the current workspace.
            </div>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              className="mt-3 h-36 w-full rounded-lg border border-[#2a3347] bg-[#101827] p-3 text-xs text-[#d7e1f2] outline-none focus:border-blue-500/50"
            />
            {aiWarning ? <p className="mt-2 text-xs text-amber-300">{aiWarning}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowAiDraft(false)}
                className="rounded-lg border border-[#2a3347] px-3 py-1.5 text-xs text-[#9bb0cf]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setAiGenerating(true);
                  try {
                    const hasPublicKey = Boolean(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
                    const draft = hasPublicKey
                      ? await draftSceneFromPromptWithModel(aiPrompt, new OpenAIProvider())
                      : draftSceneFromPrompt(aiPrompt);
                    setScene(draft.scene);
                    const warning =
                      draft.warnings[0] ?? (hasPublicKey ? "Model draft generated without warnings." : "Using heuristic draft because NEXT_PUBLIC_OPENAI_API_KEY is not set.");
                    setAiWarning(warning);
                    setAiDraftNotice(warning);
                    setLaunchNotice(warning);
                  } catch (error) {
                    const fallback = draftSceneFromPrompt(aiPrompt);
                    setScene(fallback.scene);
                    const warning = `Model draft failed; fallback used. ${error instanceof Error ? error.message : ""}`.trim();
                    setAiWarning(warning);
                    setAiDraftNotice(warning);
                    setLaunchNotice(warning);
                  } finally {
                    setAiGenerating(false);
                    setShowAiDraft(false);
                    openStudio();
                  }
                }}
                disabled={aiGenerating}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                {aiGenerating ? "Generating..." : "Generate Draft Scene"}
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

      {importError ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-red-400/25 bg-red-500/12 px-4 py-2 text-xs text-red-200 shadow-lg">
          {importError}
        </div>
      ) : null}
    </>
  );
}
