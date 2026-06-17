"use client";

import { Trash2 } from "lucide-react";

import {
  Field,
  NumberInput,
  SelectInput,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import { pathLength } from "@/components/workspace/editing/editor-geometry";
import type { ScenarioPath } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function PathInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const path = scene.paths.find((entry) => entry.id === selectedId);
  if (!path) return null;

  const lengthM = pathLength(path.points.map((point) => point.position));
  const estimatedTimeS = lengthM / Math.max(0.1, path.speedMps);

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{path.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">
          Path · {lengthM.toFixed(2)}m · {estimatedTimeS.toFixed(1)}s
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Actor">
          <SelectInput
            label="Actor Type"
            value={path.actorType}
            options={[
              { value: "person", label: "Person" },
              { value: "vehicle", label: "Vehicle" },
              { value: "guard", label: "Guard" },
              { value: "crowd", label: "Crowd" },
            ]}
            onChange={(value) => updateNode(path.id, { actorType: value as ScenarioPath["actorType"] })}
          />
          <NumberInput
            label="Speed"
            value={path.speedMps}
            min={0.1}
            step={0.1}
            unit="m/s"
            onChange={(value) => updateNode(path.id, { speedMps: value })}
          />
          <SelectInput
            label="Time"
            value={path.timeOfDay}
            options={[
              { value: "day", label: "Day" },
              { value: "night", label: "Night" },
              { value: "dusk", label: "Dusk" },
              { value: "dawn", label: "Dawn" },
            ]}
            onChange={(value) => updateNode(path.id, { timeOfDay: value as ScenarioPath["timeOfDay"] })}
          />
          <SelectInput
            label="Intent"
            value={path.intent}
            options={[
              { value: "authorized", label: "Authorized" },
              { value: "suspicious", label: "Unverified / Investigative" },
              { value: "incident_replay", label: "Incident Replay" },
            ]}
            onChange={(value) => updateNode(path.id, { intent: value as ScenarioPath["intent"] })}
          />
        </SectionCard>

        <SectionCard title="Metrics">
          <Field label="Length" value={lengthM.toFixed(2)} unit="m" />
          <Field label="Est. Time" value={estimatedTimeS.toFixed(1)} unit="s" />
          <Field label="Points" value={path.points.length} />
        </SectionCard>

        <SectionCard title="Waypoints">
          <div className="space-y-2">
            {path.points.map((point, index) => (
              <div key={`${path.id}-${index}`} className="rounded-lg border border-[#1f2536] bg-[#111521] p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Point {index + 1}</div>
                  {path.points.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateNode(path.id, {
                          points: path.points.filter((_, pointIndex) => pointIndex !== index),
                        });
                      }}
                      className="rounded border border-red-900/30 bg-red-950/15 px-1.5 py-0.5 text-[8px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/30"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberInput
                    label="X"
                    value={point.position[0]}
                    step={0.1}
                    unit="m"
                    onChange={(value) => {
                      updateNode(path.id, {
                        points: path.points.map((entry, pointIndex) =>
                          pointIndex === index
                            ? { ...entry, position: [value, entry.position[1]] as [number, number] }
                            : entry
                        ),
                      });
                    }}
                  />
                  <NumberInput
                    label="Z"
                    value={point.position[1]}
                    step={0.1}
                    unit="m"
                    onChange={(value) => {
                      updateNode(path.id, {
                        points: path.points.map((entry, pointIndex) =>
                          pointIndex === index
                            ? { ...entry, position: [entry.position[0], value] as [number, number] }
                            : entry
                        ),
                      });
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const last = path.points[path.points.length - 1];
                const prev = path.points[path.points.length - 2] ?? last;
                if (!last || !prev) return;
                const midpoint: [number, number] = [
                  (last.position[0] + prev.position[0]) / 2,
                  (last.position[1] + prev.position[1]) / 2,
                ];
                updateNode(path.id, { points: [...path.points, { position: midpoint }] });
              }}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-900/30 bg-blue-950/15 text-[10px] font-medium text-blue-300 transition-colors hover:border-blue-700 hover:bg-blue-950/30"
            >
              Add Waypoint
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(path.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Path
        </button>
      </div>
    </>
  );
}
