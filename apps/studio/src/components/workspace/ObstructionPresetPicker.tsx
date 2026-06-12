"use client";

import React from "react";
import { Box, Car, Columns3, Grid3x3, Package, PanelTop, Ruler, Square, TreePine, X } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  CUSTOM_OBSTRUCTION_PRESET_ID,
  OBSTRUCTION_PRESETS,
  getObstructionPreset,
} from "@/lib/obstruction-presets";
import { useStudioStore } from "@/store/studio-store";

const PRESET_ICONS: Record<string, React.ReactNode> = {
  shelf: <Grid3x3 className="h-3.5 w-3.5" />,
  counter: <PanelTop className="h-3.5 w-3.5" />,
  cupboard: <Package className="h-3.5 w-3.5" />,
  pillar: <Columns3 className="h-3.5 w-3.5" />,
  glass_display: <Square className="h-3.5 w-3.5" />,
  partition: <PanelTop className="h-3.5 w-3.5" />,
  vehicle: <Car className="h-3.5 w-3.5" />,
  tree: <TreePine className="h-3.5 w-3.5" />,
  [CUSTOM_OBSTRUCTION_PRESET_ID]: <Ruler className="h-3.5 w-3.5" />,
};

function DimensionInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
      <input
        type="number"
        min={0.05}
        step={0.1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded-md border border-[#24283a] bg-[#0b0f17] px-2 py-1 text-[11px] text-[#e6ebf7] outline-none focus:border-amber-400/50"
      />
    </label>
  );
}

export function ObstructionPresetPicker() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedPresetId = useStudioStore((s) => s.obstructionPresetId);
  const setSelectedPresetId = useStudioStore((s) => s.setObstructionPresetId);
  const customDimensions = useStudioStore((s) => s.customObstructionDimensions);
  const setCustomDimensions = useStudioStore((s) => s.setCustomObstructionDimensions);
  const selectedPreset = getObstructionPreset(selectedPresetId);

  // Collapsed by default: the expanded grid can cover most of the canvas at
  // narrow widths, blocking the placement clicks it exists to support.
  const [collapsed, setCollapsed] = React.useState(true);

  if (activeTool !== "obstruction") return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 rounded-xl border border-[#1f2536] bg-[#0d1017]/96 px-3 py-2 shadow-2xl shadow-black/35 transition-colors hover:border-[#2d3750] hover:bg-[#111521]"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#24314a] bg-[#101622] text-amber-200">
          {PRESET_ICONS[selectedPreset.id] ?? <Box className="h-3 w-3" />}
        </div>
        <span className="text-[10px] font-semibold text-[#d2d9e8]">{selectedPreset.label}</span>
        <span className="rounded-full border border-[#1f2536] bg-[#111521] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#7d8aa4]">
          Open
        </span>
      </button>
    );
  }

  return (
    <div className="w-[80vw] max-w-[560px] min-w-[340px] rounded-2xl border border-[#1f2536] bg-[#0d1017]/96 p-2.5 shadow-2xl shadow-black/35">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
            Object library
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-[#7b889f]">
            Pick the object to place. Dimensions and occlusion behavior feed the deterministic coverage engine directly.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-lg border border-[#1f2536] bg-[#111521] p-1.5 text-[#7b889f] transition-colors hover:border-[#2d3750] hover:text-[#d2d9e8]"
          aria-label="Close object library"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {OBSTRUCTION_PRESETS.map((preset) => {
          const isSelected = selectedPreset.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedPresetId(preset.id)}
              aria-pressed={isSelected}
              title={preset.description}
              className={cn(
                "group rounded-xl border px-2 py-2 text-left transition-all",
                isSelected
                  ? "border-amber-400/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]"
                  : "border-[#1f2536] bg-[#0b0f17] hover:border-[#2d3750] hover:bg-[#111521]",
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                    isSelected ? "border-amber-400/30 bg-amber-500/12 text-amber-200" : "border-[#24314a] bg-[#101622] text-[#93a4bf]",
                  )}
                >
                  {PRESET_ICONS[preset.id] ?? <Box className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold text-[#e6ebf7]">{preset.label}</div>
                  <div className="truncate text-[8px] text-[#74829d]">
                    {preset.id === CUSTOM_OBSTRUCTION_PRESET_ID
                      ? `${customDimensions[0]}×${customDimensions[1]}×${customDimensions[2]}m`
                      : `${preset.dimensions[0]}×${preset.dimensions[1]}×${preset.dimensions[2]}m`}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPreset.id === CUSTOM_OBSTRUCTION_PRESET_ID ? (
        <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2">
          <div className="text-[8px] uppercase tracking-[0.18em] text-amber-200/70">Custom dimensions (meters)</div>
          <div className="mt-1.5 flex gap-2">
            <DimensionInput
              label="Width"
              value={customDimensions[0]}
              onChange={(value) => setCustomDimensions([value, customDimensions[1], customDimensions[2]])}
            />
            <DimensionInput
              label="Depth"
              value={customDimensions[1]}
              onChange={(value) => setCustomDimensions([customDimensions[0], value, customDimensions[2]])}
            />
            <DimensionInput
              label="Height"
              value={customDimensions[2]}
              onChange={(value) => setCustomDimensions([customDimensions[0], customDimensions[1], value])}
            />
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-3 py-2">
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-[#1f2536] bg-[#111521] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#7d8aa4]">
              {selectedPreset.material}
            </span>
            <span className="rounded-full border border-[#1f2536] bg-[#111521] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#7d8aa4]">
              {selectedPreset.visionTransmission === 0
                ? "Blocks vision"
                : `${Math.round(selectedPreset.visionTransmission * 100)}% see-through`}
            </span>
            {selectedPreset.glareRisk ? (
              <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-amber-200">
                Glare risk
              </span>
            ) : null}
            {selectedPreset.nightIRReflective ? (
              <span className="rounded-full border border-purple-400/25 bg-purple-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-purple-200">
                IR reflective
              </span>
            ) : null}
            <span className="rounded-full border border-[#1f2536] bg-[#111521] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#7d8aa4]">
              {selectedPreset.movable ? "Movable" : "Fixed"}
            </span>
          </div>
          <div className="mt-1 text-[9px] leading-relaxed text-[#7b889f]">{selectedPreset.description}</div>
        </div>
      )}
    </div>
  );
}
