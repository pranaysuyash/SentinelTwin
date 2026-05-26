"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Camera, Video, VideoOff } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { getYawPitchDirection } from "@/simulation/geometry";
import type { CameraNode } from "@/schema/security-scene";

// ── Shared scene elements ──

const ENV_THEME = {
  background: "#0a0d13",
  ambient: 0.66,
  hemisphere: 0.62,
  directional: 2.3,
  fill: 0.55,
};

function SceneView() {
  const scene = useStudioStore((s) => s.scene);
  const { width, depth } = scene.dimensions;

  return (
    <>
      <color attach="background" args={["#0a0d13"]} />
      <fog attach="fog" args={["#0a0d13", 12, 24]} />
      <ambientLight intensity={ENV_THEME.ambient} />
      <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={ENV_THEME.hemisphere} />
      <directionalLight position={[10, 14, 8]} intensity={ENV_THEME.directional} color="#eef4ff" castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-5, 8, -8]} intensity={ENV_THEME.fill} color="#a5c2ff" />
      <pointLight position={[5, 2.8, 3.5]} intensity={1.15} distance={8} color="#fff6d8" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.0015, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#252d3a" roughness={0.97} />
      </mesh>

      {/* Walls */}
      {scene.walls.map((wall) => {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const cx = (wall.start[0] + wall.end[0]) / 2;
        const cz = (wall.start[1] + wall.end[1]) / 2;
        const isGlass = wall.material === "glass";
        return (
          <mesh key={wall.id} position={[cx, wall.heightM / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, wall.heightM, 0.18]} />
            <meshStandardMaterial
              color={isGlass ? "#cfe5ff" : "#d4dae6"}
              transparent={isGlass}
              opacity={isGlass ? 0.2 : 1}
              roughness={0.78}
              metalness={0.02}
            />
          </mesh>
        );
      })}

      {/* Obstructions */}
      {scene.obstructions.map((obs) => {
        const [w, d, h] = obs.dimensions;
        return (
          <group key={obs.id} position={obs.position} rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#5c4324" roughness={0.82} metalness={0.08} />
            </mesh>
          </group>
        );
      })}
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
