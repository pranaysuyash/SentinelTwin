"use client";

import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Camera, Layers, Lightbulb, MousePointer2, RefreshCcw, ScanSearch, Shield, Square } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  type AnyEditableNode,
  type CameraNode,
  type CoverageCellResult,
  type SecurityIssue,
  type SensorNode,
} from "@/schema/security-scene";
import { getYawPitchDirection } from "@sentineltwin/core";
import { CameraLabelCard } from "@/components/workspace/overlays/CameraLabelCard";
import { CriticalZoneLabelCard } from "@/components/workspace/overlays/CriticalZoneLabelCard";
import { EntryDoorChip } from "@/components/workspace/overlays/EntryDoorChip";
import { ObstructionWarningCard } from "@/components/workspace/overlays/ObstructionWarningCard";
import { useStudioStore } from "@/store/studio-store";
import {
  ENVIRONMENT_THEMES,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  ScenePathLine,
  CoverageSegmentPath,
  CoverageHeatmapInstanced,
  ScenePrivacyZones,
} from "./SharedScene";
import { makeSnapEngine } from "./editing/SnapEngine";
import { PathDrawTool } from "./editing/PathDrawTool";
import { PolygonDrawTool } from "./editing/PolygonDrawTool";
import { ObjectContextMenu } from "./editing/ObjectContextMenu";
import {
  buildContextualMenuModel,
  findContextualNode,
  planContextualAction,
  type ContextActionId,
} from "./editing/object-context-actions";
import { SelectionOverlay } from "./editing/SelectionOverlay";
import { TransformHandles } from "./editing/TransformHandles";
import { getSceneSelectionIds, normalizeBounds } from "./editing/selection-geometry";
import { WallDrawTool } from "./editing/WallDrawTool";
import { applyShiftLock, clampToScene, pathLength, pointDistance } from "./editing/editor-geometry";
import { cn } from "@/lib/cn";
import { getTrustQualityLabel } from "@/lib/quality-display";
import { pointOnPathAtProgress } from "@/components/map/path-quality";
import { MAP_COLORS } from "@/components/map/map-colors";
import { CoverageLegend } from "./CoverageLegend";
import {
  createCameraNode,
  createObstructionNode,
  createEntryPointNode,
  createWallNode,
  createDoorNode,
  createWindowNode,
  createCriticalZoneNode,
  createScenarioPathNode,
  createSecurityLightNode,
  createSensorNode,
} from "@/lib/node-factory";
import { CameraPresetPicker } from "./CameraPresetPicker";
import { applyCameraPreset, getCameraPreset } from "./camera-preset-utils";
import { getCameraColorForId } from "@/lib/camera-colors";
import "@/lib/three-compat";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";

function getMapFrame(width: number, depth: number) {
  const centerX = width / 2;
  const centerZ = depth / 2;
  const span = Math.max(width, depth);

  return {
    // Look at slightly above floor so the room reads well
    target: new THREE.Vector3(centerX, 0.5, centerZ),
    // Classic isometric-style: 45° elevation, front-right corner view
    position: new THREE.Vector3(
      centerX + width * 0.55,
      span * 0.62,
      centerZ + depth * 0.88,
    ),
  };
}

type SelectionDragState = {
  startClient: [number, number];
  currentClient: [number, number];
  startWorld: [number, number];
  currentWorld: [number, number];
};

type ObjectContextMenuState = {
  nodeId: string;
  clientX: number;
  clientY: number;
  selectionSnapshot: string[];
};

