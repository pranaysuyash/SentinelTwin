"use client";

import { Trash2 } from "lucide-react";

import {
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import type { FenceSegment } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


export function FenceInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const fence = (scene.fenceSegments ?? []).find((f) => f.id === selectedId);
  if (!fence) return null;

  const lengthM = Math.hypot(fence.end[0] - fence.start[0], fence.end[1] - fence.start[1]);

  return (
    <>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <div className="text-[12px] font-semibold text-white">{fence.label}</div>
        <div className={`text-[9px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Fence Segment · {lengthM.toFixed(2)}m</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={fence.label}
          onChange={(value) => updateNode(fence.id, { label: value })}
        />

        <SectionCard title="Endpoints">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Start X" value={fence.start[0]} step={0.1} unit="m" onChange={(v) => updateNode(fence.id, { start: [v, fence.start[1]] })} />
            <NumberInput label="Start Z" value={fence.start[1]} step={0.1} unit="m" onChange={(v) => updateNode(fence.id, { start: [fence.start[0], v] })} />
            <NumberInput label="End X" value={fence.end[0]} step={0.1} unit="m" onChange={(v) => updateNode(fence.id, { end: [v, fence.end[1]] })} />
            <NumberInput label="End Z" value={fence.end[1]} step={0.1} unit="m" onChange={(v) => updateNode(fence.id, { end: [fence.end[0], v] })} />
          </div>
        </SectionCard>

        <SectionCard title="Physical Properties">
          <NumberInput label="Height" value={fence.heightM} min={0.5} step={0.1} unit="m" onChange={(v) => updateNode(fence.id, { heightM: v })} />
          <SelectInput
            label="Material"
            value={fence.material}
            options={[
              { value: "chain_link", label: "Chain Link" },
              { value: "solid_metal", label: "Solid Metal" },
              { value: "timber", label: "Timber" },
              { value: "brick", label: "Brick" },
              { value: "razor_wire", label: "Razor Wire" },
              { value: "electric", label: "Electric" },
            ]}
            onChange={(v) => updateNode(fence.id, { material: v as FenceSegment["material"] })}
          />
          <NumberInput
            label="Vision Transmission"
            value={fence.visionTransmission}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateNode(fence.id, { visionTransmission: v })}
          />
        </SectionCard>

        <SectionCard title="Security State">
          <SelectInput
            label="Integrity"
            value={fence.integrityState}
            options={[
              { value: "intact", label: "Intact" },
              { value: "damaged", label: "Damaged" },
              { value: "breached", label: "Breached" },
            ]}
            onChange={(v) => updateNode(fence.id, { integrityState: v as FenceSegment["integrityState"] })}
          />
          <NumberInput
            label="Climb Difficulty"
            value={fence.climbDifficulty}
            min={1}
            max={5}
            step={1}
            onChange={(v) => updateNode(fence.id, { climbDifficulty: Math.round(v) as FenceSegment["climbDifficulty"] })}
          />
        </SectionCard>

        <button
          onClick={() => removeNode(fence.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/40"
        >
          <Trash2 size={11} />
          Remove Fence Segment
        </button>
      </div>
    </>
  );
}
