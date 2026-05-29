"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSimulation } from "@/hooks/use-simulation";
import { useStudioStore, type ViewMode, type ActiveTool } from "@/store/studio-store";
import { VIEW_MODE_KEYS, VIEW_MODE_PRESETS, TOOL_SHORTCUTS } from "@/lib/studio-constants";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { LeftPanel } from "@/components/left-panel/LeftPanel";
import { ViewModeBar } from "@/components/view/ViewModeBar";
import { CommandBar } from "@/components/command-bar/CommandBar";
import { DemoModeOverlay } from "@/components/demo/DemoModeOverlay";
import { DockLayout } from "@/components/dock/DockLayout";
import { DockPanel } from "@/components/dock/DockPanel";
import { ContextBottomPanel } from "@/components/panels/ContextBottomPanel";
import { ContextRightPanel } from "@/components/panels/ContextRightPanel";
import { ViewSettingsModal } from "@/components/layout/ViewSettingsModal";
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { CameraWallView } from "@/components/view/CameraWallView";
import { CameraViewMode } from "@/components/view/CameraViewMode";
import { PathReplayView } from "@/components/view/PathReplayView";
import { CompareView } from "@/components/view/CompareView";
import { ReportView } from "@/components/view/ReportView";

function WorkspaceArea() {
  const viewMode = useStudioStore((s) => s.viewMode);

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, scale: 0.97, filter: "blur(2px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.97, filter: "blur(2px)" }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="absolute inset-0"
      >
        {viewMode === "map" && <WorkspaceCanvas />}
        {viewMode === "wall" && <CameraWallView />}
        {viewMode === "camera_view" && <CameraViewMode />}
        {viewMode === "replay" && <PathReplayView />}
        {viewMode === "compare" && <CompareView />}
        {viewMode === "report" && <ReportView />}
      </motion.div>
    </AnimatePresence>
  );
}


