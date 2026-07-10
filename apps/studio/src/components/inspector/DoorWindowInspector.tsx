"use client";

import { Crosshair, Trash2 } from "lucide-react";

import { NumberInput, SelectInput, TextInput } from "@/components/inspector/inspector-controls";
import { NodeAppearanceSection } from "@/components/inspector/NodeAppearanceSection";
import { SectionCard } from "@/components/shared/SectionCard";
import { snapDoorWindowToWall } from "@/components/inspector/door-window-snap";
import { OBJECT_PRESET_CHOICES } from "@/lib/scene-appearance";
import type { DoorAccessControl, DoorNode, WindowNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
      <div className="`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`">
        <div className="text-[12px] font-semibold text-white">{node.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{isWindow ? "Window" : "Door"}</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={node.label}
          onChange={(value) => updateNode(node.id, { label: value })}
        />

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

        {!isWindow && (
          <SectionCard title="Access Control" helpText="Configures how hard it is for an adversary to breach this door. The adversarial path simulation adds breach time to the total route exposure when this door is on the computed path." helpTitle="Access control help">
            <SelectInput
              label="Control Type"
              value={(node as DoorNode).accessControl?.type ?? "none"}
              options={[
                { value: "none",       label: "None (open)" },
                { value: "pin",        label: "PIN Keypad" },
                { value: "card",       label: "Card Reader" },
                { value: "biometric",  label: "Biometric" },
                { value: "guard_post", label: "Guard Post" },
              ]}
              onChange={(value) => {
                const existing = (node as DoorNode).accessControl;
                updateNode(node.id, {
                  accessControl: value === "none"
                    ? undefined
                    : { type: value as DoorAccessControl["type"], breachDifficulty: existing?.breachDifficulty ?? 2 },
                } as Partial<DoorNode>);
              }}
            />
            {(node as DoorNode).accessControl && (node as DoorNode).accessControl!.type !== "none" && (
              <>
                <NumberInput
                  label="Breach Difficulty"
                  value={(node as DoorNode).accessControl!.breachDifficulty}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(value) =>
                    updateNode(node.id, {
                      accessControl: { ...(node as DoorNode).accessControl!, breachDifficulty: value },
                    } as Partial<DoorNode>)
                  }
                />
                <NumberInput
                  label="Breach Time"
                  value={(node as DoorNode).accessControl?.breachTimeS ?? 30}
                  min={1}
                  step={5}
                  unit="s"
                  onChange={(value) =>
                    updateNode(node.id, {
                      accessControl: { ...(node as DoorNode).accessControl!, breachTimeS: value },
                    } as Partial<DoorNode>)
                  }
                />
                <div className="pt-0.5 text-[9px] leading-relaxed text-[#6a748b]">
                  Difficulty 1 = trivial (push through), 5 = extreme (biometric + guard). Breach time adds to total adversarial route duration.
                </div>
              </>
            )}
          </SectionCard>
        )}

        <NodeAppearanceSection
          title={isWindow ? "Frame Appearance" : "Panel Appearance"}
          appearance={node.appearance}
          presetChoices={OBJECT_PRESET_CHOICES}
          onChange={(next) => useStudioStore.getState().updateNodeAppearance(node.id, next)}
        />
      </div>

      <div className="`{border-t ${UI_SURFACES.borderPanel} px-3 py-3}`">
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