function SelectionRectangleOverlay({ drag }: { drag: SelectionDragState | null }) {
  if (!drag) return null;

  const left = Math.min(drag.startClient[0], drag.currentClient[0]);
  const top = Math.min(drag.startClient[1], drag.currentClient[1]);
  const width = Math.abs(drag.currentClient[0] - drag.startClient[0]);
  const height = Math.abs(drag.currentClient[1] - drag.startClient[1]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute rounded-md border border-sky-300/80 bg-sky-400/10"
        style={{
          left,
          top,
          width,
          height,
          boxShadow: "0 0 0 1px rgba(125, 211, 252, 0.18), inset 0 0 0 1px rgba(125, 211, 252, 0.18)",
        }}
      />
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function getSelectionAnchor(node: AnyEditableNode): [number, number, number] | null {
  if (node.nodeType === "camera" || node.nodeType === "security_light" || node.nodeType === "sensor" || node.nodeType === "obstruction" || node.nodeType === "door" || node.nodeType === "window") {
    return [node.position[0], node.position[1], node.position[2]];
  }

  if (node.nodeType === "entry_point") {
    return [node.position[0], 0.06, node.position[1]];
  }

  if (node.nodeType === "wall") {
    return [
      (node.start[0] + node.end[0]) / 2,
      node.heightM / 2,
      (node.start[1] + node.end[1]) / 2,
    ];
  }

  if (node.nodeType === "critical_zone" || node.nodeType === "privacy_zone") {
    const centroid = node.polygon.reduce(
      (acc, [x, z]) => {
        acc[0] += x;
        acc[1] += z;
        return acc;
      },
      [0, 0] as [number, number],
    );
    const count = Math.max(1, node.polygon.length);
    return [centroid[0] / count, 0.05, centroid[1] / count];
  }

  if (node.nodeType === "path") {
    const centroid = node.points.reduce(
      (acc, point) => {
        acc[0] += point.position[0];
        acc[1] += point.position[1];
        return acc;
      },
      [0, 0] as [number, number],
    );
    const count = Math.max(1, node.points.length);
    return [centroid[0] / count, 0.05, centroid[1] / count];
  }

  return null;
}

function SelectionHighlights() {
  const scene = useStudioStore((s) => s.scene);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);

  if (selectedNodeIds.length === 0) return null;

  const nodesById = new Map<string, AnyEditableNode>([
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.sensors,
    ...scene.obstructions,
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ].map((node) => [node.id, node] as const));
  const firstSelectedNode = selectedNodeIds.length > 0 ? nodesById.get(selectedNodeIds[0]!) : undefined;
  const firstSelectionAnchor = selectedNodeIds.length > 1 && firstSelectedNode ? getSelectionAnchor(firstSelectedNode) : null;

  return (
    <>
      {selectedNodeIds.length > 1 && firstSelectionAnchor ? (
        <Html position={[firstSelectionAnchor[0], firstSelectionAnchor[1] + 0.55, firstSelectionAnchor[2]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="rounded-full border border-sky-300/35 bg-[#08111e]/92 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-200 shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
            {selectedNodeIds.length} selected
          </div>
        </Html>
      ) : null}
      {selectedNodeIds.map((id, index) => {
        const node = nodesById.get(id);
        if (!node) return null;
        const anchor = getSelectionAnchor(node);
        if (!anchor) return null;
        const isPrimary = index === 0;
        return (
          <group key={id}>
            <mesh position={anchor} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[isPrimary ? 0.18 : 0.14, isPrimary ? 0.28 : 0.22, 20]} />
              <meshBasicMaterial color={isPrimary ? "#93c5fd" : "#60a5fa"} transparent opacity={0.75} />
            </mesh>
            <Html position={[anchor[0], anchor[1] + 0.2, anchor[2]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
              <div className="rounded border border-[#2b3a58] bg-[#0b0f17]/90 px-1.5 py-0.5 text-[8px] font-semibold text-[#d2d9e8]">
                {isPrimary ? "Primary" : `+${index}`}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function CameraFrustum({
  camera,
  selected,
  onContextMenu,
}: {
  camera: CameraNode;
  selected: boolean;
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const studioViewMode = useStudioStore((s) => s.setViewMode);
  const [hovered, setHovered] = useState(false);
  const lastClickTime = useRef(0);

  const handleDoubleClick = useCallback(() => {
    setSelectedCameraId(camera.id);
    selectNode(camera.id);
    studioViewMode("camera_view");
  }, [camera.id, selectNode, setSelectedCameraId, studioViewMode]);
  const [px, py, pz] = camera.position;
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg);
  const range = Math.min(camera.rangeM, 12);

  const quaternion = useMemo(() => {
    const down = new THREE.Vector3(0, -1, 0);
    return new THREE.Quaternion().setFromUnitVectors(down, forward);
  }, [forward]);

  const centerPos = useMemo(
    () => new THREE.Vector3(px, py, pz).add(forward.clone().multiplyScalar(range / 2)),
    [px, py, pz, forward, range],
  );

  const radius = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180)) * range;

  const cameraColor = getCameraColorForId(camera.id);
  const color = camera.status === "on" ? cameraColor : "#6b7280";
  const isSuggested = camera.tags?.includes("suggested");

  // computeLineDistances is required for lineDashedMaterial to render dashes
  const lineRef = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    lineRef.current?.computeLineDistances();
  }, [isSuggested]);

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleSelectedNode(camera.id);
      return;
    }
    selectNode(camera.id);

    const now = Date.now();
    if (now - lastClickTime.current < 350) {
      handleDoubleClick();
    }
    lastClickTime.current = now;
  };

  const edgesGeom = useMemo(() => {
    const geom = new THREE.ConeGeometry(radius, range, 24, 1, false);
    return new THREE.EdgesGeometry(geom);
  }, [radius, range]);

  return (
    <group
      onPointerDown={handleSelect}
      onContextMenu={onContextMenu ? (event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu(camera.id, event);
      } : undefined}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      scale={hovered ? 1.04 : 1}
    >
      <mesh position={centerPos} quaternion={quaternion}>
        <coneGeometry args={[radius, range, 24, 1, false]} />
        <meshBasicMaterial
          color={hovered ? "#bfdbfe" : color}
          transparent
          opacity={isSuggested ? 0.15 : (selected ? 0.55 : hovered ? 0.48 : 0.38)}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        ref={isSuggested ? lineRef : undefined}
        position={centerPos}
        quaternion={quaternion}
        geometry={edgesGeom}
      >
        {isSuggested ? (
          <lineDashedMaterial color={color} transparent opacity={0.45} dashSize={0.12} gapSize={0.08} />
        ) : (
          <lineBasicMaterial color={hovered ? "#dbeafe" : color} transparent opacity={selected ? 0.85 : hovered ? 0.82 : 0.65} />
        )}
      </lineSegments>
      {(selected || hovered) && (
        <Html position={[centerPos.x, centerPos.y + range * 0.58, centerPos.z]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
          <div className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide shadow-lg",
            selected ? "border-sky-300/70 bg-sky-400/15 text-sky-100" : "border-white/15 bg-black/45 text-sky-100",
          )}>
            {selected ? "Selected" : "Click to select"}
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraMarker({
  camera,
  selected,
  onContextMenu,
}: {
  camera: CameraNode;
  selected: boolean;
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const layers = useStudioStore((s) => s.layerVisibility);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const cameraLabelsVisible = useStudioStore((s) => s.overlayFilters.cameraLabels);
  const [hovered, setHovered] = useState(false);
  const [px, py, pz] = camera.position;
  const isActive = camera.status === "on";
  const cameraColor = getCameraColorForId(camera.id);

  // Determine label rendering based on density
  const showLabel = layers.labels && cameraLabelsVisible;
  const labelCompact = overlayDensity === "compact";
  const showOnlyOnHover = overlayDensity === "minimal";

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleSelectedNode(camera.id);
      return;
    }
    selectNode(camera.id);
  };

  return (
    <group
      position={[px, py, pz]}
      scale={hovered ? 1.12 : selected ? 1.08 : 1}
      onContextMenu={onContextMenu ? (event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu(camera.id, event);
      } : undefined}
      onPointerEnter={() => {
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
          <ringGeometry args={[0.16, hovered ? 0.28 : 0.22, 28]} />
          <meshBasicMaterial color={cameraColor} transparent opacity={0.9} />
        </mesh>
      )}

      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <ringGeometry args={[0.22, hovered ? 0.36 : 0.3, 28]} />
          <meshBasicMaterial
            color={hovered ? "#e0e7ff" : cameraColor}
            transparent
            opacity={hovered ? 0.34 : 0.18}
            depthWrite={false}
          />
        </mesh>
      )}

      <group
        onPointerDown={handleSelect}
      >
        <mesh position={[0, 0, 0]} onPointerDown={handleSelect}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 18]} />
          <meshStandardMaterial
            color={cameraColor}
            emissive={hovered || selected ? "#bfdbfe" : cameraColor}
            emissiveIntensity={selected ? 0.72 : hovered ? 0.56 : 0.3}
            roughness={0.32}
            metalness={0.68}
          />
        </mesh>
        <mesh position={[0.06, 0, 0.07]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <boxGeometry args={[0.09, 0.05, 0.11]} />
          <meshStandardMaterial color={hovered ? "#f8fbff" : "#dce6f7"} roughness={0.24} metalness={0.55} />
        </mesh>
      </group>

      {showLabel && (selected || hovered || !showOnlyOnHover) && (
        <Html position={[0, 0.34, 0]} center distanceFactor={11} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <CameraLabelCard
            name={camera.name}
            resolutionMP={camera.resolutionMP}
            mountType={camera.mountType}
            isActive={isActive}
            status={camera.status}
            selected={selected}
            hovered={hovered}
            compact={labelCompact}
            isSuggested={camera.tags?.includes("suggested")}
          />
        </Html>
      )}

      {/* In minimal mode, always show a small dot indicator for quick location */}
      {showOnlyOnHover && !selected ? (
        <Html position={[0, 0.18, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: cameraColor,
              opacity: 0.5,
              boxShadow: `0 0 3px ${cameraColor}`,
            }}
          />
        </Html>
      ) : null}
    </group>
  );
}

function AccentSurface({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function CeilingLightMarkers({
  onContextMenu,
}: {
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const scene = useStudioStore((s) => s.scene);

  return (
    <group>
      {scene.securityLights.map((light) => (
        <group
          key={light.id}
          position={light.position}
          onContextMenu={onContextMenu ? (event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
            onContextMenu(light.id, event);
          } : undefined}
        >
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.05, 22]} />
            <meshStandardMaterial color="#eceff7" emissive="#f8f2c0" emissiveIntensity={0.45} roughness={0.2} metalness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SensorMarkers({
  onContextMenu,
}: {
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const scene = useStudioStore((s) => s.scene);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const colorMap: Record<SensorNode["sensorType"], string> = {
    motion: "#60a5fa",
    door_contact: "#34d399",
    access_reader: "#f59e0b",
    audio: "#c084fc",
    vibration: "#fb7185",
    panic_button: "#f97316",
    smoke_heat: "#fbbf24",
  };

  return (
    <group>
      {scene.sensors.map((sensor) => {
        const color = colorMap[sensor.sensorType];
        const isHovered = hoveredId === sensor.id;
        const isSelected = selected === sensor.id;
        return (
          <group
            key={sensor.id}
            position={sensor.position}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.shiftKey || event.metaKey || event.ctrlKey) {
                toggleSelectedNode(sensor.id);
                return;
              }
              selectNode(sensor.id);
            }}
            onContextMenu={onContextMenu ? (event) => {
              event.stopPropagation();
              event.nativeEvent.preventDefault();
        onContextMenu(sensor.id, event);
            } : undefined}
            onPointerOver={() => {
              setHoveredId(sensor.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHoveredId((current) => (current === sensor.id ? null : current));
              document.body.style.cursor = "default";
            }}
            scale={isHovered ? 1.06 : 1}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.1, 0.14, 0.08, 16]} />
              <meshStandardMaterial
                color={isSelected ? "#bfdbfe" : color}
                emissive={isSelected ? "#1d4ed8" : color}
                emissiveIntensity={isSelected ? 0.5 : 0.18}
                roughness={0.35}
                metalness={0.3}
              />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.08, 0.08, 0.04]} />
              <meshStandardMaterial color={isSelected ? "#e0f2fe" : "#e5eefb"} roughness={0.18} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.18, 0.26, 20]} />
              <meshBasicMaterial color={isSelected ? "#93c5fd" : color} transparent opacity={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CriticalZoneOverlay({
  zone,
  result,
  selected,
  onSelect,
  onContextMenu,
}: {
  zone: { id: string; label: string; polygon: [number, number][]; heightM: number; requiredQuality: string };
  result?: { status: string; actualQuality: string };
  selected?: boolean;
  onSelect?: (id: string) => void;
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const layers = useStudioStore((s) => s.layerVisibility);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const zoneLabelsVisible = useStudioStore((s) => s.overlayFilters.zoneLabels);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  if (!layers.critical_zones) return null;

  const xs = zone.polygon.map(([x]) => x);
  const zs = zone.polygon.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;

  const status = result?.status ?? "unknown";
  const color = status === "pass" ? "#22c55e" : status === "fail" ? "#eab308" : "#6b7280";
  const badgeBg = status === "pass" ? "#064e3b" : status === "fail" ? "#7f1d1d" : "#374151";
  const badgeText = status === "pass" ? "#86efac" : status === "fail" ? "#fca5a5" : "#d1d5db";

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          toggleSelectedNode(zone.id);
          return;
        }
        onSelect?.(zone.id);
        if (!onSelect) {
          selectNode(zone.id);
        }
      }}
      onContextMenu={onContextMenu ? (event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu(zone.id, event);
      } : undefined}
    >
      <mesh position={[cx, 0.012, cz]}>
        <boxGeometry args={[w, 0.01, d]} />
        <meshBasicMaterial color={selected ? "#93c5fd" : color} transparent opacity={selected ? 0.18 : 0.1} depthWrite={false} />
      </mesh>
      <lineSegments position={[cx, 0.014, cz]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, 0.01, d)]} />
        <lineBasicMaterial color={selected ? "#93c5fd" : color} transparent opacity={selected ? 0.95 : 0.72} />
      </lineSegments>
      {zoneLabelsVisible && (selected || overlayDensity !== "minimal") && (
        <Html position={[cx, 0.05, cz]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <CriticalZoneLabelCard
            label={zone.label}
            requiredQuality={zone.requiredQuality}
            status={status}
            borderColor={color}
            badgeBg={badgeBg}
            badgeText={badgeText}
            compact={overlayDensity === "compact"}
          />
        </Html>
      )}
    </group>
  );
}

function ObstructionWarning({
  issue,
  obstructionLabel,
  position,
}: {
  issue: SecurityIssue;
  obstructionLabel: string;
  position: [number, number, number];
}) {
  const layers = useStudioStore((s) => s.layerVisibility);
  const scene = useStudioStore((s) => s.scene);
  const obsWarningsVisible = useStudioStore((s) => s.overlayFilters.obstructionWarnings);
  if (!layers.labels || !obsWarningsVisible) return null;

  const affectedCamera = scene.cameras.find((camera) => camera.id === issue.affectedCameras[0]);

  return (
    <Html position={position} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <ObstructionWarningCard
        obstructionLabel={obstructionLabel}
        affectedCameraName={affectedCamera?.name}
      />
    </Html>
  );
}

function EntryDoorLabel({ position }: { position: [number, number] }) {
  const layers = useStudioStore((s) => s.layerVisibility);
  const entryChipsVisible = useStudioStore((s) => s.overlayFilters.entryChips);
  if (!layers.labels || !entryChipsVisible) return null;

  return (
    <Html position={[position[0], 0.14, position[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <EntryDoorChip label="ENTRY DOOR" />
    </Html>
  );
}

function SceneGeometry({
  onObjectContextMenu,
  onHeatmapHover,
  onHeatmapHoverClear,
}: {
  onObjectContextMenu: (nodeId: string, event: ThreeEvent<MouseEvent>) => void;
  onHeatmapHover: (cell: CoverageCellResult, event: ThreeEvent<PointerEvent>) => void;
  onHeatmapHoverClear: () => void;
}) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const layers = useStudioStore((s) => s.layerVisibility);

  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const pathLabelsVisible = useStudioStore((s) => s.overlayFilters.pathLabels);
  const { width, depth } = scene.dimensions;
  // Data-driven: one warning per blindspot issue, positioned above the matching obstruction.
  // Label is extracted from the issue description (format: "<Label> is obstructing coverage in: ...").
  const blockingIssues = result?.issues.filter((issue) => issue.category === "blindspot") ?? [];
  const entryDoor = scene.entryPoints[0];

  return (
    <>
      {layers.walls_floors && (
        <>
          <SceneFloor width={width} depth={depth} showGrid={false} />
          <AccentSurface position={[width / 2, 0.002, depth / 2]} size={[width * 0.94, depth * 0.94]} color="#5b677d" opacity={0.06} />
          <AccentSurface position={[5, 0.0025, 5.58]} size={[2.5, 1.45]} color="#d7c542" opacity={0.16} />
          <AccentSurface position={[5, 0.003, 6.56]} size={[2, 0.34]} color="#7e8797" opacity={0.18} />
          <AccentSurface position={[8.25, 0.003, 1.12]} size={[2.9, 2.08]} color="#39404d" opacity={0.18} />
          <AccentSurface position={[5, 0.005, 3.55]} size={[3.9, 5.1]} color="#ffffff" opacity={0.15} />
        </>
      )}

      {layers.walls_floors && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0.006, depth / 2]}>
          <planeGeometry args={[width * 0.97, depth * 0.97, 20, 14]} />
          <meshStandardMaterial color="#72809a" wireframe transparent opacity={0.08} />
        </mesh>
      )}

      {layers.grid && (
        <gridHelper
          args={[Math.max(width, depth) + 1.5, (Math.max(width, depth) + 2) * 6, "#2d3444", "#181d28"]}
          position={[width / 2, 0.002, depth / 2]}
        />
      )}

      {layers.walls_floors ? (
        <SceneWalls walls={scene.walls} onContextMenu={onObjectContextMenu} />
      ) : null}

      <SceneDoors doors={scene.doors} onContextMenu={onObjectContextMenu} />
      <SceneWindows windows={scene.windows} onContextMenu={onObjectContextMenu} />

      {layers.obstructions ? (
        <SceneObstructions obstructions={scene.obstructions} selectedId={selected} onContextMenu={onObjectContextMenu} />
      ) : null}
      <SensorMarkers onContextMenu={onObjectContextMenu} />
      {layers.lights ? <CeilingLightMarkers onContextMenu={onObjectContextMenu} /> : null}

      {blockingIssues.map((issue) => {
        const obsLabel = issue.description.split(" is obstructing")[0] ?? "";
        const matchingObs = scene.obstructions.find((obs) => obs.label === obsLabel);
        if (!matchingObs || !layers.labels) return null;
        const [ox, oy, oz] = matchingObs.position;
        const [, , obsHeight] = matchingObs.dimensions;
        const warningY = oy + obsHeight / 2 + 0.35;
        return (
          <ObstructionWarning
            key={matchingObs.id}
            issue={issue}
            obstructionLabel={matchingObs.label}
            position={[ox, warningY, oz]}
          />
        );
      })}

      {layers.heatmap && result?.coverageCells ? (
        <CoverageHeatmapInstanced
          cells={result.coverageCells}
          mode={heatmapMode}
          onHoverCell={onHeatmapHover}
          onClearHover={onHeatmapHoverClear}
        />
      ) : null}

      {scene.criticalZones.map((zone) => (
        <CriticalZoneOverlay
          key={zone.id}
          zone={zone}
          selected={selected === zone.id}
          onSelect={selectNode}
          onContextMenu={onObjectContextMenu}
          result={result?.criticalZoneResults.find((entry) => entry.zoneId === zone.id)}
        />
      ))}

      {entryDoor ? <EntryDoorLabel position={entryDoor.position} /> : null}

      {layers.cameras ? scene.cameras.map((cam) => <CameraMarker key={cam.id} camera={cam} selected={selected === cam.id} onContextMenu={onObjectContextMenu} />) : null}
      {layers.camera_cones ? scene.cameras.map((cam) => <CameraFrustum key={`frust_${cam.id}`} camera={cam} selected={selected === cam.id} onContextMenu={onObjectContextMenu} />) : null}

      {layers.paths && pathLabelsVisible
        ? scene.paths.map((path) => (
          <ScenePathLine
            key={path.id}
            id={path.id}
            points={path.points.map((point) => point.position)}
            onSelect={selectNode}
            onContextMenu={onObjectContextMenu}
            color={selected === path.id ? "#f59e0b" : undefined}
          />
        ))
        : null}

      {layers.paths && pathLabelsVisible && result?.adversarialPath ? (
        <CoverageSegmentPath waypoints={result.adversarialPath.waypoints} />
      ) : null}

      {layers.privacy_zones && scene.privacyZones.length > 0 ? (
        <ScenePrivacyZones zones={scene.privacyZones} onSelect={selectNode} onContextMenu={onObjectContextMenu} />
      ) : null}

      {layers.paths ? <PathReplayActor /> : null}
    </>
  );
}

function PathReplayActor() {
  const scene = useStudioStore((s) => s.scene);
  const activePathId = useStudioStore((s) => s.activePathId);
  const pathReplayPlaying = useStudioStore((s) => s.pathReplay.playing);
  const pathReplayProgress = useStudioStore((s) => s.pathReplay.progress);

  const path = scene.paths.find((item) => item.id === activePathId) ?? null;
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!path || path.points.length < 2) return;
    if (meshRef.current) {
      const [x, z] = pointOnPathAtProgress(path, pathReplayProgress);
      meshRef.current.position.set(x, 0.18, z);
    }
  });

  if (!path || (!pathReplayPlaying && pathReplayProgress === 0)) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.18, 12, 12]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.5} />
    </mesh>
  );
}

function SceneFrameRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const scene = useStudioStore((s) => s.scene);
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const canvasViewResetTick = useStudioStore((s) => s.canvasViewResetTick);
  const focusRequest = useStudioStore((s) => s.focusScenePointRequest);
  const clearFocusRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const { width: sceneWidth, depth: sceneDepth } = scene.dimensions;
  const previousTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const { target, position } = getMapFrame(sceneWidth, sceneDepth);

    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    const orbitControls = controls as unknown as { target: THREE.Vector3; update: () => void } | undefined;

    if (orbitControls) {
      orbitControls.target.copy(target);
      orbitControls.update();
      previousTarget.current = target.clone();
    }
  }, [camera, canvasMode, canvasViewResetTick, controls, sceneDepth, sceneWidth]);

  useEffect(() => {
    if (!focusRequest) return;

    const orbitControls = controls as unknown as { target: THREE.Vector3; update: () => void } | undefined;
    const target = new THREE.Vector3(focusRequest.point[0], 0.5, focusRequest.point[1]);
    const priorTarget = previousTarget.current ?? new THREE.Vector3(sceneWidth / 2, 0.5, sceneDepth / 2);

    if (orbitControls) {
      const delta = new THREE.Vector3().subVectors(target, priorTarget);
      camera.position.add(delta);
      orbitControls.target.copy(target);
      orbitControls.update();
      previousTarget.current = target.clone();
    }

    clearFocusRequest(null);
    return () => {
      clearFocusRequest(null);
    };
  }, [camera, clearFocusRequest, controls, focusRequest, sceneDepth, sceneWidth]);

  return null;
}