function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: "⌘ + N", action: "New Scene" },
    { keys: "⌘ + S", action: "Save Scene" },
    { keys: "⌘ + O", action: "Open / Import Scene" },
    { keys: "⌘ + Enter", action: "Run Simulation" },
    { keys: "← → ↑ ↓", action: "Nudge selected objects" },
    { keys: "1 – 6", action: "Switch View Mode (Map, Camera, Wall, Replay, Compare, Report)" },
    { keys: "V", action: "Select tool" },
    { keys: "C", action: "Place Camera tool" },
    { keys: "B", action: "Place Obstruction tool" },
    { keys: "L", action: "Place Light tool" },
    { keys: "Y", action: "Place Sensor tool" },
    { keys: "P", action: "Place Path tool" },
    { keys: "Z", action: "Place Zone tool" },
    { keys: "D", action: "Place Door/Window tool" },
    { keys: "W", action: "Place Wall tool" },
    { keys: "M", action: "Measure tool" },
    { keys: "T", action: "Comment tool" },
    { keys: "R", action: "Open Report" },
    { keys: "N", action: "Toggle Night Mode" },
    { keys: "F", action: "Toggle Focus Mode" },
    { keys: "S", action: "Save Snapshot" },
    { keys: "Esc", action: "Select tool / Cancel placement" },
    { keys: "?", action: "Toggle this shortcuts panel" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-xl border border-[#1f2536] bg-[#0d1017] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[11px] font-semibold text-white">Keyboard Shortcuts</div>
        <div className="space-y-2">
          {shortcuts.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between">
              <span className="text-[10px] text-[#8090a8]">{action}</span>
              <kbd className="rounded border border-[#24283a] bg-[#111521] px-2 py-0.5 font-mono text-[10px] text-[#c7d0e4]">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[9px] text-[#4a5568]">Press <kbd className="rounded border border-[#24283a] bg-[#111521] px-1 font-mono text-[9px]">?</kbd> or click anywhere to close.</p>
      </div>
    </div>
  );
}

function FirstRunGuide({ onClose, onOpenHelp }: { onClose: () => void; onOpenHelp: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] rounded-xl border border-[#26304a] bg-[#0d111a] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[13px] font-semibold text-white">Welcome to SentinelTwin Studio</div>
        <div className="mt-2 text-[12px] text-[#9fb0ce]">First run flow:</div>
        <ol className="mt-2 space-y-1 text-[12px] text-[#c6d3eb]">
          <li>1. Place/select cameras and assumptions.</li>
          <li>2. Run simulation with <kbd className="rounded border border-[#2a3248] bg-[#11182a] px-1">Ctrl/Cmd + Enter</kbd>.</li>
          <li>3. Open Security Outcome to review failures and causes.</li>
          <li>4. Preview Fix, compare before/after, then apply.</li>
        </ol>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onOpenHelp} className="rounded border border-[#2d3750] px-3 py-1.5 text-[11px] text-[#cfe0ff] hover:bg-[#161f31]">Open Help</button>
          <button onClick={onClose} className="rounded border border-emerald-500/35 px-3 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/10">Start</button>
        </div>
      </div>
    </div>
  );
}

export default function StudioShell() {
  useSimulation();
  const demoMode = useStudioStore((s) => s.demoMode);
  const launchNotice = useStudioStore((s) => s.launchNotice);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const focusMode = useStudioStore((s) => s.focusMode);
  const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);
  const rightDockCollapsed = useStudioStore((s) => s.rightDockCollapsed);
  const bottomDockCollapsed = useStudioStore((s) => s.bottomDockCollapsed);
  const leftDockSizePx = useStudioStore((s) => s.leftDockSizePx);
  const rightDockSizePx = useStudioStore((s) => s.rightDockSizePx);
  const bottomDockSizePx = useStudioStore((s) => s.bottomDockSizePx);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const toggleDock = useStudioStore((s) => s.toggleDock);
  const setDockSize = useStudioStore((s) => s.setDockSize);
  const enterFocusMode = useStudioStore((s) => s.enterFocusMode);
  const restorePreviousLayout = useStudioStore((s) => s.restorePreviousLayout);

  const viewMode = useStudioStore((s) => s.viewMode);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const translateSelectedNodes = useStudioStore((s) => s.translateSelectedNodes);
  const scene = useStudioStore((s) => s.scene);
  const rightPanelMode = useStudioStore((s) => s.rightPanelMode);
  const setRightPanelMode = useStudioStore((s) => s.setRightPanelMode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeSelectedNodes = useStudioStore((s) => s.removeSelectedNodes);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const createNewScene = useStudioStore((s) => s.createNewScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const editor = useStudioStore((s) => s.editor);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const uiDensity = useStudioStore((s) => s.uiDensity);
  const uiTheme = useStudioStore((s) => s.uiTheme);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const rightRailAutoSetRef = useRef(false);
  const fullCanvasMode = viewMode === "camera_view" || viewMode === "wall" || viewMode === "report";

  // Read ?mode= from URL on mount only — prevents URL from overriding user's mode changes.
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (!mode) return;
    if (mode !== "map" && mode !== "wall" && mode !== "replay" && mode !== "camera_view" && mode !== "compare" && mode !== "report") {
      return;
    }
    setViewMode(mode as ViewMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl+N: New Scene
    if (isCtrlOrMeta && e.key === "n") {
      e.preventDefault();
      if (confirm("Create a new blank scene? Unsaved changes will be lost.")) {
        createNewScene();
      }
      return;
    }

    // Ctrl+S: Save Scene
    if (isCtrlOrMeta && e.key === "s") {
      e.preventDefault();
      saveSceneToStorage();
      return;
    }

    // Ctrl+O: Open / Import
    if (isCtrlOrMeta && e.key === "o") {
      e.preventDefault();
      // Trigger the file input by dispatching a custom event
      // The TopBar already has a file input — we reuse it
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"][accept=".json"]');
      fileInput?.click();
      return;
    }

    // Ctrl+Enter: Run simulation
    if (isCtrlOrMeta && e.key === "Enter") {
      e.preventDefault();
      runSimulation();
      return;
    }

    // ?: Toggle shortcuts modal
    if (e.key === "?" && !e.shiftKey) {
      setShowShortcuts((v) => !v);
      return;
    }

    if (e.shiftKey && e.key.toLowerCase() === "v") {
      e.preventDefault();
      useStudioStore.getState().toggleViewSettingsOpen();
      return;
    }

    // Esc: Cancel placement, revert to select
    if (e.key === "Escape") {
      if (activeTool !== "select") {
        e.preventDefault();
        setActiveTool("select");
        return;
      }
      return;
    }

    // Undo / redo
    if (isCtrlOrMeta && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (activeTool === "select" && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") && (selectedNodeId || selectedNodeIds.length > 0)) {
      e.preventDefault();
      const baseStep = editor.snapEnabled ? editor.gridSnapM : 0.1;
      const step = e.shiftKey ? baseStep * 4 : e.altKey ? baseStep / 4 : baseStep;
      const delta: [number, number] = e.key === "ArrowUp"
        ? [0, -step]
        : e.key === "ArrowDown"
          ? [0, step]
          : e.key === "ArrowLeft"
            ? [-step, 0]
            : [step, 0];
      translateSelectedNodes(delta);
      return;
    }

    // Delete selected node
    if ((e.key === "Backspace" || e.key === "Delete") && (selectedNodeId || selectedNodeIds.length > 0)) {
      e.preventDefault();
      if (confirm("Delete the selected scene object? This can be undone.")) {
        removeSelectedNodes();
      }
      return;
    }

    if (isCtrlOrMeta && e.key.toLowerCase() === "d" && (selectedNodeId || selectedNodeIds.length > 0)) {
      e.preventDefault();
      duplicateNode(selectedNodeId ?? selectedNodeIds[0] ?? "");
      return;
    }

    // Single-key command shortcuts from the spec / shell hints
    if (!isCtrlOrMeta && e.key.toLowerCase() === "r") {
      e.preventDefault();
      setBottomTab("report");
      setViewMode("report");
      return;
    }

    if (!isCtrlOrMeta && e.key.toLowerCase() === "n") {
      e.preventDefault();
      useStudioStore.getState().setEnvironmentMode(useStudioStore.getState().environmentMode === "night" ? "day" : "night");
      return;
    }

    if (!isCtrlOrMeta && e.key.toLowerCase() === "f") {
      e.preventDefault();
      if (focusMode) {
        restorePreviousLayout();
      } else {
        enterFocusMode();
      }
      return;
    }

    if (!isCtrlOrMeta && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveSnapshot(`Snapshot ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
      return;
    }

    // View mode keys: 1-6
    if (VIEW_MODE_KEYS[e.key]) {
      const nextMode = VIEW_MODE_KEYS[e.key];
      if (viewMode !== nextMode) {
        setWorkspacePreset(VIEW_MODE_PRESETS[nextMode]);
        setViewMode(nextMode);
      }
      return;
    }

    // Tool shortcuts: C, B, L
    if (TOOL_SHORTCUTS[e.key.toLowerCase()]) {
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (activeTool === tool) {
        setActiveTool("select");
      } else {
        setActiveTool(tool);
      }
      return;
    }
  }, [activeTool, createNewScene, duplicateNode, editor.gridSnapM, editor.snapEnabled, enterFocusMode, focusMode, redo, removeSelectedNodes, restorePreviousLayout, runSimulation, saveSceneToStorage, saveSnapshot, selectedNodeId, selectedNodeIds, setActiveTool, setBottomTab, setViewMode, setWorkspacePreset, translateSelectedNodes, undo, viewMode]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Listen for custom event from TopBar keyboard button
  useEffect(() => {
    const handler = () => setShowShortcuts((v) => !v);
    window.addEventListener("sentineltwin:toggle-shortcuts", handler);
    return () => window.removeEventListener("sentineltwin:toggle-shortcuts", handler);
  }, []);

  useEffect(() => {
    if (!launchNotice) return;
    const timer = window.setTimeout(() => setLaunchNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [launchNotice, setLaunchNotice]);

  useEffect(() => {
    const key = "sentineltwin_first_run_guide_seen_v1";
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(key)) {
      queueMicrotask(() => {
        setShowFirstRunGuide(true);
        window.localStorage.setItem(key, "1");
      });
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = uiTheme;
    root.dataset.density = uiDensity;
    window.localStorage.setItem("sentineltwin_ui_theme", uiTheme);
    window.localStorage.setItem("sentineltwin_ui_density", uiDensity);
  }, [uiDensity, uiTheme]);

  useEffect(() => {
    if (!rightRailAutoSetRef.current) {
      rightRailAutoSetRef.current = true;
      if (!selectedNodeId && rightPanelMode === "inspector") {
        setRightPanelMode("security_status");
      }
      return;
    }

    if (selectedNodeId && rightPanelMode === "security_status") {
      setRightPanelMode("inspector");
    }
  }, [rightPanelMode, selectedNodeId, setRightPanelMode]);

  useEffect(() => {
    if (viewMode !== "camera_view") return;
    if (scene.cameras.length === 0) return;
    const selectedIsCamera = !!selectedNodeId && scene.cameras.some((camera) => camera.id === selectedNodeId);
    if (selectedIsCamera) return;
    const selectedCameraExists = !!selectedCameraId && scene.cameras.some((camera) => camera.id === selectedCameraId);
    if (selectedCameraExists) return;
  }, [scene.cameras, selectedCameraId, selectedNodeId, viewMode]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />
      {launchNotice ? (
        <div className="flex items-center justify-between gap-3 border-b border-cyan-500/15 bg-cyan-500/8 px-3 py-2 text-[11px] text-cyan-100">
          <div className="min-w-0">
            <span className="font-semibold text-cyan-200">Launcher result:</span>{" "}
            <span className="text-cyan-50">{launchNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLaunchNotice(null)}
            className="shrink-0 rounded border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <ViewSettingsModal />

      {fullCanvasMode ? (
        <div className="relative z-0 flex-1 min-h-0 overflow-hidden">
          {visibleComponents.view_mode_bar ? <ViewModeBar /> : null}
          <WorkspaceArea />
          {visibleComponents.command_bar ? <CommandBar /> : null}
          {demoMode ? <DemoModeOverlay /> : null}
        </div>
      ) : (
        <DockLayout
          leftDock={visibleComponents.left_dock ? (
            <DockPanel
              side="left"
              title="Scene Tools"
              subtitle={workspacePreset.replace(/_/g, " ")}
              workspacePreset={workspacePreset}
              collapsed={leftDockCollapsed}
              focusMode={focusMode}
              sizePx={leftDockSizePx}
              onToggle={() => toggleDock("left")}
              onResize={(sizePx) => setDockSize("left", sizePx)}
              onFocus={enterFocusMode}
              className="border-r"
            >
              <LeftPanel />
            </DockPanel>
          ) : null}
          bottomDock={visibleComponents.bottom_dock ? (
            <DockPanel
              side="bottom"
              title="Insights Drawer"
              subtitle={focusMode ? "Focus mode" : workspacePreset.replace(/_/g, " ")}
              workspacePreset={workspacePreset}
              collapsed={bottomDockCollapsed}
              focusMode={focusMode}
              sizePx={bottomDockSizePx}
              onToggle={() => toggleDock("bottom")}
              onResize={(sizePx) => setDockSize("bottom", sizePx)}
              onFocus={focusMode ? restorePreviousLayout : enterFocusMode}
            >
              <ContextBottomPanel sizePx={bottomDockSizePx} />
            </DockPanel>
          ) : null}
          rightDock={visibleComponents.right_dock ? (
            <DockPanel
              side="right"
              title="Inspector"
              subtitle={workspacePreset.replace(/_/g, " ")}
              workspacePreset={workspacePreset}
              collapsed={rightDockCollapsed}
              focusMode={focusMode}
              sizePx={rightDockSizePx}
              onToggle={() => toggleDock("right")}
              onResize={(sizePx) => setDockSize("right", sizePx)}
              onFocus={enterFocusMode}
              className="border-l"
            >
              <ContextRightPanel />
            </DockPanel>
          ) : null}
        >
          <div className="relative z-0 flex-1 min-h-0 overflow-hidden">
            {visibleComponents.view_mode_bar ? <ViewModeBar /> : null}
            <WorkspaceArea />
            {visibleComponents.command_bar ? <CommandBar /> : null}
            {demoMode ? <DemoModeOverlay /> : null}
          </div>
        </DockLayout>
      )}

      {visibleComponents.status_bar ? <StatusBar /> : null}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showFirstRunGuide && (
        <FirstRunGuide
          onClose={() => setShowFirstRunGuide(false)}
          onOpenHelp={() => {
            setBottomTab("help");
            setShowFirstRunGuide(false);
          }}
        />
      )}
    </div>
  );
}
