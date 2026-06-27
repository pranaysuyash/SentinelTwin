"use client";

import type { CSSProperties } from "react";
import { MotionConfig } from "framer-motion";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSimulation } from "@/hooks/use-simulation";
import { useStudioKeyboard } from "@/hooks/use-studio-keyboard";
import { useStudioStore, type ViewMode } from "@/store/studio-store";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { ViewModeBar } from "@/components/view/ViewModeBar";
import { CommandBar } from "@/components/command-bar/CommandBar";
import { DemoWalkthroughPanel } from "@/components/demo/DemoWalkthroughPanel";
import { DockLayout } from "@/components/dock/DockLayout";
import { DockPanel } from "@/components/dock/DockPanel";
import { ContextBottomPanel } from "@/components/panels/ContextBottomPanel";
import { ContextRightPanel } from "@/components/panels/ContextRightPanel";
import { ViewSettingsModal } from "@/components/layout/ViewSettingsModal";
import { AutosaveRecoveryBanner } from "@/components/shared/AutosaveRecoveryBanner";
import { LeftPanel } from "@/components/left-panel/LeftPanel";
import PathReplayClock from "./PathReplayClock";
import WorkspaceArea from "./WorkspaceArea";
import ShortcutsModal from "./ShortcutsModal";
import FirstRunGuide from "./FirstRunGuide";
import { STUDIO_SHORTCUT_EVENTS } from "@/lib/studio-shortcuts";

const FULL_CANVAS_SAFE_ZONE_STYLE = {
  "--st-view-mode-bar-top": "0.75rem",
  "--st-view-mode-bar-height": "2.75rem",
  "--st-view-mode-bar-gap": "0.75rem",
  "--st-full-canvas-safe-top": "calc(var(--st-view-mode-bar-top) + var(--st-view-mode-bar-height) + var(--st-view-mode-bar-gap))",
} as CSSProperties;

