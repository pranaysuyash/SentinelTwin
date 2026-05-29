"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Filter, Layers, Crosshair, Sigma, Grid3x3, Shield, Target } from "lucide-react";
import { MAP_COLORS } from "@/components/map/map-colors";
import { useStudioStore, type OverlayDensity, type OverlayFilterId, type HeatmapMode } from "@/store/studio-store";

const QUALITY_LEVELS = [
  { label: "Identification", range: "250+", detail: "250+ PPM", color: "#3b82f6" },
  { label: "Recognition", range: "125-250", detail: "125-250 PPM", color: "#22c55e" },
  { label: "Observation", range: "62.5-125", detail: "62.5-125 PPM", color: "#eab308" },
  { label: "Detection", range: "25-62.5", detail: "25-62.5 PPM", color: "#f97316" },
  { label: "No Coverage", range: "<25", detail: "<25 PPM", color: "#ef4444" },
];

const FRAGILITY_LEVELS = [
  { label: "Robust", range: "0-30%", detail: "Far from threshold", color: "#22c55e" },
  { label: "Moderate", range: "30-60%", detail: "Some margin", color: "#f5a623" },
  { label: "Fragile", range: "60-100%", detail: "Near DORI threshold", color: "#ef4444" },
];

const MODE_CONFIG: { mode: HeatmapMode; label: string; icon: React.ReactNode; description: string; levels: { label: string; range: string; detail: string; color: string }[]; legendNote?: string }[] = [
  {
    mode: "quality",
    label: "Quality",
    icon: <Target className="h-3 w-3" />,
    description: "Coverage quality by PPM density",
    levels: QUALITY_LEVELS,
  },
  {
    mode: "fragility",
    label: "Fragility",
    icon: <Shield className="h-3 w-3" />,
    description: "How close each cell is to a DORI threshold boundary",
    levels: FRAGILITY_LEVELS,
    legendNote: "Fragile cells may drop quality under minor camera adjustments.",
  },
  {
    mode: "overlap",
    label: "Overlap",
    icon: <Layers className="h-3 w-3" />,
    description: "Number of cameras covering each cell",
    levels: [
      { label: "3+ Cameras", range: "3+", detail: "High redundancy", color: "#3b82f6" },
      { label: "2 Cameras", range: "2", detail: "Moderate redundancy", color: "#22c55e" },
      { label: "1 Camera", range: "1", detail: "Single coverage", color: "#facc15" },
      { label: "No Coverage", range: "0", detail: "Uncovered area", color: "#ef4444" },
    ],
  },
  {
    mode: "contribution",
    label: "Contribution",
    icon: <Sigma className="h-3 w-3" />,
    description: "Each camera's coverage contribution to the area",
    levels: [
      { label: "High Contribution", range: ">75%", detail: "Primary coverage provider", color: "#3b82f6" },
      { label: "Moderate", range: "50-75%", detail: "Secondary coverage", color: "#22c55e" },
      { label: "Low", range: "25-50%", detail: "Marginal contribution", color: "#facc15" },
      { label: "None", range: "<25%", detail: "Cell not covered by camera", color: "#6b7280" },
    ],
  },
  {
    mode: "blindspots",
    label: "Blindspots",
    icon: <EyeOff className="h-3 w-3" />,
    description: "Areas with no camera coverage",
    levels: [
      { label: "Covered", range: "Any", detail: "Cell is covered by ≥1 camera", color: "#22c55e" },
      { label: "Blindspot", range: "None", detail: "No camera coverage", color: "#991b1b" },
    ],
  },
];

const DENSITY_OPTIONS: { value: OverlayDensity; label: string }[] = [
  { value: "all", label: "All" },
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
];

const FILTER_OPTIONS: { id: OverlayFilterId; label: string }[] = [
  { id: "cameraLabels", label: "Camera Labels" },
  { id: "zoneLabels", label: "Zone Labels" },
  { id: "obstructionWarnings", label: "Obstructions" },
  { id: "entryChips", label: "Entry Points" },
  { id: "pathLabels", label: "Path Labels" },
];

