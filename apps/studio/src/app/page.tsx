"use client";

import { ArrowRight, FileUp, FolderOpen, Plus, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import StudioShell from "@/components/layout/StudioShell";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { useStudioStore } from "@/store/studio-store";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel } from "@/lib/ai-layout-draft";
import { PRODUCT_FEATURE_STATUS, PRODUCT_FEATURE_STATUS_LAST_VERIFIED } from "@/lib/product-feature-status";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { simulateStudio } from "@/simulation/simulate-studio";

export default function StudioPage() {
  const [enterStudio, setEnterStudio] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);
  const importScene = useStudioStore((s) => s.importScene);
  const setScene = useStudioStore((s) => s.setScene);
  const scene = useStudioStore((s) => s.scene);
  const savedScenes = useStudioStore((s) => s.savedScenes);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setEnvironmentMode = useStudioStore((s) => s.setEnvironmentMode);
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);
  const updateNode = useStudioStore((s) => s.updateNode);
  const runCounterfactual = useStudioStore((s) => s.runCounterfactual);
  const sceneName = useStudioStore((s) => s.scene.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Create a 10m x 7m electronics shop with front entry, two shelves, right-side cash counter, back storage, and two cameras.");
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  const hasQueryBoot = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("studio") === "1";
  }, []);

  useEffect(() => {
    refreshSavedScenesList();
  }, [refreshSavedScenesList]);

  if (enterStudio || hasQueryBoot) {
    return <StudioShell />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0f17] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.08),transparent_30%)]" />
      <section className="relative z-10 w-full max-w-3xl rounded-2xl border border-[#1f2637] bg-[#0f1522]/96 p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/12">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">SentinelTwin Studio</h1>
            <p className="text-xs text-[#9caccc]">Start from a scene, then verify coverage outcomes.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setShowWizard(true)}
            className="group rounded-xl border border-[#2a3347] bg-[#131c2b] p-4 text-left transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
          >
            <div className="mb-2 flex items-center gap-2 text-white">
              <Plus className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold">Create or Import Scene</span>
            </div>
            <p className="text-xs text-[#8e9ab3]">Blank room, template, or floor-plan import wizard.</p>
          </button>

          <button
            onClick={() => setShowScanWizard(true)}
            className="group rounded-xl border border-[#2a3347] bg-[#131c2b] p-4 text-left transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
          >
            <div className="mb-2 flex items-center gap-2 text-white">
              <ScanSearch className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold">Scan a Site</span>
            </div>
            <p className="text-xs text-[#8e9ab3]">Upload a site photo, tap objects, classify them, and compile to Studio.</p>
          </button>

          <button
            onClick={() => setEnterStudio(true)}
            className="group rounded-xl border border-[#2a3347] bg-[#131c2b] p-4 text-left transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
          >
            <div className="mb-2 flex items-center gap-2 text-white">
              <FolderOpen className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold">Open Current Workspace</span>
            </div>
            <p className="text-xs text-[#8e9ab3]">Continue with loaded scene: {sceneName || "Untitled Scene"}.</p>
          </button>

          <button
            onClick={() => setShowAiDraft(true)}
            className="group rounded-xl border border-[#2a3347] bg-[#131c2b] p-4 text-left transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
          >
            <div className="mb-2 flex items-center gap-2 text-white">
              <Plus className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-semibold">AI Layout Draft</span>
            </div>
            <p className="text-xs text-[#8e9ab3]">Generate a draft SecurityScene JSON from a text prompt.</p>
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-[#212a3c] bg-[#0f1726] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-white">Workspace Resume</div>
              <p className="mt-0.5 text-[9px] text-[#7584a3]">
                Resume the current scene, or open one of the saved workspaces that already lives in local storage.
              </p>
            </div>
            <div className="rounded-full border border-[#2a3550] bg-[#111827] px-2 py-1 text-[9px] text-[#9ab0ce]">
              {savedScenes.length} saved
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-lg border border-[#1f2a40] bg-[#111827] p-3">
              <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#7584a3]">Current Workspace</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{sceneName || "Untitled Scene"}</div>
                  <div className="mt-0.5 text-[9px] text-[#7f91b2]">
                    Resume this scene to continue editing, simulating, and reporting without rebuilding state.
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-[#9ab0ce] sm:grid-cols-4">
                <div className="rounded-md border border-[#1f2a40] bg-[#0f1623] px-2 py-1.5">
                  <div className="text-[#7584a3]">Cameras</div>
                  <div className="mt-0.5 font-mono text-white">{scene.cameras.length}</div>
                </div>
                <div className="rounded-md border border-[#1f2a40] bg-[#0f1623] px-2 py-1.5">
                  <div className="text-[#7584a3]">Lights</div>
                  <div className="mt-0.5 font-mono text-white">{scene.securityLights.length}</div>
                </div>
                <div className="rounded-md border border-[#1f2a40] bg-[#0f1623] px-2 py-1.5">
                  <div className="text-[#7584a3]">Obstructions</div>
                  <div className="mt-0.5 font-mono text-white">{scene.obstructions.length}</div>
                </div>
                <div className="rounded-md border border-[#1f2a40] bg-[#0f1623] px-2 py-1.5">
                  <div className="text-[#7584a3]">Zones</div>
                  <div className="mt-0.5 font-mono text-white">{scene.criticalZones.length}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setEnterStudio(true)}
                className="flex w-full items-center justify-between rounded-lg border border-[#263349] bg-[#131d2d] px-3 py-2 text-left transition-colors hover:border-[#395076] hover:bg-[#172235]"
              >
                <div>
                  <div className="text-[10px] font-semibold text-white">Resume Current Workspace</div>
                  <div className="text-[9px] text-[#8b96ae]">Open the scene already loaded in memory.</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[#5fb0ff]" />
              </button>
              <button
                onClick={() => {
                  setBottomTab("metrics");
                  setEnterStudio(true);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-[#263349] bg-[#131d2d] px-3 py-2 text-left transition-colors hover:border-[#395076] hover:bg-[#172235]"
              >
                <div>
                  <div className="text-[10px] font-semibold text-white">Open Coverage Workspace</div>
                  <div className="text-[9px] text-[#8b96ae]">Jump straight into the latest simulation and analysis tabs.</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[#5fb0ff]" />
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[#1f2a40] bg-[#0d1420] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7584a3]">Saved Scenes</div>
              <div className="text-[9px] text-[#7f91b2]">
                {savedScenes.length > 0 ? "Open any saved workspace directly from the launcher." : "No saved scenes yet."}
              </div>
            </div>
            {savedScenes.length > 0 ? (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {savedScenes.map((saved) => (
                  <button
                    key={saved.id}
                    onClick={() => {
                      setScene(saved);
                      setEnterStudio(true);
                    }}
                    className="rounded-md border border-[#1f2a40] bg-[#111827] px-2.5 py-2 text-left transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
                  >
                    <div className="truncate text-[10px] font-medium text-[#d9e5ff]">{saved.name}</div>
                    <div className="mt-0.5 text-[8px] text-[#7f91b2]">
                      {saved.cameras.length} cameras · {saved.obstructions.length} obstructions · {saved.criticalZones.length} zones
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-md border border-dashed border-[#1f2a40] px-2.5 py-3 text-[9px] text-[#6f7f9b]">
                Save a scene from Studio to make it appear here for one-click resume.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#212a3c] bg-[#111827] p-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2e3850] bg-[#192234] px-3 py-2 text-xs text-[#d2d9e8] hover:bg-[#1c2940]"
          >
            <FileUp className="h-3.5 w-3.5" />
            Import Scene JSON
          </button>
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
                  setEnterStudio(true);
                } catch {
                  setImportError("Failed to parse JSON.");
                }
              };
              reader.readAsText(file);
              event.target.value = "";
            }}
          />
          {importError ? <p className="mt-2 text-xs text-red-300">{importError}</p> : null}
        </div>

        <div className="mt-4 rounded-lg border border-[#212a3c] bg-[#101824] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Guided Security Workflow (Goal2)
          </div>
          <div className="space-y-1.5 text-[10px] text-[#9ab0ce]">
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>1. Define outcomes: what must be detected/recognized and when?</span>
              <button
                onClick={() => {
                  setBottomTab("assumptions");
                  setEnterStudio(true);
                }}
                className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
              >
                Set Assumptions
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>2. Choose source: template, floor plan, scan, or AI draft.</span>
              <button onClick={() => setShowWizard(true)} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Create Scene</button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>3. Model site geometry: walls/openings/cameras/obstructions/zones.</span>
              <button
                onClick={() => {
                  setViewMode("map");
                  setEnterStudio(true);
                }}
                className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
              >
                Open Site Map
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>4. Verify baseline: run simulation and inspect pass/fail, blind spots, reasons.</span>
              <button
                onClick={() => {
                  setSimulationRunning(true);
                  const start = performance.now();
                  const result = simulateStudio(scene);
                  setSimulationResult(result, performance.now() - start);
                  setBottomTab("metrics");
                  setEnterStudio(true);
                }}
                className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
              >
                Run Baseline Check
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>5. Harden and report: replay route, stress conditions, then export evidence.</span>
              <div className="flex gap-1">
                <button onClick={() => { setViewMode("replay"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Replay Route</button>
                <button onClick={() => { setEnvironmentMode("night"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Night Stress</button>
                <button
                  onClick={() => {
                    const target = scene.cameras.find((camera) => camera.status === "on") ?? scene.cameras[0];
                    if (target) updateNode(target.id, { status: "off" });
                    setBottomTab("issues");
                    setEnterStudio(true);
                  }}
                  disabled={scene.cameras.length === 0}
                  title={scene.cameras.length === 0 ? "Add a camera to run failure drill." : undefined}
                  className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
                >
                  Failure Drill
                </button>
                <button
                  onClick={() => {
                    const targetObs = scene.obstructions.find((obs) => obs.movableByAI) ?? scene.obstructions[0];
                    if (targetObs) runCounterfactual(targetObs.id);
                    setBottomTab("counterfactual");
                    setEnterStudio(true);
                  }}
                  disabled={scene.obstructions.length === 0}
                  title={scene.obstructions.length === 0 ? "Add an obstruction to test counterfactual fix." : undefined}
                  className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
                >
                  Test Cheapest Fix
                </button>
                <button onClick={() => { setBottomTab("report"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Export Report</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#212a3c] bg-[#0f1726] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-semibold text-white">Product Feature Status</div>
            <div className="text-[9px] text-[#7584a3]">Last verified: {PRODUCT_FEATURE_STATUS_LAST_VERIFIED}</div>
          </div>
          <div className="space-y-1.5 text-[10px] text-[#9ab0ce]">
            {PRODUCT_FEATURE_STATUS.map((entry) => (
              <div key={entry.feature} className="flex items-start gap-2 rounded border border-[#1f2a40] px-2 py-1.5">
                <span
                  className={
                    entry.status === "Available"
                      ? "rounded border border-emerald-400/35 bg-emerald-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-300"
                      : entry.status === "Preview"
                        ? "rounded border border-amber-400/35 bg-amber-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-300"
                        : "rounded border border-[#3a455f] bg-[#1a2436] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9fb0cf]"
                  }
                >
                  {entry.status}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-[#d9e5ff]">{entry.feature}</div>
                  <div className="text-[9px] text-[#7f91b2]">{entry.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                    setAiWarning(
                      draft.warnings[0] ?? (hasPublicKey ? null : "Using heuristic draft because NEXT_PUBLIC_OPENAI_API_KEY is not set."),
                    );
                  } catch (error) {
                    const fallback = draftSceneFromPrompt(aiPrompt);
                    setScene(fallback.scene);
                    setAiWarning(
                      `Model draft failed; fallback used. ${error instanceof Error ? error.message : ""}`.trim(),
                    );
                  } finally {
                    setAiGenerating(false);
                    setShowAiDraft(false);
                    setEnterStudio(true);
                  }
                }}
                disabled={aiGenerating}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                {aiGenerating ? "Generating..." : "Generate Draft Scene"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
