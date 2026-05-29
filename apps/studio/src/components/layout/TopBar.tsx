"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Copy,
  Crosshair,
  Download,
  FileText,
  Info,
  Keyboard,
  Loader2,
  Moon,
  Play,
  Shield,
  Plus,
  ScanSearch,
  Upload,
  Save,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { useStudioStore } from "@/store/studio-store";
import { WorkspacePresetSwitcher } from "@/components/dock/WorkspacePresetSwitcher";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import type { CriticalZoneNode, SecurityScene } from "@/schema/security-scene";
import { bakeoffToSecurityScene } from "@/lib/bakeoff-bridge";

const TARGET_TYPE_OPTIONS: Array<{
  value: CriticalZoneNode["targetType"];
  label: string;
  hint: string;
}> = [
  { value: "person_detection", label: "Person Detection", hint: "General movement watch" },
  { value: "face_recognition", label: "Face Recognition", hint: "Recognize known faces" },
  { value: "face_identification", label: "Face Identification", hint: "Higher certainty face match" },
  { value: "vehicle_detection", label: "Vehicle Detection", hint: "Cars, bikes, deliveries" },
  { value: "license_plate", label: "License Plate", hint: "Entry lane / LPR" },
  { value: "package_detection", label: "Package Detection", hint: "Counter, drop-off, parcels" },
  { value: "cash_counter_activity", label: "Cash Counter", hint: "Checkout / till activity" },
  { value: "door_entry_exit", label: "Entry / Exit", hint: "Doors and thresholds" },
  { value: "perimeter_breach", label: "Perimeter", hint: "Fence or boundary breach" },
];

const TARGET_TYPE_LABELS: Record<CriticalZoneNode["targetType"], string> = {
  person_detection: "Person Detection",
  face_recognition: "Face Recognition",
  face_identification: "Face Identification",
  vehicle_detection: "Vehicle Detection",
  license_plate: "License Plate",
  package_detection: "Package Detection",
  cash_counter_activity: "Cash Counter",
  door_entry_exit: "Entry / Exit",
  perimeter_breach: "Perimeter",
};

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


