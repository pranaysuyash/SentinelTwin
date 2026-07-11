"use client";

import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Filter, Layers, Sigma, Shield, Sun, Target } from "lucide-react";
import { MAP_COLORS } from "@/components/map/map-colors";
import { UI_SURFACES , UI_SURFACES_RAW} from "@/lib/studio-surface-tokens";
import { useStudioStore, type OverlayDensity, type OverlayFilterId, type HeatmapMode } from "@/store/studio-store";


type LegendModeLevel = { label: string; range: string; detail: string; color: string };
type CoverageLegendConfig = {
  mode: HeatmapMode;
  label: string;
  icon: ReactNode;
  description: string;
  levels: LegendModeLevel[];
  legendNote?: string;
};

const QUALITY_LEVELS = [
  { label: "Identify a person", range: "250+ PPM", detail: "clear face/detail evidence", color: "#3b82f6" },
  { label: "Recognize a known person", range: "125-250 PPM", detail: "usable identity confidence", color: "#22c55e" },
  { label: "Observe activity", range: "62.5-125 PPM", detail: "body/action visible", color: "#eab308" },
  { label: "Detect motion/person", range: "25-62.5 PPM", detail: "presence only", color: "#f97316" },
  { label: "No useful coverage", range: "<25 PPM", detail: "blind or too weak", color: "#ef4444" },
];

const FRAGILITY_LEVELS = [
  { label: "Robust", range: "0-30%", detail: "Far from threshold", color: "#22c55e" },
  { label: "Moderate", range: "30-60%", detail: "Some margin", color: "#f5a623" },
  { label: "Fragile", range: "60-100%", detail: "Near DORI threshold", color: "#ef4444" },
];

const LIGHTING_LEVELS = [
  { label: "Bright", range: "65%+", detail: "Strong light reach", color: "#ffe047" },
  { label: "Usable", range: "35-65%", detail: "Moderate illumination", color: "#f97316" },
  { label: "Low", range: "12-35%", detail: "Weak light / IR-dependent", color: "#3b82f6" },
  { label: "Shadow", range: "Blocked", detail: "Light ray obstructed", color: "#b91c1c" },
  { label: "Dark", range: "<12%", detail: "No useful light", color: UI_SURFACES_RAW.bgPanel },
];

const MODE_ORDER: HeatmapMode[] = [
  "quality",
  "fragility",
  "lighting",
  "overlap",
  "contribution",
  "blindspots",
] as const;

const MODE_CONFIG: Record<HeatmapMode, CoverageLegendConfig> = {
  quality: {
    mode: "quality",
    label: "Quality",
    icon: <Target className="h-3 w-3" />,
    description: "How much usable camera detail each floor cell has after distance, light, and obstruction effects.",
    levels: QUALITY_LEVELS,
    legendNote: "PPM means pixels per meter at that floor cell. Higher PPM means clearer faces, bodies, and evidence; lower PPM means the camera may only detect movement or miss the spot.",
  },
  fragility: {
    mode: "fragility",
    label: "Fragility",
    icon: <Shield className="h-3 w-3" />,
    description: "How likely a cell is to drop below its required quality if a camera, object, or light changes.",
    levels: FRAGILITY_LEVELS,
    legendNote: "Fragile cells are near a quality boundary. A small camera move, obstruction, or lighting change can turn them from pass to fail.",
  },
  lighting: {
    mode: "lighting",
    label: "Lighting",
    icon: <Sun className="h-3 w-3" />,
    description: "Light reach only, separated from camera quality.",
    levels: LIGHTING_LEVELS,
    legendNote: "Bright cells have usable light. Shadow or dark cells are blocked or underlit, so night coverage can fail even when a camera points there.",
  },
  overlap: {
    mode: "overlap",
    label: "Overlap",
    icon: <Layers className="h-3 w-3" />,
    description: "How many cameras can see the same floor cell.",
    levels: [
      { label: "3+ Cameras", range: "3+", detail: "High redundancy", color: "#3b82f6" },
      { label: "2 Cameras", range: "2", detail: "Moderate redundancy", color: "#22c55e" },
      { label: "1 Camera", range: "1", detail: "Single coverage", color: "#facc15" },
      { label: "No Coverage", range: "0", detail: "Uncovered area", color: "#ef4444" },
    ],
    legendNote: "Overlap shows redundancy. One camera means a single point of failure; two or more cameras give backup evidence.",
  },
  contribution: {
    mode: "contribution",
    label: "Contribution",
    icon: <Sigma className="h-3 w-3" />,
    description: "Which cells depend heavily on the selected or strongest camera.",
    levels: [
      { label: "High Contribution", range: ">75%", detail: "Primary coverage provider", color: "#3b82f6" },
      { label: "Moderate", range: "50-75%", detail: "Secondary coverage", color: "#22c55e" },
      { label: "Low", range: "25-50%", detail: "Marginal contribution", color: "#facc15" },
      { label: "None", range: "<25%", detail: "Cell not covered by camera", color: "#6b7280" },
    ],
    legendNote: "Contribution highlights dependency. High contribution areas are the cells most affected if that camera is moved, blocked, or offline.",
  },
  blindspots: {
    mode: "blindspots",
    label: "Blindspots",
    icon: <EyeOff className="h-3 w-3" />,
    description: "Only the cells that no camera can currently see.",
    levels: [
      { label: "Covered", range: "Any", detail: "Cell is covered by ≥1 camera", color: "#22c55e" },
      { label: "Blindspot", range: "None", detail: "No camera coverage", color: "#991b1b" },
    ],
    legendNote: "Blindspot view removes quality levels and shows the yes/no question: can any camera see this spot?",
  },
};

