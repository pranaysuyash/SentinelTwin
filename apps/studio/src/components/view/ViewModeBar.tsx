"use client";

import { motion } from "framer-motion";
import { Camera, GitCompare, LayoutDashboard, Monitor, Play } from "lucide-react";

import type { ViewMode, WorkspacePreset } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";

const VIEW_OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "map", label: "Map View", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { mode: "wall", label: "Camera Wall", icon: <Monitor className="h-3.5 w-3.5" /> },
  { mode: "camera_view", label: "Camera View", icon: <Camera className="h-3.5 w-3.5" /> },
  { mode: "replay", label: "Path Replay", icon: <Play className="h-3.5 w-3.5" /> },
  { mode: "compare", label: "Compare", icon: <GitCompare className="h-3.5 w-3.5" /> },
];

const tabVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.96 },
};

const VIEW_MODE_PRESETS: Record<ViewMode, WorkspacePreset> = {
  map: "edit",
  wall: "camera_wall",
  replay: "replay",
  camera_view: "coverage",
  compare: "compare",
};

const iconVariants = {
  idle: { rotate: 0 },
  hover: { rotate: [0, -8, 8, 0] },
};

export function ViewModeBar() {
  const viewMode = useStudioStore((s) => s.viewMode);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.32)] backdrop-blur-sm"
    >
      {VIEW_OPTIONS.map(({ mode, label, icon }) => (
        <motion.button
          key={mode}
          variants={tabVariants}
          initial="idle"
          whileHover="hover"
          whileTap="tap"
          onClick={() => {
            setWorkspacePreset(VIEW_MODE_PRESETS[mode]);
            setViewMode(mode);
          }}
          className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium"
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
        >
          {viewMode === mode && (
            <motion.div
              layoutId="view-tab-bg"
              className="absolute inset-0 rounded-lg bg-[#1a2333] shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <motion.span
            variants={iconVariants}
            initial="idle"
            whileHover="hover"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
              viewMode === mode ? "text-[#93c5fd]" : "text-[#5b667c] hover:text-[#8b96ab]"
            }`}
          >
            {icon}
            {label}
          </motion.span>
        </motion.button>
      ))}
    </motion.div>
  );
}
