"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Loader2,
  Moon,
  Play,
  Shield,
  Sun,
  Plus,
  Upload,
  Save,
  MoreHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";
import { useSimulation } from "@/hooks/use-simulation";
import { WorkspacePresetSwitcher } from "@/components/dock/WorkspacePresetSwitcher";

function SimStatus() {
  const dirty = useStudioStore((s) => s.simulationDirty);
  const running = useStudioStore((s) => s.simulationRunning);

  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-[10px] font-semibold text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </span>
    );
  }

  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-[10px] font-semibold text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        Needs Recompute
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-1 text-[10px] font-semibold text-emerald-300">
      <CheckCircle2 className="h-3 w-3" />
      Up to date
    </span>
  );
}

function SurfaceButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:border-green-900/40 disabled:bg-green-900/25 disabled:text-green-600",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TopBar() {
  const { runSimulation } = useSimulation();
  const envMode = useStudioStore((s) => s.environmentMode);
  const setEnvMode = useStudioStore((s) => s.setEnvironmentMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const scene = useStudioStore((s) => s.scene);
  const savedScenes = useStudioStore((s) => s.savedScenes);
  const createNewScene = useStudioStore((s) => s.createNewScene);
  const setScene = useStudioStore((s) => s.setScene);
  const importScene = useStudioStore((s) => s.importScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const deleteSavedScene = useStudioStore((s) => s.deleteSavedScene);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const exportScene = useStudioStore((s) => s.exportScene);
  const running = useStudioStore((s) => s.simulationRunning);
  const demoMode = useStudioStore((s) => s.demoMode);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);

  const [sceneOpen, setSceneOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    refreshSavedScenesList();
  }, [refreshSavedScenesList]);

  const handleImportScene = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const result = importScene(json);
        if (!result.success) {
          setImportError(result.error ?? "Invalid scene file");
          setTimeout(() => setImportError(null), 4000);
        } else {
          setImportError(null);
        }
      } catch {
        setImportError("Failed to parse JSON file");
        setTimeout(() => setImportError(null), 4000);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    event.target.value = "";
  }, [importScene]);

  const handleExportScene = useCallback(() => {
    const sceneExport = exportScene();
    const blob = new Blob([JSON.stringify(sceneExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sceneExport.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportScene]);

  return (
    <header className="flex h-12 items-center gap-2 border-b border-[#1e2130] bg-[#0c0f16]/96 px-2.5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex min-w-0 items-center gap-2 pr-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/12 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12px] font-semibold tracking-[0.01em] text-white">SentinelTwin Studio</div>
            <div className="truncate text-[9px] uppercase tracking-[0.22em] text-[#4d566b]">Camera Coverage Testbed</div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-[#1e2130] xl:block" />

        <div className="relative min-w-0">
          <button
            onClick={() => setSceneOpen((open) => !open)}
            className="flex h-7 min-w-[170px] max-w-[190px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <span className="truncate">Small Retail Shop Demo</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#546078]" />
          </button>
          {sceneOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setSceneOpen(false)}
            >
              {/* Saved scenes from localStorage */}
              {savedScenes.length > 0 && (
                <>
                  {savedScenes.map((saved) => (
                    <div key={saved.id} className="group flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          setScene(saved);
                          setSceneOpen(false);
                        }}
                        className={cn(
                          "flex-1 truncate rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-[#171c2b]",
                          saved.id === scene.id ? "text-emerald-400" : "text-[#c7d0e4]",
                        )}
                      >
                        {saved.name}
                      </button>
                      <button
                        onClick={() => deleteSavedScene(saved.id)}
                        className="hidden rounded-lg px-1.5 py-2 text-[9px] text-red-400 opacity-60 transition-colors hover:opacity-100 group-hover:block"
                        title="Delete scene"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-[#1e2130]" />
                </>
              )}
              {savedScenes.length === 0 && (
                <div className="px-2.5 py-2 text-[10px] text-[#4a5568]">No saved scenes yet</div>
              )}

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    handleExportScene();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  Export Scene JSON
                </button>
                <button
                  onClick={() => {
                    handleImportScene();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Upload className="h-3 w-3" />
                  Import Scene JSON
                </button>
                <button
                  onClick={() => {
                    createNewScene();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  New Blank Scene
                </button>
                <button
                  onClick={() => {
                    saveSceneToStorage();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Save className="h-3 w-3" />
                  Save Current Scene
                </button>
              </div>

              {/* Import error */}
              {importError && (
                <div className="mt-1.5 rounded-md bg-red-900/30 px-2.5 py-1.5 text-[9px] text-red-300">
                  {importError}
                </div>
              )}
            </div>
          )}

          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        <div className="hidden xl:block">
          <SimStatus />
        </div>

        <div className="relative">
          <button
            onClick={() => setEnvOpen((open) => !open)}
            className="flex h-7 min-w-[118px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <Sun className="h-3 w-3 text-amber-300" />
            <span>{envMode === "day" ? "Day Mode" : envMode === "night" ? "Night Mode" : "Dusk"}</span>
            <ChevronDown className="h-3 w-3 text-[#546078]" />
          </button>
          {envOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-40 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setEnvOpen(false)}
            >
              {(["day", "night", "dusk"] as const).map((mode) => (
                <button
                  key={mode}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left text-[11px] capitalize transition-colors hover:bg-[#171c2b]",
                    envMode === mode ? "text-emerald-400" : "text-[#c7d0e4]",
                  )}
                  onClick={() => {
                    setEnvMode(mode);
                    setEnvOpen(false);
                  }}
                >
                  {mode === "day" ? "Day Mode" : mode === "night" ? "Night Mode" : "Dusk"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <div className="xl:hidden">
          <SimStatus />
        </div>

        <WorkspacePresetSwitcher />

        <button
          onClick={runSimulation}
          disabled={running}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors",
            running
              ? "border border-green-900/40 bg-green-900/25 text-green-600"
              : "bg-green-600 text-white shadow-lg shadow-green-900/25 hover:bg-green-500",
          )}
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
          {running ? "Running" : "Run Simulation"}
        </button>

        <SurfaceButton onClick={() => setEnvMode(envMode === "night" ? "day" : "night")}>
          <Moon className="h-3 w-3" />
          Night Mode
        </SurfaceButton>

        <SurfaceButton
          onClick={() => {
            const { scene, updateNode, getSelectedCamera, selectNode } = useStudioStore.getState();
            const selectedCamera = getSelectedCamera();
            if (!selectedCamera) {
              const fallback = scene.cameras.find((camera) => camera.status === "on") ?? scene.cameras[0];
              if (!fallback) return;
              updateNode(fallback.id, { status: "off" });
              selectNode(fallback.id);
              return;
            }

            updateNode(selectedCamera.id, { status: selectedCamera.status === "on" ? "off" : "on" });
          }}
        >
          <Shield className="h-3 w-3" />
          Camera Failure
        </SurfaceButton>

        <SurfaceButton
          onClick={() =>
            saveSnapshot(
              `Snapshot ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
            )
          }
        >
          <Copy className="h-3 w-3" />
          Save Snapshot
        </SurfaceButton>

        <SurfaceButton onClick={() => setBottomTab("beforeafter")}>
          <Clapperboard className="h-3 w-3" />
          Compare
        </SurfaceButton>

        <SurfaceButton onClick={() => setBottomTab("report")}>
          <FileText className="h-3 w-3" />
          Generate Report
        </SurfaceButton>

        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setMoreOpen(false)}
            >
              <button
                onClick={() => {
                  setDemoMode(!demoMode);
                  setMoreOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                {demoMode ? "Exit Demo Mode" : "Enter Demo Mode"}
              </button>
              <button
                onClick={() => {
                  handleExportScene();
                  setMoreOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Download className="h-3 w-3" />
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
