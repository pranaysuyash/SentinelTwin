"use client";

import { motion } from "framer-motion";
import { BarChart3, Camera, FileText, GitCompare, LayoutDashboard, Monitor, Play } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { MAP_COLORS } from "@/components/map/map-colors";
import { VIEW_MODE_PRESETS } from "@/lib/studio-constants";
import type { ViewMode } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";

type ViewTabOption = {
  mode: ViewMode;
  label: string;
  description: string;
  shortcut: string;
  icon: React.ReactNode;
};

const PRIMARY_VIEW_OPTIONS: ViewTabOption[] = [
  { mode: "map", label: "Map View", description: "Edit the scene layout.", shortcut: "1", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { mode: "camera_view", label: "Camera View", description: "Inspect one camera in detail.", shortcut: "2", icon: <Camera className="h-3.5 w-3.5" /> },
  { mode: "wall", label: "Camera Wall", description: "Review feeds side by side.", shortcut: "3", icon: <Monitor className="h-3.5 w-3.5" /> },
  { mode: "replay", label: "Path Replay", description: "Trace route visibility over time.", shortcut: "4", icon: <Play className="h-3.5 w-3.5" /> },
];

const SECONDARY_VIEW_OPTIONS: ViewTabOption[] = [
  { mode: "compare", label: "Compare View", description: "Measure before/after impact.", shortcut: "5", icon: <GitCompare className="h-3.5 w-3.5" /> },
  { mode: "report", label: "Report View", description: "Prepare the evidence handoff.", shortcut: "6", icon: <FileText className="h-3.5 w-3.5" /> },
  { mode: "analytics", label: "Analytics", description: "Inspect operational trends.", shortcut: "7", icon: <BarChart3 className="h-3.5 w-3.5" /> },
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
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const result = useStudioStore((s) => s.simulationResult);

  if (!mounted) return null;

  if (viewMode === "camera_view") {
    const cam = scene.cameras.find((c) => c.id === selectedCameraId) ?? scene.cameras.find((c) => c.id === selectedId) ?? null;
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

  if (viewMode === "wall") {
    const activeCount = scene.cameras.filter((camera) => camera.status === "on").length;
    const selectedCamera = scene.cameras.find((c) => c.id === selectedCameraId) ?? scene.cameras.find((c) => c.id === selectedId) ?? null;
    return (
      <div className="flex max-w-[min(240px,36vw)] items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <span className="font-mono font-bold" style={{ color: MAP_COLORS.viewport }}>{activeCount}/{scene.cameras.length || 0}</span>
        <span className="text-[#4a5568]">feeds</span>
        {selectedCamera ? (
          <>
            <span className="text-[#4a5568]">·</span>
            <span className="min-w-0 truncate font-medium" style={{ color: MAP_COLORS.viewport }}>
              {selectedCamera.name}
            </span>
          </>
        ) : null}
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
        <span className="text-[#4a5568]">·</span>
        <span className="font-medium" style={{ color: MAP_COLORS.viewport }}>{result.issues.length} issues</span>
      </div>
    );
  }

  if (viewMode === "compare") {
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <GitCompare className="h-2.5 w-2.5 text-sky-300" />
        <span className="font-medium" style={{ color: MAP_COLORS.viewport }}>Before / after review</span>
        {result ? (
          <>
            <span className="text-[#4a5568]">·</span>
            <span className="font-mono font-bold text-emerald-400">{Math.round(result.totalCoveragePct)}%</span>
            <span className="text-[#4a5568]">coverage</span>
          </>
        ) : null}
      </div>
    );
  }

  if (viewMode === "report") {
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <FileText className="h-2.5 w-2.5 text-sky-300" />
        <span className="font-medium" style={{ color: MAP_COLORS.viewport }}>Evidence handoff</span>
        {result ? (
          <>
            <span className="text-[#4a5568]">·</span>
            <span className="font-mono font-bold text-emerald-400">{result.issues.length}</span>
            <span className="text-[#4a5568]">issues</span>
          </>
        ) : null}
      </div>
    );
  }

  if (viewMode === "analytics") {
    return (
      <div className="flex items-center gap-1 rounded-md border border-[#2a3246] bg-[#111827] px-2 py-1 text-[10px]">
        <BarChart3 className="h-2.5 w-2.5 text-sky-300" />
        <span className="font-medium" style={{ color: MAP_COLORS.viewport }}>Operational trends</span>
        {result ? (
          <>
            <span className="text-[#4a5568]">·</span>
            <span className="font-mono font-bold text-emerald-400">{result.issues.length}</span>
            <span className="text-[#4a5568]">issues</span>
          </>
        ) : null}
      </div>
    );
  }

  return null;
}

function ModeButton({ mode, label, description, shortcut, icon, active, onClick }: ViewTabOption & { active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      variants={tabVariants}
      initial="idle"
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Switch to ${label} mode`}
      title={`${label} · ${description}`}
      className="pointer-events-auto relative flex min-w-[4.5rem] flex-shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[10px] font-medium md:min-w-[6.5rem] md:px-3"
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
    >
      {active && (
        <motion.div
          layoutId="view-tab-bg"
          className="absolute inset-0 rounded-xl shadow-sm"
          style={{ backgroundColor: MAP_COLORS.panelFillAlt }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <motion.span
        variants={iconVariants}
        initial="idle"
        whileHover="hover"
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${
          active ? "border-white/10 bg-white/5 text-white" : "border-transparent bg-transparent text-[#5b667c] hover:text-[#8b96ab]"
        }`}
        style={active ? { color: MAP_COLORS.viewport } : undefined}
      >
        {icon}
      </motion.span>
      <span className="relative z-10 flex min-w-0 flex-1 flex-col leading-tight">
        <span className={`truncate ${active ? "text-white" : "text-[#c7d0e4]"}`} style={active ? { color: MAP_COLORS.viewport } : undefined}>
          {label}
        </span>
        <span className="hidden truncate text-[9px] text-[#6f7c93] md:block">{description}</span>
      </span>
      <span className="relative z-10 hidden rounded-md border border-[#2a3246] bg-[#0b0f17] px-1.5 py-0.5 text-[9px] text-[#8b96ab] md:inline-flex">
        {shortcut}
      </span>
    </motion.button>
  );
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
      className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#1f2536] bg-[#0b0f17]/90 px-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
    >
      <div className="pointer-events-auto hidden rounded-full border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#6f7c93] sm:block">
        Workspaces
      </div>

      {PRIMARY_VIEW_OPTIONS.map((option) => (
        <ModeButton
          key={option.mode}
          {...option}
          active={viewMode === option.mode}
          onClick={() => {
            setWorkspacePreset(VIEW_MODE_PRESETS[option.mode]);
            setViewMode(option.mode);
          }}
        />
      ))}

      <div className="pointer-events-auto mx-0.5 hidden h-5 w-px flex-shrink-0 bg-[#1f2536] lg:block" aria-hidden />

      <div className="pointer-events-auto hidden rounded-full border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#6f7c93] sm:block">
        Review
      </div>

      {SECONDARY_VIEW_OPTIONS.map((option) => (
        <ModeButton
          key={option.mode}
          {...option}
          active={viewMode === option.mode}
          onClick={() => {
            setWorkspacePreset(VIEW_MODE_PRESETS[option.mode]);
            setViewMode(option.mode);
          }}
        />
      ))}

      {/* Context chip: shows camera name / path / coverage depending on active mode */}
      <ContextChip />
    </motion.div>
  );
}
