"use client";

import { Lightbulb, Trash2 } from "lucide-react";

import {
  Field,
  NumberInput,
  SelectInput,
  TextInput,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import type { SecurityLightNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function LightInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const light = scene.securityLights.find((l) => l.id === selectedId);
  if (!light) return null;

  const statusColor = light.status === "on" ? "green" : light.status === "failed" ? "red" : "gray";
  const nightCoverageActive = light.status === "on" && light.illuminatesNightCoverage;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{light.name}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{light.lightType}</div>
            </div>
          </div>
          <Badge variant={statusColor as "green" | "red" | "gray"} dot>
            {light.status}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={light.name}
          onChange={(value) => updateNode(light.id, { name: value })}
        />

        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={light.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [value, light.position[1], light.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Z"
              value={light.position[2]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [light.position[0], light.position[1], value] as [number, number, number] })}
            />
            <NumberInput
              label="Y"
              value={light.position[1]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [light.position[0], value, light.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Range"
              value={light.rangeM}
              min={0.5}
              max={20}
              step={0.5}
              unit="m"
              onChange={(value) => updateNode(light.id, { rangeM: value })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Light Properties">
          <SelectInput
            label="Brightness"
            value={light.brightness}
            options={[
              { value: "dim", label: "Dim" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "very_high", label: "Very High" },
            ]}
            onChange={(value) => updateNode(light.id, { brightness: value as SecurityLightNode["brightness"] })}
          />
          <SelectInput
            label="Type"
            value={light.lightType}
            options={[
              { value: "ceiling", label: "Ceiling" },
              { value: "wall", label: "Wall" },
              { value: "flood", label: "Flood" },
              { value: "street", label: "Street" },
              { value: "emergency", label: "Emergency" },
              { value: "ir_flood", label: "IR Flood" },
            ]}
            onChange={(value) => updateNode(light.id, { lightType: value as SecurityLightNode["lightType"] })}
          />
          <SelectInput
            label="Status"
            value={light.status}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
              { value: "failed", label: "Failed" },
            ]}
            onChange={(value) => updateNode(light.id, { status: value as SecurityLightNode["status"] })}
          />
        </SectionCard>

        <SectionCard title="Night Impact">
          <ToggleField
            label="Illuminates Night Coverage"
            value={light.illuminatesNightCoverage}
            trueLabel="Yes"
            falseLabel="No"
            onChange={(value) => updateNode(light.id, { illuminatesNightCoverage: value })}
          />
          <Field
            label="Night Contribution"
            value={nightCoverageActive ? "Active" : "Inactive"}
          />
          <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-2 text-[10px] leading-relaxed text-[#8d98b0]">
            {nightCoverageActive
              ? "This light reduces night-mode penalty in the simulation and can improve low-light camera quality."
              : "This light does not currently reduce night-mode penalty. Turn it on and enable night coverage to influence simulation results."}
          </div>
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(light.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/20 text-[10px] font-medium text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Remove Light
        </button>
      </div>
    </>
  );
}
