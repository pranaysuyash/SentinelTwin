"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import type {
  CoverageCellResult,
  DoorNode,
  ObstructionNode,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";
import { DORI_THRESHOLDS } from "@sentineltwin/core";
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

export function SceneWalls({
  walls,
  selectable = true,
  onContextMenu,
}: {
  walls: WallNode[];
  selectable?: boolean;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
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
        const isSelected = selectedNodeIds.includes(wall.id);
        return (
          <group
            key={wall.id}
            position={[cx, wall.heightM / 2, cz]}
          rotation={[0, -angle, 0]}
          onClick={selectable ? (e) => {
            e.stopPropagation();
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
              toggleSelectedNode(wall.id);
              return;
            }
            selectNode(wall.id);
          } : undefined}
          onContextMenu={onContextMenu ? (event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
            onContextMenu(wall.id, event);
          } : undefined}
        >
            <mesh>
            <boxGeometry args={[length, wall.heightM, 0.18]} />
            <meshStandardMaterial
              color={isSelected ? "#93c5fd" : isGlass ? "#dceeff" : "#f0f2f6"}
              transparent={isGlass}
              opacity={isGlass ? 0.22 : isSelected ? 0.96 : 1}
              roughness={isGlass ? 0.08 : 0.65}
              metalness={isGlass ? 0.28 : 0.0}
              emissive={isSelected ? "#1d4ed8" : "#000000"}
              emissiveIntensity={isSelected ? 0.18 : 0}
            />
            </mesh>
            {isSelected && (
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(length * 1.03, wall.heightM * 1.03, 0.22)]} />
                <lineBasicMaterial color="#93c5fd" transparent opacity={0.9} />
              </lineSegments>
            )}
          </group>
        );
      })}
    </>
  );
}

// ── Doors ──

