"use client";

import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Camera, MousePointer2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  type AnyEditableNode,
  type CameraNode,
  type CoverageCellResult,
  type ObstructionNode,
  type SecurityIssue,
  type SensorNode,
} from "@/schema/security-scene";
import { getYawPitchDirection } from "@sentineltwin/core";
import { CameraLabelCard } from "@/components/workspace/overlays/CameraLabelCard";
import { ControlHintBar } from "@/components/workspace/overlays/ControlHintBar";
import { CriticalZoneLabelCard } from "@/components/workspace/overlays/CriticalZoneLabelCard";
import { EntryDoorChip } from "@/components/workspace/overlays/EntryDoorChip";
import { NorthCompass } from "@/components/workspace/overlays/NorthCompass";
import { ObstructionWarningCard } from "@/components/workspace/overlays/ObstructionWarningCard";
import { ViewControls } from "@/components/workspace/overlays/ViewControls";
import { LevelSwitcher } from "@/components/workspace/overlays/LevelSwitcher";
import { TOOL_GHOST_COLORS, TOOL_ICONS, TOOL_LABELS } from "@/lib/tool-constants";
import { useStudioStore, useFilteredScene } from "@/store/studio-store";
import {
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  ScenePathLine,
  CoverageSegmentPath,
  CoverageHeatmapInstanced,
  ScenePrivacyZones,
  CrowdChokepointOverlay,
  SceneContactShadows,
  SceneEnvironmentSphere,
  SceneEnvironmentSetup,
  SceneShadowCaster,
} from "./SharedScene";
import { makeSnapEngine } from "./editing/SnapEngine";
import { PathDrawTool } from "./editing/PathDrawTool";
import { PolygonDrawTool } from "./editing/PolygonDrawTool";
import { ObjectContextMenu } from "./editing/ObjectContextMenu";
import {
  applyContextActionPlan,
  buildContextualMenuModel,
  findContextualNode,
  planContextualAction,
  type ContextActionId,
} from "./editing/object-context-actions";
import { PlanView2D } from "./PlanView2D";
import { SelectionContextBar } from "./SelectionContextBar";
import { SelectionOverlay } from "./editing/SelectionOverlay";
import { TransformHandles } from "./editing/TransformHandles";
import { getSceneSelectionIds, normalizeBounds } from "./editing/selection-geometry";
import { WallDrawTool } from "./editing/WallDrawTool";
import { applyShiftLock, clampToScene, pathLength, pointDistance } from "./editing/editor-geometry";
import { cn } from "@/lib/cn";
import { isTypingTarget } from "@/lib/input-guard";
import { resolveSceneLighting } from "@/lib/scene-appearance";
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
import { ObstructionPresetPicker } from "./ObstructionPresetPicker";
import { PlacementPreviewPanel } from "./PlacementPreviewPanel";
import { applyCameraPreset, getCameraPreset } from "./camera-preset-utils";
import { getObstructionPreset, resolvePresetDimensions } from "@/lib/obstruction-presets";
import { getCameraColorForId } from "@/lib/camera-colors";
import {
  AIM_DRAG_THRESHOLD_M,
  computeAimYawDeg,
  DEFAULT_PLACEMENT_YAW_DEG,
  findObstructionForBlindspotIssue,
  isPrimaryMouseEvent,
  sanitizeSceneDimensions,
} from "./workspace-canvas-utils";
import "@/lib/three-compat";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import { SceneHtml } from "@/components/shared/SceneHtml";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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

function setWorkspaceCursor(cursor: "pointer" | "default") {
  if (typeof document === "undefined") return;
  document.body.style.cursor = cursor;
}

type WorkspaceNodeInteractionOptions = {
  nodeId: string;
  selectable: boolean;
  selectNode: (nodeId: string) => void;
  toggleSelectedNode: (nodeId: string) => void;
  onSelect?: (nodeId: string) => void;
  onContextMenu?: (nodeId: string, event: ThreeEvent<MouseEvent>) => void;
};

