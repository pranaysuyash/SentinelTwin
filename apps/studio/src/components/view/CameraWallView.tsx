"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Camera, Video, VideoOff } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { getYawPitchDirection } from "@/simulation/geometry";
import type { CameraNode } from "@/schema/security-scene";
import { ENVIRONMENT_THEMES, SceneLighting, SceneFloor, SceneWalls, SceneObstructions } from "@/components/workspace/SharedScene";

// ── Shared scene elements ──

const CAMERA_WALL_THEME = ENVIRONMENT_THEMES.day;

function SceneView() {
  const scene = useStudioStore((s) => s.scene);
  const { width, depth } = scene.dimensions;
  const selectedId = useStudioStore((s) => s.selectedNodeId);

  return (
    <>
      <SceneLighting theme={CAMERA_WALL_THEME} />
      <SceneFloor width={width} depth={depth} showGrid={false} />
      <SceneWalls walls={scene.walls} />
      <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} />
    </>
  );
}

// ── Camera Rig ──

function CameraRig({ camera: camData }: { camera: CameraNode }) {
  const camera = useThree((s) => s.camera);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const forward = getYawPitchDirection(camData.yawDeg, camData.pitchDeg);
    const pos = new THREE.Vector3(...camData.position);
    const target = pos.clone().add(forward.clone().multiplyScalar(6));
    camera.position.copy(pos);
    camera.lookAt(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── Individual camera feed panel ──

function CameraFeedPanel({ camera: camData }: { camera: CameraNode }) {
  const isActive = camData.status === "on";

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#1f2536] bg-[#07090d]">
      <Canvas
        camera={{ position: camData.position, fov: Math.min(camData.fovHorizontalDeg, 100), near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
        shadows
      >
        <Suspense fallback={null}>
          <SceneView />
        </Suspense>
        <CameraRig camera={camData} />
        <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>

      {/* Overlay label */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-2.5 pb-4 pt-2">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Video className="h-3 w-3 text-green-400" />
          ) : (
            <VideoOff className="h-3 w-3 text-red-400" />
          )}
          <span className="text-[10px] font-semibold text-[#c7d0e4]">{camData.name}</span>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-black/70 px-2 py-1">
        <span className="text-[8px] text-[#5b667c]">{camData.resolutionMP}MP</span>
        <span className="text-[8px] text-[#4a5568]">·</span>
        <span className="text-[8px] text-[#5b667c]">{camData.fovHorizontalDeg}°</span>
        <span className="text-[8px] text-[#4a5568]">·</span>
        <span className={`text-[8px] ${isActive ? "text-green-400" : "text-red-400"}`}>
          {isActive ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}

// ── Empty placeholder panel ──

function EmptyPanel() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-[#1f2536] bg-[#0a0d14]">
      <div className="text-center">
        <Camera className="mx-auto h-6 w-6 text-[#2a3246]" />
        <p className="mt-2 text-[10px] text-[#3a4158]">No Camera Feed</p>
      </div>
    </div>
  );
}

// ── Main export ──

export function CameraWallView() {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);

  const cameras = useMemo(() => {
    // Show selected camera first, then active ones, then offline
    const sorted = [...scene.cameras].sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      if (a.status === "on" && b.status !== "on") return -1;
      if (a.status !== "on" && b.status === "on") return 1;
      return 0;
    });
    return sorted.slice(0, 4);
  }, [scene.cameras, selectedId]);

  return (
    <div className="flex-1 p-3">
      {cameras.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Camera className="mx-auto h-8 w-8 text-[#2a3246]" />
            <p className="mt-2 text-[11px] text-[#4a5568]">Place cameras to see live feeds</p>
          </div>
        </div>
      ) : (
        <div className="grid h-full grid-cols-2 gap-3">
          {cameras.map((cam) => (
            <div
              key={cam.id}
              className={`cursor-pointer rounded-lg transition-all ${
                cam.id === selectedId ? "ring-2 ring-[#60a5fa]" : ""
              }`}
              onClick={() => selectNode(cam.id)}
            >
              <CameraFeedPanel camera={cam} />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - cameras.length) }).map((_, i) => (
            <EmptyPanel key={`empty-${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}
