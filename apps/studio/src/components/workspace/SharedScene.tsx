"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import type {
  DoriQuality,
  CoverageCellResult,
  DoorNode,
  ObstructionNode,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";
import { DORI_THRESHOLDS } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";
import { SceneHtml } from "@/components/shared/SceneHtml";
import { isPrimaryMouseEvent } from "@/components/workspace/workspace-canvas-utils";

type HeatmapMode = "quality" | "lighting" | "fragility" | "overlap" | "contribution" | "blindspots";

type CoverageSegmentWaypoint = {
  position: [number, number];
  detectionQuality: DoriQuality;
};

type PrivacyZone = {
  id: string;
  label: string;
  polygon: [number, number][];
  restriction: "no_video" | "restricted_view" | "masked_area" | "blindspot_required";
  nodeType?: string;
  source?: string;
  reviewStatus?: string;
  sourceTrace?: string;
  geometryValidity?: string;
  regulation?: string;
};

type CameraEvaluation = NonNullable<CoverageCellResult["cameraEvaluations"]>[string];

type SceneNodeInteractionOptions = {
  nodeId: string;
  selectable: boolean;
  selectNode: (nodeId: string) => void;
  toggleSelectedNode: (nodeId: string) => void;
  onSelect?: (nodeId: string) => void;
  onContextMenu?: (nodeId: string, event: ThreeEvent<MouseEvent>) => void;
};

export type Point2 = [number, number];
export type Point3 = [number, number, number];
export type SceneLightingOverride = Partial<EnvironmentTheme & { intensityScale: number }>;

export const SCENE_LIGHT_PRESETS = {
  day: "day",
  dusk: "dusk",
  night: "night",
} as const;

export function resolveSafeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function clampPositiveNumber(value: unknown, min = 0, fallback = 0): number {
  return Math.max(min, resolveSafeNumber(value, fallback));
}

export function sanitizePoint2D(point: unknown, fallback: Point2 = [0, 0]): Point2 {
  if (!Array.isArray(point) || point.length < 2) return fallback;
  return [resolveSafeNumber(point[0], fallback[0]), resolveSafeNumber(point[1], fallback[1])];
}

export function sanitizePoint3D(point: unknown, fallback: Point3 = [0, 0, 0]): Point3 {
  if (!Array.isArray(point) || point.length < 3) return fallback;
  return [
    resolveSafeNumber(point[0], fallback[0]),
    resolveSafeNumber(point[1], fallback[1]),
    resolveSafeNumber(point[2], fallback[2]),
  ];
}

