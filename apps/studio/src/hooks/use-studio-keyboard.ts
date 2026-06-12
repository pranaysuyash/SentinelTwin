"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/store/studio-store";
import { VIEW_MODE_KEYS, VIEW_MODE_PRESETS, TOOL_SHORTCUTS } from "@/lib/studio-constants";

export function useStudioKeyboard() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const viewMode = useStudioStore((s) => s.viewMode);
  const focusMode = useStudioStore((s) => s.focusMode);
  const editor = useStudioStore((s) => s.editor);

  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const translateSelectedNodes = useStudioStore((s) => s.translateSelectedNodes);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeSelectedNodes = useStudioStore((s) => s.removeSelectedNodes);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const createNewScene = useStudioStore((s) => s.createNewScene);
  const saveSceneToStorage = useStudioStore((s) => s.saveSceneToStorage);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const enterFocusMode = useStudioStore((s) => s.enterFocusMode);
  const restorePreviousLayout = useStudioStore((s) => s.restorePreviousLayout);

  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
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
    if (e.key === "?") {
      window.dispatchEvent(new CustomEvent("sentineltwin:toggle-shortcuts"));
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

    // View mode keys: 1-7
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
    };
  }, [
    activeTool,
    createNewScene,
    duplicateNode,
    editor.gridSnapM,
    editor.snapEnabled,
    enterFocusMode,
    focusMode,
    redo,
    removeSelectedNodes,
    restorePreviousLayout,
    runSimulation,
    saveSceneToStorage,
    saveSnapshot,
    selectedNodeId,
    selectedNodeIds,
    setActiveTool,
    setBottomTab,
    setViewMode,
    setWorkspacePreset,
    translateSelectedNodes,
    undo,
    viewMode,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current?.(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
