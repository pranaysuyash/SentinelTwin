"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import StudioShell from "@/components/layout/StudioShell";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { StudioDashboardHome } from "@/components/launcher/StudioDashboardHome";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel, summarizeDraftResult } from "@/lib/ai-layout-draft";
import { PRODUCT_FEATURE_STATUS } from "@/lib/product-feature-status";
import { createModelProvider, describeAiProviderSelection, providerKeyAvailable } from "@/agents/provider-selection";
import { simulateStudio } from "@/simulation/simulate-studio";

function formatClock(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export default function StudioPage() {
  const [enterStudio, setEnterStudio] = useState(false);
  const [queryBootEnabled, setQueryBootEnabled] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFloorPlanWizard, setShowFloorPlanWizard] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);
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
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);
  const savedProjects = useStudioStore((s) => s.savedProjects);
  const updateSavedSceneMetadata = useStudioStore((s) => s.updateSavedSceneMetadata);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);

  const currentResult = simulationResult ?? scene.simulation ?? null;
  const bootstrapRef = useRef(false);
  const currentRunLabel = useMemo(() => {
    const label = formatClock(currentResult?.computedAt);
    return label ? `Last run ${label}` : null;
  }, [currentResult?.computedAt]);
  const currentAiProvider = useMemo(() => describeAiProviderSelection(aiProviderSelection), [aiProviderSelection]);
  const aiDraftSummary = useMemo(
    () => (aiDraftPreview ? summarizeDraftResult(aiDraftPreview) : null),
    [aiDraftPreview],
  );
  const aiDraftComparison = useMemo(() => {
    if (!aiDraftSummary) return null;
    const current = {
      entryPoints: scene.entryPoints.length,
      cameras: scene.cameras.length,
      securityLights: scene.securityLights.length,
      obstructions: scene.obstructions.length,
      criticalZones: scene.criticalZones.length,
      paths: scene.paths.length,
    };
    const delta = {
      entryPoints: aiDraftSummary.counts.entryPoints - current.entryPoints,
      cameras: aiDraftSummary.counts.cameras - current.cameras,
      securityLights: aiDraftSummary.counts.securityLights - current.securityLights,
      obstructions: aiDraftSummary.counts.obstructions - current.obstructions,
      criticalZones: aiDraftSummary.counts.criticalZones - current.criticalZones,
      paths: aiDraftSummary.counts.paths - current.paths,
    };
    return { current, draft: aiDraftSummary.counts, delta };
  }, [aiDraftSummary, scene]);
  const aiDraftSceneJson = useMemo(
    () => (aiDraftPreview ? JSON.stringify(aiDraftPreview.scene, null, 2) : ""),
    [aiDraftPreview],
  );
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
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setQueryBootEnabled(new URLSearchParams(window.location.search).get("studio") === "1");
  }, []);

  useEffect(() => {
    refreshSavedScenesList();
  }, [refreshSavedScenesList]);

  useEffect(() => {
    if (bootstrapRef.current) return;
    if (currentResult || !simulationDirty || scene.source !== "demo") return;
    bootstrapRef.current = true;
    setSimulationRunning(true);
    const start = performance.now();
    const result = simulateStudio(scene);
    setSimulationResult(result, performance.now() - start);
  }, [currentResult, scene, scene.source, setSimulationResult, setSimulationRunning, simulationDirty]);

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
    setSimulationRunning(true);
    const start = performance.now();
    const result = simulateStudio(scene);
    setSimulationResult(result, performance.now() - start);
    setWorkspacePreset("coverage");
    setViewMode("map");
    setBottomTab("metrics");
    setEnterStudio(true);
  };

  const openScene = (nextScene = scene) => {
    setScene(nextScene);
    openStudio();
  };

  const handleImportScene = () => {
    if (!confirmWorkspaceReplacement("import a scene JSON")) return;
    fileInputRef.current?.click();
  };

  if (enterStudio || queryBootEnabled) {
    return <StudioShell />;
  }

  return (
    <>
      <StudioDashboardHome
        scene={scene}
        result={currentResult}
        simulationDirty={simulationDirty}
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
          setShowScanWizard(true);
        }}
        onAiDraft={() => {
          if (!confirmWorkspaceReplacement("open AI layout draft")) return;
          setShowAiDraft(true);
        }}
        onGuidedScanPlanned={() => setShowGuidedScanKickoff(true)}
        onVerifyFootagePlanned={() => setShowVerifyFootagePreview(true)}
        onOpenReport={openReport}
        onOpenScene={openScene}
        onUpdateProjectMetadata={updateSavedSceneMetadata}
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
            <h2 className="text-sm font-semibold text-white">Guided Scan Reconstruction (Planned)</h2>
            <p className="mt-1 text-xs text-[#91a4c5]">
              This future flow will guide capture, segmentation, and multi-photo reconstruction. Today, the manual-assisted scan flow is the product entry point.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-emerald-200">Manual-assisted flow available now</div>
                <div className="mt-1">Upload site photos and mark walls, doors, cameras, objects, lights, and zones</div>
                <div>Compile directly into an editable SecurityScene</div>
                <div>Run baseline simulation in Studio when camera and critical zone are present</div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Planned upgrades</div>
                <div>No automatic segmentation or depth solve yet</div>
                <div>Auto structure inference from multiple images</div>
                <div>Multi-photo correspondence + confidence surfacing</div>
                <div>Pose/FOV auto-assist suggestions</div>
                <div>Semi-automated reconstruction QA checks</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#22314b] bg-[#101827] px-3 py-2 text-[10px] text-[#b6c6e6]">
              Planning mode only: guided capture is not implemented yet, so the manual-assisted scan flow remains the supported entry point.
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
                  setShowScanWizard(true);
                  setLaunchNotice("Guided scan is planned. Opening the manual-assisted Scan Site flow instead.");
                }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Open Manual-Assisted Scan
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
              Model-backed if <code className="text-[#c4d5ff]">{currentAiProvider.envKey}</code> is set, otherwise a heuristic fallback is used. The generated scene will replace the current workspace.
              <span className="ml-2 rounded-full border border-[#2a3347] bg-[#0d1421] px-2 py-0.5 text-[9px] text-[#c4d5ff]">
                {currentAiProvider.providerLabel}
              </span>
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
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.cameras}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Lights</div>
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.securityLights}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Obstructions</div>
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.obstructions}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Zones</div>
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.criticalZones}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Paths</div>
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.paths}</div>
                  </div>
                  <div className="rounded-lg border border-[#22314b] bg-[#101827] px-2 py-1.5 text-[#b6c6e6]">
                    <div className="text-[#7e8fb0]">Entries</div>
                    <div className="text-sm font-semibold text-white">{aiDraftSummary.counts.entryPoints}</div>
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
                  <pre className="mt-2 max-h-52 overflow-auto rounded-xl border border-[#1e2a42] bg-[#08101b] p-3 text-[9px] leading-relaxed text-[#8ea2c5]">
                    {aiDraftSceneJson}
                  </pre>
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
                  try {
                    const provider = createModelProvider(aiProviderSelection);
                    const hasProviderKey = providerKeyAvailable(aiProviderSelection.providerId);
                    const draft = hasProviderKey
                      ? await draftSceneFromPromptWithModel(aiPrompt, provider)
                      : draftSceneFromPrompt(aiPrompt);
                    setAiDraftPreview(draft);
                    const warning =
                      draft.warnings[0] ?? (hasProviderKey ? `Model draft generated with ${currentAiProvider.providerLabel}.` : `Using heuristic draft because ${currentAiProvider.envKey} is not set.`);
                    const provenanceNote = `${draft.provenance.summary} (${draft.provenance.confidenceLevel} confidence)`;
                    setAiWarning(warning);
                    setAiDraftNotice(provenanceNote);
                  } catch (error) {
                    const fallback = draftSceneFromPrompt(aiPrompt);
                    setAiDraftPreview(fallback);
                    const warning = `Model draft failed; fallback used. ${error instanceof Error ? error.message : ""}`.trim();
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
                  if (!confirmWorkspaceReplacement("apply this AI layout draft")) return;
                  const provenanceNote = `${aiDraftPreview.provenance.summary} (${aiDraftPreview.provenance.confidenceLevel} confidence)`;
                  setScene(aiDraftPreview.scene);
                  setLaunchNotice(provenanceNote);
                  resetAiDraftPreview();
                  setShowAiDraft(false);
                  setTimeout(() => {
                    const store = useStudioStore.getState();
                    store.runSimulation();
                  }, 100);
                  openStudio();
                }}
                disabled={!aiDraftPreview || aiGenerating}
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
              Current support is a planning-assist overlay in Camera View, not a forensic verification pipeline.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-emerald-200">Available now</div>
                <div className="mt-1">Reference frame upload</div>
                <div>Local video ingest + frame extraction</div>
                <div>Multi-frame candidate strip + auto best-frame scoring</div>
                <div>Overlay/split comparison</div>
                <div>Alignment quality estimate</div>
                <div>Difference heat overlay</div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Not implemented yet</div>
                <div>Auto camera pose/FOV recovery</div>
                <div>ONVIF/RTSP integration</div>
                <div>Forensic-grade proof claims</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#22314b] bg-[#101827] px-3 py-2 text-[10px] text-[#b6c6e6]">
              Planning indicator only: modeled outcomes depend on assumptions and are not legal/forensic guarantees.
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
