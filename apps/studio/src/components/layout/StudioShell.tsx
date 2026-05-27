"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
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
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { CameraWallView } from "@/components/view/CameraWallView";
import { CameraViewMode } from "@/components/view/CameraViewMode";
import { PathReplayView } from "@/components/view/PathReplayView";
import { CompareView } from "@/components/view/CompareView";

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
      </motion.div>
    </AnimatePresence>
  );
}


function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: "⌘ + N", action: "New Scene" },
    { keys: "⌘ + S", action: "Save Scene" },
    { keys: "⌘ + O", action: "Open / Import Scene" },
    { keys: "1 – 5", action: "Switch View Mode (Map, Camera, Wall, Replay, Compare)" },
    { keys: "C", action: "Place Camera tool" },
    { keys: "B", action: "Place Obstruction tool" },
    { keys: "L", action: "Place Light tool" },
    { keys: "Esc", action: "Select tool / Cancel placement" },
    { keys: "?​?", action: "Toggle this shortcuts panel" },
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

export default function StudioShell() {
  useSimulation();
  const demoMode = useStudioStore((s) => s.demoMode);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const focusMode = useStudioStore((s) => s.focusMode);
  const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);
  const rightDockCollapsed = useStudioStore((s) => s.rightDockCollapsed);
  const bottomDockCollapsed = useStudioStore((s) => s.bottomDockCollapsed);
  const leftDockSizePx = useStudioStore((s) => s.leftDockSizePx);
  const rightDockSizePx = useStudioStore((s) => s.rightDockSizePx);
  const bottomDockSizePx = useStudioStore((s) => s.bottomDockSizePx);
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
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeSelectedNodes = useStudioStore((s) => s.removeSelectedNodes);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const createNewScene = useStudioStore((s) => s.createNewScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const fullCanvasMode = viewMode === "camera_view" || viewMode === "wall";

  // Read ?mode= from URL on mount only — prevents URL from overriding user's mode changes.
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (!mode) return;
    if (mode !== "map" && mode !== "wall" && mode !== "replay" && mode !== "camera_view" && mode !== "compare") {
      return;
    }
    setViewMode(mode as ViewMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Global keyboard shortcut handler
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

    // ?: Toggle shortcuts modal
    if (e.key === "?" && !e.shiftKey) {
      setShowShortcuts((v) => !v);
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

    // View mode keys: 1-5
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
  }, [activeTool, createNewScene, duplicateNode, redo, removeSelectedNodes, saveSceneToStorage, selectedNodeId, selectedNodeIds.length, setActiveTool, setViewMode, setWorkspacePreset, undo, viewMode]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />

      {fullCanvasMode ? (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <ViewModeBar />
          <WorkspaceArea />
          <CommandBar />
          {demoMode ? <DemoModeOverlay /> : null}
        </div>
      ) : (
        <DockLayout
          leftDock={
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
          }
          bottomDock={
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
          }
          rightDock={
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
          }
        >
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <ViewModeBar />
            <WorkspaceArea />
            <CommandBar />
            {demoMode ? <DemoModeOverlay /> : null}
          </div>
        </DockLayout>
      )}

      <StatusBar />

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
