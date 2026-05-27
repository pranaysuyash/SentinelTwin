"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

import "@/lib/three-compat";
import type { CameraNode, DoriQuality, SecurityScene } from "@/schema/security-scene";
import { qualityToScore } from "@/simulation/dori";
import { getYawPitchDirection } from "@/simulation/geometry";
import { useStudioStore } from "@/store/studio-store";

type FeedViewMode = "normal" | "ir" | "low_light" | "thermal";

const FEED_MODE_LABELS: Record<FeedViewMode, string> = {
  normal: "Normal",
  ir: "IR",
  low_light: "Low Light",
  thermal: "Thermal",
};

const DORI_2014_RANGES: Record<Exclude<DoriQuality, "none" | "overview" | "outline" | "discern" | "perceive" | "characterize" | "validate" | "scrutinize">, string> = {
  detection: "25-62.5 PPM",
  observation: "62.5-125 PPM",
  recognition: "125-250 PPM",
  identification: "250+ PPM",
};

const OODPCVS_RANGES: Record<Exclude<DoriQuality, "none" | "detection" | "observation" | "recognition" | "identification">, string> = {
  overview: "25-50 PPM",
  outline: "50-62.5 PPM",
  discern: "62.5-100 PPM",
  perceive: "100-125 PPM",
  characterize: "125-250 PPM",
  validate: "250-500 PPM",
  scrutinize: "500+ PPM",
};

function qualityRangeLabel(quality: DoriQuality, doriStandard: SecurityScene["assumptions"]["doriStandard"]) {
  if (quality === "none") return "<25 PPM";
  if (doriStandard === "oodpcvs_2025") {
    return OODPCVS_RANGES[quality as keyof typeof OODPCVS_RANGES] ?? "25+ PPM";
  }
  return DORI_2014_RANGES[quality as keyof typeof DORI_2014_RANGES] ?? "25+ PPM";
}

function CameraFeedScene({
  camera,
  walls,
  obstructions,
  dimensions,
}: {
  camera: CameraNode;
  walls: SecurityScene["walls"];
  obstructions: SecurityScene["obstructions"];
  dimensions: SecurityScene["dimensions"];
}) {
  const target = useMemo(() => {
    const direction = getYawPitchDirection(camera.yawDeg, camera.pitchDeg);

    return [
      camera.position[0] + direction.x * 5,
      camera.position[1] + direction.y * 5,
      camera.position[2] + direction.z * 5,
    ] as [number, number, number];
  }, [camera.pitchDeg, camera.position, camera.yawDeg]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={camera.position}
        fov={camera.fovHorizontalDeg}
        near={0.1}
        far={50}
        ref={(cam) => {
          if (cam) cam.lookAt(target[0], target[1], target[2]);
        }}
      />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[dimensions.width / 2, 0, dimensions.depth / 2]} receiveShadow>
        <planeGeometry args={[dimensions.width, dimensions.depth]} />
        <meshStandardMaterial color="#1a1f2e" />
      </mesh>

      {obstructions.map((obs) => {
        const [width, depth, height] = obs.dimensions;

        return (
          <mesh key={obs.id} position={obs.position} rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]} castShadow receiveShadow>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        );
      })}

      {walls.map((wall) => {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const len = Math.sqrt(dx * dx + dz * dz);
        const midX = (wall.start[0] + wall.end[0]) / 2;
        const midZ = (wall.start[1] + wall.end[1]) / 2;
        const angle = Math.atan2(dz, dx);
        const isGlass = wall.material === "glass";

        return (
          <mesh key={wall.id} position={[midX, wall.heightM / 2, midZ]} rotation={[0, -angle, 0]} receiveShadow castShadow>
            <boxGeometry args={[len, wall.heightM, wall.thicknessM]} />
            <meshStandardMaterial
              color={isGlass ? "#7fb4ff" : "#2a3040"}
              transparent={isGlass}
              opacity={isGlass ? 0.4 : 1}
            />
          </mesh>
        );
      })}
    </>
  );
}

