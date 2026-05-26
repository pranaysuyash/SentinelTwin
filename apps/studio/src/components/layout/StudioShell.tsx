"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useSimulation } from "@/hooks/use-simulation";
import { useStudioStore } from "@/store/studio-store";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { LeftPanel } from "@/components/left-panel/LeftPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { BottomPanel } from "@/components/bottom-panel/BottomPanel";
import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { BottomRow } from "@/components/bottom-row/BottomRow";
import { ViewModeBar } from "@/components/view/ViewModeBar";

const WorkspaceCanvas = dynamic(
  () => import("@/components/workspace/WorkspaceCanvas").then((m) => m.WorkspaceCanvas),
  { ssr: false },
);

const CameraWallView = dynamic(
  () => import("@/components/view/CameraWallView").then((m) => m.CameraWallView),
  { ssr: false },
);

const PathReplayView = dynamic(
  () => import("@/components/view/PathReplayView").then((m) => m.PathReplayView),
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
        {viewMode === "wall" && <CameraWallView />}
        {viewMode === "replay" && <PathReplayView />}
        {viewMode === "map" && <WorkspaceCanvas />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function StudioShell() {
  useSimulation();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftPanel />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="relative flex-1 overflow-hidden">
            <ViewModeBar />
            <WorkspaceArea />
          </div>
          <BottomPanel />
        </div>

        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 304 }}>
          <InspectorPanel />
          <ScenarioPathPanel />
        </div>
      </div>

      <BottomRow />
      <StatusBar />
    </div>
  );
}
