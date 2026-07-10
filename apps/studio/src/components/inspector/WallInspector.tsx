"use client";

import { Trash2 } from "lucide-react";

import {
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { NodeAppearanceSection } from "@/components/inspector/NodeAppearanceSection";
import { SectionCard } from "@/components/shared/SectionCard";
import { WALL_PRESET_CHOICES } from "@/lib/scene-appearance";
import type { WallNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


export function WallInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const wall = scene.walls.find((entry) => entry.id === selectedId);
  if (!wall) return null;

  const lengthM = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);

  return (
    <>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <div className="text-[12px] font-semibold text-white">{wall.label}</div>
        <div className={`text-[9px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Wall · {lengthM.toFixed(2)}m</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={wall.label}
          onChange={(value) => updateNode(wall.id, { label: value })}
        />

        <SectionCard title="Endpoints">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Start X" value={wall.start[0]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { start: [value, wall.start[1]] })} />
            <NumberInput label="Start Z" value={wall.start[1]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { start: [wall.start[0], value] })} />
            <NumberInput label="End X" value={wall.end[0]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { end: [value, wall.end[1]] })} />
            <NumberInput label="End Z" value={wall.end[1]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { end: [wall.end[0], value] })} />
          </div>
        </SectionCard>

        <SectionCard title="Material">
          <SelectInput
            label="Material"
            value={wall.material}
            options={[
              { value: "solid", label: "Solid" },
              { value: "glass", label: "Glass" },
              { value: "grill", label: "Grill" },
              { value: "partial", label: "Partial" },
            ]}
            onChange={(value) => updateNode(wall.id, { material: value as WallNode["material"] })}
          />
          <NumberInput label="Height" value={wall.heightM} min={1.2} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { heightM: value })} />
          <NumberInput label="Thickness" value={wall.thicknessM} min={0.05} step={0.01} unit="m" onChange={(value) => updateNode(wall.id, { thicknessM: value })} />
          <NumberInput label="Light through (%)" value={wall.visionTransmission} min={0} max={1} step={0.05} onChange={(value) => updateNode(wall.id, { visionTransmission: value })} />
        </SectionCard>

        <NodeAppearanceSection
          appearance={wall.appearance}
          presetChoices={WALL_PRESET_CHOICES}
          showTextureScale
          onChange={(next) => useStudioStore.getState().updateNodeAppearance(wall.id, next)}
        />
      </div>

      <div className={`{border-t ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <button
          type="button"
          onClick={() => removeNode(wall.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Wall
        </button>
      </div>
    </>
  );
}
