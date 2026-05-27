"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, CircleSmall, VideoOff } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { getYawPitchDirection } from "@/simulation/geometry";
import "@/lib/three-compat";
import {
  ENVIRONMENT_THEMES,
  SceneFloor,
  SceneLighting,
  SceneObstructions,
  SceneDoors,
  SceneWalls,
  SceneWindows,
} from "@/components/workspace/SharedScene";
import type { CameraNode, DoriQuality, SimulationAssumptions } from "@/schema/security-scene";

type CameraFeedMode = "normal" | "ir_bw" | "low_light" | "thermal";

type OverlayFlags = {
  overlays: boolean;
  dori: boolean;
  path: boolean;
  zones: boolean;
  timestamp: boolean;
  grid: boolean;
};

const QUALITY_RANK: Record<DoriQuality, number> = {
  none: 0,
  detection: 1,
  overview: 1,
  outline: 1,
  observation: 2,
  discern: 2,
  perceive: 2,
  recognition: 3,
  characterize: 3,
  validate: 4,
  identification: 4,
  scrutinize: 4,
};

function SceneView({ theme }: { theme: (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES] }) {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const { width, depth } = scene.dimensions;

  return (
    <>
      <SceneLighting theme={theme} />
      <SceneFloor width={width} depth={depth} showGrid={false} />
      <SceneWalls walls={scene.walls} />
      <SceneDoors doors={scene.doors} />
      <SceneWindows windows={scene.windows} />
      <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} />
    </>
  );
}

function CameraRig({ camera: camData }: { camera: CameraNode }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const forward = getYawPitchDirection(camData.yawDeg, camData.pitchDeg);
    const pos = new THREE.Vector3(...camData.position);
    const target = pos.clone().add(forward.clone().multiplyScalar(8));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData.id, camData.pitchDeg, camData.position, camData.yawDeg]);

  return null;
}

function nowTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function formatCameraTag(name: string) {
  const match = name.match(/(\d+)/);
  return `CAM ${match ? match[0] : "01"}`;
}

function rangeMeters(camera: CameraNode, ppm: SimulationAssumptions["pixelsPerMeter"]) {
  const width = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  return {
    detection: Math.min(width / (2 * ppm.detection * tanHalfFov), camera.rangeM),
    observation: Math.min(width / (2 * ppm.observation * tanHalfFov), camera.rangeM),
    recognition: Math.min(width / (2 * ppm.recognition * tanHalfFov), camera.rangeM),
    identification: Math.min(width / (2 * ppm.identification * tanHalfFov), camera.rangeM),
  };
}

function modeFilter(mode: CameraFeedMode) {
  if (mode === "ir_bw") {
    return (
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(170deg, rgba(232,244,255,0.12), rgba(0,0,0,0.24))",
          mixBlendMode: "soft-light",
        }}
      />
    );
  }

  if (mode === "low_light") {
    return <div className="pointer-events-none absolute inset-0 bg-[#0a1330]/40" />;
  }

  if (mode === "thermal") {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(173,239,255,0.08), rgba(17,24,39,0.4))",
          filter: "sepia(0.15)",
          mixBlendMode: "color-dodge",
        }}
      />
    );
  }

  return null;
}

function CameraNoise() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
      }}
    />
  );
}