const TOOL_GHOST_COLORS: Record<string, string> = {
  select: "#94a3b8",
  camera: "#60a5fa",
  obstruction: "#f97316",
  light: "#eab308",
  sensor: "#22d3ee",
  wall: "#22c55e",
  zone: "#86efac",
  door_window: "#c084fc",
  path: "#fb923c",
  measure: "#f8fafc",
  comment: "#94a3b8",
  default: "#60a5fa",
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  select: <MousePointer2 className="h-3 w-3" />,
  camera: <Camera className="h-3 w-3" />,
  obstruction: <Square className="h-3 w-3" />,
  light: <Lightbulb className="h-3 w-3" />,
  sensor: <ScanSearch className="h-3 w-3" />,
  wall: <Square className="h-3 w-3" />,
  zone: <Shield className="h-3 w-3" />,
  door_window: <Layers className="h-3 w-3" />,
  path: <RefreshCcw className="h-3 w-3" />,
  measure: <Layers className="h-3 w-3" />,
  comment: <Layers className="h-3 w-3" />,
};

const TOOL_LABELS: Record<string, string> = {
  select: "Select",
  camera: "Place Camera",
  obstruction: "Place Obstruction",
  light: "Place Light",
  sensor: "Place Sensor",
  wall: "Draw Wall",
  zone: "Draw Zone",
  door_window: "Place Door / Window",
  path: "Draw Path",
  measure: "Measure",
  comment: "Comment",
};

const SENSOR_TYPE_LABELS: Record<string, string> = {
  motion: "Motion",
  door_contact: "Door Contact",
  access_reader: "Access Reader",
  audio: "Audio",
  vibration: "Vibration",
  panic_button: "Panic Button",
  smoke_heat: "Smoke / Heat",
};

/**
 * Invisible floor plane that catches pointer events for tool placement.
 * Shows ghost preview, places object on click.
 */
