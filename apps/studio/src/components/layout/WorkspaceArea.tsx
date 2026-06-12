"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useStudioStore } from "@/store/studio-store";
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { CameraWallView } from "@/components/view/CameraWallView";
import { CameraViewMode } from "@/components/view/CameraViewMode";
import { PathReplayView } from "@/components/view/PathReplayView";
import { CompareView } from "@/components/view/CompareView";
import { ReportView } from "@/components/view/ReportView";
import { AnalyticsDashboardView } from "@/components/view/AnalyticsDashboardView";

export default function WorkspaceArea() {
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
        {viewMode === "analytics" && <AnalyticsDashboardView />}
      </motion.div>
    </AnimatePresence>
  );
}
