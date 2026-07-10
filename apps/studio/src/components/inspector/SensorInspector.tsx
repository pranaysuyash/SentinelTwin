"use client";

import { ScanSearch, Trash2 } from "lucide-react";

import {
  Field,
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import type { CameraNode, SensorNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const SENSOR_TYPE_LABELS: Record<SensorNode["sensorType"], string> = {
  motion: "Motion",
  door_contact: "Door Contact",
  access_reader: "Access Reader",
  audio: "Audio",
  vibration: "Vibration",
  panic_button: "Panic Button",
  smoke_heat: "Smoke / Heat",
};

const SENSOR_STATE_OPTIONS: Array<{ value: SensorNode["state"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "faulted", label: "Faulted" },
];

const SENSOR_COVERAGE_OPTIONS: Array<{ value: SensorNode["coverageMode"]; label: string }> = [
  { value: "detection", label: "Detection" },
  { value: "trigger", label: "Trigger" },
  { value: "audit", label: "Audit" },
];

const SENSOR_COVERAGE_LABELS: Record<SensorNode["coverageMode"], string> = {
  detection: "Detection",
  trigger: "Trigger",
  audit: "Audit",
};

export function SensorInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const recordSensorEvent = useStudioStore((s) => s.recordSensorEvent);

  const sensor = scene.sensors.find((entry) => entry.id === selectedId);
  if (!sensor) return null;

  let nearestCamera: CameraNode | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const camera of scene.cameras) {
    const dx = camera.position[0] - sensor.position[0];
    const dy = camera.position[1] - sensor.position[1];
    const dz = camera.position[2] - sensor.position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCamera = camera;
    }
  }

  return (
    <>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
              <ScanSearch className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{sensor.label}</div>
              <div className={`text-[9px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
                {SENSOR_TYPE_LABELS[sensor.sensorType]} · {SENSOR_COVERAGE_LABELS[sensor.coverageMode]}
              </div>
            </div>
          </div>
          <Badge variant={sensor.state === "active" ? "green" : sensor.state === "inactive" ? "amber" : "red"} dot>
            {sensor.state}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <TextInput
          label="Name"
          value={sensor.label}
          onChange={(value) => updateNode(sensor.id, { label: value })}
        />

        <SectionCard title="Position">
          <div className="grid grid-cols-3 gap-2">
            <NumberInput
              label="X"
              value={sensor.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(sensor.id, { position: [value, sensor.position[1], sensor.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Y"
              value={sensor.position[1]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(sensor.id, { position: [sensor.position[0], value, sensor.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Z"
              value={sensor.position[2]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(sensor.id, { position: [sensor.position[0], sensor.position[1], value] as [number, number, number] })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Sensor Settings">
          <SelectInput
            label="Sensor Type"
            value={sensor.sensorType}
            options={(Object.keys(SENSOR_TYPE_LABELS) as SensorNode["sensorType"][]).map((value) => ({ value, label: SENSOR_TYPE_LABELS[value] }))}
            onChange={(value) => updateNode(sensor.id, { sensorType: value as SensorNode["sensorType"] })}
          />
          <SelectInput
            label="Coverage Mode"
            value={sensor.coverageMode}
            options={SENSOR_COVERAGE_OPTIONS}
            onChange={(value) => updateNode(sensor.id, { coverageMode: value as SensorNode["coverageMode"] })}
          />
          <SelectInput
            label="State"
            value={sensor.state}
            options={SENSOR_STATE_OPTIONS}
            onChange={(value) => updateNode(sensor.id, { state: value as SensorNode["state"] })}
          />
        </SectionCard>

        <SectionCard title="Fusion Preview">
          <Field label="Nearest Camera" value={nearestCamera?.name ?? "None"} />
          <Field label="Camera Distance" value={nearestCamera ? `${nearestDistance.toFixed(1)}m` : "—"} />
          <Field label="Coverage Mode" value={SENSOR_COVERAGE_LABELS[sensor.coverageMode]} />
          <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2 text-[10px] leading-relaxed ${UI_SURFACES.textSoftBright}`}>
            Sensors participate in the canonical scene graph and report summary. Live event binding records sensor triggers, heartbeats, faults, and restores into the evidence trail.
          </div>
        </SectionCard>

        <SectionCard title="Live Event Controls">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => recordSensorEvent({
                sensorId: sensor.id,
                sensorLabel: sensor.label,
                sensorType: sensor.sensorType,
                kind: "triggered",
                details: `${sensor.label} observed a live trigger.`,
                resultingState: sensor.state,
              })}
              className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-2 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/14"
            >
              Trigger
            </button>
            <button
              type="button"
              onClick={() => recordSensorEvent({
                sensorId: sensor.id,
                sensorLabel: sensor.label,
                sensorType: sensor.sensorType,
                kind: "heartbeat",
                details: `${sensor.label} sent a heartbeat.`,
                resultingState: sensor.state,
              })}
              className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} px-2 py-2 text-[10px] font-medium ${UI_SURFACES.textBody2} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverBgDark}`}
            >
              Heartbeat
            </button>
            <button
              type="button"
              onClick={() => {
                updateNode(sensor.id, { state: "faulted" });
                recordSensorEvent({
                  sensorId: sensor.id,
                  sensorLabel: sensor.label,
                  sensorType: sensor.sensorType,
                  kind: "faulted",
                  details: `${sensor.label} reported a fault.`,
                  resultingState: "faulted",
                });
              }}
              className="rounded-lg border border-red-900/35 bg-red-950/15 px-2 py-2 text-[10px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/28"
            >
              Mark Faulted
            </button>
            <button
              type="button"
              onClick={() => {
                updateNode(sensor.id, { state: "active" });
                recordSensorEvent({
                  sensorId: sensor.id,
                  sensorLabel: sensor.label,
                  sensorType: sensor.sensorType,
                  kind: "restored",
                  details: `${sensor.label} restored to active service.`,
                  resultingState: "active",
                });
              }}
              className="rounded-lg border border-emerald-900/35 bg-emerald-950/15 px-2 py-2 text-[10px] font-medium text-emerald-200 transition-colors hover:border-emerald-700 hover:bg-emerald-950/28"
            >
              Restore
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <label className={`block rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>Notes</span>
            </div>
            <textarea
              value={sensor.notes ?? ""}
              onChange={(event) => updateNode(sensor.id, { notes: event.target.value })}
              rows={3}
              className={`w-full resize-none bg-transparent text-[11px] leading-relaxed ${UI_SURFACES.textBody2} outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50`}
              placeholder="Optional sensor notes"
            />
          </label>
        </SectionCard>
      </div>

      <div className={`{border-t ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <button
          type="button"
          onClick={() => removeNode(sensor.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Sensor
        </button>
      </div>
    </>
  );
}