const HEATMAP_ACTIVE_BG_BY_MODE: Record<HeatmapMode, string> = {
  quality: "rgba(30, 41, 59, 0.85)",
  fragility: "rgba(127, 29, 29, 0.45)",
  lighting: "rgba(202, 138, 4, 0.32)",
  overlap: "rgba(30, 64, 175, 0.35)",
  contribution: "rgba(21, 128, 61, 0.35)",
  blindspots: "rgba(127, 29, 29, 0.35)",
};

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
  { id: "adversaryShadow", label: "Adversary Shadow" },
];

export function CoverageLegend() {
  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const setHeatmapMode = useStudioStore((s) => s.setHeatmapMode);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const overlayFilters = useStudioStore((s) => s.overlayFilters);
  const setOverlayDensity = useStudioStore((s) => s.setOverlayDensity);
  const setOverlayFilter = useStudioStore((s) => s.setOverlayFilter);
  const hasResult = useStudioStore((s) => !!s.simulationResult);

  const activeConfig = MODE_CONFIG[heatmapMode];
  // Collapsed by default: the legend is reference material, not primary chrome.
  const [collapsed, setCollapsed] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className={`absolute left-3 top-3 z-10 w-[240px] rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/90 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]`}>
      {/* Header row with collapse toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="coverage-legend-body"
          aria-label={`${collapsed ? "Expand" : "Collapse"} coverage legend`}
          className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textMuted} transition-colors hover:text-sky-300`}
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
          className={`rounded p-0.5 transition-colors ${showFilters ? "text-sky-300" : "${UI_SURFACES.textDim} ${UI_SURFACES.hoverTextSoft}"}`}
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
            <div className={`mb-2 grid grid-cols-3 gap-0.5 rounded-md overflow-hidden border ${UI_SURFACES.borderDark}`}>
              {MODE_ORDER.map((mode) => {
                const config = MODE_CONFIG[mode];
                const isActive = heatmapMode === config.mode;
                return (
                  <button
                    key={config.mode}
                    type="button"
                    onClick={() => setHeatmapMode(config.mode)}
                    aria-pressed={isActive}
                    aria-label={`${config.label} heatmap`}
                    className="flex flex-col items-center gap-0.5 py-0.5 text-[7px] font-semibold tracking-wide transition-colors"
                    title={config.description}
                    style={isActive ? { background: HEATMAP_ACTIVE_BG_BY_MODE[config.mode], color: MAP_COLORS.panelText } : { color: UI_SURFACES_RAW.textDim }}
                  >
                    {config.icon}
                    <span className="leading-none">{config.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className={`mb-2 rounded-lg border ${UI_SURFACES.borderSubtle} bg-white/[0.025] px-2 py-1.5 text-[9px] leading-4 ${UI_SURFACES.textMuted3}`}>
            {activeConfig.description}
          </div>

          {/* Legend items */}
          <div className="space-y-1.5">
            {activeConfig.levels.map(({ label, range, detail, color }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color, opacity: 0.9 }} />
                <div className="min-w-0 flex-1 leading-none">
                  <div className={`text-[10px] ${UI_SURFACES.textBody}`}>{range}</div>
                  <div className={`mt-1 text-[8px] ${UI_SURFACES.textSoftMid}`}>{label} &middot; {detail}</div>
                </div>
              </div>
            ))}
          </div>

          {activeConfig.legendNote && (
            <div className={`mt-2 border-t ${UI_SURFACES.borderSubtle} pt-1.5 text-[8px] ${UI_SURFACES.textMuted} leading-tight`}>
              {activeConfig.legendNote}
            </div>
          )}
        </div>
      )}

      {/* Expandable filter & density panel */}
      {showFilters && (
        <div id="coverage-legend-filters" className={`mt-2 border-t ${UI_SURFACES.borderSubtle} pt-2 space-y-2`}>
          {/* Density mode selector */}
          <div>
            <div className={`flex items-center gap-1 mb-1.5 text-[8px] font-semibold uppercase tracking-wider ${UI_SURFACES.textMuted}`}>
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
                      ? "${UI_SURFACES.borderStandard} text-sky-300"
                      : "${UI_SURFACES.textDim} ${UI_SURFACES.hoverTextSoft} ${UI_SURFACES.borderFaint}"
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
            <div className={`flex items-center gap-1 mb-1 text-[8px] font-semibold uppercase tracking-wider ${UI_SURFACES.textMuted}`}>
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
                    className={`h-2.5 w-2.5 rounded ${UI_SURFACES.borderDark} ${UI_SURFACES.hoverBgMuted} accent-[#3b82f6] cursor-pointer`}
                  />
                  <span className={`text-[9px] transition-colors ${
                    overlayFilters[opt.id] ? `${UI_SURFACES.textBody}` : "${UI_SURFACES.textDim}"
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
