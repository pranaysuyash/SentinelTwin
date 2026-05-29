"use client";

import { ScanSearch, LocateFixed } from "lucide-react";

import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/cn";
import type { SensorNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

const SENSOR_TYPE_LABELS: Record<SensorNode["sensorType"], string> = {
  motion: "Motion",
  door_contact: "Door Contact",
  access_reader: "Access Reader",
  audio: "Audio",
  vibration: "Vibration",
  panic_button: "Panic Button",
  smoke_heat: "Smoke / Heat",
};

const SENSOR_STATE_STYLES: Record<SensorNode["state"], { label: string; tone: "green" | "amber" | "red" }> = {
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "amber" },
  faulted: { label: "Faulted", tone: "red" },
};

const SENSOR_COVERAGE_LABELS: Record<SensorNode["coverageMode"], string> = {
  detection: "Detection",
  trigger: "Trigger",
  audit: "Audit",
};

function formatDistance(distanceM: number | null) {
  if (distanceM === null) return "—";
  return `${distanceM.toFixed(1)}m`;
}

type CameraLike = { position: [number, number, number]; name: string };

function nearestCameraName(sensor: SensorNode, cameras: CameraLike[]) {
  if (cameras.length === 0) return null;
  let bestName: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const camera of cameras) {
    const dx = camera.position[0] - sensor.position[0];
    const dy = camera.position[1] - sensor.position[1];
    const dz = camera.position[2] - sensor.position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = camera.name;
    }
  }
  return bestName;
}