function ToolPlacementFloor({
  selectionDrag,
  setSelectionDrag,
  setSelectedNodes,
  clearSelection,
}: {
  selectionDrag: SelectionDragState | null;
  setSelectionDrag: React.Dispatch<React.SetStateAction<SelectionDragState | null>>;
  setSelectedNodes: (ids: string[]) => void;
  clearSelection: () => void;
}) {
  const activeTool = useStudioStore((s) => s.activeTool);
  const addNode = useStudioStore((s) => s.addNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const scene = useStudioStore((s) => s.scene);
  const criticalZoneTargetType = useStudioStore((s) => s.criticalZoneTargetType);
  const sensorPlacementType = useStudioStore((s) => s.sensorPlacementType);
  const editor = useStudioStore((s) => s.editor);
  const { draftWallStart, draftPolygonPoints, draftPathPoints, hoverPoint } = editor;
  const setEditorHoverPoint = useStudioStore((s) => s.setEditorHoverPoint);
  const setEditorFeedbackMessage = useStudioStore((s) => s.setEditorFeedbackMessage);
  const setDraftWallStart = useStudioStore((s) => s.setDraftWallStart);
  const setDraftPolygonPoints = useStudioStore((s) => s.setDraftPolygonPoints);
  const setDraftPathPoints = useStudioStore((s) => s.setDraftPathPoints);
  const setEditorMode = useStudioStore((s) => s.setEditorMode);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const { camera, size } = useThree();

  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const floorRef = useRef<THREE.Mesh>(null!);
  const lastHoverRef = useRef<[number, number] | null>(null);
  const hasEntryPointsRef = useRef(scene.entryPoints.length > 0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const { width: sceneWidth, depth: sceneDepth } = scene.dimensions;
  const snapEngine = useMemo(() => makeSnapEngine(scene, {
    snapEnabled: editor.snapEnabled,
    snapDistanceM: editor.snapDistanceM,
    gridSnapM: editor.gridSnapM,
  }), [scene, editor.snapEnabled, editor.snapDistanceM, editor.gridSnapM]);

  useEffect(() => {
    hasEntryPointsRef.current = scene.entryPoints.length > 0;
  }, [scene.entryPoints.length]);

  useEffect(() => {
    setEditorFeedbackMessage(null);
  }, [activeTool, setEditorFeedbackMessage]);

  const isPlacing = activeTool !== "select";

  const wallDraft = draftWallStart && hoverPoint
    ? { start: draftWallStart, current: hoverPoint, length: pointDistance(draftWallStart, hoverPoint) }
    : null;

  const wallLength = wallDraft ? wallDraft.length : 0;

  const getFloorPoint = useCallback(
    (event: ThreeEvent<MouseEvent>): THREE.Vector3 | null => {
      const ndc = new THREE.Vector2(
        (event.nativeEvent.clientX / size.width) * 2 - 1,
        -(event.nativeEvent.clientY / size.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, point);
      if (!hit) return null;
      // Clamp to scene bounds
      [point.x, point.z] = clampToScene([point.x, point.z], sceneWidth, sceneDepth, 0.2);
      point.y = 0;
      return point;
    },
    [camera, raycaster, sceneDepth, sceneWidth, size],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (selectionDrag) {
        const point = getFloorPoint(event);
        if (point) {
          const nextClient: [number, number] = [event.nativeEvent.clientX, event.nativeEvent.clientY];
          setSelectionDrag({
            ...selectionDrag,
            currentClient: nextClient,
            currentWorld: [point.x, point.z],
          });
        }
        return;
      }

      if (!isPlacing) return;
      const point = getFloorPoint(event);
      if (!point) return;

      const basePoint = snapEngine.snapToGrid([point.x, point.z]);
      const generalProfile = snapEngine.snapForPlacement(basePoint, false);
      let snapped = basePoint;
      let nextMessage: string | null = generalProfile.message ?? null;

      if (activeTool === "wall" && draftWallStart) {
        const constrained = applyShiftLock(draftWallStart, basePoint, event.nativeEvent.shiftKey);
        const profile = snapEngine.snapForPlacement(constrained, false);
        snapped = profile.point;
        nextMessage = profile.message ?? null;
      } else if (activeTool === "door_window") {
        const profile = snapEngine.snapToWall(basePoint);
        if (profile.snappedToWall) {
          snapped = profile.point;
          nextMessage = profile.message ?? null;
        } else {
          nextMessage = "Door must be placed on wall";
        }
      }

      setEditorFeedbackMessage(nextMessage);
      const lastHover = lastHoverRef.current;
      const shouldUpdateHover = !lastHover || Math.abs(lastHover[0] - snapped[0]) > 0.01 || Math.abs(lastHover[1] - snapped[1]) > 0.01;
      if (shouldUpdateHover) {
        lastHoverRef.current = snapped;
        setEditorHoverPoint(snapped);
        setHoverPos(new THREE.Vector3(snapped[0], 0.02, snapped[1]));
      }
    },
    [activeTool, draftWallStart, getFloorPoint, isPlacing, selectionDrag, setEditorFeedbackMessage, setEditorHoverPoint, setSelectionDrag, snapEngine],
  );

  const commitDraftPolygon = useCallback(() => {
    if (draftPolygonPoints.length < 3) {
      setEditorFeedbackMessage("Zone needs at least 3 points");
      return;
    }
    const zone = createCriticalZoneNode(draftPolygonPoints, criticalZoneTargetType);
    addNode(zone);
    selectNode(zone.id);
    setDraftPolygonPoints([]);
    setEditorFeedbackMessage(null);
    setEditorMode("idle");
  }, [addNode, criticalZoneTargetType, draftPolygonPoints, selectNode, setDraftPolygonPoints, setEditorFeedbackMessage, setEditorMode]);

  const commitDraftPath = useCallback(() => {
    if (draftPathPoints.length < 2) {
      setEditorFeedbackMessage("Path needs at least 2 points");
      return;
    }
    const path = createScenarioPathNode(
      draftPathPoints.map((point) => ({ position: point })),
    );
    addNode(path);
    selectNode(path.id);
    setDraftPathPoints([]);
    setEditorFeedbackMessage(null);
    setEditorMode("idle");

    if (!hasEntryPointsRef.current) {
      const first = draftPathPoints[0];
      if (first) {
        addNode(createEntryPointNode(first));
      }
    }
  }, [addNode, draftPathPoints, selectNode, setDraftPathPoints, setEditorFeedbackMessage, setEditorMode]);

  const commitDraftWall = useCallback(() => {
    if (!draftWallStart || !hoverPoint) {
      setEditorFeedbackMessage("Wall needs a second point");
      return;
    }

    const constrained = applyShiftLock(draftWallStart, hoverPoint, false);
    const segmentLength = pointDistance(draftWallStart, constrained);
    if (segmentLength < 0.2) {
      setEditorFeedbackMessage("Wall needs at least 0.20m");
      return;
    }

    const wall = createWallNode(draftWallStart, constrained, {
      wallHeightM: scene.assumptions.wallHeightM,
      thicknessM: 0.18,
      material: "solid",
      visionTransmission: 0,
    });
    addNode(wall);
    selectNode(wall.id);
    setDraftWallStart(undefined);
    setEditorFeedbackMessage(null);
    setEditorMode("idle");
    setActiveTool("select");
  }, [addNode, draftWallStart, hoverPoint, scene.assumptions.wallHeightM, selectNode, setActiveTool, setDraftWallStart, setEditorFeedbackMessage, setEditorMode]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool === "select") {
        if (event.nativeEvent.shiftKey || event.nativeEvent.metaKey || event.nativeEvent.ctrlKey) {
          const point = getFloorPoint(event);
          if (!point) return;
          event.stopPropagation();
          const client: [number, number] = [event.nativeEvent.clientX, event.nativeEvent.clientY];
          setSelectionDrag({
            startClient: client,
            currentClient: client,
            startWorld: [point.x, point.z],
            currentWorld: [point.x, point.z],
          });
          return;
        }

        clearSelection();
        return;
      }

      if (!isPlacing) return;
      const point = getFloorPoint(event);
      if (!point) return;

      const workingSnap = hoverPoint ?? snapEngine.snapToGrid([point.x, point.z]);
      const pos: [number, number, number] = [workingSnap[0], 0, workingSnap[1]];

      if (activeTool === "zone" && event.nativeEvent.detail > 1) {
        commitDraftPolygon();
        return;
      }

      if (activeTool === "path" && event.nativeEvent.detail > 1) {
        commitDraftPath();
        return;
      }

      if (activeTool === "camera") {
        const preset = getCameraPreset();
        const node = createCameraNode([pos[0], 2.8, pos[2]]);
        if (preset) {
          const presetOverrides = applyCameraPreset(preset);
          Object.assign(node, presetOverrides);
        }
        addNode(node);
        setEditorFeedbackMessage(null);
        selectNode(node.id);
      } else if (activeTool === "obstruction") {
        const node = createObstructionNode([pos[0], 1, pos[2]]);
        addNode(node);
        setEditorFeedbackMessage(null);
        selectNode(node.id);
      } else if (activeTool === "light") {
        const node = createSecurityLightNode([pos[0], 2.8, pos[2]]);
        addNode(node);
        setEditorFeedbackMessage(null);
        selectNode(node.id);
      } else if (activeTool === "sensor") {
        const node = createSensorNode([pos[0], 1.2, pos[2]], sensorPlacementType);
        addNode(node);
        setEditorFeedbackMessage(null);
        selectNode(node.id);
      } else if (activeTool === "wall") {
        if (!draftWallStart) {
          setDraftWallStart(workingSnap);
          setEditorMode("drawing_wall");
          setEditorFeedbackMessage(null);
          return;
        }

        const constrained = applyShiftLock(draftWallStart, workingSnap, event.nativeEvent.shiftKey);
        const segmentLength = pointDistance(draftWallStart, constrained);
        if (segmentLength < 0.2) {
          setEditorFeedbackMessage("Wall needs at least 0.20m");
          return;
        }
        const wall = createWallNode(draftWallStart, constrained, {
          wallHeightM: scene.assumptions.wallHeightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
        });
        addNode(wall);
        setEditorFeedbackMessage(null);
        setDraftWallStart(constrained);
        selectNode(wall.id);
      } else if (activeTool === "zone") {
        setDraftPolygonPoints([...draftPolygonPoints, workingSnap]);
        setEditorFeedbackMessage(null);
      } else if (activeTool === "path") {
        setDraftPathPoints([...draftPathPoints, workingSnap]);
        setEditorFeedbackMessage(null);
      } else if (activeTool === "door_window") {
        const wallProfile = snapEngine.snapToWall(workingSnap);
        if (!wallProfile.snappedToWall) {
          setEditorFeedbackMessage("Door must be placed on wall");
          return;
        }

        const wantsWindow = event.nativeEvent.ctrlKey || event.nativeEvent.altKey;
        const node = wantsWindow
          ? createWindowNode([wallProfile.point[0], 1.4, wallProfile.point[1]])
          : createDoorNode([wallProfile.point[0], 0, wallProfile.point[1]]);

        addNode(node);
        setEditorFeedbackMessage(null);
        selectNode(node.id);
      }
    },
    [
      addNode,
      activeTool,
      commitDraftPath,
      commitDraftPolygon,
      clearSelection,
      draftPathPoints,
      draftPolygonPoints,
      draftWallStart,
      getFloorPoint,
      hoverPoint,
      isPlacing,
      scene.assumptions.wallHeightM,
      sensorPlacementType,
      selectNode,
      setDraftPathPoints,
      setDraftPolygonPoints,
      setDraftWallStart,
      setEditorMode,
      setEditorFeedbackMessage,
      setSelectionDrag,
      snapEngine,
    ],
  );

  useEffect(() => {
    const onMouseUp = () => {
      if (!selectionDrag) return;
      const bounds = normalizeBounds(selectionDrag.startWorld, selectionDrag.currentWorld);
      const ids = getSceneSelectionIds(scene, bounds);
      if (ids.length > 0) {
        setSelectedNodes(ids);
      } else {
        clearSelection();
      }
      setSelectionDrag(null);
    };

    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clearSelection, scene, selectionDrag, setSelectedNodes, setSelectionDrag]);

  const tooltipText = useMemo(() => {
    if (activeTool === "wall" && wallLength > 0) {
      return `Wall: ${wallLength.toFixed(2)}m`;
    }

    if (activeTool === "path") {
      const len = pathLength(draftPathPoints.concat(hoverPoint ? [hoverPoint] : []));
      return len > 0 ? `Path: ${len.toFixed(2)}m` : "Click to add path point";
    }

    if (activeTool === "zone") {
      return draftPolygonPoints.length > 0
        ? `Zone: ${draftPolygonPoints.length} points`
        : "Click to draw zone polygon";
    }

    if (activeTool === "select") {
      return "Select and inspect objects";
    }

    if (activeTool === "sensor") {
      return `Sensor: ${SENSOR_TYPE_LABELS[sensorPlacementType] ?? "Motion"}`;
    }

    return TOOL_LABELS[activeTool] ?? "Place";
  }, [activeTool, draftPathPoints, draftPolygonPoints.length, hoverPoint, sensorPlacementType, wallLength]);
  const tooltipDisplay = editor.feedbackMessage ?? tooltipText;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        if (activeTool === "zone" && draftPolygonPoints.length > 0) {
          setDraftPolygonPoints(draftPolygonPoints.slice(0, -1));
          setEditorFeedbackMessage(null);
          return;
        }

        if (activeTool === "path" && draftPathPoints.length > 0) {
          setDraftPathPoints(draftPathPoints.slice(0, -1));
          setEditorFeedbackMessage(null);
          return;
        }

        if (activeTool === "wall" && draftWallStart) {
          setDraftWallStart(undefined);
          setEditorMode("idle");
          setEditorFeedbackMessage(null);
          return;
        }

        if (activeTool === "select" && selectedNodeIds.length > 0) {
          setEditorFeedbackMessage(null);
          return;
        }
      }

      if (event.key === "Enter") {
        if (activeTool === "zone") {
          commitDraftPolygon();
          return;
        }
        if (activeTool === "path") {
          commitDraftPath();
          return;
        }
        if (activeTool === "wall") {
          commitDraftWall();
          return;
        }
      }

      if (event.key === "Escape") {
        setActiveTool("select");
        setDraftWallStart(undefined);
        setDraftPolygonPoints([]);
        setDraftPathPoints([]);
        setEditorMode("idle");
        setSelectionDrag(null);
        setEditorFeedbackMessage(null);
        selectNode(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTool,
    commitDraftPath,
    commitDraftPolygon,
    commitDraftWall,
    clearSelection,
    draftPathPoints,
    draftPolygonPoints,
    draftWallStart,
    selectNode,
    setActiveTool,
    setEditorFeedbackMessage,
    setDraftPathPoints,
    setDraftPolygonPoints,
    setDraftWallStart,
    setEditorMode,
    selectedNodeIds,
    setSelectionDrag,
  ]);

  const ghostColor = TOOL_GHOST_COLORS[activeTool] ?? TOOL_GHOST_COLORS.default;
  const visibleHoverPos = activeTool === "select" ? null : hoverPos;

  return (
    <>
      {/* Invisible floor catcher */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[sceneWidth / 2, -0.005, sceneDepth / 2]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => {
          setIsHovering(false);
          setHoverPos(null);
          lastHoverRef.current = null;
          setEditorHoverPoint(undefined);
          setEditorFeedbackMessage(null);
        }}
      >
        <planeGeometry args={[sceneWidth * 2, sceneDepth * 2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Active draw previews */}
      {activeTool === "wall" && wallDraft ? (
        <WallDrawTool draft={{ start: wallDraft.start, current: wallDraft.current, length: wallDraft.length, snappedToWall: false }} />
      ) : null}

      {activeTool === "zone" ? <PolygonDrawTool points={draftPolygonPoints} hoverPoint={hoverPoint} /> : null}
      {activeTool === "path" ? <PathDrawTool points={draftPathPoints} hoverPoint={hoverPoint} /> : null}

      {/* Ghost preview */}
      {visibleHoverPos && isHovering && (
        <group position={[visibleHoverPos.x, 0.02, visibleHoverPos.z]}>
          {/* Base ghost shape */}
          {activeTool === "camera" ? (
            <>
              <mesh>
                <cylinderGeometry args={[0.18, 0.18, 0.08, 18]} />
                <meshBasicMaterial color={ghostColor} transparent opacity={0.35} />
              </mesh>
              <mesh position={[0.02, 0, 0.02]}>
                <boxGeometry args={[0.12, 0.06, 0.14]} />
                <meshBasicMaterial color={ghostColor} transparent opacity={0.35} />
              </mesh>
            </>
          ) : activeTool === "sensor" ? (
            <>
              <mesh>
                <cylinderGeometry args={[0.11, 0.14, 0.08, 16]} />
                <meshBasicMaterial color={ghostColor} transparent opacity={0.35} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[0.08, 0.08, 0.04]} />
                <meshBasicMaterial color={ghostColor} transparent opacity={0.35} />
              </mesh>
            </>
          ) : activeTool === "obstruction" ? (
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[1, 2, 0.5]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.28} wireframe />
            </mesh>
          ) : (
            <mesh>
              <cylinderGeometry args={[0.18, 0.18, 0.05, 22]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.35} />
            </mesh>
          )}

          {/* Ground ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <ringGeometry args={[0.15, 0.28, 24]} />
            <meshBasicMaterial color={ghostColor} transparent opacity={0.5} />
          </mesh>

          {/* Tool label above */}
          <Html position={[0, 0.35, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: `rgba(0,0,0,0.75)`,
                border: `1.5px solid ${ghostColor}`,
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 9,
                fontWeight: 600,
                color: ghostColor,
                whiteSpace: "nowrap",
                backdropFilter: "blur(4px)",
              }}
            >
              <span className="inline-flex items-center gap-1">
                {TOOL_ICONS[activeTool] ?? <MousePointer2 className="h-3 w-3" />}
                {tooltipDisplay}
              </span>
            </div>
          </Html>
        </group>
      )}

      {activeTool === "measure" && isHovering && hoverPoint ? (
        <SelectionOverlay center={hoverPoint} label={tooltipText} showSnap />
      ) : null}
    </>
  );
}

