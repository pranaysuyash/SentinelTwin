"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { ArrowLeft, VideoOff } from "lucide-react";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { getYawPitchDirection } from "@/simulation/geometry";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
} from "@/components/workspace/SharedScene";
import type { CameraNode } from "@/schema/security-scene";

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
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const forward = getYawPitchDirection(camData.yawDeg, camData.pitchDeg);
    const pos = new THREE.Vector3(...camData.position);
    const target = pos.clone().add(forward.clone().multiplyScalar(8));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData]);

  return null;
}

function nowTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function LiveFeedHUD({ camera: cam }: { camera: CameraNode }) {
  const isActive = cam.status === "on";
  return (
    <>
      {/* Top gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />

      {/* Top-left: status + camera name */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400"}`} />
        <span className="text-[11px] font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {cam.name.toUpperCase()}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${isActive ? "bg-emerald-500/30 text-emerald-300" : "bg-red-500/30 text-red-300"}`}>
          {isActive ? "Active" : "Offline"}
        </span>
      </div>

      {/* Top-right: MP badge + timestamp */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-0.5">
        <span className="rounded bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-[#93c5fd]">
          {cam.resolutionMP}MP · {cam.fovHorizontalDeg}° FOV
        </span>
        <span className="font-mono text-[9px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {nowTimestamp()}
        </span>
      </div>

      {/* Scan line overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
        }}
      />

      {/* Bottom metadata */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        <span className="rounded bg-black/50 px-2 py-1 font-mono text-[9px] text-white/60">
          {cam.mountType.toUpperCase()} · H: {cam.mountHeightM}m · Range: {cam.rangeM}m
        </span>
      </div>
    </>
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
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-[10px] font-semibold text-white/60">{cam.name.toUpperCase()}</span>
          <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 text-[7px] font-semibold text-red-300">OFFLINE</span>
        </div>
      </div>
    </div>
  );
}

export function CameraViewMode() {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const envMode = useStudioStore((s) => s.environmentMode);

  const camera = scene.cameras.find((c) => c.id === selectedId) ?? scene.cameras[0];
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;

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
          <Canvas
            camera={{
              position: camera.position,
              fov: Math.min(camera.fovHorizontalDeg, 100),
              near: 0.1,
              far: 60,
            }}
            gl={{ antialias: true, alpha: false }}
            style={{ width: "100%", height: "100%" }}
            shadows="percentage"
          >
            <color attach="background" args={[theme.background]} />
            <Suspense fallback={null}>
              <SceneView theme={theme} />
            </Suspense>
            <CameraRig camera={camera} />
            <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
          </Canvas>
          <LiveFeedHUD camera={camera} />
        </>
      ) : (
        <div className="relative h-full w-full">
          <OfflineFeed camera={camera} />
        </div>
      )}

      {/* Back to map button */}
      <button
        onClick={() => {
          setWorkspacePreset("edit");
          setViewMode("map");
        }}
        className="absolute right-3 top-14 z-20 flex items-center gap-1.5 rounded-lg border border-[#2a3246] bg-[#0e1320]/90 px-3 py-1.5 text-[10px] font-medium text-[#c7d0e4] backdrop-blur-sm transition-colors hover:border-[#3a4a66] hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Map View
      </button>

      {/* Camera selector pills */}
      {scene.cameras.length > 1 && (
        <div className="absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {scene.cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => {
                const store = useStudioStore.getState();
                store.selectNode(cam.id);
              }}
              className={`rounded-full px-3 py-1 text-[9px] font-medium transition-all ${
                cam.id === camera.id
                  ? "bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50"
                  : "bg-black/60 text-white/50 hover:text-white/80"
              }`}
            >
              {cam.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
