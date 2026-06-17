"use client";

import { Trash2 } from "lucide-react";

import {
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import type { BollardLine } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function BollardInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const bollard = (scene.bollardLines ?? []).find((b) => b.id === selectedId);
  if (!bollard) return null;

  const lengthM = Math.hypot(bollard.end[0] - bollard.start[0], bollard.end[1] - bollard.start[1]);

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{bollard.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Bollard Line · {lengthM.toFixed(2)}m</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={bollard.label}
          onChange={(value) => updateNode(bollard.id, { label: value })}
        />

        <SectionCard title="Endpoints">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Start X" value={bollard.start[0]} step={0.1} unit="m" onChange={(v) => updateNode(bollard.id, { start: [v, bollard.start[1]] })} />
            <NumberInput label="Start Z" value={bollard.start[1]} step={0.1} unit="m" onChange={(v) => updateNode(bollard.id, { start: [bollard.start[0], v] })} />
            <NumberInput label="End X" value={bollard.end[0]} step={0.1} unit="m" onChange={(v) => updateNode(bollard.id, { end: [v, bollard.end[1]] })} />
            <NumberInput label="End Z" value={bollard.end[1]} step={0.1} unit="m" onChange={(v) => updateNode(bollard.id, { end: [bollard.end[0], v] })} />
          </div>
        </SectionCard>

        <SectionCard title="Bollard Properties">
          <NumberInput label="Spacing" value={bollard.spacingM} min={0.3} max={3} step={0.1} unit="m" onChange={(v) => updateNode(bollard.id, { spacingM: v })} />
          <SelectInput
            label="Type"
            value={bollard.bollardType}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "removable", label: "Removable" },
              { value: "retractable", label: "Retractable" },
            ]}
            onChange={(v) => updateNode(bollard.id, { bollardType: v as BollardLine["bollardType"] })}
          />
          <SelectInput
            label="Protection Class"
            value={bollard.protectionClass}
            options={[
              { value: "standard", label: "Standard" },
              { value: "pas68", label: "PAS 68" },
              { value: "iwa14_1", label: "IWA 14-1" },
            ]}
            onChange={(v) => updateNode(bollard.id, { protectionClass: v as BollardLine["protectionClass"] })}
          />
        </SectionCard>

        <div className="rounded bg-[#1a1f2e] px-2.5 py-2 text-[10px] text-[#6b7891]">
          Bollard lines block vehicle-class threats. The current pedestrian adversarial model routes around them. Vehicle threat modelling arrives in V0.3.
        </div>

        <button
          onClick={() => removeNode(bollard.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/40"
        >
          <Trash2 size={11} />
          Remove Bollard Line
        </button>
      </div>
    </>
  );
}