export function SensorsTab() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const sensorPlacementType = useStudioStore((s) => s.sensorPlacementType);
  const setSensorPlacementType = useStudioStore((s) => s.setSensorPlacementType);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);

  const activeCount = scene.sensors.filter((sensor) => sensor.state === "active").length;
  const faultedCount = scene.sensors.filter((sensor) => sensor.state === "faulted").length;
  const inactiveCount = scene.sensors.filter((sensor) => sensor.state === "inactive").length;

  const typeCounts = scene.sensors.reduce<Record<SensorNode["sensorType"], number>>((acc, sensor) => {
    acc[sensor.sensorType] += 1;
    return acc;
  }, {
    motion: 0,
    door_contact: 0,
    access_reader: 0,
    audio: 0,
    vibration: 0,
    panic_button: 0,
    smoke_heat: 0,
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3 p-3">
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
              <ScanSearch className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-white">Sensor Fusion Entry Point</div>
              <div className="mt-1 text-[10px] leading-relaxed text-cyan-100/70">
                Sensors are now a first-class scene object: place them on the canvas, inspect them like other nodes, and track their state in the report handoff.
              </div>
            </div>
          </div>
        </div>

        <SectionCard title="Placement">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(SENSOR_TYPE_LABELS) as SensorNode["sensorType"][]).map((sensorType) => {
                const active = sensorPlacementType === sensorType;
                return (
                  <button
                    key={sensorType}
                    type="button"
                    onClick={() => {
                      setSensorPlacementType(sensorType);
                      setActiveTool("sensor");
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors",
                      active
                        ? "border-cyan-500/30 bg-cyan-500/12 text-cyan-200"
                        : "border-[#1f2536] bg-[#0f1320] text-[#95a0b7] hover:border-[#273246] hover:text-[#d2d9e8]",
                    )}
                  >
                    <div className="font-semibold">{SENSOR_TYPE_LABELS[sensorType]}</div>
                    <div className="text-[8px] uppercase tracking-[0.16em] text-[#64708a]">{typeCounts[sensorType]} on scene</div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("sensor")}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition-colors",
                activeTool === "sensor"
                  ? "border-cyan-500/30 bg-cyan-500/12 text-cyan-200"
                  : "border-[#24304a] bg-[#111521] text-[#c7d0e4] hover:border-[#3b4a69] hover:bg-[#172235]",
              )}
            >
              <LocateFixed className="h-3 w-3" />
              Place {SENSOR_TYPE_LABELS[sensorPlacementType]}
            </button>
          </div>
        </SectionCard>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#546078]">Total</div>
            <div className="mt-1 text-[18px] font-semibold text-white">{scene.sensors.length}</div>
          </div>
          <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#546078]">Active</div>
            <div className="mt-1 text-[18px] font-semibold text-emerald-300">{activeCount}</div>
          </div>
          <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#546078]">Inactive / Faulted</div>
            <div className="mt-1 text-[18px] font-semibold text-red-300">{faultedCount + inactiveCount}</div>
          </div>
        </div>

        <SectionCard title="Sensor Types">
          <div className="space-y-1.5">
            {(Object.keys(SENSOR_TYPE_LABELS) as SensorNode["sensorType"][]).map((sensorType) => (
              <div key={sensorType} className="flex items-center justify-between gap-2 rounded-lg border border-[#1f2536] bg-[#0f1320] px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium text-[#d8def0]">{SENSOR_TYPE_LABELS[sensorType]}</div>
                  <div className="text-[8px] uppercase tracking-[0.14em] text-[#5d6781]">Scene inventory</div>
                </div>
                <Badge variant="blue">{typeCounts[sensorType]}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sensor Inventory">
          <div className="space-y-2">
            {scene.sensors.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#24304a] bg-[#0f1320] px-3 py-3 text-[10px] leading-relaxed text-[#7a869f]">
                No sensors placed yet. Use the placement controls above to add motion, access, or environmental sensors to the scene.
              </div>
            ) : (
              scene.sensors.map((sensor) => {
                const state = SENSOR_STATE_STYLES[sensor.state];
                const nearestCamera = nearestCameraName(sensor, scene.cameras);
                const nearestDistance = scene.cameras.length > 0
                  ? Math.min(...scene.cameras.map((camera) => {
                    const dx = camera.position[0] - sensor.position[0];
                    const dy = camera.position[1] - sensor.position[1];
                    const dz = camera.position[2] - sensor.position[2];
                    return Math.hypot(dx, dy, dz);
                  }))
                  : null;
                const isSelected = selectedNodeId === sensor.id;

                return (
                  <button
                    key={sensor.id}
                    type="button"
                    onClick={() => selectNode(sensor.id)}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      isSelected
                        ? "border-cyan-500/30 bg-cyan-500/10"
                        : "border-[#1f2536] bg-[#0f1320] hover:border-[#273246] hover:bg-[#131929]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-semibold text-[#e5ecfb]">{sensor.label}</div>
                        <div className="text-[8px] uppercase tracking-[0.14em] text-[#64708a]">
                          {SENSOR_TYPE_LABELS[sensor.sensorType]} · {SENSOR_COVERAGE_LABELS[sensor.coverageMode]}
                        </div>
                      </div>
                      <Badge variant={state.tone}>{state.label}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] text-[#90a0bf]">
                      <div className="rounded-md bg-[#0b0f17] px-1.5 py-1">
                        <div className="text-[8px] uppercase tracking-[0.14em] text-[#546078]">X/Z</div>
                        <div className="mt-0.5 font-mono">{sensor.position[0].toFixed(1)} / {sensor.position[2].toFixed(1)}</div>
                      </div>
                      <div className="rounded-md bg-[#0b0f17] px-1.5 py-1">
                        <div className="text-[8px] uppercase tracking-[0.14em] text-[#546078]">Nearest Cam</div>
                        <div className="mt-0.5 truncate font-mono">{nearestCamera ?? "None"}</div>
                      </div>
                      <div className="rounded-md bg-[#0b0f17] px-1.5 py-1">
                        <div className="text-[8px] uppercase tracking-[0.14em] text-[#546078]">Distance</div>
                        <div className="mt-0.5 font-mono">{formatDistance(nearestDistance)}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        {result ? (
          <div className="rounded-lg border border-[#1f2536] bg-[#0f1320] px-3 py-2 text-[10px] leading-relaxed text-[#8d98b0]">
            Sensors are included in the canonical report summary today, while live sensor-camera fusion remains the next platform step.
          </div>
        ) : null}
      </div>
    </div>
  );
}