function isFinitePoint2(point: unknown): point is Point2 {
  return Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

export function sanitizeDimensions(values: unknown, fallback: Point3 = [1, 1, 1]): Point3 {
  if (!Array.isArray(values) || values.length < 3) return fallback;
  return [
    clampPositiveNumber(values[0], 0.02, fallback[0]),
    clampPositiveNumber(values[1], 0.02, fallback[1]),
    clampPositiveNumber(values[2], 0.02, fallback[2]),
  ];
}

export function sanitizeScenePath(points: ReadonlyArray<unknown>): Point2[] {
  return points
    .filter(isFinitePoint2)
    .map((point) => sanitizePoint2D(point));
}

function resolveTheme(theme: EnvironmentTheme | keyof typeof SCENE_LIGHT_PRESETS): EnvironmentTheme {
  const fallbackTheme = ENVIRONMENT_THEMES.day;
  if (typeof theme === "string") {
    return ENVIRONMENT_THEMES[theme] ?? fallbackTheme;
  }
  return theme ?? fallbackTheme;
}

function useSelectedNodeIdSet(): Set<string> {
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  return useMemo(() => new Set(selectedNodeIds.filter((nodeId) => typeof nodeId === "string")), [selectedNodeIds]);
}

function makeSceneNodeHandlers({
  nodeId,
  selectable,
  selectNode,
  toggleSelectedNode,
  onSelect,
  onContextMenu,
}: SceneNodeInteractionOptions) {
  if (!selectable) {
    return {};
  }

  const handlePointerDown = (event: ThreeEvent<MouseEvent>) => {
    if (!isPrimaryMouseEvent(event)) return;
    // Placement tools own the pointer: walls/doors/windows must not swallow
    // placement clicks while the user is placing objects.
    const activeTool = useStudioStore.getState().activeTool;
    if (activeTool !== "select" && activeTool !== "measure" && activeTool !== "comment") return;
    event.stopPropagation();
    const isRangeSelect = event.shiftKey || event.metaKey || event.ctrlKey;
    if (isRangeSelect) {
      toggleSelectedNode(nodeId);
      return;
    }
    if (onSelect) {
      onSelect(nodeId);
      return;
    }
    selectNode(nodeId);
  };

  const handleContextMenu = onContextMenu
    ? (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      event.nativeEvent.preventDefault();
      onContextMenu(nodeId, event);
    }
    : undefined;

  return {
    onPointerDown: handlePointerDown,
    onContextMenu: handleContextMenu,
  };
}

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

const WALL_MATERIAL = {
  selected: "#93c5fd",
  glass: "#dceeff",
  solid: "#f0f2f6",
};

const DOOR_MATERIAL = {
  selected: "#60a5fa",
  locked: "#b45309",
  default: "#8b5e34",
};

const WINDOW_MATERIAL = {
  selected: "#93c5fd",
  reflective: "#e5f0ff",
  default: "#cfe5ff",
};

// ── Lighting ──

export function SceneLighting({ theme, intensityScale = 1, overrides }: {
  theme: EnvironmentTheme | keyof typeof SCENE_LIGHT_PRESETS;
  intensityScale?: number;
  overrides?: SceneLightingOverride;
}) {
  const safeTheme = resolveTheme(theme);
  const safeScale = resolveSafeNumber(intensityScale, 1);
  const appliedTheme = {
    background: typeof overrides?.background === "string" ? overrides.background : safeTheme.background,
    ambient: clampPositiveNumber((overrides?.ambient ?? safeTheme.ambient) * safeScale, 0, safeTheme.ambient * safeScale),
    hemisphere: clampPositiveNumber((overrides?.hemisphere ?? safeTheme.hemisphere) * safeScale, 0, safeTheme.hemisphere * safeScale),
    directional: clampPositiveNumber((overrides?.directional ?? safeTheme.directional) * safeScale, 0, safeTheme.directional * safeScale),
    fill: clampPositiveNumber((overrides?.fill ?? safeTheme.fill) * safeScale, 0, safeTheme.fill * safeScale),
  };
  return (
    <>
      <color attach="background" args={[appliedTheme.background]} />
      <fog attach="fog" args={[appliedTheme.background, 22, 44]} />
      <ambientLight intensity={appliedTheme.ambient} />
      <hemisphereLight groundColor="#1a2030" color="#e8f0ff" intensity={appliedTheme.hemisphere} />
      {/* Main key light — no shadows to prevent dark corners */}
      <directionalLight
        position={[10, 16, 10]}
        intensity={appliedTheme.directional}
        color="#f5f8ff"
        castShadow={false}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-8, 10, -10]} intensity={appliedTheme.fill} color="#c8d8ff" />
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
  gridCellSize = 0.25,
  gridSectionsMultiplier = 4,
  gridColor = "#c8c0b4",
  gridSectionColor = "#d8d0c8",
}: {
  width: number;
  depth: number;
  showGrid?: boolean;
  gridCellSize?: number;
  gridSectionsMultiplier?: number;
  gridColor?: string;
  gridSectionColor?: string;
}) {
  const safeWidth = clampPositiveNumber(width, 0.1, 0.1);
  const safeDepth = clampPositiveNumber(depth, 0.1, 0.1);
  const safeCellSize = clampPositiveNumber(gridCellSize, 0.05, 0.25);
  const safeSectionsMultiplier = Math.max(1, Math.round(resolveSafeNumber(gridSectionsMultiplier, 4)));
  const maxDimension = Math.max(safeWidth, safeDepth);
  const gridDivisions = Math.max(2, Math.max(1, Math.floor((maxDimension + 2) / safeCellSize)) * safeSectionsMultiplier);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[safeWidth / 2, -0.0015, safeDepth / 2]}>
        <planeGeometry args={[safeWidth, safeDepth]} />
        <meshStandardMaterial color="#ede5d8" roughness={0.85} />
      </mesh>
      {showGrid && (
        <gridHelper
          args={[Math.max(maxDimension, 0.2) + 1.5, gridDivisions, gridColor, gridSectionColor]}
          position={[safeWidth / 2, 0.002, safeDepth / 2]}
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
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIdSet = useSelectedNodeIdSet();
  return (
    <>
      {walls.map((wall) => {
        const start = sanitizePoint2D(wall.start);
        const end = sanitizePoint2D(wall.end);
        if (!start || !end) return null;

        const dx = end[0] - start[0];
        const dz = end[1] - start[1];
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length < 0.001) return null;
        const angle = Math.atan2(dz, dx);
        const cx = (start[0] + end[0]) / 2;
        const cz = (start[1] + end[1]) / 2;
        const isGlass = wall.material === "glass";
        const isSelected = selectedNodeIdSet.has(wall.id);
        const interactionHandlers = makeSceneNodeHandlers({
          nodeId: wall.id,
          selectable,
          selectNode,
          toggleSelectedNode,
          onContextMenu,
        });
        return (
          <group
            key={wall.id}
            position={[cx, clampPositiveNumber(wall.heightM, 0.02, 1) / 2, cz]}
            rotation={[0, -angle, 0]}
            {...interactionHandlers}
          >
            <mesh>
            <boxGeometry args={[length, clampPositiveNumber(wall.heightM, 0.02, 1), 0.18]} />
            <meshStandardMaterial
              color={isSelected ? WALL_MATERIAL.selected : isGlass ? WALL_MATERIAL.glass : WALL_MATERIAL.solid}
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
                <edgesGeometry args={[new THREE.BoxGeometry(length * 1.03, clampPositiveNumber(wall.heightM, 0.02, 1) * 1.03, 0.22)]} />
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
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIdSet = useSelectedNodeIdSet();
  return (
    <>
      {doors.map((door) => {
        const [width, height, thickness] = sanitizeDimensions(door.dimensions, [0.9, 2.1, 0.1]);
        const isOpen = door.state === "open";
        const isLocked = door.state === "locked";
        const isSelected = selectedNodeIdSet.has(door.id);
        const interactionHandlers = makeSceneNodeHandlers({
          nodeId: door.id,
          selectable,
          selectNode,
          toggleSelectedNode,
          onContextMenu,
        });

        return (
        <group
            key={door.id}
          position={sanitizePoint3D(door.position, [width / 2, height / 2, thickness / 2])}
            {...interactionHandlers}
        >
            <mesh rotation={[0, 0, 0]} castShadow receiveShadow visible={!isOpen}>
              <boxGeometry args={[width, height, Math.max(thickness, 0.08)]} />
              <meshStandardMaterial
                color={isSelected ? DOOR_MATERIAL.selected : isLocked ? DOOR_MATERIAL.locked : DOOR_MATERIAL.default}
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
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIdSet = useSelectedNodeIdSet();
  return (
    <>
      {windows.map((window) => {
        const [width, height, thickness] = sanitizeDimensions(window.dimensions, [1.2, 1.2, 0.08]);
        const isOpen = window.state === "open";
        const isCurtain = window.state === "curtain";
        const isReflective = window.state === "reflective";
        const opacity = isOpen ? 0.1 : isCurtain ? 0.22 : isReflective ? 0.38 : 0.24;
        const isSelected = selectedNodeIdSet.has(window.id);
        const interactionHandlers = makeSceneNodeHandlers({
          nodeId: window.id,
          selectable,
          selectNode,
          toggleSelectedNode,
          onContextMenu,
        });

        return (
        <group
            key={window.id}
          position={sanitizePoint3D(window.position, [width / 2, height / 2, 0])}
            {...interactionHandlers}
        >
            <mesh castShadow receiveShadow visible={!isOpen}>
            <boxGeometry args={[width, height, Math.max(thickness, 0.05)]} />
            <meshStandardMaterial
              color={isSelected ? WINDOW_MATERIAL.selected : isReflective ? WINDOW_MATERIAL.reflective : WINDOW_MATERIAL.default}
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
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const storeSelect = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectedNodeIdSet = useSelectedNodeIdSet();

  return (
    <>
      {obstructions.map((obs) => {
        const [w, d, h] = sanitizeDimensions(obs.dimensions, [1.2, 1, 1]);
        const isSelected = selectedId === obs.id || selectedNodeIdSet.has(obs.id);
        const isShelf = obs.obstructionType === "shelf";
        const color = OBSTRUCTION_COLORS[obs.obstructionType] ?? OBSTRUCTION_COLORS.other;
        const highlightBox = new THREE.BoxGeometry(w * 1.02, h * 1.02, d * 1.02);
        const placementToolActive = () => {
          const activeTool = useStudioStore.getState().activeTool;
          return activeTool !== "select" && activeTool !== "measure" && activeTool !== "comment";
        };

        const handleSelect = (id: string) => {
          const selectTarget = onSelect ?? storeSelect;
          selectTarget(id);
        };

        const pointerSelectHandler = (event: ThreeEvent<MouseEvent>) => {
          if (!isPrimaryMouseEvent(event)) return;
          const isRangeSelect = event.shiftKey || event.metaKey || event.ctrlKey;
          if (isRangeSelect) {
            toggleSelectedNode(obs.id);
          }
        };

        const interactionHandlers = {
          onPointerDown: pointerSelectHandler,
          onContextMenu: onContextMenu
            ? (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              event.nativeEvent.preventDefault();
              onContextMenu(obs.id, event);
            }
            : undefined,
        };

        return (
          <group
            key={obs.id}
            position={sanitizePoint3D(obs.position, [w / 2, h / 2, d / 2])}
            rotation={[0, (resolveSafeNumber(obs.rotationYDeg, 0) * Math.PI) / 180, 0]}
            onClick={(e) => {
              if (placementToolActive()) return;
              e.stopPropagation();
              handleSelect(obs.id);
            }}
            {...interactionHandlers}
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
  const safeWaypoints = sanitizeScenePath(waypoints);
  const propsRef = useRef({ waypoints: safeWaypoints, currentIndex, progress });
  const directionRef = useRef(0);

  useEffect(() => {
    propsRef.current = { waypoints: safeWaypoints, currentIndex: Math.max(0, currentIndex), progress };
  }, [safeWaypoints, currentIndex, progress]);

  useFrame(() => {
    const { waypoints: wps, currentIndex: idx, progress: prog } = propsRef.current;
    if (!groupRef.current || wps.length < 2) return;

    const segmentIndex = Math.min(idx, wps.length - 2);
    if (segmentIndex < 0) {
      groupRef.current.position.set(wps[0]![0], 0.02, wps[0]![1]);
      groupRef.current.rotation.y = 0;
      return;
    }

    const clampedProg = Math.max(0, Math.min(1, prog));
    let x: number, z: number, dx = 0, dz = 0;
    if (segmentIndex >= wps.length - 1) {
      x = wps[wps.length - 1]![0];
      z = wps[wps.length - 1]![1];
    } else {
      const a = wps[segmentIndex]!;
      const b = wps[Math.min(segmentIndex + 1, wps.length - 1)]!;
      dx = b[0] - a[0];
      dz = b[1] - a[1];
      x = a[0] + dx * clampedProg;
      z = a[1] + dz * clampedProg;
      const segmentLength = Math.hypot(dx, dz);
      if (segmentLength > 0.0001) {
        directionRef.current = Math.atan2(dx, dz);
      }
    }

    groupRef.current.position.set(x, 0.02, z);
    groupRef.current.rotation.y = directionRef.current;
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

type LegacyDoriQuality = "identification" | "recognition" | "observation" | "detection" | "none";
const TILE_FLOOR_RGB: Record<LegacyDoriQuality, [number, number, number]> = {
  identification: [0.16, 0.44, 0.98],
  recognition: [0.10, 0.78, 0.30],
  observation: [0.98, 0.79, 0.16],
  detection: [0.98, 0.47, 0.12],
  none: [0.56, 0.19, 0.19],
};

function qualityToBaseHeatmapColor(quality: DoriQuality): [number, number, number] {
  switch (quality) {
    case "identification":
      return TILE_FLOOR_RGB.identification;
    case "recognition":
      return TILE_FLOOR_RGB.recognition;
    case "observation":
      return TILE_FLOOR_RGB.observation;
    case "detection":
      return TILE_FLOOR_RGB.detection;
    default:
      return TILE_FLOOR_RGB.none;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampPpm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function lerpColorRgb(a: THREE.Color, b: THREE.Color, t: number): [number, number, number] {
  const clamped = clamp01(t);
  return [
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped,
  ];
}

function heatmapColorFromPpm(ppm: number): [number, number, number] {
  const clampedPpm = clampPpm(ppm);
  if (clampedPpm <= HEATMAP_COLOR_STOPS[0].ppm) {
    return lerpColorRgb(HEATMAP_COLOR_STOPS[0].color, HEATMAP_COLOR_STOPS[1].color, clampedPpm / Math.max(1, HEATMAP_COLOR_STOPS[1].ppm));
  }

  for (let index = 1; index < HEATMAP_COLOR_STOPS.length; index += 1) {
    const prev = HEATMAP_COLOR_STOPS[index - 1];
    const next = HEATMAP_COLOR_STOPS[index];
    if (clampedPpm <= next.ppm) {
      const span = Math.max(1, next.ppm - prev.ppm);
      return lerpColorRgb(prev.color, next.color, (clampedPpm - prev.ppm) / span);
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
    if (!mesh) return;
    if (cells.length === 0) {
      mesh.count = 0;
      return;
    }
    mesh.count = cells.length;

    cells.forEach((cell, index) => {
      if (!Number.isFinite(cell.x) || !Number.isFinite(cell.z)) return;
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

function getCellEvaluations(cell: CoverageCellResult): CameraEvaluation[] {
  return Object.values(cell.cameraEvaluations ?? {});
}

function getBestVisibleEvaluation(cell: CoverageCellResult): CameraEvaluation | undefined {
  return getCellEvaluations(cell).reduce<CameraEvaluation | undefined>((best, evaluation) => {
    if (!best) return evaluation;
    if (!evaluation.visible && best.visible) return best;
    if (evaluation.visible && !best.visible) return evaluation;
    if ((evaluation.lightLevel ?? 0) * (evaluation.visible ? 1 : 0.35) - (evaluation.lightingPenalty ?? 0)
      > (best.lightLevel ?? 0) * (best.visible ? 1 : 0.35) - (best.lightingPenalty ?? 0)) {
      return evaluation;
    }
    return best;
  }, undefined);
}

export function CoverageHeatmapInstanced({
  cells,
  mode = "quality",
  onHoverCell,
  onClearHover,
}: {
  cells: CoverageCellResult[];
  mode?: HeatmapMode;
  onHoverCell?: (cell: CoverageCellResult, event: ThreeEvent<PointerEvent>) => void;
  onClearHover?: () => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  const visibleCells = useMemo(() => {
    const safeCells = cells.filter((cell) => Number.isFinite(cell.x) && Number.isFinite(cell.z));
    if (mode === "fragility") {
      return safeCells.filter((c) => c.fragility != null && Number.isFinite(c.fragility) && c.quality !== "none");
    }
    return safeCells;
  }, [cells, mode]);

  const overlapRGB = useCallback((coveringCount: number): [number, number, number] => {
    const safeCount = Number.isFinite(coveringCount) ? Math.max(0, Math.round(coveringCount)) : 0;
    if (safeCount >= 3) return [0.23, 0.51, 0.96]; // blue
    if (safeCount === 2) return [0.13, 0.78, 0.30]; // green
    if (safeCount === 1) return [0.98, 0.79, 0.16]; // yellow
    return [0.94, 0.27, 0.27]; // red
  }, []);

  const lightingRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    const bestEvaluation = getBestVisibleEvaluation(cell);

    if (!bestEvaluation) return [0.22, 0.24, 0.30];

    const lightLevel = bestEvaluation.lightLevel ?? 0;
    const shadowed = Array.isArray(bestEvaluation.shadowedBy) && bestEvaluation.shadowedBy.length > 0;
    if (shadowed && lightLevel < 0.35) return [0.70, 0.13, 0.13];
    if (lightLevel >= 0.65) return [1.00, 0.88, 0.28];
    if (lightLevel >= 0.35) return [0.97, 0.58, 0.16];
    if (lightLevel >= 0.12) return [0.27, 0.51, 0.96];
    return [0.11, 0.14, 0.22];
  }, []);

  const contributionRGB = useCallback((cell: CoverageCellResult): [number, number, number] => {
    const evaluations = getCellEvaluations(cell)
      .filter((evaluation) => evaluation.visible && Number.isFinite(evaluation.ppm) && evaluation.ppm > 0);
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
    const rgb = qualityToBaseHeatmapColor(cell.quality);
    const evaluations = getCellEvaluations(cell);
    const bestEvaluation = evaluations.reduce<(typeof evaluations)[number] | undefined>((best, evaluation) => {
      if (!best) return evaluation;
      return evaluation.ppm > best.ppm ? evaluation : best;
    }, undefined);

    if (!bestEvaluation) return rgb;

    const lightLevel = bestEvaluation.lightLevel ?? 1;
    const shadowed = (bestEvaluation.shadowedBy ?? []).length > 0;
    const lightingPenalty = bestEvaluation.lightingPenalty ?? 0;

    if (shadowed && Number.isFinite(lightingPenalty) && lightingPenalty > 0.2) {
      return [rgb[0] * 0.52 + 0.38, rgb[1] * 0.38, rgb[2] * 0.38];
    }

    if (lightLevel < 0.12 && Number.isFinite(lightingPenalty) && lightingPenalty > 0.5) {
      return [rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.65 + 0.08];
    }

    if (Array.isArray(bestEvaluation.illuminatedBy) && bestEvaluation.illuminatedBy.length > 0) {
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
  const hoveredCellIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (visibleCells.length === 0) {
      mesh.count = 0;
      return;
    }
    mesh.count = visibleCells.length;

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
    if (hoveredCellIndexRef.current === event.instanceId) return;
    hoveredCellIndexRef.current = event.instanceId;
    const cell = visibleCells[event.instanceId];
    if (!cell) return;
    onHoverCell(cell, event);
  }, [onHoverCell, visibleCells]);

  const clearHover = useCallback(() => {
    hoveredCellIndexRef.current = null;
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

const QUALITY_SEGMENT_COLORS: Partial<Record<DoriQuality, string>> = {
  identification: "#3b82f6",
  recognition:    "#22c55e",
  observation:    "#eab308",
  detection:      "#f97316",
  none:           "#ef4444",
};

type LineSegment = { line: THREE.Line; key: number };

export function CoverageSegmentPath({ waypoints }: { waypoints: CoverageSegmentWaypoint[] }) {
  const segments = useMemo((): LineSegment[] => {
    const safeWaypoints = waypoints.filter((waypoint) => sanitizePoint2D(waypoint.position).every(Number.isFinite));
    if (safeWaypoints.length < 2) return [];
    const result: LineSegment[] = [];
    safeWaypoints.slice(0, -1).forEach((curr, i) => {
      const next = safeWaypoints[i + 1];
      if (!next) return;
      const color = QUALITY_SEGMENT_COLORS[curr.detectionQuality] ?? "#ef4444";
      const arr = new Float32Array([
        curr.position[0], 0.045, curr.position[1],
        next.position[0], 0.045, next.position[1],
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
      result.push({ line, key: i });
    });
    return result;
  }, [waypoints]);

  useEffect(() => {
    return () => {
      segments.forEach(({ line }) => {
        if (line.geometry) line.geometry.dispose();
        if (line.material instanceof THREE.Material) line.material.dispose();
      });
    };
  }, [segments]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg) => (
        <primitive key={seg.key} object={seg.line} />
      ))}
    </>
  );
}

// ── Crowd Chokepoint Overlay ──
// Renders top-down circles at positions where crowd density statistically occludes
// a covered camera view. The brighter/more opaque the ring, the higher the occlusion
// probability at that spot.

export type CrowdChokepoint = {
  x: number;
  z: number;
  occlusionProbability: number; // 0–1
};

// Reused per-frame scratch objects — allocated once, never inside render loops
const _cpPos = new THREE.Vector3();
const _cpQuat = new THREE.Quaternion();
const _cpScale = new THREE.Vector3();
// No rotation: CylinderGeometry is already horizontal (Y-axis up) so the ring
// appears flat on the floor without any quaternion rotation.
_cpQuat.identity();

export function CrowdChokepointOverlay({ chokepoints }: { chokepoints: CrowdChokepoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const col = useRef(new THREE.Color());

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = chokepoints.length;
    chokepoints.forEach((cp, i) => {
      // Scale ring radius with occlusion probability so highest-risk spots are biggest
      const scale = 0.18 + cp.occlusionProbability * 0.22;
      _cpPos.set(cp.x, 0.03, cp.z);
      _cpScale.set(scale, 1, scale);
      const mat = new THREE.Matrix4();
      mat.compose(_cpPos, _cpQuat, _cpScale);
      mesh.setMatrixAt(i, mat);
      // Amber at P=0.4, deep red at P=1.0
      const t = Math.min(1, Math.max(0, (cp.occlusionProbability - 0.4) / 0.6));
      col.current.setRGB(1, 0.55 - t * 0.37, 0.08 - t * 0.05);
      mesh.setColorAt(i, col.current);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [chokepoints]);

  if (chokepoints.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(1, chokepoints.length)]} renderOrder={3}>
      {/* Open cylinder = flat horizontal ring. radiusTop=radiusBottom=1, very thin height, openEnded=true */}
      <cylinderGeometry args={[1, 1, 0.04, 32, 1, true]} />
      <meshBasicMaterial vertexColors transparent opacity={0.78} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ── Privacy Zones ──

function PrivacyZoneMesh({ zone }: { zone: PrivacyZone }) {
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const isSelected = useMemo(() => {
    const selectedNodeIdSet = new Set(selectedNodeIds);
    return selectedNodeIdSet.has(zone.id);
  }, [selectedNodeIds, zone.id]);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const pts = zone.polygon.filter((point) => sanitizePoint2D(point).every(Number.isFinite));
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

  const safePolygon = zone.polygon.filter((point) => sanitizePoint2D(point).every(Number.isFinite));
  const cx = safePolygon.length ? safePolygon.reduce((sum, [x]) => sum + x, 0) / safePolygon.length : 0;
  const cz = safePolygon.length ? safePolygon.reduce((sum, [, z]) => sum + z, 0) / safePolygon.length : 0;

  if (safePolygon.length < 3) {
    return null;
  }
  const safeCx = Number.isFinite(cx) ? cx : 0;
  const safeCz = Number.isFinite(cz) ? cz : 0;

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
      <PrivacyZoneLabel position={[safeCx, 0.5, safeCz]} text={zone.label} color={restrictionColor} />
    </group>
  );
}

function PrivacyZoneLabel({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const width = Math.max(240, text.length * 11 + 72);
    const height = 48;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 14px Arial, Helvetica, sans-serif";
    const sanitizedColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : "#94a3b8";
    ctx.fillStyle = "rgba(2, 6, 23, 0.52)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    ctx.strokeStyle = sanitizedColor;
    ctx.lineWidth = 1;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [text, color]);

  useEffect(() => {
    if (!texture) return;
    return () => {
      texture.dispose();
    };
  }, [texture]);

  if (!texture) return null;

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
  zones: PrivacyZone[];
  onSelect?: (id: string) => void;
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  return (
    <>
      {zones.map((zone) => (
        <group key={zone.id} {...makeSceneNodeHandlers({
          nodeId: zone.id,
          selectable: true,
          selectNode,
          toggleSelectedNode,
          onSelect,
          onContextMenu,
        })}>
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
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeIdSet = useSelectedNodeIdSet();
  const isSelected = Boolean(id && selectedNodeIdSet.has(id));
  const safePoints = sanitizeScenePath(points);
  if (safePoints.length < 2) {
    return null;
  }
  const geometry = useMemo(() => {
    const arr = new Float32Array(safePoints.length * 3);
    safePoints.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.045;
      arr[index * 3 + 2] = z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [safePoints]);

  const line = useMemo(() => {
    const dashedLine = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: isSelected ? "#f59e0b" : color, dashSize: isSelected ? 0.18 : 0.14, gapSize: isSelected ? 0.06 : 0.08, scale: 1 }),
    );
    dashedLine.computeLineDistances();
    return dashedLine;
  }, [color, geometry, isSelected]);

  useEffect(() => () => {
    line.geometry.dispose();
    if (line.material instanceof THREE.Material) {
      line.material.dispose();
    }
  }, [line]);

  const start = safePoints[0];
  const end = safePoints[safePoints.length - 1];

  return (
    <group
      {...(id
        ? makeSceneNodeHandlers({
          nodeId: id,
          selectable: true,
          selectNode,
          toggleSelectedNode,
          onSelect,
          onContextMenu,
        })
        : {})}
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
          <SceneHtml position={[(start[0] + end[0]) / 2, 0.16, (start[1] + end[1]) / 2]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
            <div className="rounded border border-[#f59e0b]/40 bg-[#1b1205]/88 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#fdba74]">
              Selected path
            </div>
        </SceneHtml>
      )}
    </group>
  );
}
