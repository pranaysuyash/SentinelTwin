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
  LayoutDashboard,
  Loader2,
  Moon,
  Play,
  Settings2,
  Shield,
  Plus,
  ScanSearch,
  Upload,
  Save,
  MoreHorizontal,
  SlidersHorizontal,
  Undo2,
  Redo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { useProductViewStore } from "@/store/product-view-store";
import { useStudioStore } from "@/store/studio-store";
import { STUDIO_SHORTCUT_EVENTS } from "@/lib/studio-shortcuts";
import { WorkspacePresetSwitcher } from "@/components/dock/WorkspacePresetSwitcher";
import { BranchSwitcher } from "@/components/top-bar/BranchSwitcher";
import { FixSandboxBar } from "@/components/top-bar/FixSandboxBar";
import type { CriticalZoneNode, SecurityScene } from "@/schema/security-scene";
import { bakeoffToSecurityScene } from "@/lib/bakeoff-bridge";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

const TARGET_TYPE_OPTIONS: Array<{
  value: CriticalZoneNode["targetType"];
  label: string;
  hint: string;
}> = [
  { value: "person_detection", label: "Person Detection", hint: "Confirm a person is present in this area." },
  { value: "face_recognition", label: "Face Recognition", hint: "Support watchlist or known-person review where policy allows." },
  { value: "face_identification", label: "Face Identification", hint: "Require enough detail for higher-certainty identity review." },
  { value: "vehicle_detection", label: "Vehicle Detection", hint: "Monitor cars, bikes, and delivery movement." },
  { value: "license_plate", label: "License Plate", hint: "Check whether entry lanes have readable plate coverage." },
  { value: "package_detection", label: "Package Detection", hint: "Monitor counters, drop-off points, and parcels." },
  { value: "cash_counter_activity", label: "Cash Counter", hint: "Prioritize checkout and till activity." },
  { value: "door_entry_exit", label: "Entry / Exit", hint: "Review doorways, thresholds, and access points." },
  { value: "perimeter_breach", label: "Perimeter", hint: "Review fence lines, boundaries, and after-hours movement." },
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
  const progress = useStudioStore((s) => s.simulationProgress);

  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-[10px] font-semibold text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reviewing{progress !== null && progress > 0 ? ` ${Math.round(progress * 100)}%` : ""}
      </span>
    );
  }

  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-[10px] font-semibold text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        Review stale
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
  const navigateProductView = useProductViewStore((s) => s.navigate);
  const router = useRouter();
  const pathname = usePathname();
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
  const referenceScenes = useStudioStore((s) => s.referenceScenes);
  const setScene = useStudioStore((s) => s.setScene);
  const importScene = useStudioStore((s) => s.importScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const deleteSavedScene = useStudioStore((s) => s.deleteSavedScene);
  const duplicateSavedScene = useStudioStore((s) => s.duplicateSavedScene);
  const renameSavedScene = useStudioStore((s) => s.renameSavedScene);
  const duplicateReferenceToWorkspace = useStudioStore((s) => s.duplicateReferenceToWorkspace);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const exportScene = useStudioStore((s) => s.exportScene);
  const running = useStudioStore((s) => s.simulationRunning);
  const progress = useStudioStore((s) => s.simulationProgress);
  const demoMode = useStudioStore((s) => s.demoMode);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const canUndo = useStudioStore((s) => s.historyPast.length > 0);
  const canRedo = useStudioStore((s) => s.historyFuture.length > 0);
  const targetTypes = new Set(scene.criticalZones.map((zone) => zone.targetType));
  const currentTargetType = targetTypes.size === 1 ? [...targetTypes][0] ?? null : null;
  const currentTargetLabel = currentTargetType ? TARGET_TYPE_LABELS[currentTargetType] : TARGET_TYPE_LABELS[criticalZoneTargetType];

  // When at /studio (direct route), ProductViewRouter isn't mounted.
  // Navigate to root first so ProductViewRouter picks up the store change.
  const openFloorPlanImport = useCallback(() => {
    navigateProductView("floor_plan_import");
    if (pathname !== "/") router.push("/");
  }, [navigateProductView, pathname, router]);

  const openManualBuilder = useCallback(() => {
    navigateProductView("manual_builder");
    if (pathname !== "/") router.push("/");
  }, [navigateProductView, pathname, router]);

  const [sceneOpen, setSceneOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleNewBlankScene = useCallback(() => {
    setScene(createBlankSecurityScene());
    setSceneOpen(false);
  }, [setScene]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const handleCameraFailure = useCallback(() => {
    const { getSelectedCamera, updateNode, setBottomTab } = useStudioStore.getState();
    const selectedCamera = getSelectedCamera();
    if (!selectedCamera) return;
    updateNode(selectedCamera.id, { status: selectedCamera.status === "on" ? "off" : "on" });
    setBottomTab("redundancy");
  }, []);

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

  // Keyboard shortcut to enter fix sandbox (Ctrl+Shift+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        const { fixSandboxActive, enterFixSandbox, exitFixSandbox } = useStudioStore.getState();
        if (fixSandboxActive) {
          exitFixSandbox();
        } else {
          enterFixSandbox();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col">
    <header className="relative z-[320] isolate flex h-12 items-center gap-2 overflow-visible border-b border-[#1e2130] bg-[#0c0f16]/96 px-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2 pr-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/12 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12px] font-semibold tracking-[0.01em] text-white">SentinelTwin</div>
            <div className="truncate text-[10px] uppercase tracking-[0.18em] text-[#5a6882]">Security Site Twin</div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-[#1e2130] xl:block" />

        <SurfaceButton
          onClick={() => navigateProductView("product_home")}
          title="Return to Product Home"
          aria-label="Return to Product Home"
        >
          <LayoutDashboard className="h-3 w-3" />
          <span className="hidden lg:inline">Home</span>
        </SurfaceButton>

        <SurfaceButton
          onClick={() => navigateProductView("settings")}
          title="Open product preferences and consolidated settings"
          aria-label="Open settings"
          data-testid="topbar-settings"
        >
          <Settings2 className="h-3 w-3" />
          <span className="hidden lg:inline">Settings</span>
        </SurfaceButton>

        <div className="hidden h-5 w-px bg-[#1e2130] xl:block" />

        <BranchSwitcher />

        <div className="flex flex-shrink-0 items-center gap-1">
          <SurfaceButton
            onClick={openManualBuilder}
            title="Create a new site twin"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden md:inline">Create</span>
          </SurfaceButton>
          <div className="relative">
            <div className="flex items-center">
              <SurfaceButton
                onClick={openFloorPlanImport}
                title="Import a floor plan image"
                className="rounded-r-none border-r-0"
              >
                <Upload className="h-3 w-3" />
                <span className="hidden lg:inline">Import</span>
              </SurfaceButton>
              <button
                type="button"
                onClick={() => setImportOpen((o) => !o)}
                title="More import options"
                className="inline-flex h-7 items-center justify-center rounded-r-lg border border-[#24283a] bg-[#111521] px-1.5 text-[#6b7280] transition-colors hover:border-[#32384d] hover:text-white"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            {importOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setImportOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-[#1f2536] bg-[#0d1117] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] text-[#c7d0e4] hover:bg-[#161b26] hover:text-white"
                    onClick={() => { setImportOpen(false); openFloorPlanImport(); }}
                  >
                    <Upload className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Floor Plan</div>
                      <div className="text-[10px] text-[#6b7280]">Image → auto-generate walls</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] text-[#c7d0e4] hover:bg-[#161b26] hover:text-white"
                    onClick={() => { setImportOpen(false); handleImportScene(); }}
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Scene File</div>
                      <div className="text-[10px] text-[#6b7280]">.json exported site twin</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mr-1 hidden h-4 w-px flex-shrink-0 bg-[#1e2130] md:block" />

        <div className="flex items-center gap-0.5">
          <SurfaceButton
            onClick={() => useStudioStore.getState().undo()}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="h-3 w-3" />
          </SurfaceButton>
          <SurfaceButton
            onClick={() => useStudioStore.getState().redo()}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="h-3 w-3" />
          </SurfaceButton>
        </div>

        <div className="hidden h-4 w-px flex-shrink-0 bg-[#1e2130] md:block" />

        <div className="relative hidden min-w-0 md:block">
          <button type="button"
            onClick={() => setSceneOpen((open) => !open)}
            className="flex h-7 min-w-[128px] max-w-[18vw] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white xl:min-w-[170px] xl:max-w-[190px]"
          >
            <span className="truncate">{scene.name || "Untitled Site"}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#546078]" />
          </button>
          {sceneOpen && (
            <div
              className="absolute left-0 top-full z-[420] mt-1 w-64 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setSceneOpen(false)}
            >
              {/* User workspaces from localStorage */}
              {savedScenes.length > 0 ? (
                <>
                  <div className="px-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6f7f9d]">Your Workspaces</div>
                  {savedScenes.map((saved) => (
                    <div key={saved.id} className="group flex items-center gap-0.5">
                      <button type="button"
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
                      <button type="button"
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
                      <button type="button"
                        onClick={() => handleDuplicateSavedScene(saved.id)}
                        className="hidden rounded-lg px-1.5 py-2 text-[10px] text-sky-300 opacity-60 transition-colors hover:opacity-100 group-hover:block"
                        title="Duplicate scene"
                      >
                        ⧉
                      </button>
                      <button type="button"
                        onClick={() => handleRenameSavedScene(saved.id, saved.name, saved.source)}
                        disabled={saved.source === "demo"}
                        className={cn(
                          "hidden rounded-lg px-1.5 py-2 text-[10px] opacity-60 transition-colors hover:opacity-100 group-hover:block",
                          saved.source === "demo" ? "cursor-not-allowed text-[#55617b]" : "text-amber-300",
                        )}
                        title={saved.source === "demo" ? "Duplicate the reference baseline first to rename it" : "Rename scene"}
                      >
                        ✎
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-[#1e2130]" />
                </>
              ) : null}

              {/* Reference scenes */}
              {referenceScenes.length > 0 ? (
                <>
                  <div className="px-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6f7f9d]">
                    Reference Scenes
                    <span className="ml-1.5 font-normal normal-case text-[#55617b]">(duplicate to edit)</span>
                  </div>
                  {referenceScenes.map((ref) => (
                    <div key={ref.id} className="group flex items-center gap-0.5">
                      <button type="button"
                        onClick={() => {
                          duplicateReferenceToWorkspace(ref.id);
                          setSceneOpen(false);
                        }}
                        className="flex-1 truncate rounded-lg px-2.5 py-2 text-left text-[11px] text-[#8a96ab] transition-colors hover:bg-[#171c2b] hover:text-white"
                      >
                        {ref.name}
                      </button>
                      <button type="button"
                        onClick={() => {
                          duplicateReferenceToWorkspace(ref.id);
                          setSceneOpen(false);
                        }}
                        className="rounded-lg px-1.5 py-2 text-[10px] text-sky-400 opacity-60 transition-colors hover:opacity-100"
                        title="Duplicate reference as workspace"
                      >
                        ⧉
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-[#1e2130]" />
                </>
              ) : null}

              {savedScenes.length === 0 && referenceScenes.length === 0 && (
                <div className="px-2.5 py-3 text-[11px] text-[#6f7f9d]">No saved site twins yet</div>
              )}

              <div className="space-y-0.5">
                <button type="button"
                  onClick={() => {
                    handleExportScene();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  Export Site Twin File
                </button>
                <button type="button"
                  onClick={() => {
                    handleImportScene();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Upload className="h-3 w-3" />
                  Import Site Twin File
                </button>
                <button type="button"
                  onClick={() => {
                    navigateProductView("scan_site");
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <ScanSearch className="h-3 w-3" />
                  Scan a Site...
                </button>
                <button type="button"
                  onClick={handleNewBlankScene}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  New Blank Scene
                </button>
                <button type="button"
                  onClick={() => {
                    openManualBuilder();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  New Site Twin (Guided)...
                </button>
                <button type="button"
                  onClick={() => {
                    saveSceneToStorage();
                    setSceneOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
                >
                  <Save className="h-3 w-3" />
                  Save Current Site Twin
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

        <div className="relative hidden min-w-0 2xl:block">
          <button type="button"
            onClick={() => setTargetOpen((open) => !open)}
            className="flex h-7 max-w-[190px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
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
                <button type="button"
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
        <span className="hidden 2xl:inline-flex">
          <ExplainBadge
            text="Coverage targets describe what the camera view must support in a zone: noticing movement, recognizing a person, reading a plate, or reviewing activity. Changing the target reruns the same geometry against a stricter or looser operating need."
            side="right"
          />
        </span>

      </div>

      <div className="flex-1" />

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {/* Simulation status — always visible so workspace context is clear */}
        <SimStatus />

        <WorkspacePresetSwitcher />

        <SurfaceButton onClick={() => toggleViewSettingsOpen()} data-testid="topbar-view-settings">
          <SlidersHorizontal className="h-3 w-3" />
          <span className="hidden lg:inline">View</span>
        </SurfaceButton>

        <button
          type="button"
          aria-label="Open keyboard shortcuts"
          onClick={() => {}}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] transition-colors hover:border-[#32384d] hover:text-white"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </button>

        {/* Primary CTA */}
        <button type="button"
          onClick={runSimulation}
          disabled={running}
          title="Run the site review and refresh coverage, route exposure, redundancy, and report evidence."
          className={cn(
            "relative inline-flex h-7 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-3 text-[11px] font-semibold transition-colors",
            running
              ? "border border-green-900/40 bg-green-900/25 text-green-600"
              : "bg-green-600 text-white shadow-lg shadow-green-900/25 hover:bg-green-500",
          )}
        >
          {running && progress !== null ? (
            <span
              className="absolute inset-y-0 left-0 bg-green-700/30 transition-[width] duration-150"
              style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              aria-hidden
            />
          ) : null}
          <span className="relative inline-flex items-center gap-1.5">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
            {running ? `Reviewing${progress !== null && progress > 0 ? ` ${Math.round(progress * 100)}%` : ""}` : "Run Review"}
          </span>
        </button>

        {/* Overflow menu — all secondary actions live here, organized by function */}
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
              className="absolute right-0 top-full z-[420] mt-1 w-52 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
              onMouseLeave={() => setMoreOpen(false)}
            >
              {/* Simulation tools */}
              <div className="px-2.5 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#3d4f6a]">Simulation</div>
              <button type="button"
                onClick={() => { setEnvMode(envMode === "night" ? "day" : "night"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Moon className="h-3 w-3" />
                Night Mode
              </button>
              <button type="button"
                onClick={() => { handleCameraFailure(); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Shield className="h-3 w-3" />
                Test Camera Outage
              </button>
              <button type="button"
                onClick={() => { saveSnapshot(`Snapshot ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Copy className="h-3 w-3" />
                Save Snapshot
              </button>

              <div className="my-1 border-t border-[#1e2130]" />

              {/* Analysis jump targets */}
              <div className="px-2.5 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#3d4f6a]">Jump to</div>
              <button type="button"
                onClick={() => { setBottomTab("beforeafter"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Clapperboard className="h-3 w-3" />
                Compare
              </button>
              <button type="button"
                onClick={() => { setBottomTab("threat"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Crosshair className="h-3 w-3" />
                Path Risk
              </button>
              <button type="button"
                onClick={() => { setBottomTab("report"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <FileText className="h-3 w-3" />
                Prepare Report
              </button>
              <button type="button"
                onClick={() => { setBottomTab("assumptions"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Info className="h-3 w-3" />
                Assumptions
              </button>
              <button type="button"
                onClick={() => { setBottomTab("provenance"); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Evidence Trail
              </button>

              <div className="my-1 border-t border-[#1e2130]" />

              {/* Tools */}
              <button type="button"
                onClick={() => { setDemoMode(!demoMode); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                {demoMode ? "Exit Guided Walkthrough" : "Start Guided Walkthrough"}
              </button>
              <button type="button"
                onClick={() => { toggleViewSettingsOpen(); setMoreOpen(false); }}
                data-testid="more-view-settings"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <SlidersHorizontal className="h-3 w-3" />
                View Settings
              </button>
              <button type="button"
                onClick={() => { handleExportScene(); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Download className="h-3 w-3" />
                Export Site Twin File
              </button>
              <button type="button"
                onClick={() => { window.dispatchEvent(new CustomEvent(STUDIO_SHORTCUT_EVENTS.toggleShortcuts)); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#6c768f] transition-colors hover:bg-[#171c2b] hover:text-white"
              >
                <Keyboard className="h-3 w-3" />
                Keyboard Shortcuts
              </button>
            </div>
          )}
        </div>
      </div>

      </header>
      <FixSandboxBar />
    </div>
  );
}