function NorthCompass() {
  return (
    <div className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#2a3246] bg-[#0e1320]/90">
      <div className="relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">N</span>
        <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-0 h-5 w-0.5 rotate-180 rounded-full bg-gradient-to-b from-[#4a5568] to-transparent" />
      </div>
    </div>
  );
}

function ViewControls() {
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const setCanvasMode = useStudioStore((s) => s.setCanvasMode);
  const resetCanvasView = useStudioStore((s) => s.resetCanvasView);
  const toggleViewSettingsOpen = useStudioStore((s) => s.toggleViewSettingsOpen);

  return (
    <div className="absolute right-3 top-16 z-10 flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setCanvasMode("orbit_3d")}
        aria-label="Switch to 3D orbit"
        title="Switch to 3D orbit"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors",
           canvasMode === "orbit_3d"
             ? "border-sky-400 text-sky-100"
             : "border-[#2a3246] bg-[#0e1320]/90 text-[#6b7280] hover:bg-[#171e30] hover:text-white",
        )}
        style={canvasMode === "orbit_3d"
          ? {
              borderColor: MAP_COLORS.viewport,
              backgroundColor: "rgba(59, 130, 246, 0.14)",
            }
          : undefined}
      >
        3D
      </button>
      <button
        type="button"
        onClick={() => setCanvasMode("topdown_2d")}
        aria-label="Switch to 2D top-down"
        title="Switch to 2D top-down"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors",
           canvasMode === "topdown_2d"
             ? "border-emerald-400 text-emerald-100"
             : "border-[#2a3246] bg-[#0e1320]/90 text-[#6b7280] hover:bg-[#171e30] hover:text-white",
        )}
        style={canvasMode === "topdown_2d"
          ? {
              borderColor: MAP_COLORS.viewport,
              backgroundColor: "rgba(16, 185, 129, 0.14)",
            }
          : undefined}
      >
        2D
      </button>
      <button
        type="button"
        onClick={resetCanvasView}
        aria-label="Reset canvas view"
        title="Reset canvas view"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 hover:bg-[#171e30]"
      >
        <RefreshCcw className="h-3.5 w-3.5 text-[#6b7280] hover:text-white" />
      </button>
      <button
        type="button"
        onClick={() => toggleViewSettingsOpen()}
        aria-label="Open View Settings"
        title="Open View Settings"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 hover:bg-[#171e30]"
      >
        <Layers className="h-3.5 w-3.5 text-[#6b7280] hover:text-white" />
      </button>
    </div>
  );
}

