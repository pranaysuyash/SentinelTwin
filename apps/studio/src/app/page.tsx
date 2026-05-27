"use client";

import { FileUp, FolderOpen, Plus, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import StudioShell from "@/components/layout/StudioShell";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { useStudioStore } from "@/store/studio-store";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel } from "@/lib/ai-layout-draft";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { simulateStudio } from "@/simulation/simulate-studio";

export default function StudioPage() {
  const [enterStudio, setEnterStudio] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);
  const importScene = useStudioStore((s) => s.importScene);
  const setScene = useStudioStore((s) => s.setScene);
  const scene = useStudioStore((s) => s.scene);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setEnvironmentMode = useStudioStore((s) => s.setEnvironmentMode);
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);
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
              <span>1. What are you trying to protect?</span>
              <button
                onClick={() => {
                  setBottomTab("assumptions");
                  setEnterStudio(true);
                }}
                className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
              >
                Open Assumptions
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>2. Choose input: template, floor plan, or scan.</span>
              <button onClick={() => setShowWizard(true)} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Start Scene Wizard</button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>3. Build scene: walls, openings, cameras, obstructions, zones.</span>
              <button
                onClick={() => {
                  setViewMode("map");
                  setEnterStudio(true);
                }}
                className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]"
              >
                Open Map Builder
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>4. Run baseline simulation + inspect pass/fail and blind spots.</span>
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
                Run Baseline
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-[#1f2a40] px-2 py-1.5">
              <span>5. Next action: replay route, test night/failure, generate report.</span>
              <div className="flex gap-1">
                <button onClick={() => { setViewMode("replay"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Replay</button>
                <button onClick={() => { setEnvironmentMode("night"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Night</button>
                <button onClick={() => { setBottomTab("report"); setEnterStudio(true); }} className="rounded border border-[#2b3953] px-2 py-0.5 text-[9px] text-[#d2ddf0]">Report</button>
              </div>
            </div>
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