function makeWorkspaceNodeHandlers({
  nodeId,
  selectable,
  selectNode,
  toggleSelectedNode,
  onSelect,
  onContextMenu,
}: WorkspaceNodeInteractionOptions) {
  if (!selectable) {
    return {};
  }

  const handlePointerDown = (event: ThreeEvent<MouseEvent>) => {
    if (!isPrimaryMouseEvent(event)) return;
    // While a placement tool is active, objects must not swallow placement
    // clicks (camera frustums alone can blanket the whole floor). Let the
    // event fall through to the placement floor instead of selecting.
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

function getSelectionAnchor(node: AnyEditableNode): [number, number, number] | null {
  const toFinite = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback);

  const centroid2D = (points: [number, number][]) => {
    if (!Array.isArray(points) || points.length === 0) return [0, 0] as [number, number];

    let sumX = 0;
    let sumZ = 0;
    let count = 0;

    for (const point of points) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const x = toFinite(point[0], NaN);
      const z = toFinite(point[1], NaN);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      sumX += x;
      sumZ += z;
      count += 1;
    }

    if (count === 0) return [0, 0];
    return [sumX / count, sumZ / count];
  };

  if (node.nodeType === "camera" || node.nodeType === "security_light" || node.nodeType === "sensor" || node.nodeType === "obstruction" || node.nodeType === "door" || node.nodeType === "window") {
    if (!Array.isArray(node.position) || node.position.length < 3) return null;
    return [node.position[0], node.position[1], node.position[2]];
  }

  if (node.nodeType === "entry_point") {
    if (!Array.isArray(node.position) || node.position.length < 2) return null;
    return [node.position[0], 0.06, node.position[1]];
  }

  if (node.nodeType === "wall") {
    if (!Array.isArray(node.start) || !Array.isArray(node.end)) return null;
    return [
      (toFinite(node.start[0], 0) + toFinite(node.end[0], 0)) / 2,
      toFinite(node.heightM, 1.8) / 2,
      (toFinite(node.start[1], 0) + toFinite(node.end[1], 0)) / 2,
    ];
  }

  if (node.nodeType === "critical_zone" || node.nodeType === "privacy_zone") {
    const [cx, cz] = centroid2D(node.polygon);
    return [cx, 0.05, cz];
  }

  if (node.nodeType === "path") {
    const [cx, cz] = centroid2D(node.points.map((point) => {
      if (!point || !Array.isArray(point.position) || point.position.length < 2) return [0, 0];
      return [point.position[0], point.position[1]];
    }));
    return [cx, 0.05, cz];
  }

  return null;
}

