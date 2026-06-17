"use client";

import { Crosshair, Trash2 } from "lucide-react";

import { NumberInput, SelectInput } from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import { snapDoorWindowToWall } from "@/components/inspector/door-window-snap";
import type { DoorNode, WindowNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function DoorWindowInspector({ node }: { node: DoorNode | WindowNode }) {
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const isWindow = node.nodeType === "window";
  const stateOptions = isWindow
    ? [
        { value: "closed_glass", label: "Closed Glass" },
        { value: "open", label: "Open" },
        { value: "grill", label: "Grill" },
        { value: "curtain", label: "Curtain" },
        { value: "reflective", label: "Reflective" },
      ]
    : [
        { value: "closed", label: "Closed" },
        { value: "open", label: "Open" },
        { value: "locked", label: "Locked" },
        { value: "restricted", label: "Restricted" },
      ];

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{node.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{isWindow ? "Window" : "Door"}</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-3 gap-2">
            <NumberInput label="X" value={node.position[0]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [value, node.position[1], node.position[2]] })} />
            <NumberInput label="Y" value={node.position[1]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [node.position[0], value, node.position[2]] })} />
            <NumberInput label="Z" value={node.position[2]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [node.position[0], node.position[1], value] })} />
          </div>
        </SectionCard>

        <SectionCard title="State">
          <SelectInput
            label="State"
            value={node.state}
            options={stateOptions}
            onChange={(value) => updateNode(node.id, { state: value as DoorNode["state"] | WindowNode["state"] })}
          />
          {isWindow ? (
            <NumberInput
              label="Light through (%)"
              value={node.visionTransmission}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => updateNode(node.id, { visionTransmission: value })}
            />
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            <NumberInput label="W" value={node.dimensions[0]} min={0.1} step={0.05} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [value, node.dimensions[1], node.dimensions[2]] })} />
            <NumberInput label="H" value={node.dimensions[1]} min={0.1} step={0.05} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [node.dimensions[0], value, node.dimensions[2]] })} />
            <NumberInput label="D" value={node.dimensions[2]} min={0.01} step={0.01} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [node.dimensions[0], node.dimensions[1], value] })} />
          </div>
          <button
            type="button"
            onClick={() => {
              const patch = snapDoorWindowToWall(node, scene);
              if (!patch) return;
              updateNode(node.id, patch);
            }}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-sky-900/30 bg-sky-950/15 text-[10px] font-medium text-sky-300 transition-colors hover:border-sky-700 hover:bg-sky-950/30"
          >
            <Crosshair className="h-3 w-3" />
            Snap to Nearest Wall
          </button>
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(node.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete {isWindow ? "Window" : "Door"}
        </button>
      </div>
    </>
  );
}