export default function StudioShell() {
  const [hydrated, setHydrated] = useState(false);
  useSimulation(hydrated);
  useStudioKeyboard();
  const [studioBypassMode, setStudioBypassMode] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const rightRailAutoSetRef = useRef(false);

  const demoMode = useStudioStore((s) => s.demoMode);
  const launchNotice = useStudioStore((s) => s.launchNotice);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const focusMode = useStudioStore((s) => s.focusMode);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const scene = useStudioStore((s) => s.scene);
  const uiDensity = useStudioStore((s) => s.uiDensity);
  const uiTheme = useStudioStore((s) => s.uiTheme);

  const dockState = useStudioStore(
    useShallow((s) => ({
      leftDockCollapsed: s.leftDockCollapsed,
      rightDockCollapsed: s.rightDockCollapsed,
      bottomDockCollapsed: s.bottomDockCollapsed,
      dockAttention: s.dockAttention,
      leftDockSizePx: s.leftDockSizePx,
      rightDockSizePx: s.rightDockSizePx,
      bottomDockSizePx: s.bottomDockSizePx,
    })),
  );
  const dockActions = useStudioStore(
    useShallow((s) => ({
      toggleDock: s.toggleDock,
      clearDockAttention: s.clearDockAttention,
      setDockSize: s.setDockSize,
      enterFocusMode: s.enterFocusMode,
      restorePreviousLayout: s.restorePreviousLayout,
    })),
  );

  const viewState = useStudioStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      rightPanelMode: s.rightPanelMode,
    })),
  );
  const viewActions = useStudioStore(
    useShallow((s) => ({
      setViewMode: s.setViewMode,
      setSelectedCameraId: s.setSelectedCameraId,
      setRightPanelMode: s.setRightPanelMode,
      setBottomTab: s.setBottomTab,
    })),
  );

  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);

  const {
    leftDockCollapsed, rightDockCollapsed, bottomDockCollapsed,
    dockAttention, leftDockSizePx, rightDockSizePx, bottomDockSizePx,
  } = dockState;
  const {
    toggleDock, clearDockAttention, setDockSize,
    enterFocusMode, restorePreviousLayout,
  } = dockActions;
  const { viewMode, rightPanelMode } = viewState;
  const {
    setViewMode, setSelectedCameraId,
    setRightPanelMode, setBottomTab,
  } = viewActions;

  const fullCanvasMode = viewMode === "camera_view" || viewMode === "wall" || viewMode === "replay";
  const canvasOnlyLayout = compactViewport || fullCanvasMode;

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  // QA hook: expose the store for browser automation when explicitly requested
  // via ?qa=1. Used by scripted UI verification (no effect for normal users).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("qa") === "1") {
      (window as unknown as Record<string, unknown>).__sentinelStudioStore = useStudioStore;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 720px)");
    const syncCompactViewport = () => setCompactViewport(media.matches);
    syncCompactViewport();
    media.addEventListener("change", syncCompactViewport);
    return () => media.removeEventListener("change", syncCompactViewport);
  }, []);

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (!mode) return;
    if (mode !== "map" && mode !== "wall" && mode !== "replay" && mode !== "camera_view" && mode !== "compare" && mode !== "report" && mode !== "analytics") return;
    setViewMode(mode as ViewMode);
  }, []);

  useEffect(() => {
    const handler = () => setShowShortcuts((v) => !v);
    window.addEventListener(STUDIO_SHORTCUT_EVENTS.toggleShortcuts, handler);
    return () => window.removeEventListener(STUDIO_SHORTCUT_EVENTS.toggleShortcuts, handler);
  }, []);

  useEffect(() => {
    if (!launchNotice) return;
    const timer = window.setTimeout(() => setLaunchNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [launchNotice, setLaunchNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    startTransition(() => {
      setStudioBypassMode(new URLSearchParams(window.location.search).get("studio") === "1");
    });
  }, []);

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

  const effectiveRightPanelMode = useMemo(() => {
    if (!rightRailAutoSetRef.current) {
      if (!selectedNodeId && rightPanelMode === "inspector") return "security_status";
    } else if (selectedNodeId && rightPanelMode === "security_status") {
      return "inspector";
    }
    return rightPanelMode;
  }, [selectedNodeId, rightPanelMode]);

  useEffect(() => {
    rightRailAutoSetRef.current = true;
    if (effectiveRightPanelMode !== rightPanelMode) {
      setRightPanelMode(effectiveRightPanelMode);
    }
  }, [effectiveRightPanelMode, rightPanelMode, setRightPanelMode]);

  useEffect(() => {
    if (viewMode !== "camera_view") return;
    if (scene.cameras.length === 0) return;
    const selectedIsCamera = !!selectedNodeId && scene.cameras.some((camera) => camera.id === selectedNodeId);
    if (selectedIsCamera && selectedCameraId !== selectedNodeId) {
      setSelectedCameraId(selectedNodeId);
    } else if (!selectedCameraId || !scene.cameras.some((camera) => camera.id === selectedCameraId)) {
      setSelectedCameraId(scene.cameras[0]?.id ?? null);
    }
  }, [scene.cameras, selectedCameraId, selectedNodeId, setSelectedCameraId, viewMode]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030611] text-[#9fb1cf]">
        <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1020] px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-sky-100">
          Loading Studio
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />
      <AutosaveRecoveryBanner />
      {studioBypassMode ? (
        <div className="border-b border-amber-500/15 bg-amber-500/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
          Studio bypass mode - root product launcher skipped
        </div>
      ) : null}
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
      <PathReplayClock />

      {canvasOnlyLayout ? (
        <div className="relative z-0 flex-1 min-h-0 overflow-hidden" style={fullCanvasMode ? FULL_CANVAS_SAFE_ZONE_STYLE : undefined}>
          {visibleComponents.view_mode_bar ? <ViewModeBar /> : null}
          <WorkspaceArea />
          {visibleComponents.command_bar ? <CommandBar /> : null}
          {demoMode ? <DemoWalkthroughPanel onFinish={() => {}} /> : null}
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
              attention={dockAttention.left}
              focusMode={focusMode}
              sizePx={leftDockSizePx}
              onToggle={() => {
                if (leftDockCollapsed) clearDockAttention("left");
                toggleDock("left");
              }}
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
              attention={dockAttention.bottom}
              focusMode={focusMode}
              sizePx={bottomDockSizePx}
              onToggle={() => {
                if (bottomDockCollapsed) clearDockAttention("bottom");
                toggleDock("bottom");
              }}
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
              attention={dockAttention.right}
              focusMode={focusMode}
              sizePx={rightDockSizePx}
              onToggle={() => {
                if (rightDockCollapsed) clearDockAttention("right");
                toggleDock("right");
              }}
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
            {demoMode ? <DemoWalkthroughPanel onFinish={() => {}} /> : null}
          </div>
        </DockLayout>
      )}

      {visibleComponents.status_bar && !compactViewport ? <StatusBar /> : null}

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
    </MotionConfig>
  );
}
