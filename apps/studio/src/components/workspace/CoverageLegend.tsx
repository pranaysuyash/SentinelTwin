"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, Layers } from "lucide-react";
import { useStudioStore, type OverlayDensity, type OverlayFilterId } from "@/store/studio-store";

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

  const isFragility = heatmapMode === "fragility";
  const [collapsed, setCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="absolute left-3 top-3 z-10 min-w-[182px] rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      {/* Header row with collapse toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5b667c] hover:text-[#93c5fd] transition-colors"
        >
          {collapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isFragility ? "Coverage Fragility" : "Coverage Quality (PPM)"}
        </button>

        {/* Filter toggle button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-0.5 rounded transition-colors ${showFilters ? "text-[#93c5fd]" : "text-[#3a4158] hover:text-[#647089]"}`}
          title="Overlay filters & density"
        >
          <Filter className="h-3 w-3" />
        </button>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Mode toggle — only when simulation data is present */}
          {hasResult ? (
            <div className="mb-2 flex rounded-md overflow-hidden border border-[#2a3246]">
              <button
                onClick={() => setHeatmapMode("quality")}
                className="flex-1 py-0.5 text-[8px] font-semibold tracking-wide uppercase transition-colors"
                style={{
                  background: !isFragility ? "#1e2d4a" : "transparent",
                  color: !isFragility ? "#93c5fd" : "#3a4158",
                }}
              >
                Quality
              </button>
              <button
                onClick={() => setHeatmapMode("fragility")}
                className="flex-1 py-0.5 text-[8px] font-semibold tracking-wide uppercase transition-colors"
                style={{
                  background: isFragility ? "#2d1e1e" : "transparent",
                  color: isFragility ? "#fca5a5" : "#3a4158",
                }}
              >
                Fragility
              </button>
            </div>
          ) : null}

          {/* Quality/fragility legend items */}
          <div className="space-y-1.5">
            {(isFragility ? FRAGILITY_LEVELS : QUALITY_LEVELS).map(({ label, range, detail, color }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color, opacity: 0.9 }} />
                <div className="min-w-0 flex-1 leading-none">
                  <div className="text-[10px] text-[#c7d0e4]">{range}</div>
                  <div className="mt-1 text-[8px] text-[#647089]">{label} &middot; {detail}</div>
                </div>
              </div>
            ))}
          </div>

          {isFragility ? (
            <div className="mt-2 border-t border-[#1f2536] pt-1.5 text-[8px] text-[#4a5568] leading-tight">
              How close each cell is to a DORI threshold boundary. Fragile cells may drop quality under minor camera adjustments.
            </div>
          ) : null}
        </>
      )}

      {/* Expandable filter & density panel */}
      {showFilters && (
        <div className="mt-2 border-t border-[#1f2536] pt-2 space-y-2">
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
                  onClick={() => setOverlayDensity(opt.value)}
                  className={`flex-1 py-0.5 text-[8px] font-medium rounded transition-colors ${
                    overlayDensity === opt.value
                      ? "bg-[#1e2d4a] text-[#93c5fd]"
                      : "text-[#3a4158] hover:text-[#647089] hover:bg-[#1a1f2e]"
                  }`}
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
