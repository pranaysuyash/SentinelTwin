"use client";

import { motion } from "framer-motion";
import { Camera, GitCompare, LayoutDashboard, Monitor, Play } from "lucide-react";

import { VIEW_MODE_PRESETS } from "@/lib/studio-constants";
import type { ViewMode } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";

const VIEW_OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "map", label: "Site Map", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { mode: "camera_view", label: "Single Camera", icon: <Camera className="h-3.5 w-3.5" /> },
  { mode: "wall", label: "Camera Wall Grid", icon: <Monitor className="h-3.5 w-3.5" /> },
  { mode: "replay", label: "Route Replay", icon: <Play className="h-3.5 w-3.5" /> },
  { mode: "compare", label: "Before/After", icon: <GitCompare className="h-3.5 w-3.5" /> },
];

const tabVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.96 },
};

const iconVariants = {
  idle: { rotate: 0 },
  hover: { rotate: [0, -8, 8, 0] },
};

/** Context chip shown next to the active mode tab to orient the user */
function ContextChip() {
  const viewMode = useStudioStore((s) => s.viewMode);
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const result = useStudioStore((s) => s.simulationResult);

  if (viewMode === "camera_view") {
    const cam = scene.cameras.find((c) => c.id === selectedId) ?? scene.cameras[0];
    if (!cam) return null;
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[8px]">
        <span className={`h-1.5 w-1.5 rounded-full ${cam.status === "on" ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="text-[#93c5fd] font-medium">{cam.name}</span>
      </div>
    );
  }

  if (viewMode === "replay") {
    const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[8px]">
        <Play className="h-2.5 w-2.5 text-emerald-400" />
        <span className="text-[#93c5fd] font-medium">
          {activePath ? activePath.label : `${scene.paths.length} path${scene.paths.length !== 1 ? "s" : ""}`}
        </span>
      </div>
    );
  }

  if (viewMode === "map" && result) {
    const pct = Math.round(result.totalCoveragePct);
    const color = pct > 80 ? "text-emerald-400" : pct > 60 ? "text-yellow-400" : "text-red-400";
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[8px]">
        <span className={`font-mono font-bold ${color}`}>{pct}%</span>
        <span className="text-[#4a5568]">coverage</span>
      </div>
    );
  }

  return null;
}

export function ViewModeBar() {
  const viewMode = useStudioStore((s) => s.viewMode);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.32)] backdrop-blur-sm"
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

      {/* Context chip: shows camera name / path count / coverage% depending on active mode */}
      <ContextChip />
    </motion.div>
  );
}
