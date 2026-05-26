"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useSimulation } from "@/hooks/use-simulation";
import { useStudioStore } from "@/store/studio-store";
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

const WorkspaceCanvas = dynamic(
  () => import("@/components/workspace/WorkspaceCanvas").then((m) => m.WorkspaceCanvas),
  { ssr: false },
);

const CameraWallView = dynamic(
  () => import("@/components/view/CameraWallView").then((m) => m.CameraWallView),
  { ssr: false },
);

const CameraViewMode = dynamic(
  () => import("@/components/view/CameraViewMode").then((m) => m.CameraViewMode),
  { ssr: false },
);

const PathReplayView = dynamic(
  () => import("@/components/view/PathReplayView").then((m) => m.PathReplayView),
  { ssr: false },
);

const CompareView = dynamic(
  () => import("@/components/view/CompareView").then((m) => m.CompareView),
  { ssr: false },
);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />

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
        <div className="relative flex-1 overflow-hidden">
          <ViewModeBar />
          <WorkspaceArea />
          <CommandBar />
          {demoMode ? <DemoModeOverlay /> : null}
        </div>
      </DockLayout>

      <StatusBar />
    </div>
  );
}
