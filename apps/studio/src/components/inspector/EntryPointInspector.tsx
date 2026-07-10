"use client";

import { Trash2 } from "lucide-react";

import { NumberInput, TextInput } from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


export function EntryPointInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const entryPoint = scene.entryPoints.find((entry) => entry.id === selectedId);
  if (!entryPoint) return null;

  const SNAP_RADIUS = 2.5;
  const [epx, epz] = entryPoint.position;
  const nearbyPaths = scene.paths.filter((p) => {
    const first = p.points[0]?.position;
    const last = p.points[p.points.length - 1]?.position;
    const near = (pt: [number, number] | undefined) =>
      pt ? Math.hypot(pt[0] - epx, pt[1] - epz) <= SNAP_RADIUS : false;
    return near(first) || near(last);
  });

  return (
    <>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <div className="text-[12px] font-semibold text-white">{entryPoint.label}</div>
        <div className={`text-[9px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Entry Point</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={entryPoint.label}
          onChange={(value) => updateNode(entryPoint.id, { label: value })}
        />

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

        <SectionCard title="Nearby Paths">
          {nearbyPaths.length > 0 ? (
            <div className="space-y-1">
              {nearbyPaths.map((p) => (
                <div key={p.id} className={`flex items-center justify-between gap-2 border-b ${UI_SURFACES.borderFaint} py-1.5 last:border-0`}>
                  <span className={`text-[10px] ${UI_SURFACES.textBody}`}>{p.label}</span>
                  <span className={`text-[9px] capitalize ${UI_SURFACES.textDimMid}`}>{p.intent}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-[10px] ${UI_SURFACES.textMuted}`}>No paths start or end within 2.5 m of this entry point.</p>
          )}
        </SectionCard>
      </div>

      <div className={`{border-t ${UI_SURFACES.borderPanel} px-3 py-3}`}>
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
