"use client";

import React from "react";
import { BadgeInfo, Box, Car, Columns3, Grid3x3, Layers3, Package, PanelTop, Ruler, Square, TreePine, X } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  CUSTOM_OBSTRUCTION_PRESET_ID,
  OBSTRUCTION_PRESETS,
  getObstructionPreset,
} from "@/lib/obstruction-presets";
import { SCENE_OBJECT_LAYERS, getSceneObjectLayerCounts } from "@/lib/scene-object-catalog";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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
      <span className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>{label}</span>
      <input
        type="number"
        min={0.05}
        step={0.1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className={`w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1 text-[11px] UI_SURFACES.textBody4 outline-none focus:border-amber-400/50`}
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
  const layerCounts = getSceneObjectLayerCounts();

  // Collapsed by default: the expanded grid can cover most of the canvas at
  // narrow widths, blocking the placement clicks it exists to support.
  const [collapsed, setCollapsed] = React.useState(true);

  if (activeTool !== "obstruction") return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`flex items-center gap-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panelDeep/96 px-3 py-2 shadow-2xl shadow-black/35 transition-colors UI_SURFACES.hoverBorderBright hover:UI_SURFACES.card`}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md border UI_SURFACES.borderStandard UI_SURFACES.card text-amber-200">
          {PRESET_ICONS[selectedPreset.id] ?? <Box className="h-3 w-3" />}
        </div>
        <span className={`text-[10px] font-semibold UI_SURFACES.textBody2`}>{selectedPreset.label}</span>
        <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
          Open
        </span>
      </button>
    );
  }

  return (
    <div className={`w-[80vw] max-w-[560px] min-w-[340px] rounded-2xl border UI_SURFACES.borderSubtle UI_SURFACES.panelDeep/96 p-2.5 shadow-2xl shadow-black/35`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[9px] font-semibold uppercase tracking-[0.22em] UI_SURFACES.textMuted`}>
            Object library
          </div>
          <div className={`mt-1 text-[10px] leading-relaxed UI_SURFACES.textSoftDim`}>
            Pick the object to place. The catalog keeps the scene graph split into structural primitives, security fixtures, and fit-out objects so the future marketplace can attach SKUs without changing the scene model.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className={`shrink-0 rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card p-1.5 UI_SURFACES.textSoftDim transition-colors UI_SURFACES.hoverBorderBright hover:UI_SURFACES.textBody2`}
          aria-label="Close object library"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={`mt-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-3 py-2`}>
        <div className={`flex items-center gap-2 text-[8px] uppercase tracking-[0.18em] UI_SURFACES.textSoftMid`}>
          <Layers3 className="h-3.5 w-3.5 text-sky-200" />
          Object graph layers
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SCENE_OBJECT_LAYERS.map((layer) => {
            const isFitOut = layer.id === "fit_out";
            const count = layer.id === "structural"
              ? layerCounts.structural
              : layer.id === "security_fixture"
                ? layerCounts.securityFixture
                : layerCounts.fitOut;

            return (
              <div
                key={layer.id}
                className={cn(
                  "rounded-lg border px-2 py-2",
                  isFitOut ? "border-amber-400/25 bg-amber-500/6" : "UI_SURFACES.borderSubtle UI_SURFACES.card",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-[10px] font-semibold UI_SURFACES.textBody4`}>{layer.label}</div>
                  <span className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em]",
                    isFitOut ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "UI_SURFACES.borderStandard UI_SURFACES.panel UI_SURFACES.textMuted5",
                  )}>
                    {layer.marketplaceRole}
                  </span>
                </div>
                <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>{layer.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {layer.liveExamples.slice(0, 3).map((example) => (
                    <span key={example} className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.panel px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textSoftBright`}>
                      {example}
                    </span>
                  ))}
                </div>
                <div className={`mt-2 flex items-center justify-between gap-2 text-[8px] UI_SURFACES.textDimMid`}>
                  <span>{count} live objects</span>
                  <span>{layer.addPath}</span>
                </div>
                {layer.futureExamples?.length ? (
                  <div className={`mt-2 flex items-start gap-1.5 rounded-md border border-dashed UI_SURFACES.borderDark UI_SURFACES.panel px-2 py-1`}>
                    <BadgeInfo className="mt-0.5 h-3 w-3 shrink-0 text-sky-200/80" />
                    <div className={`text-[8px] leading-relaxed UI_SURFACES.textSoftDim`}>
                      Future catalog examples: {layer.futureExamples.join(", ")}.
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
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
                  : "UI_SURFACES.borderSubtle UI_SURFACES.panel UI_SURFACES.hoverBorderBright hover:UI_SURFACES.card",
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                    isSelected ? "border-amber-400/30 bg-amber-500/12 text-amber-200" : "UI_SURFACES.borderStandard UI_SURFACES.card UI_SURFACES.hoverTextSoft",
                  )}
                >
                  {PRESET_ICONS[preset.id] ?? <Box className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-[10px] font-semibold UI_SURFACES.textBody4`}>{preset.label}</div>
                  <div className="truncate text-[8px] UI_SURFACES.textSoftDim">
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
        <div className={`mt-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-3 py-2`}>
          <div className="flex flex-wrap gap-1">
            <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
              {selectedPreset.material}
            </span>
            <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
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
            <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
              {selectedPreset.movable ? "Movable" : "Fixed"}
            </span>
          </div>
          <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>{selectedPreset.description}</div>
        </div>
      )}
    </div>
  );
}