export function TopBar() {
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const envMode = useStudioStore((s) => s.environmentMode);
  const setEnvMode = useStudioStore((s) => s.setEnvironmentMode);
  const setAllZoneTargetTypes = useStudioStore((s) => s.setAllZoneTargetTypes);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const toggleViewSettingsOpen = useStudioStore((s) => s.toggleViewSettingsOpen);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const scene = useStudioStore((s) => s.scene);
  const zoneCount = scene.criticalZones.length;
  const criticalZoneTargetType = useStudioStore((s) => s.criticalZoneTargetType);
  const savedScenes = useStudioStore((s) => s.savedScenes);
  const setScene = useStudioStore((s) => s.setScene);
  const importScene = useStudioStore((s) => s.importScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const deleteSavedScene = useStudioStore((s) => s.deleteSavedScene);
  const duplicateSavedScene = useStudioStore((s) => s.duplicateSavedScene);
  const renameSavedScene = useStudioStore((s) => s.renameSavedScene);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const exportScene = useStudioStore((s) => s.exportScene);
  const running = useStudioStore((s) => s.simulationRunning);
  const demoMode = useStudioStore((s) => s.demoMode);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const targetTypes = new Set(scene.criticalZones.map((zone) => zone.targetType));
  const currentTargetType = targetTypes.size === 1 ? [...targetTypes][0] ?? null : null;
  const currentTargetLabel = currentTargetType ? TARGET_TYPE_LABELS[currentTargetType] : TARGET_TYPE_LABELS[criticalZoneTargetType];

  const [sceneOpen, setSceneOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [scanWizardOpen, setScanWizardOpen] = useState(false);
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
        if (json && typeof json.image_id === "string" && Array.isArray(json.walls)) {
          const scene = bakeoffToSecurityScene(json, {
            knownDimensionM: 8,
            axisHint: "width",
          }, json.image_id);
          const result = importScene(scene);
          if (!result.success) {
            setImportError(result.error ?? "Bakeoff scene import failed");
            setTimeout(() => setImportError(null), 4000);
          } else {
            setImportError(null);
          }
          return;
        }
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

  const handleDuplicateSavedScene = useCallback((sceneId: string) => {
    const duplicate = duplicateSavedScene(sceneId);
    if (!duplicate) return;
    setScene(duplicate.scene);
    setSceneOpen(false);
  }, [duplicateSavedScene, setScene]);

  const handleRenameSavedScene = useCallback((savedSceneId: string, currentName: string, source: SecurityScene["source"]) => {
    if (source === "demo") return;
    const nextName = window.prompt("Rename scene", currentName);
    if (nextName == null) return;
    renameSavedScene(savedSceneId, nextName);
    refreshSavedScenesList();
    setSceneOpen(false);
  }, [refreshSavedScenesList, renameSavedScene]);

  return (
    <header className="relative z-[320] isolate flex h-12 items-center gap-2 overflow-visible border-b border-[#1e2130] bg-[#0c0f16]/96 px-2.5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex min-w-0 items-center gap-2 pr-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/12 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12px] font-semibold tracking-[0.01em] text-white">SentinelTwin</div>
            <div className="truncate text-[10px] uppercase tracking-[0.18em] text-[#5a6882]">AI Security Audit Studio</div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-[#1e2130] xl:block" />

        <div className="relative min-w-0">
          <button
            onClick={() => setSceneOpen((open) => !open)}
            className="flex h-7 min-w-[170px] max-w-[190px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <span className="truncate">{scene.name || "Untitled Scene"}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#546078]" />
          </button>
          {sceneOpen && (
            <div
              className="absolute left-0 top-full z-[420] mt-1 w-56 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
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
                        onClick={() => {
                          if (confirm(`Delete saved scene "${saved.name}"? This cannot be undone.`)) {
                            deleteSavedScene(saved.id);
                          }
                        }}
                        className="hidden rounded-lg px-1.5 py-2 text-[10px] text-red-400 opacity-60 transition-colors hover:opacity-100 group-hover:block"
                        title="Delete scene"
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => handleDuplicateSavedScene(saved.id)}
                        className="hidden rounded-lg px-1.5 py-2 text-[10px] text-sky-300 opacity-60 transition-colors hover:opacity-100 group-hover:block"
                        title="Duplicate scene"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => handleRenameSavedScene(saved.id, saved.name, saved.source)}
                        disabled={saved.source === "demo"}
                        className={cn(
                          "hidden rounded-lg px-1.5 py-2 text-[10px] opacity-60 transition-colors hover:opacity-100 group-hover:block",
                          saved.source === "demo" ? "cursor-not-allowed text-[#55617b]" : "text-amber-300",
                        )}
                        title={saved.source === "demo" ? "Duplicate the demo first to rename it" : "Rename scene"}
                      >
                        ✎
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-[#1e2130]" />
                </>
              )}
              {savedScenes.length === 0 && (
                <div className="px-2.5 py-2 text-[11px] text-[#6f7f9d]">No saved scenes yet</div>
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
                    setScanWizardOpen(true);
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <ScanSearch className="h-3 w-3" />
                  Scan a Site...
                </button>
                <button
                  onClick={() => {
                    setWizardOpen(true);
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  New Scene...
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

        <div className="relative">
          <button
            onClick={() => setTargetOpen((open) => !open)}
            className="flex h-7 min-w-[130px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <Shield className="h-3 w-3 text-cyan-300" />
            <span className="truncate">
              {zoneCount > 0 && scene.criticalZones.every((zone) => zone.targetType === criticalZoneTargetType)
                ? `Target: ${currentTargetLabel}`
                : `Default Target: ${currentTargetLabel}`}
            </span>
            <ChevronDown className="h-3 w-3 text-[#546078]" />
          </button>
          {targetOpen && (
            <div
              className="absolute left-0 top-full z-[420] mt-1 w-64 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setTargetOpen(false)}
            >
              {TARGET_TYPE_OPTIONS.map((entry) => (
                <button
                  key={entry.value}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#171c2b]"
                  onClick={() => {
                    useStudioStore.getState().setCriticalZoneTargetType(entry.value);
                    setAllZoneTargetTypes(entry.value);
                    setTargetOpen(false);
                  }}
                >
                  <div className="text-[11px] font-medium text-[#c7d0e4]">{entry.label}</div>
                  <div className="text-[9px] text-[#5b667c]">{entry.hint}</div>
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

        <SurfaceButton onClick={() => toggleViewSettingsOpen()} data-testid="topbar-view-settings">
          <SlidersHorizontal className="h-3 w-3" />
          <span className="hidden lg:inline">View Settings</span>
        </SurfaceButton>

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
          {running ? "Running" : "Simulate"}
        </button>

        {/* Secondary actions — collapse into more menu below xl */}
        <div className="hidden items-center gap-1.5 xl:flex">
          <SurfaceButton onClick={() => setEnvMode(envMode === "night" ? "day" : "night")}>
            <Moon className="h-3 w-3" />
            Night
          </SurfaceButton>

          <SurfaceButton
            onClick={() => {
              const { scene, updateNode, getSelectedCamera, selectNode } = useStudioStore.getState();
              const selectedCamera = getSelectedCamera();
              if (!selectedCamera) return;
              updateNode(selectedCamera.id, { status: selectedCamera.status === "on" ? "off" : "on" });
            }}
          >
            <Shield className="h-3 w-3" />
            Failure
          </SurfaceButton>

          <SurfaceButton
            onClick={() =>
              saveSnapshot(
                `Snapshot ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
              )
            }
          >
            <Copy className="h-3 w-3" />
            Snapshot
          </SurfaceButton>

          <SurfaceButton onClick={() => setBottomTab("beforeafter")}>
            <Clapperboard className="h-3 w-3" />
            Compare
          </SurfaceButton>

          <SurfaceButton onClick={() => setBottomTab("threat")}>
            <Crosshair className="h-3 w-3" />
            Threat
          </SurfaceButton>

          <SurfaceButton onClick={() => setBottomTab("report")}>
            <FileText className="h-3 w-3" />
            Report
          </SurfaceButton>

          <SurfaceButton onClick={() => setBottomTab("assumptions")}>
            <Info className="h-3 w-3" />
            Assumptions
          </SurfaceButton>

          <SurfaceButton onClick={() => setBottomTab("provenance")}>
            <SlidersHorizontal className="h-3 w-3" />
            Provenance
          </SurfaceButton>

          {/* Visible keyboard shortcut toggle */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("sentineltwin:toggle-shortcuts"))}
            aria-label="Open keyboard shortcuts"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] transition-colors hover:border-[#32384d] hover:text-white"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Overflow menu (always visible) — contains secondary actions on narrow viewports + extras */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Open more actions"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls="topbar-more-menu"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreOpen && (
            <div
              id="topbar-more-menu"
              className="absolute right-0 top-full z-[420] mt-1 w-44 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setMoreOpen(false)}
            >
              {/* XL-only actions shown in menu for narrow widths */}
              <div className="xl:hidden">
                <button
                  onClick={() => { setEnvMode(envMode === "night" ? "day" : "night"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Moon className="h-3 w-3" />
                  Night Mode
                </button>
                <button
                  onClick={() => { const s = useStudioStore.getState(); const cam = s.getSelectedCamera(); if (cam) s.updateNode(cam.id, { status: cam.status === "on" ? "off" : "on" }); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Shield className="h-3 w-3" />
                  Camera Failure
                </button>
                <button
                  onClick={() => { saveSnapshot(`Snapshot ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  Save Snapshot
                </button>
                <button
                  onClick={() => { setBottomTab("beforeafter"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Clapperboard className="h-3 w-3" />
                  Compare
                </button>
                <button
                  onClick={() => { setBottomTab("threat"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Crosshair className="h-3 w-3" />
                  Threat Path
                </button>
                <button
                  onClick={() => { setBottomTab("report"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <FileText className="h-3 w-3" />
                  Generate Report
                </button>
                <button
                  onClick={() => { setBottomTab("assumptions"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Info className="h-3 w-3" />
                  Assumptions
                </button>
                <button
                  onClick={() => { setBottomTab("provenance"); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Provenance
                </button>
                <div className="my-1 border-t border-[#1e2130]" />
              </div>
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
                  toggleViewSettingsOpen();
                  setMoreOpen(false);
                }}
                data-testid="more-view-settings"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <SlidersHorizontal className="h-3 w-3" />
                View Settings
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
              <div className="xl:hidden">
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent("sentineltwin:toggle-shortcuts")); setMoreOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Keyboard className="h-3 w-3" />
                  Shortcuts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {wizardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative h-[520px] w-[640px] overflow-hidden rounded-2xl border border-[#202536] shadow-2xl shadow-black/50">
            <SceneBuilderWizard onClose={() => setWizardOpen(false)} />
          </div>
        </div>
      )}

      {scanWizardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative h-[720px] w-[1120px] overflow-hidden rounded-2xl border border-[#202536] shadow-2xl shadow-black/50">
            <ScanSiteWizard onClose={() => setScanWizardOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
