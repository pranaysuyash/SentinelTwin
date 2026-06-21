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
  { mode: "compare", label: "Compare", description: "Measure before/after impact.", shortcut: "5", icon: <GitCompare className="h-3.5 w-3.5" /> },
  { mode: "report", label: "Report", description: "Prepare the evidence handoff.", shortcut: "6", icon: <FileText className="h-3.5 w-3.5" /> },
  { mode: "analytics", label: "Analytics", description: "Inspect operational trends.", shortcut: "7", icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

const tabVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.96 },
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

function ModeButton({
  mode, label, description, shortcut, icon, active, disabled, disabledReason, onClick,
}: ViewTabOption & { active: boolean; disabled: boolean; disabledReason: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      variants={tabVariants}
      initial="idle"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={disabled ? `${label} — ${disabledReason}` : `Switch to ${label} mode`}
      title={disabled ? disabledReason : `${label} · ${description}`}
      className="pointer-events-auto relative flex min-w-0 flex-shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-[10px] font-medium transition-opacity"
      style={{ opacity: disabled ? 0.38 : 1, cursor: disabled ? "default" : "pointer" }}
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
      <span
        className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${
          active ? "border-white/10 bg-white/5 text-white" : "border-transparent bg-transparent text-[#5b667c]"
        }`}
        style={active ? { color: MAP_COLORS.viewport } : undefined}
      >
        {icon}
      </span>
      <span className="relative z-10 flex min-w-0 flex-col leading-tight">
        <span
          className={`truncate text-[10px] ${active ? "text-white" : "text-[#c7d0e4]"}`}
          style={active ? { color: MAP_COLORS.viewport } : undefined}
        >
          {label}
        </span>
      </span>
      <span className="relative z-10 hidden rounded-md border border-[#2a3246] bg-[#0b0f17] px-1 py-0.5 text-[9px] text-[#6b7280] sm:inline-flex">
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
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);

  if (!visible) return null;

  const cameraCount = scene.cameras.length;
  const pathCount = scene.paths?.length ?? 0;
  const hasResult = !!result;

  // Contextual availability per mode
  const availability: Record<ViewMode, { ok: boolean; reason: string }> = {
    map:         { ok: true,               reason: "" },
    camera_view: { ok: cameraCount >= 1,   reason: "Place a camera first" },
    wall:        { ok: cameraCount >= 2,   reason: `Need ≥2 cameras (have ${cameraCount})` },
    replay:      { ok: pathCount >= 1,     reason: "Add an adversarial path first" },
    compare:     { ok: hasResult,          reason: "Run simulation first" },
    report:      { ok: hasResult,          reason: "Run simulation first" },
    analytics:   { ok: hasResult,          reason: "Run simulation first" },
  };

  function activate(mode: ViewMode) {
    setWorkspacePreset(VIEW_MODE_PRESETS[mode]);
    setViewMode(mode);
  }

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
      className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-2xl border border-[#1f2536] bg-[#0b0f17]/90 px-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
    >
      {PRIMARY_VIEW_OPTIONS.map((option) => {
        const { ok, reason } = availability[option.mode];
        return (
          <ModeButton
            key={option.mode}
            {...option}
            active={viewMode === option.mode}
            disabled={!ok}
            disabledReason={reason}
            onClick={() => activate(option.mode)}
          />
        );
      })}

      <div className="pointer-events-none mx-1 h-5 w-px flex-shrink-0 bg-[#1f2536]" aria-hidden />

      {SECONDARY_VIEW_OPTIONS.map((option) => {
        const { ok, reason } = availability[option.mode];
        return (
          <ModeButton
            key={option.mode}
            {...option}
            active={viewMode === option.mode}
            disabled={!ok}
            disabledReason={reason}
            onClick={() => activate(option.mode)}
          />
        );
      })}

      {/* Context chip: dynamic status for the current mode */}
      <ContextChip />
    </motion.div>
  );
}
