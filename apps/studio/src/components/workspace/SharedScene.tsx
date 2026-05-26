"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

import type { CoverageCellResult, WallNode, ObstructionNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

// ── Environment themes ──

export const ENVIRONMENT_THEMES = {
  day: {
    background: "#0a0d13",
    ambient: 0.66,
    hemisphere: 0.62,
    directional: 2.3,
    fill: 0.55,
  },
  dusk: {
    background: "#090b12",
    ambient: 0.48,
    hemisphere: 0.46,
    directional: 1.6,
    fill: 0.42,
  },
  night: {
    background: "#06080d",
    ambient: 0.3,
    hemisphere: 0.28,
    directional: 0.95,
    fill: 0.3,
  },
} as const;

export type EnvironmentTheme = (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES];

// ── Lighting ──

export function SceneLighting({ theme }: { theme: EnvironmentTheme }) {
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, 12, 24]} />
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={theme.hemisphere} />
      <directionalLight
        position={[10, 14, 8]}
        intensity={theme.directional}
        color="#eef4ff"
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <directionalLight position={[-5, 8, -8]} intensity={theme.fill} color="#a5c2ff" />
      <pointLight position={[5, 2.8, 3.5]} intensity={1.15} distance={8} color="#fff6d8" />
    </>
  );
}

// ── Floor + Grid ──

export function SceneFloor({
  width,
  depth,
  showGrid = true,
}: {
  width: number;
  depth: number;
  showGrid?: boolean;
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.0015, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#252d3a" roughness={0.97} />
      </mesh>
      {showGrid && (
        <gridHelper
          args={[Math.max(width, depth) + 1.5, (Math.max(width, depth) + 2) * 6, "#2d3444", "#181d28"]}
          position={[width / 2, 0.002, depth / 2]}
        />
      )}
    </>
  );
}

// ── Walls (with glass richness) ──

export function SceneWalls({ walls }: { walls: WallNode[] }) {
  return (
    <>
      {walls.map((wall) => {
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
              roughness={isGlass ? 0.08 : 0.78}
              metalness={isGlass ? 0.28 : 0.02}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ── Obstructions (full — type colors, selection, shelf boards, click) ──

const OBSTRUCTION_COLORS: Record<string, string> = {
  shelf: "#5c4324",
  cupboard: "#624633",
  counter: "#786552",
  storage_boxes: "#5b4428",
  other: "#414456",
};

export function SceneObstructions({
  obstructions,
  selectedId,
  onSelect,
}: {
  obstructions: ObstructionNode[];
  selectedId?: string | null;
  /** Optional click handler. If not provided, uses store's selectNode. */
  onSelect?: (id: string) => void;
}) {
  const storeSelect = useStudioStore((s) => s.selectNode);
  const handleSelect = onSelect ?? storeSelect;

  return (
    <>
      {obstructions.map((obs) => {
        const [w, d, h] = obs.dimensions;
        const isSelected = selectedId === obs.id;
        const isShelf = obs.obstructionType === "shelf";
        const color = OBSTRUCTION_COLORS[obs.obstructionType] ?? OBSTRUCTION_COLORS.other;
        const highlightBox = new THREE.BoxGeometry(w * 1.02, h * 1.02, d * 1.02);

        return (
          <group
            key={obs.id}
            position={obs.position}
            rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]}
            onClick={(e) => { e.stopPropagation(); handleSelect(obs.id); }}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial
                color={isSelected ? "#60a5fa" : color}
                roughness={0.82}
                metalness={0.08}
                emissive={isSelected ? "#1e3a5f" : "#000000"}
                emissiveIntensity={isSelected ? 0.4 : 0}
              />
            </mesh>
            {isSelected && (
              <lineSegments>
                <edgesGeometry args={[highlightBox]} />
                <lineBasicMaterial color="#60a5fa" transparent opacity={0.8} />
              </lineSegments>
            )}
            {/* Shelf boards for shelf type */}
            {isShelf
              ? [0.78, 0.42, 0.06].map((fraction, i) => (
                  <mesh key={i} position={[0, fraction * h - h / 2, 0]} castShadow>
                    <boxGeometry args={[w * 0.95, 0.03, d * 0.94]} />
                    <meshStandardMaterial color="#6d522f" roughness={0.86} />
                  </mesh>
                ))
              : (
                <mesh position={[0, h / 2 - 0.03, 0]} castShadow>
                  <boxGeometry args={[w * 0.96, 0.05, d * 0.92]} />
                  <meshStandardMaterial color="#8f7a64" roughness={0.72} metalness={0.06} />
                </mesh>
              )}
          </group>
        );
      })}
    </>
  );
}

// ── Coverage heatmap (instanced mesh) ──

const QUALITY_COLORS: Record<string, THREE.Color> = {
  identification: new THREE.Color("#3b82f6"),
  recognition: new THREE.Color("#22c55e"),
  observation: new THREE.Color("#eab308"),
  detection: new THREE.Color("#f97316"),
  none: new THREE.Color("#25090b"),
};

export function CoverageHeatmapInstanced({ cells }: { cells: CoverageCellResult[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || cells.length === 0) return;

    cells.forEach((cell, index) => {
      mat.current.setPosition(cell.x, 0.008, cell.z);
      mesh.setMatrixAt(index, mat.current);
      col.current.copy(QUALITY_COLORS[cell.quality] ?? QUALITY_COLORS.none);
      mesh.setColorAt(index, col.current);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells]);

  if (cells.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cells.length]} renderOrder={1}>
      <boxGeometry args={[0.22, 0.008, 0.22]} />
      <meshBasicMaterial vertexColors transparent opacity={0.74} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Adversarial Path Line ──

export const ADVERSARIAL_PATH_DASH = { color: "#f43f5e", dashSize: 0.1, gapSize: 0.06 };

export function AdversarialPathLine({ waypoints }: { waypoints: [number, number][] }) {
  const geometry = useMemo(() => {
    const arr = new Float32Array(waypoints.length * 3);
    waypoints.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.045;
      arr[index * 3 + 2] = z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [waypoints]);

  const dashedLine = useMemo(() => {
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial(ADVERSARIAL_PATH_DASH),
    );
    line.computeLineDistances();
    return line;
  }, [geometry]);

  return <primitive object={dashedLine} />;
}

// ── Path Line (generic, for scene paths with optional markers) ──

export function ScenePathLine({
  points,
  color = "#7c3aed",
  showMarkers = true,
}: {
  points: [number, number][];
  color?: string;
  showMarkers?: boolean;
}) {
  const geometry = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.045;
      arr[index * 3 + 2] = z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [points]);

  const line = useMemo(() => {
    const dashedLine = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color, dashSize: 0.14, gapSize: 0.08, scale: 1 }),
    );
    dashedLine.computeLineDistances();
    return dashedLine;
  }, [color, geometry]);

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <group>
      <primitive object={line} />
      {showMarkers && start && (
        <mesh position={[start[0], 0.065, start[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      )}
      {showMarkers && end && (
        <mesh position={[end[0], 0.065, end[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}
    </group>
  );
}
