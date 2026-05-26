"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

import type { CameraNode, SecurityScene } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

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
    const yawRad = (camera.yawDeg * Math.PI) / 180;
    const pitchRad = (camera.pitchDeg * Math.PI) / 180;
    const lookDirX = Math.sin(yawRad) * Math.cos(pitchRad);
    const lookDirY = Math.sin(pitchRad);
    const lookDirZ = Math.cos(yawRad) * Math.cos(pitchRad);

    return [
      camera.position[0] + lookDirX * 5,
      camera.position[1] + lookDirY * 5,
      camera.position[2] + lookDirZ * 5,
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
  const camera = scene.cameras.find((entry) => entry.id === cameraId);

  if (!camera) return null;

  const isNight = scene.assumptions.timeOfDay === "night";

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[#1f2536]" style={{ aspectRatio: "16 / 9" }}>
      <Canvas
        camera={{ position: camera.position, fov: camera.fovHorizontalDeg, near: 0.1, far: 50 }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        <CameraFeedScene camera={camera} walls={scene.walls} obstructions={scene.obstructions} dimensions={scene.dimensions} />
      </Canvas>

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
