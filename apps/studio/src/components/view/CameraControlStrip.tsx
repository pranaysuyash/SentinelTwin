"use client";

import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Moon,
  Sun,
  Target,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback } from "react";

import { cn } from "@/lib/cn";
import { normalizeAngle } from "@sentineltwin/core";
import type { CameraNode, SecurityScene } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
const PAN_STEP_DEG = 10;
const TILT_STEP_DEG = 5;
const ZOOM_STEP_DEG = 10;

function CameraYawControl({
  yawDeg,
  onYawChange,
}: {
  yawDeg: number;
  onYawChange: (deg: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onYawChange(normalizeAngle(yawDeg - PAN_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Pan left"
      >
        <ArrowLeftFromLine className="h-3 w-3" />
      </button>
      <div className="flex flex-col items-center px-1.5">
        <span className="text-[8px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted7}">Yaw</span>
        <span className={`font-mono text-[10px] ${UI_SURFACES.textBody2}`}>{Math.round(yawDeg)}°</span>
      </div>
      <button
        type="button"
        onClick={() => onYawChange(normalizeAngle(yawDeg + PAN_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Pan right"
      >
        <ArrowRightFromLine className="h-3 w-3" />
      </button>
    </div>
  );
}

function CameraTiltControl({
  pitchDeg,
  onPitchChange,
}: {
  pitchDeg: number;
  onPitchChange: (deg: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPitchChange(Math.min(0, pitchDeg + TILT_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Tilt up"
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      <div className="flex flex-col items-center px-1.5">
        <span className="text-[8px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted7}">Tilt</span>
        <span className={`font-mono text-[10px] ${UI_SURFACES.textBody2}`}>{Math.round(pitchDeg)}°</span>
      </div>
      <button
        type="button"
        onClick={() => onPitchChange(Math.max(-90, pitchDeg - TILT_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Tilt down"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function CameraZoomControl({
  fovDeg,
  onFovChange,
}: {
  fovDeg: number;
  onFovChange: (deg: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onFovChange(Math.max(20, fovDeg - ZOOM_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Zoom in"
      >
        <ZoomIn className="h-3 w-3" />
      </button>
      <div className="flex flex-col items-center px-1.5">
        <span className="text-[8px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted7}">FOV</span>
        <span className={`font-mono text-[10px] ${UI_SURFACES.textBody2}`}>{Math.round(fovDeg)}°</span>
      </div>
      <button
        type="button"
        onClick={() => onFovChange(Math.min(180, fovDeg + ZOOM_STEP_DEG))}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
        title="Zoom out"
      >
        <ZoomOut className="h-3 w-3" />
      </button>
    </div>
  );
}

export function CameraControlStrip({
  camera,
  zones,
}: {
  camera: CameraNode;
  zones: SecurityScene["criticalZones"];
}) {
  const updateNode = useStudioStore((s) => s.updateNode);
  const markDirty = useStudioStore((s) => s.markDirty);

  const updateYaw = useCallback(
    (deg: number) => {
      updateNode(camera.id, { yawDeg: deg });
      markDirty();
    },
    [camera.id, updateNode, markDirty],
  );

  const updatePitch = useCallback(
    (deg: number) => {
      updateNode(camera.id, { pitchDeg: deg });
      markDirty();
    },
    [camera.id, updateNode, markDirty],
  );

  const updateFov = useCallback(
    (deg: number) => {
      updateNode(camera.id, { fovHorizontalDeg: deg });
      markDirty();
    },
    [camera.id, updateNode, markDirty],
  );

  const resetAim = useCallback(() => {
    updateNode(camera.id, { yawDeg: 0, pitchDeg: -45 });
    markDirty();
  }, [camera.id, updateNode, markDirty]);

  const togglePower = useCallback(() => {
    updateNode(camera.id, { status: camera.status === "on" ? "off" : "on" });
    markDirty();
  }, [camera.id, camera.status, updateNode, markDirty]);

  const cycleNightMode = useCallback(() => {
    const modes: Array<CameraNode["nightMode"]> = ["none", "ir", "low_light", "thermal"];
    const idx = modes.indexOf(camera.nightMode);
    const next = modes[(idx + 1) % modes.length]!;
    updateNode(camera.id, { nightMode: next });
    markDirty();
  }, [camera.id, camera.nightMode, updateNode, markDirty]);

  const aimAtZone = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;
      const centroid = zone.polygon.reduce(
        (acc, [x, z]) => {
          acc.x += x;
          acc.z += z;
          return acc;
        },
        { x: 0, z: 0 },
      );
      const n = zone.polygon.length || 1;
      const dx = centroid.x / n - camera.position[0];
      const dz = centroid.z / n - camera.position[2];
      const yaw = Math.atan2(dx, dz) * (180 / Math.PI);
      updateNode(camera.id, { yawDeg: Math.round(yaw), pitchDeg: -30 });
      markDirty();
    },
    [camera.id, camera.position, zones, updateNode, markDirty],
  );

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 bottom-14 z-30 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-1.5 rounded-xl border ${UI_SURFACES.borderStrong} ${UI_SURFACES.panel}/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur`}>
      <CameraYawControl yawDeg={camera.yawDeg} onYawChange={updateYaw} />
      <div className="h-7 w-px ${UI_SURFACES.borderStrong}" />
      <CameraTiltControl pitchDeg={camera.pitchDeg} onPitchChange={updatePitch} />
      <div className="h-7 w-px ${UI_SURFACES.borderStrong}" />
      <CameraZoomControl fovDeg={camera.fovHorizontalDeg} onFovChange={updateFov} />
      <div className="h-7 w-px ${UI_SURFACES.borderStrong}" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={resetAim}
          className={`flex h-7 items-center gap-1 rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} px-2 text-[8px] font-semibold uppercase tracking-[0.08em] ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText} active:scale-[0.97]`}
          title="Reset aim"
        >
          <Target className="h-3 w-3" />
          Reset
        </button>
      </div>
      {zones.length > 0 && (
        <div className="flex items-center gap-1">
          <select
            onChange={(e) => {
              const id = e.target.value;
              if (id) aimAtZone(id);
              e.target.value = "";
            }}
            defaultValue=""
            className={`h-7 rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} px-2 text-[8px] font-semibold uppercase tracking-[0.08em] ${UI_SURFACES.textMuted3} outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50`}
          >
            <option value="" disabled>
              Aim at zone...
            </option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="h-7 w-px ${UI_SURFACES.borderStrong}" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={togglePower}
          className={cn(
            "flex h-7 items-center gap-1 rounded-md border px-2 text-[8px] font-semibold uppercase tracking-[0.08em] transition-colors active:scale-[0.97]",
            camera.status === "on"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300",
          )}
          title={camera.status === "on" ? "Turn camera off" : "Turn camera on"}
        >
          {camera.status === "on" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {camera.status === "on" ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={cycleNightMode}
          className={`flex h-7 items-center gap-1 rounded-md border ${UI_SURFACES.borderStrong} ${UI_SURFACES.card} px-2 text-[8px] font-semibold uppercase tracking-[0.08em] ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText} active:scale-[0.97]`}
          title={`Night mode: ${camera.nightMode}`}
        >
          {camera.nightMode === "none" ? (
            <Sun className="h-3 w-3" />
          ) : (
            <Moon className="h-3 w-3" />
          )}
          {camera.nightMode === "none" ? "Day" : camera.nightMode === "ir" ? "IR" : camera.nightMode === "low_light" ? "Star" : "Thermal"}
        </button>
      </div>
    </div>
  );
}