export function CameraFeedCanvas({ cameraId }: { cameraId: string }) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const camera = scene.cameras.find((entry) => entry.id === cameraId);
  const [viewMode, setViewMode] = useState<FeedViewMode>("normal");

  if (!camera) return null;

  const isNight = scene.assumptions.timeOfDay === "night";
  const targetZone = scene.criticalZones.find((zone) => zone.id === selectedNodeId) ?? scene.criticalZones[0] ?? null;
  const cameraResult = result?.cameraResults.find((entry) => entry.cameraId === camera.id) ?? null;
  const targetQuality = targetZone ? (cameraResult?.qualityByZone[targetZone.id] ?? "none") : "none";
  const targetZoneResult = targetZone
    ? result?.criticalZoneResults.find((entry) => entry.zoneId === targetZone.id) ?? null
    : null;
  const targetCentroid = targetZone
    ? targetZone.polygon.reduce(
      (acc, [x, z]) => {
        acc[0] += x;
        acc[1] += z;
        return acc;
      },
      [0, 0] as [number, number],
    )
    : null;
  const targetPoint = targetCentroid && targetZone
    ? [targetCentroid[0] / targetZone.polygon.length, targetCentroid[1] / targetZone.polygon.length]
    : null;
  const targetDistanceM = targetPoint
    ? Math.hypot(camera.position[0] - targetPoint[0], camera.position[2] - targetPoint[1])
    : null;
  const targetBearingDeg = targetPoint
    ? ((Math.atan2(targetPoint[0] - camera.position[0], targetPoint[1] - camera.position[2]) * 180) / Math.PI)
    : null;
  const angleFromCenterDeg = targetBearingDeg == null
    ? null
    : Math.abs((((targetBearingDeg - camera.yawDeg) % 360) + 540) % 360 - 180);
  const bestCameraForTarget = targetZone && result
    ? result.cameraResults
        .map((entry) => ({
          cameraId: entry.cameraId,
          quality: entry.qualityByZone[targetZone.id] ?? "none",
        }))
        .sort((a, b) => qualityToScore(b.quality) - qualityToScore(a.quality))[0]
    : null;
  const bestCameraName = bestCameraForTarget
    ? (scene.cameras.find((entry) => entry.id === bestCameraForTarget.cameraId)?.name ?? bestCameraForTarget.cameraId)
    : camera.name;

  const canvasFilterClass = viewMode === "normal"
    ? ""
    : viewMode === "ir"
      ? "grayscale-[0.95] brightness-[0.85] contrast-[1.25]"
      : viewMode === "low_light"
        ? "brightness-[0.72] contrast-[1.18] saturate-[0.85]"
        : "sepia-[0.8] saturate-[1.6] hue-rotate-[300deg] brightness-[0.82] contrast-[1.1]";

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[#1f2536]" style={{ aspectRatio: "16 / 9" }}>
      <div className={cn("absolute inset-0", canvasFilterClass)}>
        <Canvas
          camera={{ position: camera.position, fov: camera.fovHorizontalDeg, near: 0.1, far: 50 }}
          shadows="percentage"
          gl={{ preserveDrawingBuffer: true }}
        >
          <CameraFeedScene camera={camera} walls={scene.walls} obstructions={scene.obstructions} dimensions={scene.dimensions} />
        </Canvas>
      </div>

      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-[#24304a] bg-black/50 p-1 backdrop-blur-sm">
        {(Object.keys(FEED_MODE_LABELS) as FeedViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              "rounded-md px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] transition-colors",
              viewMode === mode ? "bg-blue-500/25 text-blue-200" : "text-[#8592a9] hover:text-white",
            )}
          >
            {FEED_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {isNight && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            background: "rgba(0,0,0,0.55)",
            mixBlendMode: "multiply",
            filter: "grayscale(0.8)",
          }}
        />
      )}

      {targetZone ? (
        <div className="absolute right-2 top-2 z-10 rounded-xl border border-[#24304a] bg-black/70 px-2.5 py-2 backdrop-blur-sm">
          <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#8ab4ff]">DORI Overlay</div>
          <div className="text-[11px] font-semibold text-white">
            {targetZone.label}
          </div>
          <div className="mt-1 text-[9px] text-[#c7d0e4]">
            {targetZoneResult?.status === "pass"
              ? "PASS"
              : targetZoneResult?.status === "partial"
                ? "PARTIAL"
                : targetZoneResult?.status === "fail"
                  ? "FAIL"
                  : "UNKNOWN"}
          </div>
          <div className="mt-1 text-[10px] font-semibold text-amber-300">
            {targetQuality.toUpperCase()} <span className="text-[9px] font-normal text-[#8b96ab]">/ {qualityRangeLabel(targetQuality, scene.assumptions.doriStandard)}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-[8px] text-[#94a3b8]">
            <div>
              <div className="uppercase tracking-[0.16em] text-[#546078]">Target Type</div>
              <div className="mt-0.5 text-[#d7deed]">{targetZone.targetType.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.16em] text-[#546078]">Distance</div>
              <div className="mt-0.5 text-[#d7deed]">{targetDistanceM != null ? `${targetDistanceM.toFixed(1)}m` : "—"}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.16em] text-[#546078]">Angle</div>
              <div className="mt-0.5 text-[#d7deed]">{angleFromCenterDeg != null ? `${angleFromCenterDeg.toFixed(1)}°` : "—"}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.16em] text-[#546078]">Best Camera</div>
              <div className="mt-0.5 text-[#d7deed]">{bestCameraName}</div>
            </div>
          </div>
          <div className="mt-2 text-[8px] uppercase tracking-[0.18em] text-[#546078]">
            Lighting: {scene.assumptions.timeOfDay === "night" ? "Night" : scene.assumptions.timeOfDay === "custom" ? "Custom" : "Day"}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1">
        <div className="text-[8px] font-mono text-green-400">
          {camera.name} • {camera.resolutionMP}MP
        </div>
        <div className="text-[7px] font-mono text-[#6b7280]">
          FOV {camera.fovHorizontalDeg}° • {isNight ? "NIGHT" : "DAY"}
        </div>
      </div>
    </div>
  );
}