export function SceneDoors({
  doors,
  selectable = true,
  onContextMenu,
}: {
  doors: DoorNode[];
  selectable?: boolean;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  return (
    <>
      {doors.map((door) => {
        const [width, height, thickness] = door.dimensions;
        const isOpen = door.state === "open";
        const isLocked = door.state === "locked";
        const isSelected = selectedNodeIds.includes(door.id);

        return (
        <group
            key={door.id}
          position={door.position}
          onClick={selectable ? (e) => {
            e.stopPropagation();
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
              toggleSelectedNode(door.id);
              return;
            }
            selectNode(door.id);
          } : undefined}
          onContextMenu={onContextMenu ? (event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
            onContextMenu(door.id, event);
          } : undefined}
        >
            <mesh rotation={[0, 0, 0]} castShadow receiveShadow visible={!isOpen}>
              <boxGeometry args={[width, height, Math.max(thickness, 0.08)]} />
              <meshStandardMaterial
                color={isSelected ? "#60a5fa" : isLocked ? "#b45309" : "#8b5e34"}
                roughness={0.72}
                metalness={0.08}
                transparent
                opacity={isSelected ? 0.98 : 0.92}
                emissive={isSelected ? "#1d4ed8" : "#000000"}
                emissiveIntensity={isSelected ? 0.16 : 0}
              />
            </mesh>
            {isSelected && (
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(width * 1.04, height * 1.04, Math.max(thickness, 0.08) * 1.2)]} />
                <lineBasicMaterial color="#93c5fd" transparent opacity={0.88} />
              </lineSegments>
            )}
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

export function SceneWindows({
  windows,
  selectable = true,
  onContextMenu,
}: {
  windows: WindowNode[];
  selectable?: boolean;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  return (
    <>
      {windows.map((window) => {
        const [width, height, thickness] = window.dimensions;
        const isOpen = window.state === "open";
        const isCurtain = window.state === "curtain";
        const isReflective = window.state === "reflective";
        const opacity = isOpen ? 0.1 : isCurtain ? 0.22 : isReflective ? 0.38 : 0.24;
        const isSelected = selectedNodeIds.includes(window.id);

        return (
        <group
            key={window.id}
          position={window.position}
          onClick={selectable ? (e) => {
            e.stopPropagation();
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
              toggleSelectedNode(window.id);
              return;
            }
            selectNode(window.id);
          } : undefined}
          onContextMenu={onContextMenu ? (event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
            onContextMenu(window.id, event);
          } : undefined}
        >
            <mesh castShadow receiveShadow visible={!isOpen}>
            <boxGeometry args={[width, height, Math.max(thickness, 0.05)]} />
            <meshStandardMaterial
              color={isSelected ? "#93c5fd" : isReflective ? "#e5f0ff" : "#cfe5ff"}
              transparent
              opacity={isSelected ? Math.min(0.45, opacity + 0.1) : opacity}
              roughness={isReflective ? 0.05 : 0.15}
              metalness={isReflective ? 0.4 : 0.12}
              emissive={isSelected ? "#1d4ed8" : "#000000"}
              emissiveIntensity={isSelected ? 0.12 : 0}
            />
            </mesh>
            {isSelected && (
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(width * 1.04, height * 1.04, Math.max(thickness, 0.05) * 1.2)]} />
                <lineBasicMaterial color="#93c5fd" transparent opacity={0.88} />
              </lineSegments>
            )}
          </group>
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
  onContextMenu,
}: {
  obstructions: ObstructionNode[];
  selectedId?: string | null;
  /** Optional click handler. If not provided, uses store's selectNode. */
  onSelect?: (id: string) => void;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const storeSelect = useStudioStore((s) => s.selectNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const handleSelect = onSelect ?? storeSelect;

  return (
    <>
      {obstructions.map((obs) => {
        const [w, d, h] = obs.dimensions;
        const isSelected = selectedId === obs.id || selectedNodeIds.includes(obs.id);
        const isShelf = obs.obstructionType === "shelf";
        const color = OBSTRUCTION_COLORS[obs.obstructionType] ?? OBSTRUCTION_COLORS.other;
        const highlightBox = new THREE.BoxGeometry(w * 1.02, h * 1.02, d * 1.02);

        return (
          <group
            key={obs.id}
            position={obs.position}
            rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]}
            onClick={(e) => { e.stopPropagation(); handleSelect(obs.id); }}
            onContextMenu={onContextMenu ? (event) => {
              event.stopPropagation();
              event.nativeEvent.preventDefault();
              onContextMenu(obs.id, event);
            } : undefined}
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
                  <mesh key={i} /* stable order */ position={[0, fraction * h - h / 2, 0]} castShadow>
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

// ── Path Actor (animated figure along waypoints) ──

export function PathActor({ waypoints, currentIndex, progress }: {
  waypoints: [number, number][];
  currentIndex: number;
  progress: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const propsRef = useRef({ waypoints, currentIndex, progress });

  useEffect(() => {
    propsRef.current = { waypoints, currentIndex, progress };
  }, [waypoints, currentIndex, progress]);

  useFrame(() => {
    const { waypoints: wps, currentIndex: idx, progress: prog } = propsRef.current;
    if (!groupRef.current || wps.length < 2) return;

    let x: number, z: number, dx = 0, dz = 0;
    if (idx >= wps.length - 1) {
      x = wps[wps.length - 1]![0];
      z = wps[wps.length - 1]![1];
    } else {
      const a = wps[idx]!;
      const b = wps[Math.min(idx + 1, wps.length - 1)]!;
      dx = b[0] - a[0];
      dz = b[1] - a[1];
      x = a[0] + dx * prog;
      z = a[1] + dz * prog;
    }

    groupRef.current.position.set(x, 0.02, z);
    const angle = Math.atan2(dx, dz);
    groupRef.current.rotation.y = angle;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>
      <mesh position={[-0.14, 0.82, 0]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.03, 0.2, 4, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.14, 0.82, 0]} rotation={[0, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.03, 0.2, 4, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-0.06, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.03, 0.25, 4, 6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.06, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.03, 0.25, 4, 6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.12, 0.28, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// ── Coverage heatmap (instanced mesh) ──
// NOTE: "none" cells are NOT rendered — the tan floor shows through uncovered areas.
// Colors are explicit sRGB-correct values that render vividly with meshBasicMaterial.

const HEATMAP_COLOR_STOPS = [
  { ppm: 0, color: new THREE.Color("#991b1b") },
  { ppm: DORI_THRESHOLDS.detection, color: new THREE.Color("#f97316") },
  { ppm: DORI_THRESHOLDS.observation, color: new THREE.Color("#facc15") },
  { ppm: DORI_THRESHOLDS.recognition, color: new THREE.Color("#22c55e") },
  { ppm: DORI_THRESHOLDS.identification, color: new THREE.Color("#3b82f6") },
] as const;

const TILE_FLOOR_RGB: Record<string, [number, number, number]> = {
  identification: [0.16, 0.44, 0.98],
  recognition: [0.10, 0.78, 0.30],
  observation: [0.98, 0.79, 0.16],
  detection: [0.98, 0.47, 0.12],
  none: [0.56, 0.19, 0.19],
};

function lerpColorRgb(a: THREE.Color, b: THREE.Color, t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped,
  ];
}

function heatmapColorFromPpm(ppm: number): [number, number, number] {
  if (!Number.isFinite(ppm) || ppm <= HEATMAP_COLOR_STOPS[0].ppm) {
    return lerpColorRgb(HEATMAP_COLOR_STOPS[0].color, HEATMAP_COLOR_STOPS[1].color, Math.max(0, ppm / Math.max(1, HEATMAP_COLOR_STOPS[1].ppm)));
  }

  for (let index = 1; index < HEATMAP_COLOR_STOPS.length; index += 1) {
    const prev = HEATMAP_COLOR_STOPS[index - 1];
    const next = HEATMAP_COLOR_STOPS[index];
    if (ppm <= next.ppm) {
      const span = Math.max(1, next.ppm - prev.ppm);
      return lerpColorRgb(prev.color, next.color, (ppm - prev.ppm) / span);
    }
  }

  return lerpColorRgb(HEATMAP_COLOR_STOPS[HEATMAP_COLOR_STOPS.length - 2].color, HEATMAP_COLOR_STOPS[HEATMAP_COLOR_STOPS.length - 1].color, 1);
}

export function CoverageTileFloor({ cells }: { cells: CoverageCellResult[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || cells.length === 0) return;

    cells.forEach((cell, index) => {
      mat.current.setPosition(cell.x, 0.01, cell.z);
      mesh.setMatrixAt(index, mat.current);
      const rgb = cell.quality === "none"
        ? TILE_FLOOR_RGB.none
        : heatmapColorFromPpm(cell.ppm);
      col.current.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.setColorAt(index, col.current);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells]);

  if (cells.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cells.length]} renderOrder={1}>
      <boxGeometry args={[0.24, 0.014, 0.24]} />
      <meshStandardMaterial vertexColors transparent opacity={0.92} roughness={0.95} metalness={0.02} depthWrite={false} />
    </instancedMesh>
  );
}

function fragilityRGB(fragility: number): [number, number, number] {
  // 0 = robust (green), 0.5 = amber, 1 = fragile (red)
  const t = Math.max(0, Math.min(1, fragility));
  if (t < 0.5) {
    // green → amber
    const s = t * 2;
    return [s * 0.97, 0.7 - s * 0.07, 0.09];
  }
  // amber → red
  const s = (t - 0.5) * 2;
  return [0.97, (1 - s) * 0.63, 0.09 * (1 - s)];
}

export function CoverageHeatmapInstanced({
  cells,
  mode = "quality",
  onHoverCell,
  onClearHover,
}: {
  cells: CoverageCellResult[];
  mode?: "quality" | "lighting" | "fragility" | "overlap" | "contribution" | "blindspots";
  onHoverCell?: (cell: CoverageCellResult, event: ThreeEvent<PointerEvent>) => void;
  onClearHover?: () => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  const visibleCells = useMemo(() => {
    if (mode === "fragility") {
      return cells.filter((c) => c.fragility != null && c.quality !== "none");
    }
    return cells;
  }, [cells, mode]);

  const overlapRGB = useCallback((coveringCount: number): [number, number, number] => {
    if (coveringCount >= 3) return [0.23, 0.51, 0.96]; // blue
    if (coveringCount === 2) return [0.13, 0.78, 0.30]; // green
    if (coveringCount === 1) return [0.98, 0.79, 0.16]; // yellow
    return [0.94, 0.27, 0.27]; // red
  }, []);

  const lightingRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    const evaluations = Object.values(cell.cameraEvaluations ?? {});
    const bestEvaluation = evaluations.reduce<(typeof evaluations)[number] | undefined>((best, evaluation) => {
      if (!best) return evaluation;
      const bestScore = (best.lightLevel ?? 0) * (best.visible ? 1 : 0.35) - (best.lightingPenalty ?? 0);
      const evaluationScore = (evaluation.lightLevel ?? 0) * (evaluation.visible ? 1 : 0.35) - (evaluation.lightingPenalty ?? 0);
      return evaluationScore > bestScore ? evaluation : best;
    }, undefined);

    if (!bestEvaluation) return [0.22, 0.24, 0.30];

    const lightLevel = bestEvaluation.lightLevel ?? 0;
    const shadowed = (bestEvaluation.shadowedBy ?? []).length > 0;
    if (shadowed && lightLevel < 0.35) return [0.70, 0.13, 0.13];
    if (lightLevel >= 0.65) return [1.00, 0.88, 0.28];
    if (lightLevel >= 0.35) return [0.97, 0.58, 0.16];
    if (lightLevel >= 0.12) return [0.27, 0.51, 0.96];
    return [0.11, 0.14, 0.22];
  }, []);

  const contributionRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    const evaluations = Object.values(cell.cameraEvaluations ?? {}).filter((evaluation) => evaluation.visible && evaluation.ppm > 0);
    if (evaluations.length === 0) return [0.42, 0.45, 0.51];

    const totalPpm = evaluations.reduce((sum, evaluation) => sum + evaluation.ppm, 0);
    if (totalPpm <= 0) return [0.42, 0.45, 0.51];

    const topPpm = evaluations.reduce((best, evaluation) => Math.max(best, evaluation.ppm), 0);
    const contribution = topPpm / totalPpm;

    if (contribution > 0.75) return [0.23, 0.51, 0.96];
    if (contribution >= 0.5) return [0.13, 0.78, 0.30];
    if (contribution >= 0.25) return [0.98, 0.79, 0.16];
    return [0.42, 0.45, 0.51];
  }, []);

  const lightingAwareQualityRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    const rgb = cell.quality === "none" ? TILE_FLOOR_RGB.none : heatmapColorFromPpm(cell.ppm);
    const evaluations = Object.values(cell.cameraEvaluations ?? {});
    const bestEvaluation = evaluations.reduce<(typeof evaluations)[number] | undefined>((best, evaluation) => {
      if (!best) return evaluation;
      return evaluation.ppm > best.ppm ? evaluation : best;
    }, undefined);

    if (!bestEvaluation) return rgb;

    const lightLevel = bestEvaluation.lightLevel ?? 1;
    const shadowed = (bestEvaluation.shadowedBy ?? []).length > 0;
    const lightingPenalty = bestEvaluation.lightingPenalty ?? 0;

    if (shadowed && lightingPenalty > 0.2) {
      return [rgb[0] * 0.52 + 0.38, rgb[1] * 0.38, rgb[2] * 0.38];
    }

    if (lightLevel < 0.12 && lightingPenalty > 0.5) {
      return [rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.65 + 0.08];
    }

    if ((bestEvaluation.illuminatedBy ?? []).length > 0) {
      return [Math.min(1, rgb[0] * 1.08 + 0.06), Math.min(1, rgb[1] * 1.06 + 0.04), rgb[2] * 0.94];
    }

    return rgb;
  }, []);

  const blindspotRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    if (cell.quality === "none") {
      return [0.60, 0.10, 0.10];
    }
    return [0.13, 0.78, 0.30];
  }, []);

  const heatmapOpacity = mode === "blindspots" ? 0.62 : 0.88;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || visibleCells.length === 0) return;

    visibleCells.forEach((cell, index) => {
      mat.current.setPosition(cell.x, 0.014, cell.z);
      mesh.setMatrixAt(index, mat.current);

      let rgb: [number, number, number];
      if (mode === "fragility" && cell.fragility != null) {
        rgb = fragilityRGB(cell.fragility);
      } else if (mode === "lighting") {
        rgb = lightingRGB(cell);
      } else if (mode === "overlap") {
        rgb = overlapRGB(cell.coveringCameras.length);
      } else if (mode === "contribution") {
        rgb = contributionRGB(cell);
      } else if (mode === "blindspots") {
        rgb = blindspotRGB(cell);
      } else {
        rgb = lightingAwareQualityRGB(cell);
      }

      col.current.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.setColorAt(index, col.current);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visibleCells, mode, blindspotRGB, contributionRGB, lightingAwareQualityRGB, lightingRGB, overlapRGB]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!onHoverCell) return;
    if (typeof event.instanceId !== "number") return;
    const cell = visibleCells[event.instanceId];
    if (!cell) return;
    onHoverCell(cell, event);
  }, [onHoverCell, visibleCells]);

  const clearHover = useCallback(() => {
    onClearHover?.();
  }, [onClearHover]);

  if (visibleCells.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, visibleCells.length]}
      renderOrder={2}
      onPointerMove={handlePointerMove}
      onPointerOut={clearHover}
      onPointerMissed={clearHover}
    >
      <boxGeometry args={[0.28, 0.018, 0.28]} />
      <meshBasicMaterial vertexColors transparent opacity={heatmapOpacity} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Adversarial Path Line ──

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

// ── Privacy Zones ──

function PrivacyZoneMesh({ zone }: { zone: { id: string; label: string; polygon: [number, number][]; restriction: string } }) {
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const isSelected = selectedNodeIds.includes(zone.id);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const pts = zone.polygon;
    if (pts.length < 3) return s;
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i][0], pts[i][1]);
    }
    s.closePath();
    return s;
  }, [zone.polygon]);

  const restrictionColor = zone.restriction === "no_video"
    ? "#ef4444"
    : zone.restriction === "restricted_view"
      ? "#f59e0b"
      : "#8b5cf6";

  const cx = zone.polygon.reduce((sum, [x]) => sum + x, 0) / zone.polygon.length;
  const cz = zone.polygon.reduce((sum, [, z]) => sum + z, 0) / zone.polygon.length;

  return (
    <group>
      {/* Base fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={isSelected ? "#93c5fd" : restrictionColor} transparent opacity={isSelected ? 0.24 : 0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Outline */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={isSelected ? "#93c5fd" : restrictionColor} transparent opacity={isSelected ? 0.88 : 0.5} />
      </lineSegments>
      {/* Label sprite */}
      <PrivacyZoneLabel position={[cx, 0.5, cz]} text={zone.label} color={restrictionColor} />
    </group>
  );
}

function PrivacyZoneLabel({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "bold 14px Inter, system-ui, sans-serif";
    ctx.fillStyle = color.replace("#", "rgba(") + ", 0.7)".replace("rgba(#ef4444", "rgba(239, 68, 68");
    // Simpler approach: use a dark background label
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 22);
    return new THREE.CanvasTexture(canvas);
  }, [text, color]);

  return (
    <sprite position={position} scale={[1.6, 0.2, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

export function ScenePrivacyZones({
  zones,
  onSelect,
  onContextMenu,
}: {
  zones: { id: string; label: string; polygon: [number, number][]; restriction: string }[];
  onSelect?: (id: string) => void;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  return (
    <>
      {zones.map((zone) => (
        <group
          key={zone.id}
          onClick={(event) => {
            event.stopPropagation();
            if (event.shiftKey || event.metaKey || event.ctrlKey) {
              toggleSelectedNode(zone.id);
              return;
            }
            onSelect?.(zone.id);
            if (!onSelect) selectNode(zone.id);
          }}
          onContextMenu={onContextMenu ? (event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
            onContextMenu(zone.id, event);
          } : undefined}
        >
          <PrivacyZoneMesh zone={zone} />
        </group>
      ))}
    </>
  );
}

// ── Path Line (generic, for scene paths with optional markers) ──

export function ScenePathLine({
  points,
  color = "#7c3aed",
  showMarkers = true,
  id,
  onSelect,
  onContextMenu,
}: {
  points: [number, number][];
  color?: string;
  showMarkers?: boolean;
  id?: string;
  onSelect?: (id: string) => void;
  onContextMenu?: (id: string, event: ThreeEvent<any>) => void;
}) {
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const isSelected = Boolean(id && selectedNodeIds.includes(id));
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
      new THREE.LineDashedMaterial({ color: isSelected ? "#f59e0b" : color, dashSize: isSelected ? 0.18 : 0.14, gapSize: isSelected ? 0.06 : 0.08, scale: 1 }),
    );
    dashedLine.computeLineDistances();
    return dashedLine;
  }, [color, geometry, isSelected]);

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        if (id && onSelect) {
          if (event.shiftKey || event.metaKey || event.ctrlKey) {
            toggleSelectedNode(id);
            return;
          }
          onSelect(id);
        } else if (id) {
          if (event.shiftKey || event.metaKey || event.ctrlKey) {
            toggleSelectedNode(id);
          } else {
            selectNode(id);
          }
        }
      }}
      onContextMenu={id && onContextMenu ? (event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu(id, event);
      } : undefined}
    >
      <primitive object={line} />
      {showMarkers && start && (
        <mesh position={[start[0], 0.065, start[1]]} scale={isSelected ? 1.18 : 1}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color={isSelected ? "#fde68a" : "#22c55e"} />
        </mesh>
      )}
      {showMarkers && end && (
        <mesh position={[end[0], 0.065, end[1]]} scale={isSelected ? 1.18 : 1}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}
      {isSelected && start && end && (
        <Html position={[(start[0] + end[0]) / 2, 0.16, (start[1] + end[1]) / 2]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="rounded border border-[#f59e0b]/40 bg-[#1b1205]/88 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#fdba74]">
            Selected path
          </div>
        </Html>
      )}
    </group>
  );
}
