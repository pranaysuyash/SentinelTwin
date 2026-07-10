"use client";

import { Box, Trash2 } from "lucide-react";

import {
  Field,
  NumberInput,
  SelectInput,
  SliderInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { NodeAppearanceSection } from "@/components/inspector/NodeAppearanceSection";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { OBJECT_PRESET_CHOICES } from "@/lib/scene-appearance";
import type { ObstructionNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const OBSTRUCTION_MATERIALS = [
  { value: "solid", label: "Solid" },
  { value: "glass", label: "Glass" },
  { value: "grill", label: "Grill" },
  { value: "partial", label: "Partial" },
] as const satisfies { value: ObstructionNode["material"]; label: string }[];

const VISION_TRANSMISSION: Partial<Record<ObstructionNode["material"], number>> = {
  solid: 0,
  glass: 0.9,
  grill: 0.5,
  partial: 0.3,
};

const OBSTRUCTION_TYPE_OPTIONS = [
  { value: "shelf", label: "Shelf" },
  { value: "cupboard", label: "Cupboard" },
  { value: "counter", label: "Counter" },
  { value: "pillar", label: "Pillar" },
  { value: "vehicle", label: "Vehicle" },
  { value: "partition", label: "Partition" },
  { value: "storage_boxes", label: "Storage Boxes" },
  { value: "glass_display", label: "Glass Display" },
  { value: "tree", label: "Tree" },
  { value: "gate", label: "Gate" },
  { value: "signboard", label: "Signboard" },
  { value: "curtain", label: "Curtain" },
  { value: "other", label: "Other" },
] as const satisfies { value: ObstructionNode["obstructionType"]; label: string }[];

const OBSTRUCTION_TYPE_CONFIG: Partial<Record<
  ObstructionNode["obstructionType"],
  {
    label: string;
    dimensions: [number, number, number];
    material: ObstructionNode["material"];
    visionTransmission: number;
  }
>> = {
  shelf: { label: "Shelf", dimensions: [1.2, 0.5, 2.0], material: "solid", visionTransmission: 0 },
  cupboard: { label: "Cupboard", dimensions: [1.0, 0.6, 2.1], material: "solid", visionTransmission: 0 },
  counter: { label: "Counter", dimensions: [1.5, 0.8, 1.1], material: "solid", visionTransmission: 0 },
  pillar: { label: "Pillar", dimensions: [0.6, 0.6, 2.8], material: "solid", visionTransmission: 0 },
  vehicle: { label: "Vehicle", dimensions: [2.1, 4.2, 1.8], material: "solid", visionTransmission: 0 },
  partition: { label: "Partition", dimensions: [1.5, 0.15, 2.1], material: "partial", visionTransmission: 0.3 },
  storage_boxes: { label: "Storage Boxes", dimensions: [1.4, 0.8, 1.4], material: "solid", visionTransmission: 0 },
  glass_display: { label: "Glass Display", dimensions: [1.4, 0.6, 1.9], material: "glass", visionTransmission: 0.65 },
  tree: { label: "Tree", dimensions: [1.4, 1.4, 2.8], material: "solid", visionTransmission: 0 },
  gate: { label: "Gate", dimensions: [1.5, 0.2, 2.2], material: "partial", visionTransmission: 0.3 },
  signboard: { label: "Signboard", dimensions: [1.2, 0.1, 1.8], material: "solid", visionTransmission: 0 },
  curtain: { label: "Curtain", dimensions: [1.6, 0.05, 2.3], material: "curtain", visionTransmission: 0.2 },
  other: { label: "Obstruction", dimensions: [1.0, 0.5, 2.0], material: "solid", visionTransmission: 0 },
};

export function ObstructionInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const counterfactualResult = useStudioStore((s) => s.counterfactualResult);
  const counterfactualObsId = useStudioStore((s) => s.counterfactualObsId);
  const runCounterfactual = useStudioStore((s) => s.runCounterfactual);
  const clearCounterfactual = useStudioStore((s) => s.clearCounterfactual);

  const obs = scene.obstructions.find((entry) => entry.id === selectedId);
  if (!obs) return null;

  const isRunningForThis = counterfactualObsId === obs.id;
  const delta = isRunningForThis && simulationResult && counterfactualResult ? {
    coverage: counterfactualResult.totalCoveragePct - simulationResult.totalCoveragePct,
    blindspot: simulationResult.blindspotPct - counterfactualResult.blindspotPct,
    recognition: counterfactualResult.recognitionAreaPct - simulationResult.recognitionAreaPct,
    zoneFlips: counterfactualResult.criticalZoneResults.filter((czr) => {
      const baseline = simulationResult.criticalZoneResults.find((b) => b.zoneId === czr.zoneId);
      return baseline && baseline.status !== "pass" && czr.status === "pass";
    }),
  } : null;

  return (
    <>
      <div className="`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/12">
              <Box className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{obs.label}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{obs.obstructionType}</div>
            </div>
          </div>
          <Badge variant={obs.movable ? "green" : "gray"} dot>
            {obs.movable ? "Movable" : "Fixed"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={obs.label}
          onChange={(value) => updateNode(obs.id, { label: value })}
        />

        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={obs.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { position: [value, obs.position[1], obs.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Z"
              value={obs.position[2]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { position: [obs.position[0], obs.position[1], value] as [number, number, number] })}
            />
          </div>
          <div className="mt-2">
            <SliderInput
              label="Rotation Y"
              value={obs.rotationYDeg}
              min={-180}
              max={180}
              unit="°"
              onChange={(value) => updateNode(obs.id, { rotationYDeg: value })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Type">
          <SelectInput
            label="Subtype"
            value={obs.obstructionType}
            options={[...OBSTRUCTION_TYPE_OPTIONS]}
            onChange={(value) => {
              const config =
                OBSTRUCTION_TYPE_CONFIG[value as ObstructionNode["obstructionType"]] ?? OBSTRUCTION_TYPE_CONFIG.other!;
              updateNode(obs.id, {
                obstructionType: value as ObstructionNode["obstructionType"],
                label: config.label,
                dimensions: config.dimensions,
                material: config.material,
                visionTransmission: config.visionTransmission,
              });
            }}
          />
        </SectionCard>

        <SectionCard title="Dimensions">
          <div className="grid grid-cols-3 gap-1.5">
            <NumberInput
              label="W"
              value={obs.dimensions[0]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [value, obs.dimensions[1], obs.dimensions[2]] as [number, number, number] })}
            />
            <NumberInput
              label="H"
              value={obs.dimensions[2]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [obs.dimensions[0], obs.dimensions[1], value] as [number, number, number] })}
            />
            <NumberInput
              label="D"
              value={obs.dimensions[1]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [obs.dimensions[0], value, obs.dimensions[2]] as [number, number, number] })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Material">
          <SelectInput
            label="Material"
            value={obs.material}
            options={[...OBSTRUCTION_MATERIALS]}
            onChange={(value) => updateNode(obs.id, {
              material: value as ObstructionNode["material"],
              visionTransmission: VISION_TRANSMISSION[value as ObstructionNode["material"]] ?? 0,
            })}
          />
          <Field label="Camera sees through" value={`${Math.round((obs.visionTransmission ?? 0) * 100)}%`} />
          <Field label="Movable" value={obs.movable ? "Yes" : "No"} />
        </SectionCard>

        <NodeAppearanceSection
          appearance={obs.appearance}
          presetChoices={OBJECT_PRESET_CHOICES}
          onChange={(next) => useStudioStore.getState().updateNodeAppearance(obs.id, next)}
        />
      </div>

      <div className="`{border-t ${UI_SURFACES.borderPanel} px-3 py-3 space-y-2}`">
        <button
          type="button"
          onClick={() => isRunningForThis ? clearCounterfactual() : runCounterfactual(obs.id)}
          disabled={!simulationResult}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600/30 bg-blue-600/10 text-[10px] font-medium text-blue-300 transition-colors hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunningForThis ? "Clear Test" : "Test Without This Obstruction"}
        </button>

        {delta && (
          <div className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#0a0d15] p-2.5 space-y-1.5}`">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#3a4158] mb-2">
              If removed — delta vs current
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.coverage >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.coverage > 0 ? "+" : ""}{delta.coverage.toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">coverage</span>
              </div>
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.blindspot >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.blindspot > 0 ? "-" : "+"}{Math.abs(delta.blindspot).toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">blindspot</span>
              </div>
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.recognition >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.recognition > 0 ? "+" : ""}{delta.recognition.toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">recognition</span>
              </div>
            </div>
            {delta.zoneFlips.length > 0 && (
              <div className="mt-1.5">
                {delta.zoneFlips.map((z) => (
                  <div key={z.zoneId} className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-red-400">✗ FAIL</span>
                    <span className="text-[#4a5568]">→</span>
                    <span className="text-green-400">✓ PASS</span>
                    <span className="text-[#8090a8]">{z.label ?? z.zoneId}</span>
                  </div>
                ))}
              </div>
            )}
            {delta.zoneFlips.length === 0 && delta.coverage < 0.5 && delta.blindspot < 0.5 && (
              <div className="text-[9px] text-[#4a5568] text-center pt-1">
                Minimal impact — obstruction may not be blocking critical sightlines
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => useStudioStore.getState().removeNode(obs.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Obstruction
        </button>
      </div>
    </>
  );
}
