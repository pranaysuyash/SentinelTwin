"use client";

import { Trash2 } from "lucide-react";

import {
  NumberInput,
  SelectInput,
  TextInput,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import type { GateNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function GateNodeInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const gate = (scene.gateNodes ?? []).find((g) => g.id === selectedId);
  if (!gate) return null;

  const ac = gate.accessControl;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{gate.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Gate · {gate.gateType}</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={gate.label}
          onChange={(value) => updateNode(gate.id, { label: value })}
        />

        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={gate.position[0]} step={0.1} unit="m" onChange={(v) => updateNode(gate.id, { position: [v, gate.position[1]] })} />
            <NumberInput label="Z" value={gate.position[1]} step={0.1} unit="m" onChange={(v) => updateNode(gate.id, { position: [gate.position[0], v] })} />
          </div>
        </SectionCard>

        <SectionCard title="Gate Properties">
          <SelectInput
            label="Type"
            value={gate.gateType}
            options={[
              { value: "pedestrian", label: "Pedestrian" },
              { value: "vehicle", label: "Vehicle" },
              { value: "service", label: "Service" },
            ]}
            onChange={(v) => updateNode(gate.id, { gateType: v as GateNode["gateType"] })}
          />
          <SelectInput
            label="State"
            value={gate.state}
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "locked", label: "Locked" },
              { value: "restricted", label: "Restricted" },
            ]}
            onChange={(v) => updateNode(gate.id, { state: v as GateNode["state"] })}
          />
          <NumberInput label="Width" value={gate.widthM} min={0.8} step={0.1} unit="m" onChange={(v) => updateNode(gate.id, { widthM: v })} />
        </SectionCard>

        <SectionCard title="Access Control">
          <SelectInput
            label="Control Type"
            value={ac?.type ?? "none"}
            options={[
              { value: "none", label: "None" },
              { value: "pin", label: "PIN Pad" },
              { value: "card", label: "Card Reader" },
              { value: "biometric", label: "Biometric" },
              { value: "guard_post", label: "Guard Post" },
            ]}
            onChange={(v) => {
              if (v === "none") {
                updateNode(gate.id, { accessControl: undefined });
              } else {
                updateNode(gate.id, {
                  accessControl: {
                    type: v as NonNullable<GateNode["accessControl"]>["type"],
                    breachDifficulty: ac?.breachDifficulty ?? 3,
                    breachTimeS: ac?.breachTimeS,
                  },
                });
              }
            }}
          />
          {ac && ac.type !== "none" && (
            <>
              <NumberInput
                label="Breach Difficulty (1–5)"
                value={ac.breachDifficulty}
                min={1}
                max={5}
                step={1}
                onChange={(v) => updateNode(gate.id, { accessControl: { ...ac, breachDifficulty: Math.round(v) } })}
              />
              <NumberInput
                label="Breach Time"
                value={ac.breachTimeS ?? 30}
                min={0}
                step={5}
                unit="s"
                onChange={(v) => updateNode(gate.id, { accessControl: { ...ac, breachTimeS: v } })}
              />
            </>
          )}
        </SectionCard>

        <SectionCard title="Camera Coverage">
          <ToggleField
            label="Has Camera View"
            value={gate.hasCameraView}
            trueLabel="Yes"
            falseLabel="No"
            onChange={(v) => updateNode(gate.id, { hasCameraView: v })}
          />
          {gate.hasCameraView && (
            <TextInput
              label="LPR Camera ID"
              value={gate.lprCameraId ?? ""}
              onChange={(v) => updateNode(gate.id, { lprCameraId: v || undefined })}
            />
          )}
        </SectionCard>

        <button
          onClick={() => removeNode(gate.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/40"
        >
          <Trash2 size={11} />
          Remove Gate
        </button>
      </div>
    </>
  );
}
