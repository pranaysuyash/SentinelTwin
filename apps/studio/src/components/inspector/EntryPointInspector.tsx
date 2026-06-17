"use client";

import { Trash2 } from "lucide-react";

import { NumberInput } from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import { useStudioStore } from "@/store/studio-store";

export function EntryPointInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const entryPoint = scene.entryPoints.find((entry) => entry.id === selectedId);
  if (!entryPoint) return null;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{entryPoint.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Entry Point</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={entryPoint.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(entryPoint.id, { position: [value, entryPoint.position[1]] })}
            />
            <NumberInput
              label="Z"
              value={entryPoint.position[1]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(entryPoint.id, { position: [entryPoint.position[0], value] })}
            />
          </div>
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(entryPoint.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Entry Point
        </button>
      </div>
    </>
  );
}