function LiveFeedHUD({ camera: cam, mode, flags, ppm }: { camera: CameraNode; mode: CameraFeedMode; flags: OverlayFlags; ppm: SimulationAssumptions["pixelsPerMeter"] }) {
  const isActive = cam.status === "on";
  const ranges = rangeMeters(cam, ppm);

  return (
    <>
      {/* Top gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />

      {/* Top-left: status + camera name */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400"}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {formatCameraTag(cam.name)}
        </span>
        <span className="text-[11px] font-bold text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {cam.name}
        </span>
        <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">{isActive ? "Active" : "Offline"}</span>
      </div>

      {/* Top-right: badge + timestamp */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-0.5">
        <span className="rounded bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-[#93c5fd]">{cam.resolutionMP}MP · {cam.fovHorizontalDeg}°</span>
        <span className="font-mono text-[8px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{cam.mountType.toUpperCase()}</span>
        {flags.timestamp ? <span className="font-mono text-[8px] text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{nowTimestamp()}</span> : null}
      </div>

      {/* Right quality card */}
      {flags.dori ? (
        <div className="absolute right-3 top-24 flex w-48 flex-col gap-1 rounded-lg border border-[#2d3d56] bg-black/55 px-2 py-2 text-[9px] text-[#cdd6ef]">
          <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#87a5cf]">DORI RANGES AT TARGET</div>
          <div className="space-y-0.5">
            <div className="flex justify-between"><span>Detection</span><span className="font-mono text-[#f97316]">{ranges.detection.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Observation</span><span className="font-mono text-[#eab308]">{ranges.observation.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Recognition</span><span className="font-mono text-[#22c55e]">{ranges.recognition.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Identification</span><span className="font-mono text-[#60a5fa]">{ranges.identification.toFixed(1)}m</span></div>
          </div>
          <div className="mt-1 border-t border-[#334563] pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">Target: Face / Person</div>
          <div className="text-[8px] text-[#95a9cf]">Mode: {mode === "normal" ? "Normal" : mode === "ir_bw" ? "IR (B/W)" : mode === "low_light" ? "Low Light" : "Thermal"}</div>
        </div>
      ) : null}

      <div className="absolute left-3 bottom-3 flex flex-wrap gap-2 text-[8px] text-[#95a9cf]">
        <span className="rounded border border-[#2d3d56] bg-black/45 px-2 py-1">Mode: {mode === "normal" ? "Normal" : mode === "ir_bw" ? "IR (B/W)" : mode === "low_light" ? "Low Light" : "Thermal"}</span>
        <span className="rounded border border-[#2d3d56] bg-black/45 px-2 py-1">LIVE MODE (SIMULATED)</span>
      </div>

      {flags.path || flags.zones || flags.overlays || flags.grid ? (
        <div className="absolute left-3 top-20 flex flex-col gap-1 rounded-lg border border-[#2d3d56] bg-black/40 px-2 py-1.5 text-[8px] text-[#8ea6cc]">
          {flags.overlays ? <span>• Overlays: enabled</span> : null}
          {flags.path ? <span>• Path overlays</span> : null}
          {flags.zones ? <span>• Zone overlays</span> : null}
          {flags.grid ? <span>• Floor grid</span> : null}
        </div>
      ) : null}

      <CameraNoise />
    </>
  );
}

export function ReplayStatusOverlay({
  pathLabel,
  timeS,
  speed,
}: {
  pathLabel: string;
  timeS: number;
  speed: number;
}) {
  return (
    <div className="absolute left-3 bottom-24 z-30 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">LIVE MODE (Simulated)</div>
      <div className="mt-1 space-y-0.5 text-[10px] text-[#d2d9e8]">
        <div>
          <span className="text-[#6a748b]">Time:</span> {timeS.toFixed(1)}s
        </div>
        <div className="max-w-[220px] truncate">
          <span className="text-[#6a748b]">Path:</span> {pathLabel}
        </div>
        <div>
          <span className="text-[#6a748b]">Speed:</span> {speed.toFixed(1)}x
        </div>
      </div>
    </div>
  );
}

export function DoriInsightCard({
  camera,
  zoneLabel,
  currentQuality,
  requiredQuality,
  bestCameraName,
  distanceM,
  angleDeg,
  lightingLabel,
}: {
  camera: CameraNode;
  zoneLabel: string;
  currentQuality: string;
  requiredQuality: string;
  bestCameraName: string;
  distanceM: number;
  angleDeg: number;
  lightingLabel: string;
}) {
  return (
    <div className="absolute right-3 top-24 z-30 w-56 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">DORI OVERLAY</div>
      <div className="mt-1 text-[10px] font-semibold text-white">{zoneLabel}</div>
      <div className="mt-2 space-y-1.5 text-[10px] text-[#d2d9e8]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Current Quality</span>
          <span className="rounded bg-[#152034] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#93c5fd]">
            {currentQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Required</span>
          <span className="rounded bg-[#152034] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#c7d0e4]">
            {requiredQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Best Camera</span>
          <span className="truncate text-right font-medium text-[#c7d0e4]">{bestCameraName}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Distance</span>
          <span className="font-mono text-[#c7d0e4]">{distanceM.toFixed(1)}m</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Angle</span>
          <span className="font-mono text-[#c7d0e4]">{angleDeg.toFixed(0)}°</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Lighting</span>
          <span className="text-[#c7d0e4]">{lightingLabel}</span>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-[#1f2b42] bg-[#111521] px-2 py-1.5 text-[9px] text-[#8b96ab]">
        {camera.name} is being used to inspect the current coverage scenario.
      </div>
    </div>
  );
}

function BottomControlStrip({
  mode,
  onModeChange,
  flags,
  onFlagsChange,
  onBackToMap,
}: {
  mode: CameraFeedMode;
  onModeChange: (value: CameraFeedMode) => void;
  flags: OverlayFlags;
  onFlagsChange: (next: OverlayFlags) => void;
  onBackToMap: () => void;
}) {
  const viewModes: Array<{ value: CameraFeedMode; label: string }> = [
    { value: "normal", label: "Normal" },
    { value: "ir_bw", label: "IR (B/W)" },
    { value: "low_light", label: "Low Light" },
    { value: "thermal", label: "Thermal" },
  ];

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 flex items-stretch gap-1.5">
      <div className="flex rounded-md border border-[#27364e] bg-black/55 p-1">
        {viewModes.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => onModeChange(entry.value)}
            className={`rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              mode === entry.value
                ? "bg-emerald-500/25 text-emerald-200"
                : "text-[#8ea5cc] hover:text-white"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-md border border-[#27364e] bg-black/55 text-[8px]">
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, overlays: !flags.overlays })}
          className={`rounded-l-md px-2 py-1 font-medium ${flags.overlays ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          OVERLAYS {flags.overlays ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, dori: !flags.dori })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.dori ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          DORI {flags.dori ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, path: !flags.path })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.path ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          PATH {flags.path ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, zones: !flags.zones })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.zones ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          ZONES {flags.zones ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, timestamp: !flags.timestamp })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.timestamp ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          TIMESTAMP {flags.timestamp ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, grid: !flags.grid })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.grid ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          GRID {flags.grid ? "✓" : ""}
        </button>
        <button type="button" className="border-l border-[#27364e] px-2 py-1 font-medium text-[#8ea5cc]">
          MORE
        </button>
        <button
          type="button"
          onClick={onBackToMap}
          className="border-l border-[#27364e] rounded-r-md px-2 py-1 font-medium text-[#8ea5cc] transition-colors hover:text-white"
        >
          Back to Map View
        </button>
      </div>
    </div>
  );
}

function OfflineFeed({ camera: cam }: { camera: CameraNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#070a10]">
      <div className="rounded-full border border-red-500/20 bg-red-500/10 p-4">
        <VideoOff className="h-8 w-8 text-red-400/60" />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-red-300/60">Camera Offline</div>
        <div className="mt-1 text-[10px] text-[#4a5568]">{cam.name}</div>
      </div>
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          <span className="text-[9px] font-bold tracking-wide text-white/60">{formatCameraTag(cam.name)} · {cam.name}</span>
          <CircleSmall className="ml-auto h-3 w-3 text-red-300" />
        </div>
      </div>
    </div>
  );
}

function CameraHeader({
  camera,
  index,
  total,
  cameras,
  onPrevious,
  onNext,
  onSelect,
}: {
  camera: CameraNode;
  index: number;
  total: number;
  cameras: CameraNode[];
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-[#263246] bg-[#0b0f17]/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <Camera className="h-3.5 w-3.5" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">Camera View</div>
          <div className="text-[11px] font-medium text-white">{camera.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-[#27364e] bg-black/40 p-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={index <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8ea5cc] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Previous camera"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <select
          value={camera.id}
          onChange={(event) => onSelect(event.target.value)}
          className="min-w-44 rounded-md border border-[#27364e] bg-[#111521] px-2 py-1 text-[10px] text-[#c7d0e4]"
          aria-label="Select camera"
        >
          {cameras.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8ea5cc] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Next camera"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CameraViewMode() {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const result = useStudioStore((s) => s.simulationResult);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const envMode = useStudioStore((s) => s.environmentMode);

  const camera = scene.cameras.find((c) => c.id === selectedId) ?? scene.cameras[0];
  const cameraIndex = useMemo(() => scene.cameras.findIndex((c) => c.id === camera?.id), [camera?.id, scene.cameras]);
  const activePath = useMemo(() => {
    if (!scene.paths.length) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? scene.paths[0] ?? null;
  }, [activePathId, scene.paths]);
  const activePathResult = useMemo(() => {
    if (!result || !activePath) return null;
    return result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result]);
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;
  const [feedMode, setFeedMode] = useState<CameraFeedMode>("normal");
  const [flags, setFlags] = useState<OverlayFlags>({ overlays: true, dori: true, path: false, zones: true, timestamp: true, grid: false });
  const pathTimeS = activePathResult && activePathResult.totalDurationS > 0
    ? pathReplay.progress * activePathResult.totalDurationS
    : 0;
  const firstCriticalZone = scene.criticalZones[0] ?? null;
  const camResult = result?.cameraResults.find((entry) => entry.cameraId === camera?.id) ?? null;
  const zoneResult = firstCriticalZone ? result?.criticalZoneResults.find((entry) => entry.zoneId === firstCriticalZone.id) ?? null : null;

  const zoneAnalysis = useMemo(() => {
    if (!camera || !firstCriticalZone || !camResult) return null;

    const centroid = firstCriticalZone.polygon.reduce(
      (acc, [x, z]) => {
        acc.x += x;
        acc.z += z;
        return acc;
      },
      { x: 0, z: 0 },
    );
    const count = Math.max(firstCriticalZone.polygon.length, 1);
    const centroidX = centroid.x / count;
    const centroidZ = centroid.z / count;
    const dx = centroidX - camera.position[0];
    const dz = centroidZ - camera.position[2];
    const distanceM = Math.hypot(dx, dz);
    const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
    const angleDeg = Math.abs((((bearing - camera.yawDeg) % 360) + 540) % 360 - 180);
    const currentQuality = camResult.qualityByZone[firstCriticalZone.id] ?? "none";
    const bestCameraName = result?.cameraResults
      .map((entry) => ({
        cameraId: entry.cameraId,
        quality: entry.qualityByZone[firstCriticalZone.id] ?? "none",
      }))
      .sort((a, b) => QUALITY_RANK[b.quality as DoriQuality] - QUALITY_RANK[a.quality as DoriQuality])[0];

    return {
      distanceM,
      angleDeg,
      currentQuality,
      bestCameraName: bestCameraName ? (scene.cameras.find((entry) => entry.id === bestCameraName.cameraId)?.name ?? bestCameraName.cameraId) : camera.name,
    };
  }, [camera, camResult, firstCriticalZone, result, scene.cameras]);

  if (!camera) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07090d]">
        <div className="text-center text-[#4a5568]">
          <p className="text-[11px]">No camera selected</p>
          <button
            onClick={() => {
              setWorkspacePreset("edit");
              setViewMode("map");
            }}
            className="mt-3 text-[10px] text-blue-400 hover:underline"
          >
            Back to Map View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07090d]">
      {camera.status === "on" ? (
        <>
          <CameraHeader
            camera={camera}
            index={cameraIndex < 0 ? 0 : cameraIndex}
            total={scene.cameras.length}
            cameras={scene.cameras}
            onPrevious={() => {
              const nextIndex = Math.max(0, (cameraIndex < 0 ? 0 : cameraIndex) - 1);
              const nextCamera = scene.cameras[nextIndex];
              if (nextCamera) {
                selectNode(nextCamera.id);
              }
            }}
            onNext={() => {
              const nextIndex = Math.min(scene.cameras.length - 1, (cameraIndex < 0 ? 0 : cameraIndex) + 1);
              const nextCamera = scene.cameras[nextIndex];
              if (nextCamera) {
                selectNode(nextCamera.id);
              }
            }}
            onSelect={(id) => selectNode(id)}
          />
          <Canvas
            camera={{
              position: camera.position,
              fov: Math.min(camera.fovHorizontalDeg, 100),
              near: 0.1,
              far: 60,
            }}
            shadows="percentage"
            gl={{ antialias: true, alpha: false }}
            style={{ width: "100%", height: "100%" }}
          >
            <color attach="background" args={[theme.background]} />
            <Suspense fallback={null}>
              <SceneView theme={theme} />
            </Suspense>
            <CameraRig camera={camera} />
            <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
          </Canvas>
          {modeFilter(feedMode)}
          <LiveFeedHUD camera={camera} mode={feedMode} flags={flags} ppm={scene.assumptions.pixelsPerMeter} />
          {activePath && activePathResult ? (
            <ReplayStatusOverlay
              pathLabel={activePath.label}
              timeS={pathTimeS}
              speed={pathReplay.speed}
            />
          ) : null}
          {zoneAnalysis && firstCriticalZone ? (
            <DoriInsightCard
              camera={camera}
              zoneLabel={firstCriticalZone.label}
              currentQuality={zoneAnalysis.currentQuality}
              requiredQuality={zoneResult?.requiredQuality ?? firstCriticalZone.requiredQuality}
              bestCameraName={zoneAnalysis.bestCameraName}
              distanceM={zoneAnalysis.distanceM}
              angleDeg={zoneAnalysis.angleDeg}
              lightingLabel={envMode === "night" ? "Night" : envMode === "dusk" ? "Dusk" : "Day"}
            />
          ) : null}
          <BottomControlStrip mode={feedMode} onModeChange={setFeedMode} flags={flags} onFlagsChange={setFlags} onBackToMap={() => { setWorkspacePreset("edit"); setViewMode("map"); }} />
        </>
      ) : (
        <div className="relative h-full w-full">
          <OfflineFeed camera={camera} />
        </div>
      )}

      <button
        onClick={() => {
          setWorkspacePreset("edit");
          setViewMode("map");
        }}
        className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-[#2a3246] bg-[#0e1320]/90 px-3 py-1.5 text-[10px] font-medium text-[#c7d0e4] backdrop-blur-sm transition-colors hover:border-[#3a4a66] hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Map View
      </button>
    </div>
  );
}
