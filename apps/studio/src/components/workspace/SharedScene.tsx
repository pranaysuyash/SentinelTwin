"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

import type {
  CoverageCellResult,
  DoorNode,
  ObstructionNode,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

// ── Environment themes ──

export const ENVIRONMENT_THEMES = {
  day: {
    background: "#0d1420",   // slightly brighter dark blue (reference background)
    ambient: 2.2,            // bright enough to fully illuminate white walls
    hemisphere: 1.2,
    directional: 2.2,
    fill: 1.2,
  },
  dusk: {
    background: "#090b12",
    ambient: 0.7,
    hemisphere: 0.55,
    directional: 1.3,
    fill: 0.55,
  },
  night: {
    background: "#06080d",
    ambient: 0.4,
    hemisphere: 0.35,
    directional: 0.9,
    fill: 0.4,
  },
} as const;

export type EnvironmentTheme = (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES];

// ── Lighting ──

export function SceneLighting({ theme }: { theme: EnvironmentTheme }) {
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, 22, 44]} />
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight groundColor="#1a2030" color="#e8f0ff" intensity={theme.hemisphere} />
      {/* Main key light — no shadows to prevent dark corners */}
      <directionalLight
        position={[10, 16, 10]}
        intensity={theme.directional}
        color="#f5f8ff"
        castShadow={false}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-8, 10, -10]} intensity={theme.fill} color="#c8d8ff" />
      {/* Warm ceiling point lights spread across the room */}
      <pointLight position={[2.5, 2.8, 1.8]} intensity={2.5} distance={10} color="#fff4d0" />
      <pointLight position={[7.5, 2.8, 5.5]} intensity={2.5} distance={10} color="#fff4d0" />
      <pointLight position={[5.0, 2.8, 3.5]} intensity={2.0} distance={10} color="#fff8e8" />
      {/* Extra fill from below */}
      <pointLight position={[5.0, 0.5, 3.5]} intensity={0.6} distance={8} color="#e8ddd0" />
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.0015, depth / 2]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#ede5d8" roughness={0.85} />
      </mesh>
      {showGrid && (
        <gridHelper
          args={[Math.max(width, depth) + 1.5, (Math.max(width, depth) + 2) * 4, "#c8c0b4", "#d8d0c8"]}
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
          <mesh key={wall.id} position={[cx, wall.heightM / 2, cz]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[length, wall.heightM, 0.18]} />
            <meshStandardMaterial
              color={isGlass ? "#dceeff" : "#f0f2f6"}
              transparent={isGlass}
              opacity={isGlass ? 0.22 : 1}
              roughness={isGlass ? 0.08 : 0.65}
              metalness={isGlass ? 0.28 : 0.0}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ── Doors ──

export function SceneDoors({ doors }: { doors: DoorNode[] }) {
  return (
    <>
      {doors.map((door) => {
        const [width, height, thickness] = door.dimensions;
        const isOpen = door.state === "open";
        const isLocked = door.state === "locked";

        return (
          <group key={door.id} position={door.position}>
            <mesh rotation={[0, 0, 0]} castShadow receiveShadow visible={!isOpen}>
              <boxGeometry args={[width, height, Math.max(thickness, 0.08)]} />
              <meshStandardMaterial
                color={isLocked ? "#b45309" : "#8b5e34"}
                roughness={0.72}
                metalness={0.08}
                transparent
                opacity={0.92}
              />
            </mesh>
            {isOpen && (
              <mesh position={[width * 0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
                <boxGeometry args={[thickness, height, width]} />
                <meshStandardMaterial color="#6b7280" roughness={0.55} metalness={0.1} transparent opacity={0.35} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

// ── Windows ──

export function SceneWindows({ windows }: { windows: WindowNode[] }) {
  return (
    <>
      {windows.map((window) => {
        const [width, height, thickness] = window.dimensions;
        const isOpen = window.state === "open";
        const isCurtain = window.state === "curtain";
        const isReflective = window.state === "reflective";
        const opacity = isOpen ? 0.1 : isCurtain ? 0.22 : isReflective ? 0.38 : 0.24;

        return (
          <mesh key={window.id} position={window.position} castShadow receiveShadow visible={!isOpen}>
            <boxGeometry args={[width, height, Math.max(thickness, 0.05)]} />
            <meshStandardMaterial
              color={isReflective ? "#e5f0ff" : "#cfe5ff"}
              transparent
              opacity={opacity}
              roughness={isReflective ? 0.05 : 0.15}
              metalness={isReflective ? 0.4 : 0.12}
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
// NOTE: "none" cells are NOT rendered — the tan floor shows through uncovered areas.
// Colors are explicit sRGB-correct values that render vividly with meshBasicMaterial.

const HEATMAP_QUALITY_RGB: Record<string, [number, number, number]> = {
  // Using setRGB with pre-computed linear values so they render vividly
  // These are chosen to be bright and saturated
  identification: [0.12, 0.35, 1.0],   // vivid blue
  recognition:    [0.05, 0.80, 0.20],  // vivid green
  observation:    [1.00, 0.75, 0.00],  // vivid amber/yellow
  detection:      [1.00, 0.35, 0.00],  // vivid orange
  none:           [0.85, 0.05, 0.05],  // vivid red (used only when explicitly shown)
};

export function CoverageHeatmapInstanced({ cells }: { cells: CoverageCellResult[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  // Only render cells that have actual coverage (skip "none" — let the floor show)
  const visibleCells = useMemo(
    () => cells.filter((c) => c.quality !== "none"),
    [cells],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || visibleCells.length === 0) return;

    visibleCells.forEach((cell, index) => {
      mat.current.setPosition(cell.x, 0.014, cell.z);
      mesh.setMatrixAt(index, mat.current);
      const rgb = HEATMAP_QUALITY_RGB[cell.quality] ?? HEATMAP_QUALITY_RGB.none;
      col.current.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.setColorAt(index, col.current);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visibleCells]);

  if (visibleCells.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, visibleCells.length]} renderOrder={2}>
      <boxGeometry args={[0.28, 0.018, 0.28]} />
      <meshBasicMaterial vertexColors transparent opacity={0.88} depthWrite={false} />
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

// ── Coverage-quality colored path segments ──
// Each segment is colored by the DORI quality at its start waypoint.

const QUALITY_SEGMENT_COLORS: Record<string, string> = {
  identification: "#3b82f6",
  recognition:    "#22c55e",
  observation:    "#eab308",
  detection:      "#f97316",
  none:           "#ef4444",
};

export function CoverageSegmentPath({ waypoints }: { waypoints: { position: [number, number]; detectionQuality: string }[] }) {
  // Build individual line segments via useMemo — avoid creating THREE objects on every render
  // Early return after useMemo to comply with Rules of Hooks.
  const segments = useMemo(() => {
    if (waypoints.length < 2) return [];
    return waypoints.slice(0, -1).map((curr, i) => {
      const next = waypoints[i + 1];
      const color = QUALITY_SEGMENT_COLORS[curr.detectionQuality] ?? "#ef4444";
      const arr = new Float32Array([
        curr.position[0], 0.045, curr.position[1],
        next.position[0], 0.045, next.position[1],
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
      return { line, key: i };
    });
  }, [waypoints]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg) => (
        <primitive key={seg.key} object={seg.line} />
      ))}
    </>
  );
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