export function CoverageLegend() {
  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const setHeatmapMode = useStudioStore((s) => s.setHeatmapMode);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const overlayFilters = useStudioStore((s) => s.overlayFilters);
  const setOverlayDensity = useStudioStore((s) => s.setOverlayDensity);
  const setOverlayFilter = useStudioStore((s) => s.setOverlayFilter);
  const hasResult = useStudioStore((s) => !!s.simulationResult);

  const activeConfig = MODE_CONFIG.find((c) => c.mode === heatmapMode) ?? MODE_CONFIG[0];
  const [collapsed, setCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="absolute left-3 top-3 z-10 min-w-[182px] rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      {/* Header row with collapse toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="coverage-legend-body"
          aria-label={`${collapsed ? "Expand" : "Collapse"} coverage legend`}
          className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5b667c] transition-colors hover:text-sky-300"
          style={collapsed ? undefined : { color: MAP_COLORS.viewport }}
        >
          {collapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {activeConfig.icon}
          <span className="ml-0.5">{activeConfig.label} View</span>
        </button>

        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="coverage-legend-filters"
          aria-label={`${showFilters ? "Hide" : "Show"} overlay filters and density`}
          className={`rounded p-0.5 transition-colors ${showFilters ? "text-sky-300" : "text-[#3a4158] hover:text-[#647089]"}`}
          style={showFilters ? { color: MAP_COLORS.viewport } : undefined}
          title="Overlay filters & density"
        >
          <Filter className="h-3 w-3" />
        </button>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <div id="coverage-legend-body">
          {/* Mode toggle grid — only when simulation data is present */}
          {hasResult ? (
            <div className="mb-2 grid grid-cols-5 gap-0.5 rounded-md overflow-hidden border border-[#2a3246]">
              {MODE_CONFIG.map((config) => {
                const isActive = heatmapMode === config.mode;
                const activeBg = config.mode === "fragility"
                  ? "rgba(127, 29, 29, 0.45)"
                  : config.mode === "overlap"
                    ? "rgba(30, 64, 175, 0.35)"
                    : config.mode === "contribution"
                      ? "rgba(21, 128, 61, 0.35)"
                      : config.mode === "blindspots"
                        ? "rgba(127, 29, 29, 0.35)"
                        : "rgba(30, 41, 59, 0.85)";
                return (
                  <button
                    key={config.mode}
                    type="button"
                    onClick={() => setHeatmapMode(config.mode)}
                    aria-pressed={isActive}
                    aria-label={`${config.label} heatmap`}
                    className="flex flex-col items-center gap-0.5 py-0.5 text-[7px] font-semibold tracking-wide transition-colors"
                    title={config.description}
                    style={isActive ? { background: activeBg, color: MAP_COLORS.panelText } : { color: "#3a4158" }}
                  >
                    {config.icon}
                    <span className="leading-none">{config.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Legend items */}
          <div className="space-y-1.5">
            {activeConfig.levels.map(({ label, range, detail, color }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color, opacity: 0.9 }} />
                <div className="min-w-0 flex-1 leading-none">
                  <div className="text-[10px] text-[#c7d0e4]">{range}</div>
                  <div className="mt-1 text-[8px] text-[#647089]">{label} &middot; {detail}</div>
                </div>
              </div>
            ))}
          </div>

          {activeConfig.legendNote && (
            <div className="mt-2 border-t border-[#1f2536] pt-1.5 text-[8px] text-[#4a5568] leading-tight">
              {activeConfig.legendNote}
            </div>
          )}
        </div>
      )}

      {/* Expandable filter & density panel */}
      {showFilters && (
        <div id="coverage-legend-filters" className="mt-2 border-t border-[#1f2536] pt-2 space-y-2">
          {/* Density mode selector */}
          <div>
            <div className="flex items-center gap-1 mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-[#5b667c]">
              <Layers className="h-2.5 w-2.5" />
              Density
            </div>
            <div className="flex gap-1">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOverlayDensity(opt.value)}
                  aria-pressed={overlayDensity === opt.value}
                  className={`flex-1 py-0.5 text-[8px] font-medium rounded transition-colors ${
                    overlayDensity === opt.value
                      ? "bg-[#1e2d4a] text-sky-300"
                      : "text-[#3a4158] hover:text-[#647089] hover:bg-[#1a1f2e]"
                  }`}
                  style={overlayDensity === opt.value ? { backgroundColor: MAP_COLORS.panelFillAlt, color: MAP_COLORS.viewport } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay filter toggles */}
          <div>
            <div className="flex items-center gap-1 mb-1 text-[8px] font-semibold uppercase tracking-wider text-[#5b667c]">
              <Filter className="h-2.5 w-2.5" />
              Overlays
            </div>
            <div className="space-y-1">
              {FILTER_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={overlayFilters[opt.id]}
                    onChange={(e) => setOverlayFilter(opt.id, e.target.checked)}
                    className="h-2.5 w-2.5 rounded border-[#2a3246] bg-[#151a28] accent-[#3b82f6] cursor-pointer"
                  />
                  <span className={`text-[9px] transition-colors ${
                    overlayFilters[opt.id] ? "text-[#c7d0e4]" : "text-[#3a4158]"
                  }`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