function SelectionHighlights() {
  const scene = useFilteredScene();
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
        <SceneHtml position={[firstSelectionAnchor[0], firstSelectionAnchor[1] + 0.55, firstSelectionAnchor[2]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="rounded-full border border-sky-300/35 bg-[#08111e]/92 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-200 shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
            {selectedNodeIds.length} selected
          </div>
        </SceneHtml>
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
            {selectedNodeIds.length > 1 ? (
              <SceneHtml position={[anchor[0], anchor[1] + 0.2, anchor[2]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
                <div className={`rounded border border-[#2b3a58] ${UI_SURFACES.panel}/90 px-1.5 py-0.5 text-[8px] font-semibold ${UI_SURFACES.textBody2}`}>
                  {isPrimary ? "Primary" : `+${index}`}
                </div>
              </SceneHtml>
            ) : null}
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
  const selectionHandlers = makeWorkspaceNodeHandlers({
    nodeId: camera.id,
    selectable: true,
    selectNode,
    toggleSelectedNode,
    onContextMenu,
  });

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

  const handlePointerDown = (event: ThreeEvent<MouseEvent>) => {
    if (!isPrimaryMouseEvent(event)) return;
    const isRangeSelect = event.shiftKey || event.metaKey || event.ctrlKey;
    selectionHandlers.onPointerDown?.(event);
    if (isRangeSelect) {
      return;
    }
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
      onPointerDown={handlePointerDown}
      {...selectionHandlers}
      onPointerOver={() => {
        setHovered(true);
        setWorkspaceCursor("pointer");
      }}
      onPointerOut={() => {
        setHovered(false);
        setWorkspaceCursor("default");
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
        <SceneHtml position={[centerPos.x, centerPos.y + range * 0.58, centerPos.z]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
          <div className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide shadow-lg",
            selected ? "border-sky-300/70 bg-sky-400/15 text-sky-100" : "border-white/15 bg-black/45 text-sky-100",
          )}>
            {selected ? "Selected" : "Click to select"}
          </div>
        </SceneHtml>
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
  const selectionHandlers = makeWorkspaceNodeHandlers({
    nodeId: camera.id,
    selectable: true,
    selectNode,
    toggleSelectedNode,
    onContextMenu,
  });

  return (
    <group
      position={[px, py, pz]}
      scale={hovered ? 1.12 : selected ? 1.08 : 1}
      {...selectionHandlers}
      onPointerOver={() => {
        setHovered(true);
        setWorkspaceCursor("pointer");
      }}
      onPointerOut={() => {
        setHovered(false);
        setWorkspaceCursor("default");
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

      <group>
        <mesh position={[0, 0, 0]}>
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
        <SceneHtml position={[0, 0.34, 0]} center distanceFactor={11} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <CameraLabelCard
            name={camera.name}
            resolutionMP={camera.resolutionMP}
            mountType={camera.mountType}
            isActive={isActive}
            status={camera.status}
            selected={selected}
            hovered={hovered}
            // Progressive disclosure: compact chip at rest, full card on intent.
            compact={labelCompact && !selected && !hovered}
            isSuggested={camera.tags?.includes("suggested")}
          />
        </SceneHtml>
      )}

      {/* In minimal mode, always show a small dot indicator for quick location */}
      {showOnlyOnHover && !selected ? (
        <SceneHtml position={[0, 0.18, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
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
        </SceneHtml>
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
  const scene = useFilteredScene();
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  return (
    <group>
      {scene.securityLights.map((light) => {
        const isHovered = hoveredId === light.id;
        const isSelected = selectedNodeIdSet.has(light.id);
        return (
          <group
            key={light.id}
            position={light.position}
            {...makeWorkspaceNodeHandlers({
              nodeId: light.id,
              selectable: true,
              selectNode,
              toggleSelectedNode,
              onSelect: undefined,
              onContextMenu,
            })}
            onPointerOver={() => {
              setHoveredId(light.id);
              setWorkspaceCursor("pointer");
            }}
            onPointerOut={() => {
              setHoveredId((current) => (current === light.id ? null : current));
              setWorkspaceCursor("default");
            }}
            scale={isHovered ? 1.08 : 1}
          >
            <mesh>
              <cylinderGeometry args={[0.18, 0.18, 0.05, 22]} />
              <meshStandardMaterial
                color="#eceff7"
                emissive={isSelected ? "#bfdbfe" : "#f8f2c0"}
                emissiveIntensity={isSelected ? 0.7 : 0.45}
                roughness={0.2}
                metalness={0.3}
              />
            </mesh>
            {/* Progressive disclosure: identity chip only on hover/selection */}
            {(isHovered || isSelected) && (
              <SceneHtml position={[0, 0.3, 0]} center distanceFactor={12} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
                <MarkerHoverChip
                  label={light.name ?? "Security Light"}
                  detail="Light"
                  color="#facc15"
                  emphasized={isSelected}
                />
              </SceneHtml>
            )}
          </group>
        );
      })}
    </group>
  );
}

function SensorMarkers({
  onContextMenu,
}: {
  onContextMenu?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const scene = useFilteredScene();
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const selectNode = useStudioStore((s) => s.selectNode);
  const toggleSelectedNode = useStudioStore((s) => s.toggleSelectedNode);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

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
        const isSelected = selectedNodeIdSet.has(sensor.id);
        return (
          <group
            key={sensor.id}
            position={sensor.position}
            {...makeWorkspaceNodeHandlers({
              nodeId: sensor.id,
              selectable: true,
              selectNode,
              toggleSelectedNode,
              onSelect: undefined,
              onContextMenu,
            })}
            onPointerOver={() => {
              setHoveredId(sensor.id);
              setWorkspaceCursor("pointer");
            }}
            onPointerOut={() => {
              setHoveredId((current) => (current === sensor.id ? null : current));
              setWorkspaceCursor("default");
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
            {/* Progressive disclosure: identity chip only on hover/selection */}
            {(isHovered || isSelected) && (
              <SceneHtml position={[0, 0.32, 0]} center distanceFactor={12} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
                <MarkerHoverChip
                  label={sensor.label || (SENSOR_TYPE_LABELS[sensor.sensorType] ?? "Sensor")}
                  detail={SENSOR_TYPE_LABELS[sensor.sensorType] ?? "Sensor"}
                  color={color}
                  emphasized={isSelected}
                />
              </SceneHtml>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Minimal identity chip revealed when a marker is hovered or selected. */
function MarkerHoverChip({
  label,
  detail,
  color,
  emphasized,
}: {
  label: string;
  detail?: string;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(10,13,19,0.9)",
        border: `1px solid ${emphasized ? "#60a5fa" : color}`,
        borderRadius: 4,
        padding: "2px 6px",
        backdropFilter: "blur(5px)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.04em", color: emphasized ? "#dbeafe" : "#c4cfe4" }}>
        {label.toUpperCase()}
      </span>
      {detail && detail !== label ? (
        <span style={{ fontSize: 6, fontWeight: 600, color: "#64748b" }}>{detail}</span>
      ) : null}
    </div>
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
      {...makeWorkspaceNodeHandlers({
        nodeId: zone.id,
        selectable: true,
        selectNode,
        toggleSelectedNode,
        onSelect,
        onContextMenu,
      })}
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
        <SceneHtml position={[cx, 0.05, cz]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <CriticalZoneLabelCard
            label={zone.label}
            requiredQuality={zone.requiredQuality}
            status={status}
            borderColor={color}
            badgeBg={badgeBg}
            badgeText={badgeText}
            compact={overlayDensity === "compact" && !selected}
          />
        </SceneHtml>
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
  const scene = useFilteredScene();
  const obsWarningsVisible = useStudioStore((s) => s.overlayFilters.obstructionWarnings);
  if (!layers.labels || !obsWarningsVisible) return null;

  const affectedCamera = scene.cameras.find((camera) => camera.id === issue.affectedCameras[0]);

  return (
    <SceneHtml position={position} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <ObstructionWarningCard
        obstructionLabel={obstructionLabel}
        affectedCameraName={affectedCamera?.name}
      />
    </SceneHtml>
  );
}

function EntryDoorLabel({ position }: { position: [number, number] }) {
  const layers = useStudioStore((s) => s.layerVisibility);
  const entryChipsVisible = useStudioStore((s) => s.overlayFilters.entryChips);
  if (!layers.labels || !entryChipsVisible) return null;

  return (
    <SceneHtml position={[position[0], 0.14, position[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <EntryDoorChip label="ENTRY DOOR" />
    </SceneHtml>
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
  const scene = useFilteredScene();
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const layers = useStudioStore((s) => s.layerVisibility);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const [width, depth] = useMemo(
    () => sanitizeSceneDimensions(scene.dimensions.width, scene.dimensions.depth, 0.5),
    [scene.dimensions.depth, scene.dimensions.width],
  );

  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const pathLabelsVisible = useStudioStore((s) => s.overlayFilters.pathLabels);
  const adversaryShadowVisible = useStudioStore((s) => s.overlayFilters.adversaryShadow);
  // Data-driven: one warning per blindspot issue, positioned above the matched obstruction.
  // Obstruction matching first prefers the canonical parsed label, then robust fallback heuristics.
  const blockingIssues = result?.issues.filter((issue) => issue.category === "blindspot") ?? [];
  const entryDoor = scene.entryPoints[0];
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const is3D = canvasMode === "orbit_3d";

  return (
    <>
      <SceneEnvironmentSphere theme="day" visible={is3D} />
      {layers.walls_floors && (
        <>
          <SceneFloor width={width} depth={depth} showGrid={false} appearance={scene.sceneAppearance?.surfaces?.floor} />
          <SceneContactShadows width={width} depth={depth} />
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
        <SceneWalls walls={scene.walls} onContextMenu={onObjectContextMenu} defaultAppearance={scene.sceneAppearance?.surfaces?.wall} />
      ) : null}

      <SceneDoors doors={scene.doors} onContextMenu={onObjectContextMenu} />
      <SceneWindows windows={scene.windows} onContextMenu={onObjectContextMenu} />

      {layers.obstructions ? (
        <SceneObstructions obstructions={scene.obstructions} selectedId={selected} onContextMenu={onObjectContextMenu} />
      ) : null}
      <SensorMarkers onContextMenu={onObjectContextMenu} />
      {layers.lights ? <CeilingLightMarkers onContextMenu={onObjectContextMenu} /> : null}

      {blockingIssues.map((issue) => {
        const matchingObs = findObstructionForBlindspotIssue(issue, scene.obstructions);
        if (!layers.labels || !matchingObs) return null;
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

      {result?.crowdOcclusion?.chokepoints && result.crowdOcclusion.chokepoints.length > 0 ? (
        <CrowdChokepointOverlay chokepoints={result.crowdOcclusion.chokepoints} />
      ) : null}

      {scene.criticalZones.map((zone) => (
        <CriticalZoneOverlay
          key={zone.id}
          zone={zone}
          selected={selectedNodeIdSet.has(zone.id)}
          onSelect={selectNode}
          onContextMenu={onObjectContextMenu}
          result={result?.criticalZoneResults.find((entry) => entry.zoneId === zone.id)}
        />
      ))}

      {entryDoor ? <EntryDoorLabel position={entryDoor.position} /> : null}

      {layers.cameras ? scene.cameras.map((cam) => <CameraMarker key={cam.id} camera={cam} selected={selectedNodeIdSet.has(cam.id)} onContextMenu={onObjectContextMenu} />) : null}
      {layers.camera_cones ? scene.cameras.map((cam) => <CameraFrustum key={`frust_${cam.id}`} camera={cam} selected={selectedNodeIdSet.has(cam.id)} onContextMenu={onObjectContextMenu} />) : null}

      {layers.paths && pathLabelsVisible
        ? scene.paths.map((path) => (
          <ScenePathLine
            key={path.id}
            id={path.id}
            points={path.points.map((point) => point.position)}
            onSelect={selectNode}
            onContextMenu={onObjectContextMenu}
            color={selectedNodeIdSet.has(path.id) ? "#f59e0b" : undefined}
          />
        ))
        : null}

      {(adversaryShadowVisible || (layers.paths && pathLabelsVisible)) && result?.adversarialPath ? (
        <CoverageSegmentPath waypoints={result.adversarialPath.waypoints} ghosted={adversaryShadowVisible && !(layers.paths && pathLabelsVisible)} />
      ) : null}

      {layers.privacy_zones && scene.privacyZones.length > 0 ? (
        <ScenePrivacyZones zones={scene.privacyZones} onSelect={selectNode} onContextMenu={onObjectContextMenu} />
      ) : null}

      {layers.paths ? <PathReplayActor /> : null}
    </>
  );
}

function PathReplayActor() {
  const scene = useFilteredScene();
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
  const scene = useFilteredScene();
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const canvasViewResetTick = useStudioStore((s) => s.canvasViewResetTick);
  const focusRequest = useStudioStore((s) => s.focusScenePointRequest);
  const clearFocusRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const [sceneWidth, sceneDepth] = useMemo(
    () => sanitizeSceneDimensions(scene.dimensions.width, scene.dimensions.depth, 0.5),
    [scene.dimensions.depth, scene.dimensions.width],
  );
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
  const scene = useFilteredScene();
  const criticalZoneTargetType = useStudioStore((s) => s.criticalZoneTargetType);
  const sensorPlacementType = useStudioStore((s) => s.sensorPlacementType);
  const editor = useStudioStore((s) => s.editor);
  const { draftWallStart, draftPolygonPoints, draftPathPoints, hoverPoint, placementAim } = editor;
  const setEditorHoverPoint = useStudioStore((s) => s.setEditorHoverPoint);
  const setPlacementAim = useStudioStore((s) => s.setPlacementAim);
  const obstructionPresetId = useStudioStore((s) => s.obstructionPresetId);
  const customObstructionDimensions = useStudioStore((s) => s.customObstructionDimensions);
  const setEditorFeedbackMessage = useStudioStore((s) => s.setEditorFeedbackMessage);
  const setDraftWallStart = useStudioStore((s) => s.setDraftWallStart);
  const setDraftPolygonPoints = useStudioStore((s) => s.setDraftPolygonPoints);
  const setDraftPathPoints = useStudioStore((s) => s.setDraftPathPoints);
  const setEditorMode = useStudioStore((s) => s.setEditorMode);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const cameraPresetId = useStudioStore((s) => s.cameraPresetId);
  const setMeasurementTool = useStudioStore((s) => s.setMeasurementTool);
  const setCommentTool = useStudioStore((s) => s.setCommentTool);
  const addComment = useStudioStore((s) => s.addComment);
  const sceneCameras = useStudioStore((s) => s.scene.cameras);
  const { camera, size } = useThree();

  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const floorRef = useRef<THREE.Mesh>(null!);
  const lastHoverRef = useRef<[number, number] | null>(null);
  const aimDraggedRef = useRef(false);
  const placementAimRef = useRef(placementAim);
  placementAimRef.current = placementAim;
  const hasEntryPointsRef = useRef(scene.entryPoints.length > 0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [sceneWidth, sceneDepth] = useMemo(
    () => sanitizeSceneDimensions(scene.dimensions.width, scene.dimensions.depth, 0.5),
    [scene.dimensions.depth, scene.dimensions.width],
  );
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
      if (event.nativeEvent.button !== 0) return null;
      if (!size.width || !size.height || !sceneWidth || !sceneDepth) return null;
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

      // While aiming a camera, the cursor steers the yaw instead of the hover ghost.
      if (activeTool === "camera" && placementAim) {
        const yawDeg = computeAimYawDeg(placementAim.anchor, [point.x, point.z]);
        const distance = Math.hypot(point.x - placementAim.anchor[0], point.z - placementAim.anchor[1]);
        if (distance >= AIM_DRAG_THRESHOLD_M) {
          aimDraggedRef.current = true;
          if (yawDeg !== placementAim.yawDeg) {
            setPlacementAim({ anchor: placementAim.anchor, yawDeg });
          }
        }
        return;
      }

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
    [activeTool, draftWallStart, getFloorPoint, isPlacing, placementAim, selectionDrag, setEditorFeedbackMessage, setEditorHoverPoint, setPlacementAim, setSelectionDrag, snapEngine],
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
      if (!isPrimaryMouseEvent(event)) return;
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
        // Start drag-to-aim: anchor here, yaw follows the cursor until release.
        aimDraggedRef.current = false;
        setPlacementAim({ anchor: [workingSnap[0], workingSnap[1]], yawDeg: DEFAULT_PLACEMENT_YAW_DEG });
        setEditorFeedbackMessage("Drag to aim · release to place");
      } else if (activeTool === "obstruction") {
        const preset = getObstructionPreset(obstructionPresetId);
        const dimensions = resolvePresetDimensions(preset, customObstructionDimensions);
        const node = createObstructionNode([pos[0], dimensions[2] / 2, pos[2]], preset.obstructionType, {
          dimensions,
          material: preset.material,
          visionTransmission: preset.visionTransmission,
          glareRisk: preset.glareRisk,
          nightIRReflective: preset.nightIRReflective,
          movable: preset.movable,
        });
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
      } else if (activeTool === "measure") {
        const nearest = sceneCameras.reduce<{ id: string; dist: number } | null>((best, cam) => {
          const dx = cam.position[0] - pos[0];
          const dz = cam.position[2] - pos[2];
          const dist = Math.hypot(dx, dz);
          return !best || dist < best.dist ? { id: cam.id, dist } : best;
        }, null);
        if (nearest && nearest.dist <= 20) {
          setMeasurementTool({ active: true, sourceCameraId: nearest.id, targetPoint: pos, result: null });
          setEditorFeedbackMessage(`Measurement from ${nearest.id}: ${nearest.dist.toFixed(1)}m`);
        } else {
          setEditorFeedbackMessage("No camera within 20m for measurement");
        }
      } else if (activeTool === "comment") {
        addComment(pos, "New annotation", "Operator", null);
        setCommentTool({ active: true, position: pos, attachedToNodeId: null, draftText: "New annotation" });
        setEditorFeedbackMessage("Comment placed");
      }
    },
    [
      addNode,
      activeTool,
      commitDraftPath,
      commitDraftPolygon,
      clearSelection,
      customObstructionDimensions,
      draftPathPoints,
      draftPolygonPoints,
      draftWallStart,
      getFloorPoint,
      hoverPoint,
      isPlacing,
      obstructionPresetId,
      scene.assumptions.wallHeightM,
      sensorPlacementType,
      selectNode,
      setDraftPathPoints,
      setDraftPolygonPoints,
      setDraftWallStart,
      setEditorMode,
      setEditorFeedbackMessage,
      setPlacementAim,
      setSelectionDrag,
      snapEngine,
      sceneCameras,
      setMeasurementTool,
      setCommentTool,
      addComment,
    ],
  );

  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const onMouseUp = () => {
      if (!selectionDrag) return;
      const bounds = normalizeBounds(selectionDrag.startWorld, selectionDrag.currentWorld);
      const ids = getSceneSelectionIds(sceneRef.current, bounds);
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
  }, [clearSelection, selectionDrag, setSelectedNodes, setSelectionDrag]);

  // Commit the aimed camera when the pointer is released anywhere.
  useEffect(() => {
    if (!placementAim) return;
    const onPointerUp = () => {
      const aim = placementAimRef.current;
      if (!aim) return;
      const preset = getCameraPreset(cameraPresetId);
      const node = createCameraNode([aim.anchor[0], 2.8, aim.anchor[1]]);
      if (preset) {
        Object.assign(node, applyCameraPreset(preset));
      }
      if (aimDraggedRef.current) {
        node.yawDeg = aim.yawDeg;
      }
      addNode(node);
      selectNode(node.id);
      setPlacementAim(undefined);
      setEditorFeedbackMessage(aimDraggedRef.current ? `Camera placed facing ${aim.yawDeg}°` : null);
      aimDraggedRef.current = false;
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [addNode, cameraPresetId, placementAim, selectNode, setEditorFeedbackMessage, setPlacementAim]);

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
  const visibleHoverPos = activeTool === "select" || placementAim ? null : hoverPos;
  const ghostCameraPreset = getCameraPreset(cameraPresetId);
  const ghostFovDeg = ghostCameraPreset?.fovHorizontalDeg ?? 90;
  const ghostRangeM = ghostCameraPreset?.rangeM ?? 12;
  const ghostObstructionPreset = getObstructionPreset(obstructionPresetId);
  const ghostObstructionDims = resolvePresetDimensions(ghostObstructionPreset, customObstructionDimensions);

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
              <AimFovWedge yawDeg={DEFAULT_PLACEMENT_YAW_DEG} fovDeg={ghostFovDeg} rangeM={ghostRangeM} color={ghostColor} opacity={0.1} />
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
            <mesh position={[0, ghostObstructionDims[2] / 2, 0]}>
              <boxGeometry args={[ghostObstructionDims[0], ghostObstructionDims[2], ghostObstructionDims[1]]} />
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
          <SceneHtml position={[0, 0.35, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
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
          </SceneHtml>
        </group>
      )}

      {/* Drag-to-aim ghost: anchored camera with live FOV wedge following the cursor */}
      {activeTool === "camera" && placementAim ? (
        <group position={[placementAim.anchor[0], 0.03, placementAim.anchor[1]]}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 18]} />
            <meshBasicMaterial color={ghostColor} transparent opacity={0.6} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <ringGeometry args={[0.15, 0.3, 24]} />
            <meshBasicMaterial color={ghostColor} transparent opacity={0.7} />
          </mesh>
          <AimFovWedge yawDeg={placementAim.yawDeg} fovDeg={ghostFovDeg} rangeM={ghostRangeM} color={ghostColor} opacity={0.22} />
          <SceneHtml position={[0, 0.4, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "rgba(0,0,0,0.78)",
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
              {`Aim ${placementAim.yawDeg}° · release to place`}
            </div>
          </SceneHtml>
        </group>
      ) : null}

      {activeTool === "measure" && isHovering && hoverPoint ? (
        <SelectionOverlay center={hoverPoint} label={tooltipText} showSnap />
      ) : null}
    </>
  );
}

/**
 * Flat field-of-view wedge on the floor showing where a camera will look.
 * Default orientation faces -Z (engine yaw 0); rotated to the live aim yaw.
 */
function AimFovWedge({
  yawDeg,
  fovDeg,
  rangeM,
  color,
  opacity,
}: {
  yawDeg: number;
  fovDeg: number;
  rangeM: number;
  color: string;
  opacity: number;
}) {
  const shape = useMemo(() => {
    const wedge = new THREE.Shape();
    const half = (Math.min(fovDeg, 170) / 2) * (Math.PI / 180);
    const radius = Math.max(1, Math.min(rangeM * 0.6, 7));
    wedge.moveTo(0, 0);
    wedge.absarc(0, 0, radius, Math.PI / 2 - half, Math.PI / 2 + half, false);
    wedge.lineTo(0, 0);
    return wedge;
  }, [fovDeg, rangeM]);

  return (
    <group rotation={[0, -(yawDeg * Math.PI) / 180, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}


function EditorStatusBanner() {
  const message = useStudioStore((s) => s.editor.feedbackMessage);

  if (!message) return null;

  return (
    <div className={`pointer-events-none absolute bottom-14 left-3 z-10 max-w-[min(32rem,calc(100%-1.5rem))] rounded-lg border ${UI_SURFACES.borderDark} ${UI_SURFACES.panel}/92 px-3 py-2 text-[10px] font-medium ${UI_SURFACES.textBody2} shadow-xl`}>
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

const HEATMAP_CARD_DWELL_MS = 350;

function HeatmapCellExplainabilityCard() {
  const hover = useStudioStore((s) => s.heatmapHover);
  const scene = useFilteredScene();
  const heatmapMode = useStudioStore((s) => s.heatmapMode);
  const editorMode = useStudioStore((s) => s.editor.editorMode);
  // Dwell gate: the card only appears once the pointer rests on a cell.
  // Every hover update (i.e. any pointer movement) restarts the timer, so
  // sweeping the mouse across the heatmap stays visually quiet while the
  // full explainability data remains one short pause away.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!hover) return undefined;
    const timer = window.setTimeout(() => setSettled(true), HEATMAP_CARD_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [hover]);

  if (!hover || !settled || editorMode === "transforming") return null;

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
      className={`pointer-events-none absolute z-20 w-85 rounded-xl border border-[#25304a] bg-[#0a0f1a]/95 p-3 text-[10px] ${UI_SURFACES.textBody2} shadow-[0_16px_40px_rgba(0,0,0,0.38)]`}
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
  const scene = useFilteredScene();
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
  const isAimingCamera = useStudioStore((s) => Boolean(s.editor.placementAim));
  const rootActiveTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setScene = useStudioStore((s) => s.setScene);
  const referenceScenes = useStudioStore((s) => s.referenceScenes);
  // Effective lighting = built-in environment theme merged with the scene's
  // persisted appearance customization (scene.sceneAppearance).
  const lighting = resolveSceneLighting(envMode, scene.sceneAppearance);
  const [sceneWidth, sceneDepth] = useMemo(
    () => sanitizeSceneDimensions(scene.dimensions.width, scene.dimensions.depth, 0.5),
    [scene.dimensions.depth, scene.dimensions.width],
  );
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ObjectContextMenuState | null>(null);
  const frame = useMemo(
    () => getMapFrame(sceneWidth, sceneDepth),
    [sceneDepth, sceneWidth],
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

    applyContextActionPlan(node.id, plan, {
      patchNode: (nodeId, patch) => updateNode(nodeId, patch),
      duplicateNode,
      removeNode,
      focusPoint: (point) => setFocusScenePointRequest({ point, source: "minimap" }),
      openCameraView: (cameraId) => {
        setSelectedCameraId(cameraId);
        setWorkspacePreset("coverage");
        setViewMode("camera_view");
      },
      showMessage: setEditorFeedbackMessage,
    });

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
    if (!layerVisibility.heatmap) {
      setHeatmapHover(null);
    }
  }, [layerVisibility.heatmap, setHeatmapHover]);

  const handleHeatmapHover = useCallback((cell: CoverageCellResult, event: ThreeEvent<PointerEvent>) => {
    // Quiet hover: never surface cell explainability while a mouse button is
    // down (orbiting, box-selecting, or dragging a transform handle) — the
    // pointer sweeping across the floor during those gestures used to pop
    // the card constantly and made the canvas feel overloaded.
    if (event.nativeEvent.buttons !== 0) {
      setHeatmapHover(null);
      return;
    }
    setHeatmapHover({
      cell,
      screenX: event.nativeEvent.clientX,
      screenY: event.nativeEvent.clientY,
    });
  }, [setHeatmapHover]);

  const clearHeatmapHover = useCallback(() => {
    setHeatmapHover(null);
  }, [setHeatmapHover]);

  useEffect(() => () => {
    setWorkspaceCursor("default");
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden ${UI_SURFACES.page}`}>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.06),transparent_46%),linear-gradient(180deg,rgba(6,9,14,0.1),rgba(6,9,14,0.48)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/28 to-transparent" />

      {visibleComponents.coverage_legend ? <CoverageLegend /> : null}
      {visibleComponents.north_compass ? <NorthCompass /> : null}
      {visibleComponents.viewport_controls ? <ViewControls /> : null}
      {visibleComponents.control_hint_bar ? <ControlHintBar /> : null}
      {visibleComponents.level_switcher ? <LevelSwitcher /> : null}
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
          <ObstructionPresetPicker />
        </div>
      ) : null}

      {/* Live "what will this camera see" preview while placing/aiming */}
      <PlacementPreviewPanel />

      {/* Floating contextual task bar for the current selection */}
      <SelectionContextBar />

      {/* Empty-state guide: shown only in map view when no cameras exist */}
      {scene.cameras.length === 0 && rootActiveTool === "select" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-auto flex flex-col items-center gap-4">
            <button
              type="button"
              className="flex flex-col items-center gap-3 rounded-2xl border border-[#1e2536] bg-[#0b0f1a]/85 px-7 py-5 text-center backdrop-blur-sm transition-colors hover:border-[#2d3a54] hover:bg-[#0f1422]/95"
              onClick={(e) => { e.stopPropagation(); setActiveTool("camera"); }}
            >
              <div className="flex size-11 items-center justify-center rounded-xl border border-[#1e2840] bg-[#111828]">
                <Camera className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#c8d5ee]">Add your first camera</p>
                <p className="mt-1 text-[9px] leading-relaxed text-[#4d5c7a]">
                  Click here to activate the camera tool
                  <br />
                  or press{" "}
                  <kbd className="rounded border border-[#2a3652] bg-[#0e1525] px-1 py-0.5 font-mono text-[8px] text-[#7a9bcc]">
                    C
                  </kbd>
                </p>
              </div>
            </button>

            {referenceScenes.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[9px] text-[#3a4560]">or try a demo scene</p>
                <div className="flex items-center gap-2">
                  {referenceScenes.slice(0, 3).map((ref) => (
                    <button
                      key={ref.id}
                      type="button"
                      onClick={() => setScene(ref)}
                      className="rounded-lg border border-[#1e2536] bg-[#0b0f1a]/80 px-3 py-1.5 text-[9px] text-[#7a8fac] backdrop-blur-sm transition-colors hover:border-[#2d3a54] hover:text-[#b0c0d8]"
                    >
                      {ref.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {canvasMode === "plan_2d" ? (
        <PlanView2D />
      ) : (
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: lighting.background }}
      >
        <SceneEnvironmentSetup
          tier="high"
          intensityScale={lighting.iblIntensityScale}
          toneMappingExposure={lighting.toneMappingExposure}
        />
        {lighting.shadows && (
          <SceneShadowCaster tier="high" maxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)} />
        )}
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
        <color attach="background" args={[lighting.background]} />
        {lighting.fogEnabled && (
          <fog attach="fog" args={[lighting.fogColor, lighting.fogNear ?? 12, lighting.fogFar ?? 24]} />
        )}

        <ambientLight intensity={lighting.ambient} />
        <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={lighting.hemisphere} />
        <directionalLight
          position={[10, 14, 8]}
          intensity={lighting.directional}
          color={lighting.keyLightColor}
          castShadow={lighting.shadows}
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 8, -8]} intensity={lighting.fill} color={lighting.fillLightColor} />
        {lighting.practicalLights && (
          <pointLight
            position={[5, 2.8, 3.5]}
            intensity={(envMode === "night" ? 1.0 : 1.45) * lighting.practicalIntensity}
            distance={10}
            color="#fff6d8"
          />
        )}

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
          enabled={editorMode !== "transforming" && !isAimingCamera}
          enableRotate={!isTopDown && rootActiveTool !== "camera"}
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
      )}
    </div>
  );
}
