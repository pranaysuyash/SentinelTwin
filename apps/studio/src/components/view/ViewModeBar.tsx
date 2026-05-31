"use client";

import { motion } from "framer-motion";
import { Camera, FileText, GitCompare, LayoutDashboard, Monitor, Play } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { MAP_COLORS } from "@/components/map/map-colors";
import { VIEW_MODE_PRESETS } from "@/lib/studio-constants";
import type { ViewMode } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";

const PRIMARY_VIEW_OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "map", label: "Map View", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { mode: "camera_view", label: "Camera View", icon: <Camera className="h-3.5 w-3.5" /> },
  { mode: "wall", label: "Camera Wall", icon: <Monitor className="h-3.5 w-3.5" /> },
  { mode: "replay", label: "Path Replay", icon: <Play className="h-3.5 w-3.5" /> },
];

const SECONDARY_VIEW_OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "compare", label: "Compare View", icon: <GitCompare className="h-3.5 w-3.5" /> },
  { mode: "report", label: "Report View", icon: <FileText className="h-3.5 w-3.5" /> },
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);
  const viewMode = useStudioStore((s) => s.viewMode);
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const result = useStudioStore((s) => s.simulationResult);

  if (!mounted) return null;

  if (viewMode === "camera_view") {
    const cam = scene.cameras.find((c) => c.id === selectedId) ?? null;
    if (!cam) return null;
    return (
      <div className="flex max-w-[min(220px,35vw)] items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <span className={`h-1.5 w-1.5 rounded-full ${cam.status === "on" ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="min-w-0 truncate font-medium" style={{ color: MAP_COLORS.viewport }}>{cam.name}</span>
      </div>
    );
  }

  if (viewMode === "replay") {
    const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
    return (
      <div className="flex max-w-[min(220px,35vw)] items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <Play className="h-2.5 w-2.5 text-emerald-400" />
        <span className="min-w-0 truncate font-medium" style={{ color: MAP_COLORS.viewport }}>
          {activePath ? activePath.label : "No path selected"}
        </span>
      </div>
    );
  }

  if (viewMode === "map" && result) {
    const pct = Math.round(result.totalCoveragePct);
    const color = pct > 80 ? "text-emerald-400" : pct > 60 ? "text-yellow-400" : "text-red-400";
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
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
  const visible = useStudioStore((s) => s.visibleComponents.view_mode_bar);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
      className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
    >
      {PRIMARY_VIEW_OPTIONS.map(({ mode, label, icon }) => (
        <motion.button
          key={mode}
          type="button"
          variants={tabVariants}
          initial="idle"
          whileHover="hover"
          whileTap="tap"
          onClick={() => {
            setWorkspacePreset(VIEW_MODE_PRESETS[mode]);
            setViewMode(mode);
          }}
          aria-pressed={viewMode === mode}
          aria-label={`Switch to ${label} mode`}
          className="pointer-events-auto relative flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium md:px-3"
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
        >
          {viewMode === mode && (
            <motion.div
              layoutId="view-tab-bg"
              className="absolute inset-0 rounded-lg shadow-sm"
              style={{ backgroundColor: MAP_COLORS.panelFillAlt }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <motion.span
            variants={iconVariants}
            initial="idle"
            whileHover="hover"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
              viewMode === mode ? "text-white" : "text-[#5b667c] hover:text-[#8b96ab]"
            }`}
            style={viewMode === mode ? { color: MAP_COLORS.viewport } : undefined}
          >
            {icon}
            <span className="hidden md:inline">{label}</span>
          </motion.span>
        </motion.button>
      ))}

      <div className="mx-1 hidden h-5 w-px flex-shrink-0 bg-[#1f2536] sm:block" aria-hidden />

      {SECONDARY_VIEW_OPTIONS.map(({ mode, label, icon }) => (
        <motion.button
          key={mode}
          type="button"
          variants={tabVariants}
          initial="idle"
          whileHover="hover"
          whileTap="tap"
          onClick={() => {
            setWorkspacePreset(VIEW_MODE_PRESETS[mode]);
            setViewMode(mode);
          }}
          aria-pressed={viewMode === mode}
          aria-label={`Switch to ${label} mode`}
          title={`${label} mode`}
          className="pointer-events-auto relative flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
        >
          {viewMode === mode && (
            <motion.div
              layoutId="view-tab-bg"
              className="absolute inset-0 rounded-lg shadow-sm"
              style={{ backgroundColor: MAP_COLORS.panelFillAlt }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <motion.span
            variants={iconVariants}
            initial="idle"
            whileHover="hover"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
              viewMode === mode ? "text-white" : "text-[#5b667c] hover:text-[#8b96ab]"
            }`}
            style={viewMode === mode ? { color: MAP_COLORS.viewport } : undefined}
          >
            {icon}
            <span className="hidden md:inline">{label}</span>
          </motion.span>
        </motion.button>
      ))}

      {/* Context chip: shows camera name / path count / coverage% depending on active mode */}
      <ContextChip />
    </motion.div>
  );
}
