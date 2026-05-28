"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, CircleSmall, VideoOff } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import "@/lib/three-compat";
import { ENVIRONMENT_THEMES } from "@/components/workspace/SharedScene";
import { pointOnPathAtProgress } from "@/components/map/path-quality";
import { QUALITY_RANK } from "@/lib/quality-display";
import { CameraRigLive, nowTimestamp, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import type { CameraNode, DoriQuality, SimulationAssumptions, SecurityScene } from "@/schema/security-scene";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";

type CameraFeedMode = "normal" | "ir_bw" | "low_light" | "thermal";

type OverlayFlags = {
  overlays: boolean;
  dori: boolean;
  path: boolean;
  zones: boolean;
  timestamp: boolean;
  grid: boolean;
};

type VerificationViewMode = "overlay" | "split";
type VerificationSourceType = "image" | "video";
type CameraVerificationSnapshot = {
  id: string;
  fileName: string;
  imageUrl: string;
  mode: VerificationViewMode;
  sourceType?: VerificationSourceType;
  sampleTimeS?: number | null;
  videoDurationS?: number | null;
  candidateCount?: number;
  bestCandidateId?: string | null;
  selectedCandidateId?: string | null;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
  alignmentScore: number | null;
  createdAt: number;
};

type VideoFrameCandidate = {
  id: string;
  timeS: number;
  dataUrl: string;
  qualityScore: number;
};

export function formatTargetTypeLabel(targetType: SecurityScene["criticalZones"][number]["targetType"]) {
  switch (targetType) {
    case "person_detection":
      return "Person";
    case "face_recognition":
    case "face_identification":
      return "Face";
    case "vehicle_detection":
      return "Vehicle";
    case "license_plate":
      return "License Plate";
    case "package_detection":
      return "Package";
    case "cash_counter_activity":
      return "Cash Counter";
    case "door_entry_exit":
      return "Entry / Exit";
    case "perimeter_breach":
      return "Perimeter";
    default:
      return `${targetType}`.replace(/_/g, " ");
  }
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

function pathYawAtProgress(path: SecurityScene["paths"][number], progress: number) {
  if (path.points.length < 2) return 0;

  const clamped = Math.max(0, Math.min(1, progress));
  const total = path.points.reduce((acc, point, index) => {
    if (index === 0) return acc;
    const prev = path.points[index - 1]!.position;
    const current = point.position;
    return acc + Math.hypot(current[0] - prev[0], current[1] - prev[1]);
  }, 0);

  if (total <= 0) return 0;

  let target = total * clamped;
  for (let index = 1; index < path.points.length; index += 1) {
    const start = path.points[index - 1]!.position;
    const end = path.points[index]!.position;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (segmentLength <= 0) continue;

    if (target <= segmentLength || index === path.points.length - 1) {
      return Math.atan2(end[0] - start[0], end[1] - start[1]);
    }

    target -= segmentLength;
  }

  const last = path.points[path.points.length - 1]!;
  const prev = path.points[path.points.length - 2]!;
  return Math.atan2(last.position[0] - prev.position[0], last.position[1] - prev.position[1]);
}

function ReplayActor({
  path,
  progress,
}: {
  path: SecurityScene["paths"][number];
  progress: number;
}) {
  const [x, z] = pointOnPathAtProgress(path, progress);
  const yaw = pathYawAtProgress(path, progress);

  return (
    <group position={[x, 0.02, z]} rotation={[0, yaw, 0]}>
      <Html position={[0, 1.52, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="rounded-full border border-red-400/50 bg-black/75 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.18)]">
          Tracked Actor
        </div>
      </Html>
      <mesh position={[0, 0.88, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.62, 6, 10]} />
        <meshStandardMaterial color="#e5ebf3" roughness={0.58} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f8fbff" roughness={0.35} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.58, 1.9, 0.54]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.24} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.58, 1.9, 0.54]} />
        <meshBasicMaterial color="#f97316" wireframe transparent opacity={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.17, 0.35, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
      </mesh>
    </group>
  );
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

function LiveFeedHUD({ camera: cam, mode, flags, ppm, targetType }: { camera: CameraNode; mode: CameraFeedMode; flags: OverlayFlags; ppm: SimulationAssumptions["pixelsPerMeter"]; targetType?: SecurityScene["criticalZones"][number]["targetType"] }) {
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
          {targetType ? <div className="mt-1 border-t border-[#334563] pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">Target: {formatTargetTypeLabel(targetType)}</div> : null}
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
  qualityLabel,
  segmentLabel,
}: {
  pathLabel: string;
  timeS: number;
  speed: number;
  qualityLabel?: string;
  segmentLabel?: string;
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
        {qualityLabel ? (
          <div>
            <span className="text-[#6a748b]">Quality:</span> {qualityLabel}
          </div>
        ) : null}
        {segmentLabel ? (
          <div className="max-w-[220px] truncate">
            <span className="text-[#6a748b]">Segment:</span> {segmentLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CameraPathVisibilityOverlay({
  cameraName,
  visibleSeconds,
  totalSeconds,
  maxQuality,
}: {
  cameraName: string;
  visibleSeconds: number;
  totalSeconds: number;
  maxQuality: string;
}) {
  const ratio = totalSeconds > 0 ? visibleSeconds / totalSeconds : 0;
  const pct = Math.round(ratio * 100);
  const status = ratio > 0.7 ? "Strong Coverage" : ratio > 0.35 ? "Partial Coverage" : "Weak Coverage";
  const statusColor = ratio > 0.7 ? "text-emerald-300" : ratio > 0.35 ? "text-amber-300" : "text-red-300";

  return (
    <div className="absolute left-3 bottom-3 z-30 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2 backdrop-blur-sm">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#7dd3fc]">Path Visibility</div>
      <div className="mt-1 text-[10px] text-[#d2d9e8]">{cameraName}</div>
      <div className={`mt-1 text-[10px] font-semibold ${statusColor}`}>{status}</div>
      <div className="mt-1 text-[9px] text-[#9ab0ce]">{pct}% visible • best quality: {maxQuality.toUpperCase()}</div>
    </div>
  );
}

export function DoriInsightCard({
  camera,
  zoneLabel,
  targetType,
  currentQuality,
  requiredQuality,
  zoneStatus,
  bestCameraName,
  distanceM,
  angleDeg,
  lightingLabel,
  reasonLine,
}: {
  camera: CameraNode;
  zoneLabel: string;
  targetType: SecurityScene["criticalZones"][number]["targetType"];
  currentQuality: string;
  requiredQuality: string;
  zoneStatus: "pass" | "partial" | "fail" | "unknown";
  bestCameraName: string;
  distanceM: number;
  angleDeg: number;
  lightingLabel: string;
  reasonLine: string;
}) {
  const statusLabel =
    zoneStatus === "pass" ? "PASSES"
      : zoneStatus === "partial" ? "PARTIAL"
        : zoneStatus === "fail" ? "FAILS"
          : "UNKNOWN";

  return (
    <div className="absolute right-3 top-24 z-30 w-56 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">DORI OVERLAY</div>
      <div className="mt-1 text-[10px] font-semibold text-white">{zoneLabel}</div>
      <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-[#8ea5cc]">
        {requiredQuality.toUpperCase()} REQUIRED · {statusLabel}
      </div>
      <div className="mt-1 border-t border-[#334563] pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">
        Target: {formatTargetTypeLabel(targetType)}
      </div>
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
        Why this quality: {reasonLine}
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const viewModes: Array<{ value: CameraFeedMode; label: string }> = [
    { value: "normal", label: "Normal" },
    { value: "ir_bw", label: "IR (B/W)" },
    { value: "low_light", label: "Low Light" },
    { value: "thermal", label: "Thermal" },
  ];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current) return;
      if (event.target instanceof Node && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 flex items-end gap-1.5">
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
        <div ref={moreRef} className="relative border-l border-[#27364e]">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`px-2 py-1 font-medium transition-colors ${moreOpen ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
          >
            MORE
          </button>
          {moreOpen ? (
            <div className="absolute bottom-full left-0 mb-1.5 w-44 rounded-lg border border-[#27364e] bg-[#0b0f17]/96 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: true,
                    path: true,
                    zones: true,
                    timestamp: true,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
              >
                Show replay essentials
              </button>
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: false,
                    path: false,
                    zones: false,
                    timestamp: false,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
              >
                Minimal camera feed
              </button>
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: true,
                    path: false,
                    zones: true,
                    timestamp: true,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
              >
                Inspection preset
              </button>
            </div>
          ) : null}
        </div>
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

function FootageVerificationOverlay({
  imageUrl,
  mode,
  opacity,
  split,
  offsetX,
  offsetY,
}: {
  imageUrl: string;
  mode: VerificationViewMode;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
}) {
  const commonStyle = {
    transform: `translate(${offsetX}px, ${offsetY}px)`,
  } as const;

  if (mode === "split") {
    return (
      <>
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <img
            src={imageUrl}
            alt="Reference footage frame"
            className="h-full w-full object-cover"
            style={{ ...commonStyle, opacity: Math.min(0.95, Math.max(0.15, opacity + 0.05)) }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
          <div className="h-full w-px bg-cyan-300/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
        </div>
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <img
        src={imageUrl}
        alt="Reference footage frame"
        className="h-full w-full object-cover"
        style={{ ...commonStyle, opacity }}
      />
    </div>
  );
}

function alignmentQualityLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function formatSecondsShort(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSnapshotEvidenceSummary(snapshot: CameraVerificationSnapshot) {
  if (snapshot.sourceType !== "video") return "Image upload";

  const sampled = snapshot.sampleTimeS !== null && snapshot.sampleTimeS !== undefined
    ? formatSecondsShort(snapshot.sampleTimeS)
    : "0:00";
  const duration = snapshot.videoDurationS !== null && snapshot.videoDurationS !== undefined
    ? formatSecondsShort(snapshot.videoDurationS)
    : "--:--";
  const frames = typeof snapshot.candidateCount === "number" && snapshot.candidateCount > 0
    ? `${snapshot.candidateCount} frame${snapshot.candidateCount === 1 ? "" : "s"}`
    : "frame set unavailable";
  const picked = snapshot.selectedCandidateId
    ? snapshot.selectedCandidateId === snapshot.bestCandidateId
      ? "best frame selected"
      : "manual frame selected"
    : "no frame selected";

  return `Video ${sampled}/${duration} · ${frames} · ${picked}`;
}

function evaluateAlignmentSample({
  canvas,
  image,
  offsetX,
  offsetY,
  mode,
  split,
  opacity,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  mode: VerificationViewMode;
  split: number;
  opacity: number;
}) {
  const sampleWidth = 96;
  const sampleHeight = 54;

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = sampleWidth;
  renderCanvas.height = sampleHeight;
  const renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });
  if (!renderCtx) return null;

  const referenceCanvas = document.createElement("canvas");
  referenceCanvas.width = sampleWidth;
  referenceCanvas.height = sampleHeight;
  const refCtx = referenceCanvas.getContext("2d", { willReadFrequently: true });
  if (!refCtx) return null;

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = sampleWidth;
  overlayCanvas.height = sampleHeight;
  const overlayCtx = overlayCanvas.getContext("2d");
  if (!overlayCtx) return null;

  renderCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  renderCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);

  refCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  const dx = Math.round((offsetX / Math.max(1, canvas.clientWidth)) * sampleWidth);
  const dy = Math.round((offsetY / Math.max(1, canvas.clientHeight)) * sampleHeight);
  refCtx.drawImage(image, dx, dy, sampleWidth, sampleHeight);

  if (mode === "split") {
    const splitX = Math.round((split / 100) * sampleWidth);
    refCtx.clearRect(splitX, 0, sampleWidth - splitX, sampleHeight);
    renderCtx.clearRect(splitX, 0, sampleWidth - splitX, sampleHeight);
  }

  const renderPixels = renderCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const refPixels = refCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const heat = overlayCtx.createImageData(sampleWidth, sampleHeight);
  let diffSum = 0;
  let samples = 0;

  for (let i = 0; i < renderPixels.data.length; i += 4) {
    const dr = Math.abs(renderPixels.data[i] - refPixels.data[i]);
    const dg = Math.abs(renderPixels.data[i + 1] - refPixels.data[i + 1]);
    const db = Math.abs(renderPixels.data[i + 2] - refPixels.data[i + 2]);
    const diff = (dr + dg + db) / (3 * 255);
    diffSum += diff;
    samples += 1;

    const level = Math.min(255, Math.round(diff * 320));
    heat.data[i] = level;
    heat.data[i + 1] = 40;
    heat.data[i + 2] = 255 - Math.round(level * 0.55);
    heat.data[i + 3] = Math.round(diff * 190);
  }

  overlayCtx.putImageData(heat, 0, 0);
  const mismatch = samples > 0 ? diffSum / samples : 1;
  const opacityWeight = 0.6 + opacity * 0.4;
  const adjustedMismatch = Math.min(1, mismatch * opacityWeight);
  const score = Math.max(0, Math.min(100, (1 - adjustedMismatch) * 100));

  return {
    score,
    heatmapUrl: overlayCanvas.toDataURL("image/png"),
  };
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for video ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess as EventListener);
      target.removeEventListener("error", onError as EventListener);
    };

    target.addEventListener(eventName, onSuccess as EventListener, { once: true });
    target.addEventListener("error", onError as EventListener, { once: true });
  });
}

async function extractVideoFrameDataUrl(file: File, sampleTimeSeconds?: number) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const durationS = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const sampleTimeS = durationS > 0
      ? Math.min(durationS, Math.max(0, sampleTimeSeconds ?? durationS * 0.5))
      : 0;

    if (durationS > 0) {
      video.currentTime = sampleTimeS;
      await waitForMediaEvent(video, "seeked");
    } else {
      await waitForMediaEvent(video, "loadeddata");
    }

    const width = Math.max(1, video.videoWidth || 1280);
    const height = Math.max(1, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create frame extraction canvas");
    }
    ctx.drawImage(video, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      durationS,
      sampleTimeS,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function estimateFrameQuality(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sample = ctx.getImageData(0, 0, width, height).data;
  let luminanceSum = 0;
  let luminanceSqSum = 0;
  let count = 0;

  for (let i = 0; i < sample.length; i += 4) {
    const y = sample[i]! * 0.299 + sample[i + 1]! * 0.587 + sample[i + 2]! * 0.114;
    luminanceSum += y;
    luminanceSqSum += y * y;
    count += 1;
  }

  if (count === 0) return 0;
  const mean = luminanceSum / count;
  const variance = Math.max(0, luminanceSqSum / count - mean * mean);
  return Math.sqrt(variance);
}

async function extractVideoFrameCandidates(file: File, candidateCount = 5) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const durationS = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const width = Math.max(1, video.videoWidth || 1280);
    const height = Math.max(1, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Unable to create candidate extraction canvas");
    }

    const targetCount = Math.max(1, Math.floor(candidateCount));
    const candidates: VideoFrameCandidate[] = [];

    if (durationS <= 0) {
      await waitForMediaEvent(video, "loadeddata");
      ctx.drawImage(video, 0, 0, width, height);
      const qualityScore = estimateFrameQuality(ctx, width, height);
      candidates.push({
        id: `video_candidate_0`,
        timeS: 0,
        dataUrl: canvas.toDataURL("image/png"),
        qualityScore,
      });
      return { durationS, candidates, bestCandidateId: candidates[0]!.id };
    }

    for (let index = 0; index < targetCount; index += 1) {
      const ratio = targetCount === 1 ? 0.5 : (index + 1) / (targetCount + 1);
      const timeS = Math.min(durationS, Math.max(0, durationS * ratio));
      video.currentTime = timeS;
      await waitForMediaEvent(video, "seeked");

      ctx.drawImage(video, 0, 0, width, height);
      const qualityScore = estimateFrameQuality(ctx, width, height);
      candidates.push({
        id: `video_candidate_${index}`,
        timeS,
        dataUrl: canvas.toDataURL("image/png"),
        qualityScore,
      });
    }

    const best = candidates.reduce((acc, candidate) => (candidate.qualityScore > acc.qualityScore ? candidate : acc), candidates[0]!);
    return {
      durationS,
      candidates,
      bestCandidateId: best.id,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function VerificationPanel({
  enabled,
  mode,
  opacity,
  split,
  offsetX,
  offsetY,
  fileName,
  alignmentScore,
  alignmentLabel,
  sourceType,
  videoDurationS,
  sampleTimeS,
  extractionInProgress,
  errorMessage,
  canResample,
  videoCandidates,
  selectedCandidateId,
  bestCandidateId,
  onSelectVideoCandidate,
  onAutoPickBestFrame,
  onSampleTimeChange,
  onResampleVideoFrame,
  showHeatOverlay,
  snapshots,
  onToggle,
  onUpload,
  onSaveSnapshot,
  onLoadSnapshot,
  onDeleteSnapshot,
  onModeChange,
  onOpacityChange,
  onSplitChange,
  onOffsetXChange,
  onOffsetYChange,
  onToggleHeatOverlay,
  onNudge,
  onAutoAlign,
  onResetAlign,
  onClear,
}: {
  enabled: boolean;
  mode: VerificationViewMode;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
  fileName: string | null;
  alignmentScore: number | null;
  alignmentLabel: string | null;
  sourceType: VerificationSourceType;
  videoDurationS: number | null;
  sampleTimeS: number | null;
  extractionInProgress: boolean;
  errorMessage: string | null;
  canResample: boolean;
  videoCandidates: VideoFrameCandidate[];
  selectedCandidateId: string | null;
  bestCandidateId: string | null;
  onSelectVideoCandidate: (candidateId: string) => void;
  onAutoPickBestFrame: () => void;
  onSampleTimeChange: (value: number) => void;
  onResampleVideoFrame: () => void;
  showHeatOverlay: boolean;
  snapshots: CameraVerificationSnapshot[];
  onToggle: (next: boolean) => void;
  onUpload: (file: File) => void;
  onSaveSnapshot: () => void;
  onLoadSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onModeChange: (mode: VerificationViewMode) => void;
  onOpacityChange: (value: number) => void;
  onSplitChange: (value: number) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetYChange: (value: number) => void;
  onToggleHeatOverlay: (next: boolean) => void;
  onNudge: (dx: number, dy: number) => void;
  onAutoAlign: () => void;
  onResetAlign: () => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute right-3 top-[330px] z-30 w-64 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">Footage Verification</div>
        <label className="inline-flex cursor-pointer items-center gap-1 text-[9px] text-[#c5d4ef]">
          <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
          Enable
        </label>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-[#8b96ab]">
        Planning aid only. This compares a reference frame with simulated view and does not prove forensic identification.
      </p>
      <div className="mt-2 space-y-2 text-[9px] text-[#b8c5df]">
        <label className="block">
          <span className="text-[#7a8fb6]">Reference frame</span>
          <input
            type="file"
            accept="image/*,video/*"
            className="mt-1 block w-full rounded border border-[#2a3650] bg-[#0f1624] px-2 py-1 text-[9px] text-[#cdd8ee]"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {fileName ? <span className="mt-1 block truncate text-[8px] text-[#8aa0c8]">{fileName}</span> : null}
          {sourceType === "video" && videoDurationS !== null ? (
            <div className="mt-1 space-y-1.5 rounded border border-[#2a3650] bg-[#0d1523] p-1.5">
              <span className="block text-[8px] text-[#9db7e1]">
                Video frame sampled at {sampleTimeS !== null ? formatSecondsShort(sampleTimeS) : "0:00"} / {formatSecondsShort(videoDurationS)}
              </span>
              <label className="block text-[8px] text-[#8aa0c8]">
                <div className="flex justify-between"><span>Sample time</span><span>{formatSecondsShort(sampleTimeS ?? 0)}</span></div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, videoDurationS)}
                  step={0.25}
                  value={sampleTimeS ?? 0}
                  disabled={!canResample || extractionInProgress}
                  onChange={(event) => onSampleTimeChange(Number(event.target.value))}
                  className="mt-1 w-full accent-cyan-400"
                />
              </label>
              <button
                type="button"
                disabled={!canResample || extractionInProgress}
                onClick={onResampleVideoFrame}
                className="rounded bg-[#14304a] px-2 py-1 text-[8px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Extract frame at selected time
              </button>

              {videoCandidates.length ? (
                <div className="rounded border border-[#2a3650] bg-[#0b1220] p-1.5">
                  <div className="mb-1 flex items-center justify-between text-[8px] text-[#9db7e1]">
                    <span className="uppercase tracking-[0.12em]">Extracted frames</span>
                    <button
                      type="button"
                      disabled={!bestCandidateId}
                      onClick={onAutoPickBestFrame}
                      className="rounded bg-[#1b3a5a] px-1.5 py-0.5 text-[8px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Auto-pick best extracted frame
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {videoCandidates.map((candidate) => {
                      const selected = selectedCandidateId === candidate.id;
                      const isBest = bestCandidateId === candidate.id;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => onSelectVideoCandidate(candidate.id)}
                          className={`rounded border px-1.5 py-0.5 text-[8px] ${selected ? "border-cyan-300 bg-cyan-500/20 text-cyan-100" : "border-[#2a3650] bg-[#111b2c] text-[#9db7e1]"}`}
                          title={`Sharpness score ${candidate.qualityScore.toFixed(1)}`}
                        >
                          {formatSecondsShort(candidate.timeS)}{isBest ? " · Best" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {extractionInProgress ? <span className="mt-1 block text-[8px] text-cyan-300">Extracting video frame…</span> : null}
          {errorMessage ? <span className="mt-1 block text-[8px] text-rose-300">{errorMessage}</span> : null}
        </label>
        <div className="flex gap-1">
          <button type="button" onClick={() => onModeChange("overlay")} className={`rounded px-2 py-1 ${mode === "overlay" ? "bg-cyan-500/30 text-cyan-200" : "bg-[#1a2233] text-[#8ea5cc]"}`}>Overlay</button>
          <button type="button" onClick={() => onModeChange("split")} className={`rounded px-2 py-1 ${mode === "split" ? "bg-cyan-500/30 text-cyan-200" : "bg-[#1a2233] text-[#8ea5cc]"}`}>Split</button>
          <button type="button" onClick={onSaveSnapshot} className="rounded bg-[#14304a] px-2 py-1 text-cyan-200">Save</button>
          <button type="button" onClick={onClear} className="rounded bg-[#2b1a20] px-2 py-1 text-rose-200">Clear</button>
        </div>
        {snapshots.length ? (
          <div className="rounded-lg border border-[#2a3650] bg-[#0f1624] p-2">
            <div className="mb-1 text-[8px] uppercase tracking-[0.12em] text-[#7a8fb6]">Saved snapshots</div>
            <div className="max-h-24 space-y-1 overflow-y-auto pr-1">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded border border-[#243146] bg-[#0c1320] px-1.5 py-1">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onLoadSnapshot(snapshot.id)}
                      className="truncate text-left text-[8px] text-[#c9d8f3] hover:text-white"
                      title={snapshot.fileName}
                    >
                      {snapshot.fileName}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="rounded bg-[#2b1a20] px-1 py-0.5 text-[8px] text-rose-200"
                    >
                      Del
                    </button>
                  </div>
                  <div className="mt-0.5 truncate text-[8px] text-[#8aa0c8]" title={formatSnapshotEvidenceSummary(snapshot)}>
                    {formatSnapshotEvidenceSummary(snapshot)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-[#2a3650] bg-[#0f1624] px-2 py-1.5">
          <div className="flex items-center justify-between text-[#7a8fb6]">
            <span>Alignment Quality</span>
            <span className="font-mono text-[#d4e6ff]">{alignmentScore !== null ? `${Math.round(alignmentScore)}/100` : "N/A"}</span>
          </div>
          <div className="mt-0.5 text-[8px] text-[#9db7e1]">
            {alignmentLabel ? `${alignmentLabel} match (planning aid only, non-forensic).` : "Upload a reference frame to compute mismatch quality."}
          </div>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[8px] text-[#9db7e1]">
            <input type="checkbox" checked={showHeatOverlay} onChange={(event) => onToggleHeatOverlay(event.target.checked)} />
            Difference heat overlay
          </label>
        </div>
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Opacity</span><span>{Math.round(opacity * 100)}%</span></div>
          <input type="range" min={0.15} max={0.95} step={0.01} value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        {mode === "split" ? (
          <label className="block">
            <div className="flex justify-between text-[#7a8fb6]"><span>Split</span><span>{Math.round(split)}%</span></div>
            <input type="range" min={15} max={85} step={1} value={split} onChange={(event) => onSplitChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
          </label>
        ) : null}
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Offset X</span><span>{offsetX}px</span></div>
          <input type="range" min={-120} max={120} step={1} value={offsetX} onChange={(event) => onOffsetXChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Offset Y</span><span>{offsetY}px</span></div>
          <input type="range" min={-120} max={120} step={1} value={offsetY} onChange={(event) => onOffsetYChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-1">
            <button type="button" onClick={() => onNudge(-4, 0)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">◀</button>
            <button type="button" onClick={() => onNudge(4, 0)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▶</button>
            <button type="button" onClick={() => onNudge(0, -4)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▲</button>
            <button type="button" onClick={() => onNudge(0, 4)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▼</button>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={onAutoAlign} className="rounded bg-[#13354a] px-2 py-1 text-[#8ce3ff]">Auto align</button>
            <button type="button" onClick={onResetAlign} className="rounded bg-[#1d2b3f] px-2 py-1 text-[#9dd6ff]">Reset align</button>
          </div>
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
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const result = useStudioStore((s) => s.simulationResult);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const envMode = useStudioStore((s) => s.environmentMode);
  const cameraViewVerificationIntent = useStudioStore((s) => s.cameraViewVerificationIntent);
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const cameraVerificationSnapshots = useStudioStore((s) => s.cameraVerificationSnapshots);
  const upsertCameraVerificationSnapshot = useStudioStore((s) => s.upsertCameraVerificationSnapshot);
  const removeCameraVerificationSnapshot = useStudioStore((s) => s.removeCameraVerificationSnapshot);

  const camera = scene.cameras.find((c) => c.id === selectedId)
    ?? scene.cameras.find((c) => c.id === selectedCameraId)
    ?? scene.cameras[0];
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
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationFileName, setVerificationFileName] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState<VerificationViewMode>("overlay");
  const [verificationOpacity, setVerificationOpacity] = useState(0.42);
  const [verificationSplit, setVerificationSplit] = useState(50);
  const [verificationOffsetX, setVerificationOffsetX] = useState(0);
  const [verificationOffsetY, setVerificationOffsetY] = useState(0);
  const [alignmentQualityScore, setAlignmentQualityScore] = useState<number | null>(null);
  const [alignmentHeatmapUrl, setAlignmentHeatmapUrl] = useState<string | null>(null);
  const [showDifferenceHeatOverlay, setShowDifferenceHeatOverlay] = useState(false);
  const [verificationSourceType, setVerificationSourceType] = useState<VerificationSourceType>("image");
  const [verificationVideoDurationS, setVerificationVideoDurationS] = useState<number | null>(null);
  const [verificationSampleTimeS, setVerificationSampleTimeS] = useState<number | null>(null);
  const [verificationVideoFile, setVerificationVideoFile] = useState<File | null>(null);
  const [verificationVideoCandidates, setVerificationVideoCandidates] = useState<VideoFrameCandidate[]>([]);
  const [verificationSelectedCandidateId, setVerificationSelectedCandidateId] = useState<string | null>(null);
  const [verificationBestCandidateId, setVerificationBestCandidateId] = useState<string | null>(null);
  const [verificationExtracting, setVerificationExtracting] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const frameRootRef = useRef<HTMLDivElement | null>(null);
  const snapshotsForCamera = camera ? (cameraVerificationSnapshots[camera.id] ?? []) : [];
  const canvasFilter =
    feedMode === "normal"
      ? "brightness(0.82) contrast(1.08) saturate(0.92)"
      : feedMode === "ir_bw"
        ? "brightness(0.72) contrast(1.18) saturate(0.18)"
        : feedMode === "low_light"
          ? "brightness(0.65) contrast(1.1) saturate(0.8)"
          : "brightness(0.78) contrast(1.22) saturate(1.1) sepia(0.08)";
  const pathTimeS = activePathResult && activePathResult.totalDurationS > 0
    ? pathReplay.progress * activePathResult.totalDurationS
    : 0;
  const replayActorVisible = Boolean(activePath && activePathResult && (pathReplay.playing || pathReplay.progress > 0));
  const visibilityForCurrentCamera = useMemo(() => {
    if (!activePathResult || !camera) return null;
    return activePathResult.visibilityByCamera[camera.id] ?? null;
  }, [activePathResult, camera]);
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

    const reasonLine =
      zoneResult?.status === "fail"
        ? `Blocked or off-angle for ${distanceM.toFixed(1)}m at ${angleDeg.toFixed(0)}°`
        : zoneResult?.status === "partial"
          ? `Distance and angle limit the view to ${currentQuality}`
          : `Camera geometry supports ${currentQuality} around the target`;

    return {
      distanceM,
      angleDeg,
      currentQuality,
      reasonLine,
      bestCameraName: bestCameraName ? (scene.cameras.find((entry) => entry.id === bestCameraName.cameraId)?.name ?? bestCameraName.cameraId) : camera.name,
    };
  }, [camera, camResult, firstCriticalZone, result, scene.cameras]);

  const activeTimelineEvent = useMemo(() => {
    if (!activePathResult?.timeline?.length) return null;
    const events = activePathResult.timeline.filter((event) => event.timeS <= pathTimeS);
    return events[events.length - 1] ?? activePathResult.timeline[0] ?? null;
  }, [activePathResult, pathTimeS]);

  const replayQualityLabel = activeTimelineEvent?.quality
    ? activeTimelineEvent.quality.toUpperCase()
    : visibilityForCurrentCamera?.maxQuality
      ? visibilityForCurrentCamera.maxQuality.toUpperCase()
      : undefined;

  const replaySegmentLabel = activeTimelineEvent?.reason
    ?? (activePath ? `${activePath.label} active replay` : undefined);

  const extractFromCurrentVideo = (timeS?: number) => {
    if (!verificationVideoFile) return;
    setVerificationExtracting(true);
    setVerificationError(null);
    void extractVideoFrameDataUrl(verificationVideoFile, timeS)
      .then((frame) => {
        setVerificationSourceType("video");
        setVerificationVideoDurationS(frame.durationS);
        setVerificationSampleTimeS(frame.sampleTimeS);
        setVerificationImageUrl(frame.dataUrl);
        setVerificationFileName(`${verificationVideoFile.name} @ ${formatSecondsShort(frame.sampleTimeS)}`);
        setVerificationSelectedCandidateId(null);
        setVerificationEnabled(true);
      })
      .catch((error) => {
        setVerificationError(error instanceof Error ? error.message : "Video frame extraction failed");
      })
      .finally(() => {
        setVerificationExtracting(false);
      });
  };

  const applyVideoCandidate = (candidate: VideoFrameCandidate, fileName: string) => {
    setVerificationSourceType("video");
    setVerificationSampleTimeS(candidate.timeS);
    setVerificationImageUrl(candidate.dataUrl);
    setVerificationFileName(`${fileName} @ ${formatSecondsShort(candidate.timeS)}`);
    setVerificationEnabled(true);
  };

  const autoAlignVerification = useCallback(() => {
    if (!verificationEnabled || !verificationImageUrl) return;

    const host = frameRootRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;

    setVerificationExtracting(true);
    setVerificationError(null);

    const image = new Image();
    image.decoding = "async";

    image.onload = () => {
      let bestX = verificationOffsetX;
      let bestY = verificationOffsetY;
      let bestScore = -1;

      const phases = [
        { step: 16, radius: 96 },
        { step: 6, radius: 24 },
        { step: 2, radius: 8 },
      ];

      for (const phase of phases) {
        const centerX = bestX;
        const centerY = bestY;
        for (let dx = -phase.radius; dx <= phase.radius; dx += phase.step) {
          for (let dy = -phase.radius; dy <= phase.radius; dy += phase.step) {
            const candidateX = centerX + dx;
            const candidateY = centerY + dy;
            const sample = evaluateAlignmentSample({
              canvas,
              image,
              offsetX: candidateX,
              offsetY: candidateY,
              mode: verificationMode,
              split: verificationSplit,
              opacity: verificationOpacity,
            });
            if (!sample) continue;
            if (sample.score > bestScore) {
              bestScore = sample.score;
              bestX = candidateX;
              bestY = candidateY;
            }
          }
        }
      }

      setVerificationOffsetX(bestX);
      setVerificationOffsetY(bestY);

      const finalSample = evaluateAlignmentSample({
        canvas,
        image,
        offsetX: bestX,
        offsetY: bestY,
        mode: verificationMode,
        split: verificationSplit,
        opacity: verificationOpacity,
      });
      if (finalSample) {
        setAlignmentQualityScore(finalSample.score);
        setAlignmentHeatmapUrl(finalSample.heatmapUrl);
      }
      setVerificationExtracting(false);
    };

    image.onerror = () => {
      setVerificationError("Unable to auto-align reference frame");
      setVerificationExtracting(false);
    };

    image.src = verificationImageUrl;
  }, [
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOffsetX,
    verificationOffsetY,
    verificationOpacity,
    verificationSplit,
  ]);

  useEffect(() => {
    return () => {
      if (verificationImageUrl && verificationImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(verificationImageUrl);
      }
    };
  }, [verificationImageUrl]);

  useEffect(() => {
    if (camera?.id) {
      setSelectedCameraId(camera.id);
    }
  }, [camera?.id, setSelectedCameraId]);

  useEffect(() => {
    if (!cameraViewVerificationIntent?.openPanel) return;
    setVerificationEnabled(true);
    setCameraViewVerificationIntent(null);
  }, [cameraViewVerificationIntent, setCameraViewVerificationIntent]);

  useEffect(() => {
    if (!verificationEnabled || !verificationImageUrl || !camera) {
      setAlignmentQualityScore(null);
      return;
    }

    const host = frameRootRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;

    let canceled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (canceled) return;
      const sample = evaluateAlignmentSample({
        canvas,
        image,
        offsetX: verificationOffsetX,
        offsetY: verificationOffsetY,
        mode: verificationMode,
        split: verificationSplit,
        opacity: verificationOpacity,
      });
      if (!sample) return;
      setAlignmentQualityScore(sample.score);
      setAlignmentHeatmapUrl(sample.heatmapUrl);
    };
    image.src = verificationImageUrl;

    return () => {
      canceled = true;
    };
  }, [
    camera?.id,
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOpacity,
    verificationSplit,
    verificationOffsetX,
    verificationOffsetY,
  ]);

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
    <div ref={frameRootRef} className="relative h-full w-full overflow-hidden bg-[#07090d]">
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
                setSelectedCameraId(nextCamera.id);
                selectNode(nextCamera.id);
              }
            }}
            onNext={() => {
              const nextIndex = Math.min(scene.cameras.length - 1, (cameraIndex < 0 ? 0 : cameraIndex) + 1);
              const nextCamera = scene.cameras[nextIndex];
              if (nextCamera) {
                setSelectedCameraId(nextCamera.id);
                selectNode(nextCamera.id);
              }
            }}
            onSelect={(id) => {
              setSelectedCameraId(id);
              selectNode(id);
            }}
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
            style={{ width: "100%", height: "100%", filter: canvasFilter }}
          >
            <color attach="background" args={[theme.background]} />
            <Suspense fallback={<CanvasLoadingOverlay label="Loading camera view" />}>
              <SceneFeedGeometry theme={theme} showPrivacyZones />
            </Suspense>
            <CameraRigLive camera={camera} />
            {replayActorVisible && activePath ? (
              <ReplayActor path={activePath} progress={pathReplay.progress} />
            ) : null}
            <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
          </Canvas>
          {verificationEnabled && verificationImageUrl ? (
            <FootageVerificationOverlay
              imageUrl={verificationImageUrl}
              mode={verificationMode}
              opacity={verificationOpacity}
              split={verificationSplit}
              offsetX={verificationOffsetX}
              offsetY={verificationOffsetY}
            />
          ) : null}
          {verificationEnabled && showDifferenceHeatOverlay && alignmentHeatmapUrl ? (
            <div className="pointer-events-none absolute inset-0">
              <img src={alignmentHeatmapUrl} alt="Alignment mismatch heat overlay" className="h-full w-full object-cover opacity-65 mix-blend-screen" />
            </div>
          ) : null}
          {modeFilter(feedMode)}
          <LiveFeedHUD camera={camera} mode={feedMode} flags={flags} ppm={scene.assumptions.pixelsPerMeter} targetType={firstCriticalZone?.targetType} />
          {activePath && activePathResult ? (
            <ReplayStatusOverlay
              pathLabel={activePath.label}
              timeS={pathTimeS}
              speed={pathReplay.speed}
              qualityLabel={replayQualityLabel}
              segmentLabel={replaySegmentLabel}
            />
          ) : null}
          {activePathResult && visibilityForCurrentCamera ? (
            <CameraPathVisibilityOverlay
              cameraName={camera.name}
              visibleSeconds={visibilityForCurrentCamera.visibleS}
              totalSeconds={activePathResult.totalDurationS}
              maxQuality={visibilityForCurrentCamera.maxQuality}
            />
          ) : null}
          {zoneAnalysis && firstCriticalZone ? (
            <DoriInsightCard
              camera={camera}
              zoneLabel={firstCriticalZone.label}
              targetType={firstCriticalZone.targetType}
              currentQuality={zoneAnalysis.currentQuality}
              requiredQuality={zoneResult?.requiredQuality ?? firstCriticalZone.requiredQuality}
              zoneStatus={zoneResult?.status ?? "unknown"}
              bestCameraName={zoneAnalysis.bestCameraName}
              distanceM={zoneAnalysis.distanceM}
              angleDeg={zoneAnalysis.angleDeg}
              lightingLabel={envMode === "night" ? "Night" : envMode === "dusk" ? "Dusk" : "Day"}
              reasonLine={zoneAnalysis.reasonLine}
            />
          ) : null}
          <VerificationPanel
            enabled={verificationEnabled}
            mode={verificationMode}
            opacity={verificationOpacity}
            split={verificationSplit}
            offsetX={verificationOffsetX}
            offsetY={verificationOffsetY}
            fileName={verificationFileName}
            alignmentScore={alignmentQualityScore}
            alignmentLabel={alignmentQualityScore !== null ? alignmentQualityLabel(alignmentQualityScore) : null}
            sourceType={verificationSourceType}
            videoDurationS={verificationVideoDurationS}
            sampleTimeS={verificationSampleTimeS}
            extractionInProgress={verificationExtracting}
            errorMessage={verificationError}
            canResample={verificationSourceType === "video" && verificationVideoFile !== null}
            videoCandidates={verificationVideoCandidates}
            selectedCandidateId={verificationSelectedCandidateId}
            bestCandidateId={verificationBestCandidateId}
            onSelectVideoCandidate={(candidateId) => {
              if (!verificationVideoFile) return;
              const candidate = verificationVideoCandidates.find((entry) => entry.id === candidateId);
              if (!candidate) return;
              setVerificationSelectedCandidateId(candidateId);
              applyVideoCandidate(candidate, verificationVideoFile.name);
            }}
            onAutoPickBestFrame={() => {
              if (!verificationBestCandidateId || !verificationVideoFile) return;
              const best = verificationVideoCandidates.find((entry) => entry.id === verificationBestCandidateId);
              if (!best) return;
              setVerificationSelectedCandidateId(best.id);
              applyVideoCandidate(best, verificationVideoFile.name);
            }}
            onSampleTimeChange={(value) => {
              setVerificationSampleTimeS(value);
            }}
            onResampleVideoFrame={() => {
              extractFromCurrentVideo(verificationSampleTimeS ?? undefined);
            }}
            showHeatOverlay={showDifferenceHeatOverlay}
            snapshots={snapshotsForCamera}
            onToggle={setVerificationEnabled}
            onUpload={(file) => {
              setVerificationError(null);
              if (file.type.startsWith("video/")) {
                setVerificationVideoFile(file);
                setVerificationSampleTimeS(null);
                setVerificationExtracting(true);
                void extractVideoFrameCandidates(file)
                  .then((result) => {
                    setVerificationSourceType("video");
                    setVerificationVideoDurationS(result.durationS);
                    setVerificationVideoCandidates(result.candidates);
                    setVerificationBestCandidateId(result.bestCandidateId);

                    const preferred = result.candidates.find((entry) => entry.id === result.bestCandidateId) ?? result.candidates[0] ?? null;
                    if (preferred) {
                      setVerificationSelectedCandidateId(preferred.id);
                      applyVideoCandidate(preferred, file.name);
                    }
                  })
                  .catch((error) => {
                    setVerificationError(error instanceof Error ? error.message : "Video frame extraction failed");
                    setVerificationVideoCandidates([]);
                    setVerificationBestCandidateId(null);
                    setVerificationSelectedCandidateId(null);
                  })
                  .finally(() => {
                    setVerificationExtracting(false);
                  });
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") return;
                setVerificationSourceType("image");
                setVerificationVideoDurationS(null);
                setVerificationSampleTimeS(null);
                setVerificationVideoFile(null);
                setVerificationVideoCandidates([]);
                setVerificationBestCandidateId(null);
                setVerificationSelectedCandidateId(null);
                setVerificationImageUrl(reader.result);
                setVerificationFileName(file.name);
                setVerificationEnabled(true);
              };
              reader.onerror = () => {
                setVerificationError("Unable to read image file");
              };
              reader.readAsDataURL(file);
            }}
            onSaveSnapshot={() => {
              if (!camera || !verificationImageUrl || !verificationFileName) return;
              upsertCameraVerificationSnapshot(camera.id, {
                id: `verification_snapshot_${Date.now()}`,
                fileName: verificationFileName,
                imageUrl: verificationImageUrl,
                mode: verificationMode,
                sourceType: verificationSourceType,
                sampleTimeS: verificationSampleTimeS,
                videoDurationS: verificationVideoDurationS,
                candidateCount: verificationVideoCandidates.length,
                bestCandidateId: verificationBestCandidateId,
                selectedCandidateId: verificationSelectedCandidateId,
                opacity: verificationOpacity,
                split: verificationSplit,
                offsetX: verificationOffsetX,
                offsetY: verificationOffsetY,
                alignmentScore: alignmentQualityScore,
                createdAt: Date.now(),
              });
            }}
            onLoadSnapshot={(snapshotId) => {
              if (!camera) return;
              const snapshot = (cameraVerificationSnapshots[camera.id] ?? []).find((entry) => entry.id === snapshotId);
              if (!snapshot) return;
              setVerificationEnabled(true);
              setVerificationImageUrl(snapshot.imageUrl);
              setVerificationFileName(snapshot.fileName);
              setVerificationMode(snapshot.mode);
              setVerificationSourceType(snapshot.sourceType ?? "image");
              setVerificationSampleTimeS(snapshot.sampleTimeS ?? null);
              setVerificationVideoDurationS(snapshot.videoDurationS ?? null);
              setVerificationBestCandidateId(snapshot.bestCandidateId ?? null);
              setVerificationSelectedCandidateId(snapshot.selectedCandidateId ?? null);
              setVerificationVideoCandidates([]);
              setVerificationVideoFile(null);
              setVerificationOpacity(snapshot.opacity);
              setVerificationSplit(snapshot.split);
              setVerificationOffsetX(snapshot.offsetX);
              setVerificationOffsetY(snapshot.offsetY);
              setAlignmentQualityScore(snapshot.alignmentScore);
            }}
            onDeleteSnapshot={(snapshotId) => {
              if (!camera) return;
              removeCameraVerificationSnapshot(camera.id, snapshotId);
            }}
            onModeChange={setVerificationMode}
            onOpacityChange={setVerificationOpacity}
            onSplitChange={setVerificationSplit}
            onOffsetXChange={setVerificationOffsetX}
            onOffsetYChange={setVerificationOffsetY}
            onToggleHeatOverlay={setShowDifferenceHeatOverlay}
            onNudge={(dx, dy) => {
              setVerificationOffsetX((value) => value + dx);
              setVerificationOffsetY((value) => value + dy);
            }}
            onAutoAlign={autoAlignVerification}
            onResetAlign={() => {
              setVerificationOffsetX(0);
              setVerificationOffsetY(0);
            }}
            onClear={() => {
              if (verificationImageUrl && verificationImageUrl.startsWith("blob:")) {
                URL.revokeObjectURL(verificationImageUrl);
              }
              setVerificationImageUrl(null);
              setVerificationFileName(null);
              setVerificationEnabled(false);
              setVerificationSourceType("image");
              setVerificationVideoDurationS(null);
              setVerificationSampleTimeS(null);
              setVerificationVideoFile(null);
              setVerificationVideoCandidates([]);
              setVerificationBestCandidateId(null);
              setVerificationSelectedCandidateId(null);
              setVerificationError(null);
            }}
          />
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