function ControlHintBar() {
  const activeTool = useStudioStore((s) => s.activeTool);

  if (activeTool !== "select") {
    const toolLabel = TOOL_LABELS[activeTool] ?? "Place";
    const color = TOOL_GHOST_COLORS[activeTool] ?? TOOL_GHOST_COLORS.default;
    const toolShortcut: Record<string, string> = {
    camera: "C",
    obstruction: "B",
    light: "L",
    sensor: "Y",
    wall: "W",
    zone: "Z",
      door_window: "D",
      path: "P",
      measure: "M",
      comment: "T",
    };
    return (
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1">
        <span className="text-[8px]" style={{ color }}>◉ {toolLabel}</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Click floor to place</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Press {toolShortcut[activeTool] ?? "Esc"} or Esc to cancel</span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1">
      <span className="text-[8px] text-[#4a5568]">Left: Orbit</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Middle: Pan</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Right: Zoom</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Right-click: Object actions</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Scroll: Zoom</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Shift+drag: Box select</span>
    </div>
  );
}

function EditorStatusBanner() {
  const message = useStudioStore((s) => s.editor.feedbackMessage);

  if (!message) return null;

  return (
    <div className="pointer-events-none absolute bottom-14 left-3 z-10 max-w-[min(32rem,calc(100%-1.5rem))] rounded-lg border border-[#2a3246] bg-[#0b0f17]/92 px-3 py-2 text-[10px] font-medium text-[#d2d9e8] shadow-xl">
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        {message}
      </span>
    </div>
  );
}

function formatReasonCode(reasonCode: string): string {
  if (reasonCode.startsWith("REFLECTIVE_WINDOW:")) {
    const [, label] = reasonCode.split(":");
    return `Reflective window: ${label ?? "unknown"}`;
  }
  return reasonCode.toLowerCase().replaceAll("_", " ");
}

function formatMultiplier(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function HeatmapCellExplainabilityCard() {
  const hover = useStudioStore((s) => s.heatmapHover);
  const scene = useStudioStore((s) => s.scene);
  const heatmapMode = useStudioStore((s) => s.heatmapMode);

  if (!hover) return null;

  const cameraEvaluations = Object.entries(hover.cell.cameraEvaluations ?? {}).sort(([, a], [, b]) => {
    const qualityDelta = (b.probability ?? 0) - (a.probability ?? 0);
    if (qualityDelta !== 0) return qualityDelta;
    return (b.ppm ?? 0) - (a.ppm ?? 0);
  });

  const topEvaluations = cameraEvaluations.slice(0, 4);
  const lightingEvaluations = cameraEvaluations.filter(([, evaluation]) =>
    (evaluation.illuminatedBy?.length ?? 0) > 0 ||
    (evaluation.shadowedBy?.length ?? 0) > 0 ||
    typeof evaluation.lightLevel === "number",
  );
  const lightingSummary = lightingEvaluations.reduce(
    (summary, [, evaluation]) => ({
      maxLightLevel: Math.max(summary.maxLightLevel, evaluation.lightLevel ?? 0),
      illuminatedBy: new Set([...summary.illuminatedBy, ...(evaluation.illuminatedBy ?? [])]),
      shadowedBy: new Set([...summary.shadowedBy, ...(evaluation.shadowedBy ?? [])]),
    }),
    { maxLightLevel: 0, illuminatedBy: new Set<string>(), shadowedBy: new Set<string>() },
  );
  const left = hover.screenX + 14;
  const top = hover.screenY + 14;

  return (
    <div
      className="pointer-events-none absolute z-20 w-85 rounded-xl border border-[#25304a] bg-[#0a0f1a]/95 p-3 text-[10px] text-[#d2d9e8] shadow-[0_16px_40px_rgba(0,0,0,0.38)]"
      style={{ left, top }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-300">Cell explainability</span>
        <span className="font-mono text-[9px] text-[#8ea2c4]">x:{hover.cell.x.toFixed(2)} z:{hover.cell.z.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#1f2a40] bg-[#0d1421] p-2 text-[9px]">
        <div>
          <div className="text-[#6c7e9f]">{heatmapMode === "lighting" ? "Light level" : "Quality"}</div>
          <div className="font-semibold text-[#e3ebfb]">
            {heatmapMode === "lighting" ? `${(lightingSummary.maxLightLevel * 100).toFixed(0)}%` : getTrustQualityLabel(hover.cell.quality, scene.assumptions.doriStandard)}
          </div>
        </div>
        <div>
          <div className="text-[#6c7e9f]">{heatmapMode === "lighting" ? "Lit by" : "PPM"}</div>
          <div className="truncate font-semibold text-[#e3ebfb]">
            {heatmapMode === "lighting" ? ([...lightingSummary.illuminatedBy].join(", ") || "—") : hover.cell.ppm.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-[#6c7e9f]">{heatmapMode === "lighting" ? "Light shadow" : "Covering cams"}</div>
          <div className="truncate font-semibold text-[#e3ebfb]">
            {heatmapMode === "lighting" ? ([...lightingSummary.shadowedBy].join(", ") || "—") : hover.cell.coveringCameras.length}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {topEvaluations.length === 0 ? (
          <div className="rounded-md border border-[#1f2a40] bg-[#0d1421] px-2 py-1 text-[9px] text-[#7f91b3]">
            No per-camera evaluations available for this cell.
          </div>
        ) : (
          topEvaluations.map(([cameraId, evaluation]) => (
            <div key={cameraId} className="rounded-md border border-[#1f2a40] bg-[#0d1421] px-2 py-1.5">
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-semibold text-[#dbe7ff]">{cameraId}</span>
                <span className="text-[#8ea2c4]">
                  {getTrustQualityLabel(evaluation.quality, scene.assumptions.doriStandard)} · {evaluation.ppm.toFixed(1)} PPM
                </span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1 text-[8px] text-[#8ea2c4]">
                <span>FOV: {evaluation.inFov ? "yes" : "no"}</span>
                <span>Range: {evaluation.withinRange ? "yes" : "no"}</span>
                <span>Dist: {evaluation.distanceM.toFixed(1)}m</span>
                <span>Edge: {formatMultiplier(evaluation.edgePenaltyMultiplier)}</span>
                <span>Clarity: {formatMultiplier(evaluation.clarityMultiplier)}</span>
                <span>Material: {formatMultiplier(evaluation.materialTransmission)}</span>
                <span>Glare: {typeof evaluation.glarePenalty === "number" ? `${(evaluation.glarePenalty * 100).toFixed(0)}%` : "—"}</span>
                <span>Lighting: {typeof evaluation.lightingPenalty === "number" ? `${(evaluation.lightingPenalty * 100).toFixed(0)}%` : "—"}</span>
                <span>Lux proxy: {typeof evaluation.lightLevel === "number" ? `${(evaluation.lightLevel * 100).toFixed(0)}%` : "—"}</span>
                <span>Final factor: {formatMultiplier(evaluation.finalPpmMultiplier)}</span>
              </div>
              {evaluation.illuminatedBy?.length || evaluation.shadowedBy?.length ? (
                <div className="mt-1 text-[8px] text-[#8ea2c4]">
                  {evaluation.illuminatedBy?.length ? <span>Lit by {evaluation.illuminatedBy.join(", ")}</span> : null}
                  {evaluation.illuminatedBy?.length && evaluation.shadowedBy?.length ? <span> · </span> : null}
                  {evaluation.shadowedBy?.length ? <span>Light shadow: {evaluation.shadowedBy.join(", ")}</span> : null}
                </div>
              ) : null}
              {evaluation.reasonCodes.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {evaluation.reasonCodes.slice(0, 4).map((reasonCode) => (
                    <span key={reasonCode} className="rounded border border-[#314267] bg-[#13203a] px-1 py-0.5 text-[8px] text-[#9dc3ff]">
                      {formatReasonCode(reasonCode)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function WorkspaceCanvas() {
  const envMode = useStudioStore((s) => s.environmentMode);
  const scene = useStudioStore((s) => s.scene);
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const setSelectedNodes = useStudioStore((s) => s.setSelectedNodes);
  const selectNode = useStudioStore((s) => s.selectNode);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const setEditorFeedbackMessage = useStudioStore((s) => s.setEditorFeedbackMessage);
  const updateNode = useStudioStore((s) => s.updateNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setHeatmapHover = useStudioStore((s) => s.setHeatmapHover);
  const layerVisibility = useStudioStore((s) => s.layerVisibility);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const editorMode = useStudioStore((s) => s.editor.editorMode);
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ObjectContextMenuState | null>(null);
  const frame = useMemo(
    () => getMapFrame(scene.dimensions.width, scene.dimensions.depth),
    [scene.dimensions.depth, scene.dimensions.width],
  );
  const isTopDown = canvasMode === "topdown_2d";
  const canvasCamera = useMemo(
    () => ({
      position: isTopDown
        ? [frame.position.x, Math.max(frame.position.y * 2.2, 32), frame.position.z] as [number, number, number]
        : [frame.position.x, frame.position.y, frame.position.z] as [number, number, number],
      orthographic: isTopDown,
      zoom: isTopDown ? 30 : 1,
      fov: isTopDown ? 34 : 44,
      near: 0.1,
      far: 260,
    }),
    [frame.position.x, frame.position.y, frame.position.z, isTopDown],
  );

  const openObjectContextMenu = useCallback((nodeId: string, event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    const snapshot = selectedNodeIds.length > 0 ? [...selectedNodeIds] : [];
    selectNode(nodeId);
    setContextMenu({
      nodeId,
      clientX: event.nativeEvent.clientX,
      clientY: event.nativeEvent.clientY,
      selectionSnapshot: snapshot,
    });
  }, [selectNode, selectedNodeIds]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const executeContextAction = useCallback((actionId: ContextActionId) => {
    if (!contextMenu) return;
    const node = findContextualNode(scene, contextMenu.nodeId);
    if (!node) {
      setContextMenu(null);
      return;
    }

    const plan = planContextualAction(scene, node, actionId, contextMenu.selectionSnapshot);

    switch (plan.kind) {
      case "patch":
        updateNode(node.id, plan.patch);
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      case "duplicate":
        duplicateNode(node.id);
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      case "delete":
        removeNode(node.id);
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      case "focus":
        setFocusScenePointRequest({ point: plan.point, source: "minimap" });
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      case "camera_view":
        setSelectedCameraId(plan.cameraId);
        setWorkspacePreset("coverage");
        setViewMode("camera_view");
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      case "none":
        if (plan.message) setEditorFeedbackMessage(plan.message);
        break;
      default:
        break;
    }

    setContextMenu(null);
  }, [
    contextMenu,
    duplicateNode,
    removeNode,
    scene,
    setEditorFeedbackMessage,
    setFocusScenePointRequest,
    setSelectedCameraId,
    setViewMode,
    setWorkspacePreset,
    updateNode,
  ]);

  const contextMenuModel = useMemo(() => {
    if (!contextMenu) return null;
    const node = findContextualNode(scene, contextMenu.nodeId);
    if (!node) return null;
    return buildContextualMenuModel(scene, node, contextMenu.selectionSnapshot);
  }, [contextMenu, scene]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);

  useEffect(() => {
    if (!layerVisibility.heatmap || !simulationResult?.coverageCells?.length) {
      setHeatmapHover(null);
    }
  }, [layerVisibility.heatmap, setHeatmapHover, simulationResult?.coverageCells?.length]);

  const handleHeatmapHover = useCallback((cell: CoverageCellResult, event: ThreeEvent<PointerEvent>) => {
    setHeatmapHover({
      cell,
      screenX: event.nativeEvent.clientX,
      screenY: event.nativeEvent.clientY,
    });
  }, [setHeatmapHover]);

  const clearHeatmapHover = useCallback(() => {
    setHeatmapHover(null);
  }, [setHeatmapHover]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#07090d]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.06),transparent_46%),linear-gradient(180deg,rgba(6,9,14,0.1),rgba(6,9,14,0.48)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/28 to-transparent" />

      {visibleComponents.coverage_legend ? <CoverageLegend /> : null}
      {visibleComponents.north_compass ? <NorthCompass /> : null}
      {visibleComponents.viewport_controls ? <ViewControls /> : null}
      {visibleComponents.control_hint_bar ? <ControlHintBar /> : null}
      <HeatmapCellExplainabilityCard />
      <EditorStatusBanner />
      <ObjectContextMenu
        model={contextMenuModel}
        position={contextMenu ? { x: contextMenu.clientX, y: contextMenu.clientY } : { x: 0, y: 0 }}
        onAction={executeContextAction}
        onClose={closeContextMenu}
      />
      <SelectionRectangleOverlay drag={selectionDrag} />

      {/* Camera preset picker — shown when camera tool is active */}
      {visibleComponents.camera_preset_picker ? (
        <div className="absolute left-1/2 top-12 z-10 -translate-x-1/2">
          <CameraPresetPicker />
        </div>
      ) : null}

      <Canvas
        shadows="percentage"
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", background: theme.background }}
      >
        {isTopDown ? (
          <OrthographicCamera
            makeDefault
            position={canvasCamera.position}
            zoom={canvasCamera.zoom}
            near={canvasCamera.near}
            far={canvasCamera.far}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={canvasCamera.position}
            fov={canvasCamera.fov}
            near={canvasCamera.near}
            far={canvasCamera.far}
          />
        )}
        <color attach="background" args={[theme.background]} />
        <fog attach="fog" args={[theme.background, 12, 24]} />

        <ambientLight intensity={theme.ambient} />
        <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={theme.hemisphere} />
        <directionalLight
          position={[10, 14, 8]}
          intensity={theme.directional}
          color="#eef4ff"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 8, -8]} intensity={theme.fill} color="#a5c2ff" />
        <pointLight position={[5, 2.8, 3.5]} intensity={envMode === "night" ? 1.0 : 1.45} distance={10} color="#fff6d8" />

        <Suspense fallback={<CanvasLoadingOverlay label="Loading workspace scene" />}>
          <SceneGeometry
            onObjectContextMenu={openObjectContextMenu}
            onHeatmapHover={handleHeatmapHover}
            onHeatmapHoverClear={clearHeatmapHover}
          />
        </Suspense>

        <SelectionHighlights />
        <TransformHandles />
        <SceneFrameRig />
        <ToolPlacementFloor
          selectionDrag={selectionDrag}
          setSelectionDrag={setSelectionDrag}
          setSelectedNodes={setSelectedNodes}
          clearSelection={clearSelection}
        />

        <OrbitControls
          makeDefault
          enabled={editorMode !== "transforming"}
          enableRotate={!isTopDown}
          target={[frame.target.x, frame.target.y, frame.target.z]}
          minDistance={5.5}
          maxDistance={40}
          minPolarAngle={isTopDown ? Math.PI / 2 : Math.PI / 4.2}
          maxPolarAngle={isTopDown ? Math.PI / 2 : Math.PI / 2.08}
          enableZoom={true}
          enablePan={true}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
