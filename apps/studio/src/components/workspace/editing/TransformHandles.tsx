"use client";

import { SceneHtml } from "@/components/shared/SceneHtml";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";

import type {
  AnyEditableNode,
  CameraNode,
  CriticalZoneNode,
  ObstructionNode,
  PrivacyZoneNode,
  SensorNode,
  ScenarioPath,
  SecurityLightNode,
  WallNode,
} from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { AxisArrow, CenterPuck, GIZMO_AXIS_COLORS, GizmoRig, RotationRing } from "./GizmoParts";
import { makeSnapEngine } from "./SnapEngine";
import { insertPolygonVertex, pathLength, removePathPoint, removePolygonVertex, type Point2 } from "./editor-geometry";

export type TransformableNode =
  | CameraNode
  | SecurityLightNode
  | SensorNode
  | ObstructionNode
  | WallNode
  | CriticalZoneNode
  | PrivacyZoneNode
  | ScenarioPath;

export type HandleKind = "move" | "move_x" | "move_z" | "rotate" | "height" | "pitch" | "scale_x" | "scale_z" | "wall_start" | "wall_end" | "vertex" | "path_point" | "path_insert" | "polygon_insert";

const MOVE_HANDLES: ReadonlySet<HandleKind> = new Set(["move", "move_x", "move_z"]);

/**
 * Axis-constrained gizmo arrows zero out the other axis (Unity-style).
 * Exported for unit tests — this is the contract the X/Z arrows rely on.
 */
export function constrainMoveDelta(
  handle: HandleKind,
  deltaX: number,
  deltaZ: number,
): [number, number] {
  return [handle === "move_z" ? 0 : deltaX, handle === "move_x" ? 0 : deltaZ];
}

type DragState = {
  handle: HandleKind;
  index?: number;
  startClient: { x: number; y: number };
  startWorld: Point2;
  currentWorld: Point2;
  startNode: TransformableNode;
};

type SnapEngine = ReturnType<typeof makeSnapEngine>;

function cloneNode(node: TransformableNode): TransformableNode {
  return structuredClone(node);
}

function getCenterForNode(node: TransformableNode): [number, number] {
  if (node.nodeType === "wall") {
    return [
      (node.start[0] + node.end[0]) / 2,
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
      [0, 0] as Point2,
    );
    const count = Math.max(1, node.polygon.length);
    return [centroid[0] / count, centroid[1] / count];
  }

  if (node.nodeType === "path") {
    const centroid = node.points.reduce(
      (acc, point) => {
        acc[0] += point.position[0];
        acc[1] += point.position[1];
        return acc;
      },
      [0, 0] as Point2,
    );
    const count = Math.max(1, node.points.length);
    return [centroid[0] / count, centroid[1] / count];
  }

  if ("position" in node) {
    return [node.position[0], node.position[2]];
  }

  return [0, 0];
}

function getPointFromEvent(
  event: MouseEvent,
  camera: THREE.Camera,
  size: { width: number; height: number },
  raycaster: THREE.Raycaster,
  planeY = 0,
): Point2 | null {
  const ndc = new THREE.Vector2(
    (event.clientX / size.width) * 2 - 1,
    -(event.clientY / size.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const point = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(plane, point);
  if (!hit) return null;
  return [point.x, point.z];
}

function getObstructionAxis(rotationYDeg: number) {
  const angle = (rotationYDeg * Math.PI) / 180;
  return {
    xAxis: [Math.cos(angle), Math.sin(angle)] as Point2,
    zAxis: [-Math.sin(angle), Math.cos(angle)] as Point2,
  };
}

function updateDraft(
  node: TransformableNode,
  drag: DragState,
  event: MouseEvent,
  camera: THREE.Camera,
  size: { width: number; height: number },
  raycaster: THREE.Raycaster,
  snapEngine: SnapEngine,
): TransformableNode {
  const next = cloneNode(node);
  const startPoint = drag.startWorld;
  const currentPoint = getPointFromEvent(event, camera, size, raycaster, 0) ?? startPoint;
  const snappedPoint = snapEngine.snapForPlacement(currentPoint, false).point;
  const wallPoint = snapEngine.snapForPlacement(currentPoint, true).point;
  const gridPoint = snapEngine.snapToGrid(currentPoint);
  const [deltaX, deltaZ] = constrainMoveDelta(
    drag.handle,
    snappedPoint[0] - startPoint[0],
    snappedPoint[1] - startPoint[1],
  );

  if (MOVE_HANDLES.has(drag.handle)) {
    if (next.nodeType === "camera" || next.nodeType === "security_light" || next.nodeType === "sensor" || next.nodeType === "obstruction") {
      const sn = drag.startNode as CameraNode | SecurityLightNode | SensorNode | ObstructionNode;
      next.position = [sn.position[0] + deltaX, sn.position[1], sn.position[2] + deltaZ];
    } else if (next.nodeType === "wall") {
      const sn = drag.startNode as WallNode;
      next.start = [sn.start[0] + deltaX, sn.start[1] + deltaZ];
      next.end = [sn.end[0] + deltaX, sn.end[1] + deltaZ];
    } else if (next.nodeType === "critical_zone" || next.nodeType === "privacy_zone") {
      const sn = drag.startNode as CriticalZoneNode | PrivacyZoneNode;
      next.polygon = sn.polygon.map(([x, z]) => [x + deltaX, z + deltaZ]);
    } else if (next.nodeType === "path") {
      const sn = drag.startNode as ScenarioPath;
      next.points = sn.points.map((point) => ({
        ...point,
        position: [point.position[0] + deltaX, point.position[1] + deltaZ] as [number, number],
      }));
    }
    return next;
  }

  if (drag.handle === "height") {
    const screenDelta = (drag.startClient.y - event.clientY) * 0.01;
    if (next.nodeType === "camera") {
      const sn = drag.startNode as CameraNode;
      const height = Math.max(0.6, sn.position[1] + screenDelta);
      next.position = [sn.position[0], height, sn.position[2]];
      next.mountHeightM = height;
    } else if (next.nodeType === "security_light") {
      const sn = drag.startNode as SecurityLightNode;
      const height = Math.max(0.4, sn.position[1] + screenDelta);
      next.position = [sn.position[0], height, sn.position[2]];
    } else if (next.nodeType === "obstruction") {
      const sn = drag.startNode as ObstructionNode;
      const height = Math.max(0.3, sn.dimensions[2] + screenDelta);
      next.dimensions = [sn.dimensions[0], sn.dimensions[1], height];
      next.position = [sn.position[0], height / 2, sn.position[2]];
    } else if (next.nodeType === "wall") {
      const sn = drag.startNode as WallNode;
      next.heightM = Math.max(1.2, sn.heightM + screenDelta);
    }
    return next;
  }

  if (drag.handle === "rotate") {
    const sn = drag.startNode as CameraNode | ObstructionNode;
    const angleDeg = Math.atan2(currentPoint[0] - sn.position[0], currentPoint[1] - sn.position[2]) * (180 / Math.PI);
    if (next.nodeType === "camera") {
      next.yawDeg = Math.round(angleDeg);
    } else if (next.nodeType === "obstruction") {
      next.rotationYDeg = Math.round(angleDeg);
    }
    return next;
  }

  if (drag.handle === "pitch" && next.nodeType === "camera") {
    const sn = drag.startNode as CameraNode;
    const pitchDelta = (event.clientY - drag.startClient.y) * 0.15;
    next.pitchDeg = Math.max(-85, Math.min(-1, Math.round(sn.pitchDeg + pitchDelta)));
    return next;
  }

  if (drag.handle === "scale_x" && next.nodeType === "obstruction") {
    const sn = drag.startNode as ObstructionNode;
    const [dx, dz] = getObstructionAxis(sn.rotationYDeg).xAxis;
    const projection = (currentPoint[0] - sn.position[0]) * dx + (currentPoint[1] - sn.position[2]) * dz;
    const width = Math.max(0.2, Math.abs(projection) * 2);
    next.dimensions = [width, sn.dimensions[1], sn.dimensions[2]];
    return next;
  }

  if (drag.handle === "scale_z" && next.nodeType === "obstruction") {
    const sn = drag.startNode as ObstructionNode;
    const [dx, dz] = getObstructionAxis(sn.rotationYDeg).zAxis;
    const projection = (currentPoint[0] - sn.position[0]) * dx + (currentPoint[1] - sn.position[2]) * dz;
    const depth = Math.max(0.2, Math.abs(projection) * 2);
    next.dimensions = [sn.dimensions[0], depth, sn.dimensions[2]];
    return next;
  }

  if (drag.handle === "wall_start" && next.nodeType === "wall") {
    next.start = wallPoint;
    return next;
  }

  if (drag.handle === "wall_end" && next.nodeType === "wall") {
    next.end = wallPoint;
    return next;
  }

  if (drag.handle === "vertex") {
    if (next.nodeType === "critical_zone" || next.nodeType === "privacy_zone") {
      const snZone = drag.startNode as CriticalZoneNode | PrivacyZoneNode;
      const nextPolygon = [...snZone.polygon];
      if (drag.index !== undefined && nextPolygon[drag.index]) {
        nextPolygon[drag.index] = gridPoint;
      }
      next.polygon = nextPolygon;
    } else if (next.nodeType === "path") {
      const snPath = drag.startNode as ScenarioPath;
      const nextPoints = [...snPath.points];
      if (drag.index !== undefined && nextPoints[drag.index]) {
        nextPoints[drag.index] = { ...nextPoints[drag.index]!, position: gridPoint };
      }
      next.points = nextPoints;
    }
    return next;
  }

  if (drag.handle === "path_point" && next.nodeType === "path") {
    const snPath = drag.startNode as ScenarioPath;
    const nextPoints = [...snPath.points];
    if (drag.index !== undefined && nextPoints[drag.index]) {
      nextPoints[drag.index] = { ...nextPoints[drag.index]!, position: gridPoint };
    }
    next.points = nextPoints;
    return next;
  }

  return next;
}

function commitNode(
  updateNode: (id: string, patch: Partial<AnyEditableNode>) => void,
  node: TransformableNode,
  preview: TransformableNode,
) {
  updateNode(node.id, preview as Partial<AnyEditableNode>);
}

function HandleSphere({
  position,
  color,
  onPointerDown,
  label,
  dim = false,
}: {
  position: [number, number, number];
  color: string;
  onPointerDown: (event: ReactPointerEvent) => void;
  label?: string;
  /** Secondary handles (e.g. midpoint inserts) stay faint until hovered. */
  dim?: boolean;
}) {
  // Labels are hover-only: a selected object used to sprout a cloud of
  // permanent chips (Move/Height/Yaw/W/D/V1..Vn) which was the single
  // biggest source of on-click visual overload. The handles remain always
  // visible and grabbable; their names appear when the pointer reaches them.
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onPointerDown={onPointerDown}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh scale={hovered ? 1.35 : 1}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.75 : 0.4}
          roughness={0.3}
          transparent={dim && !hovered}
          opacity={dim && !hovered ? 0.45 : 1}
        />
      </mesh>
      {label && hovered ? (
        <SceneHtml center position={[0, 0.22, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded border border-[#24304a] bg-[#0b0f17]/92 px-1.5 py-0.5 text-[8px] font-semibold text-[#d2d9e8] whitespace-nowrap">
            {label}
          </div>
        </SceneHtml>
      ) : null}
    </group>
  );
}

export function TransformHandles() {
  const scene = useStudioStore((s) => s.scene);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const editor = useStudioStore((s) => s.editor);
  const updateNode = useStudioStore((s) => s.updateNode);
  const translateSelectedNodes = useStudioStore((s) => s.translateSelectedNodes);
  const setEditorMode = useStudioStore((s) => s.setEditorMode);
  const setSelectedHandle = useStudioStore((s) => s.setSelectedHandle);
  const setEditorFeedbackMessage = useStudioStore((s) => s.setEditorFeedbackMessage);
  const selected = useMemo<TransformableNode | null>(() => {
    const collections: TransformableNode[] = [
      ...scene.cameras,
      ...scene.securityLights,
      ...scene.sensors,
      ...scene.obstructions,
      ...scene.walls,
      ...scene.criticalZones,
      ...scene.privacyZones,
      ...scene.paths,
    ];
    return collections.find((entry) => entry.id === selectedNodeId) ?? null;
  }, [scene, selectedNodeId]);

  const { camera, size } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const snapEngine = useMemo(() => makeSnapEngine(scene, {
    snapEnabled: editor.snapEnabled,
    snapDistanceM: editor.snapDistanceM,
    gridSnapM: editor.gridSnapM,
  }), [editor.gridSnapM, editor.snapDistanceM, editor.snapEnabled, scene]);
  const [preview, setPreview] = useState<TransformableNode | null>(null);
  const previewRef = useRef<TransformableNode | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const isGroupSelection = selectedNodeIds.length > 1;
  const groupSelection = isGroupSelection
    ? selectedNodeIds
        .map((id) => {
          const collections: TransformableNode[] = [
            ...scene.cameras,
            ...scene.securityLights,
            ...scene.sensors,
            ...scene.obstructions,
            ...scene.walls,
            ...scene.criticalZones,
            ...scene.privacyZones,
            ...scene.paths,
          ];
          return collections.find((entry) => entry.id === id) ?? null;
        })
        .filter((node): node is TransformableNode => Boolean(node))
    : [];
  const groupCenter = isGroupSelection
    ? groupSelection.reduce(
        (acc, node) => {
          const center = getCenterForNode(node);
          acc[0] += center[0];
          acc[1] += center[1];
          return acc;
        },
        [0, 0] as Point2,
      )
    : [0, 0];
  const groupCenterCount = Math.max(1, groupSelection.length);
  const groupAnchor: [number, number] = [groupCenter[0] / groupCenterCount, groupCenter[1] / groupCenterCount];

  useEffect(() => {
    if (!selected) {
      previewRef.current = null;
      dragRef.current = null;
      setEditorMode("idle");
    }

    // Defensive reset: if component unmounts mid-drag, restore editor mode
    return () => {
      if (dragRef.current) {
        dragRef.current = null;
        setEditorMode("idle");
        setSelectedHandle(undefined);
      }
    };
  }, [selected, setEditorMode, setSelectedHandle]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current || !selected) return;
      if (isGroupSelection && MOVE_HANDLES.has(dragRef.current.handle)) {
        const currentPoint = getPointFromEvent(event, camera, size, raycaster, 0) ?? dragRef.current.startWorld;
        const snappedPoint = snapEngine.snapForPlacement(currentPoint, false).point;
        dragRef.current.currentWorld = snappedPoint;
        return;
      }
      const next = updateDraft(selected, dragRef.current, event, camera, size, raycaster, snapEngine);
      previewRef.current = next;
      setPreview(next);
    };

    const onUp = () => {
      if (!dragRef.current || !selected) return;
      if (isGroupSelection && MOVE_HANDLES.has(dragRef.current.handle)) {
        const finalPoint = dragRef.current.currentWorld;
        const [deltaX, deltaZ] = constrainMoveDelta(
          dragRef.current.handle,
          finalPoint[0] - dragRef.current.startWorld[0],
          finalPoint[1] - dragRef.current.startWorld[1],
        );
        if (deltaX !== 0 || deltaZ !== 0) {
          translateSelectedNodes([deltaX, deltaZ]);
        }
        dragRef.current = null;
        setPreview(null);
        previewRef.current = null;
        setEditorMode("idle");
        setSelectedHandle(undefined);
        return;
      }
      const next = previewRef.current ?? preview ?? selected;
      commitNode(updateNode, selected, next);
      dragRef.current = null;
      setPreview(null);
      previewRef.current = null;
      setEditorMode("idle");
      setSelectedHandle(undefined);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [camera, isGroupSelection, preview, raycaster, selected, setEditorMode, setSelectedHandle, size, snapEngine, translateSelectedNodes, updateNode]);

  if (!selected) return null;

  const node = preview ?? selected;
  const center = getCenterForNode(node);

  const beginDrag = (handle: HandleKind, index?: number) => (event: ReactPointerEvent) => {
    event.stopPropagation();
    const startWorld = getPointFromEvent(event.nativeEvent, camera, size, raycaster, 0) ?? getCenterForNode(selected);
    let baseNode = selected;
    let nextHandle = handle;
    let nextIndex = index;

    if (handle === "path_insert" && selected.nodeType === "path" && index !== undefined) {
      const insertedPoints = [...selected.points];
      insertedPoints.splice(index + 1, 0, { position: startWorld });
      const inserted = {
        ...selected,
        points: insertedPoints,
      } as ScenarioPath;
      baseNode = inserted;
      nextHandle = "path_point";
      nextIndex = index + 1;
      const initialPreview = cloneNode(inserted);
      previewRef.current = initialPreview;
      setPreview(initialPreview);
      dragRef.current = {
        handle: nextHandle,
        index: nextIndex,
        startClient: { x: event.clientX, y: event.clientY },
        startWorld,
        currentWorld: startWorld,
        startNode: baseNode,
      };
      setEditorMode("transforming");
      setSelectedHandle(`path_insert:${index}`);
      setEditorFeedbackMessage(null);
      return;
    }

    if (handle === "polygon_insert" && (selected.nodeType === "critical_zone" || selected.nodeType === "privacy_zone") && index !== undefined) {
      const inserted = {
        ...selected,
        polygon: insertPolygonVertex(selected.polygon, index, startWorld),
      } as CriticalZoneNode | PrivacyZoneNode;
      baseNode = inserted;
      nextHandle = "vertex";
      nextIndex = index + 1;
      const initialPreview = cloneNode(inserted);
      previewRef.current = initialPreview;
      setPreview(initialPreview);
      dragRef.current = {
        handle: nextHandle,
        index: nextIndex,
        startClient: { x: event.clientX, y: event.clientY },
        startWorld,
        currentWorld: startWorld,
        startNode: baseNode,
      };
      setEditorMode("transforming");
      setSelectedHandle(`polygon_insert:${index}`);
      setEditorFeedbackMessage(null);
      return;
    }

    dragRef.current = {
      handle: nextHandle,
      index: nextIndex,
      startClient: { x: event.clientX, y: event.clientY },
      startWorld,
      currentWorld: startWorld,
      startNode: baseNode,
    };
    const initialPreview = cloneNode(baseNode);
    previewRef.current = initialPreview;
    setPreview(initialPreview);
    setEditorMode("transforming");
    setSelectedHandle(`${handle}${index !== undefined ? `:${index}` : ""}`);
    setEditorFeedbackMessage(null);
  };

  const removeVertexPoint = (nodeType: TransformableNode["nodeType"], index: number) => {
    if (!selected || index < 0) return;

    if (nodeType === "critical_zone" || nodeType === "privacy_zone") {
      const current = selected as CriticalZoneNode | PrivacyZoneNode;
      const nextPolygon = removePolygonVertex(current.polygon, index);
      if (!nextPolygon) {
        setEditorFeedbackMessage("Zone needs at least 3 points");
        return;
      }
      updateNode(current.id, { polygon: nextPolygon } as Partial<AnyEditableNode>);
      setEditorFeedbackMessage(null);
      return;
    }

    if (nodeType === "path") {
      const current = selected as ScenarioPath;
      const nextPoints = removePathPoint(current.points.map((point) => point.position), index);
      if (!nextPoints) {
        setEditorFeedbackMessage("Path needs at least 2 points");
        return;
      }
      updateNode(current.id, {
        points: nextPoints.map((position) => ({ position })),
      } as Partial<AnyEditableNode>);
      setEditorFeedbackMessage(null);
    }
  };

  if (node.nodeType === "camera") {
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color="#60a5fa" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    const yawRad = (node.yawDeg * Math.PI) / 180;

    return (
      <group>
        {/* Native-style gizmo at the camera's floor anchor: axis arrows for
            constrained moves, ring for yaw, green up-arrow for mount height. */}
        <GizmoRig center={[node.position[0], 0.05, node.position[2]]}>
          <CenterPuck color="#e2e8f0" onPointerDown={beginDrag("move")} label="Move" />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
          <AxisArrow direction={[0, 1, 0]} color={GIZMO_AXIS_COLORS.y} length={0.85} onPointerDown={beginDrag("height")} label="Height" />
          <RotationRing radius={0.85} color="#22c55e" onPointerDown={beginDrag("rotate")} label="Yaw" />
          {/* Yaw direction tick on the ring so the facing quadrant stays readable. */}
          <mesh position={[Math.sin(yawRad) * 0.85, 0.05, Math.cos(yawRad) * 0.85]} renderOrder={998}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshBasicMaterial color="#22c55e" depthTest={false} />
          </mesh>
        </GizmoRig>
        <HandleSphere position={[node.position[0], node.position[1] + 0.4, node.position[2]]} color="#38bdf8" onPointerDown={beginDrag("pitch")} label="Pitch" />
      </group>
    );
  }

  if (node.nodeType === "security_light") {
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color="#eab308" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    return (
      <GizmoRig center={[node.position[0], 0.05, node.position[2]]}>
        <CenterPuck color="#eab308" onPointerDown={beginDrag("move")} label="Move" />
        <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
        <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        <AxisArrow direction={[0, 1, 0]} color={GIZMO_AXIS_COLORS.y} length={0.85} onPointerDown={beginDrag("height")} label="Height" />
      </GizmoRig>
    );
  }

  if (node.nodeType === "sensor") {
    // Sensors previously had no on-canvas manipulation at all; the shared
    // XZ gizmo gives them the same move affordance as other point nodes.
    return (
      <GizmoRig center={[node.position[0], 0.05, node.position[2]]}>
        <CenterPuck color="#a78bfa" onPointerDown={beginDrag("move")} label="Move" />
        <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
        <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
      </GizmoRig>
    );
  }

  if (node.nodeType === "obstruction") {
    const [w, d, h] = node.dimensions;
    const { xAxis, zAxis } = getObstructionAxis(node.rotationYDeg);
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color="#fb923c" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    return (
      <group>
        <GizmoRig center={[node.position[0], 0.05, node.position[2]]}>
          <CenterPuck color="#e2e8f0" onPointerDown={beginDrag("move")} label="Move" />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
          <AxisArrow direction={[0, 1, 0]} color={GIZMO_AXIS_COLORS.y} length={0.85} onPointerDown={beginDrag("height")} label="Height" />
          <RotationRing radius={0.85} color="#22c55e" onPointerDown={beginDrag("rotate")} label="Rotate" />
        </GizmoRig>
        {/* Size handles stay on the box edges (they are dimension-relative). */}
        <HandleSphere position={[node.position[0] + xAxis[0] * (w / 2 + 0.45), node.position[1] + 0.08, node.position[2] + xAxis[1] * (w / 2 + 0.45)]} color="#38bdf8" onPointerDown={beginDrag("scale_x")} label="Width" dim />
        <HandleSphere position={[node.position[0] + zAxis[0] * (d / 2 + 0.45), node.position[1] + 0.08, node.position[2] + zAxis[1] * (d / 2 + 0.45)]} color="#38bdf8" onPointerDown={beginDrag("scale_z")} label="Depth" dim />
        <HandleSphere position={[node.position[0], node.position[1] + h / 2 + 0.3, node.position[2]]} color="#f59e0b" onPointerDown={beginDrag("height")} label="Height" dim />
      </group>
    );
  }

  if (node.nodeType === "wall") {
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color="#22c55e" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    return (
      <group>
        <HandleSphere position={[node.start[0], 0.08, node.start[1]]} color="#60a5fa" onPointerDown={beginDrag("wall_start")} label="Endpoint A" />
        <HandleSphere position={[node.end[0], 0.08, node.end[1]]} color="#60a5fa" onPointerDown={beginDrag("wall_end")} label="Endpoint B" />
        <GizmoRig center={[center[0], 0.05, center[1]]}>
          <CenterPuck color="#e2e8f0" onPointerDown={beginDrag("move")} label="Move" />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
          <AxisArrow direction={[0, 1, 0]} color={GIZMO_AXIS_COLORS.y} length={0.85} onPointerDown={beginDrag("height")} label="Wall height" />
        </GizmoRig>
      </group>
    );
  }

  if (node.nodeType === "critical_zone" || node.nodeType === "privacy_zone") {
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color={node.nodeType === "critical_zone" ? "#22c55e" : "#8b5cf6"} onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    return (
      <group>
        <GizmoRig center={[center[0], 0.05, center[1]]}>
          <CenterPuck color={node.nodeType === "critical_zone" ? "#22c55e" : "#8b5cf6"} onPointerDown={beginDrag("move")} label="Move zone" />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
        {node.polygon.map((point, index) => (
          <HandleSphere
            key={`${node.id}-${point[0].toFixed(1)}-${point[1].toFixed(1)}`}
            position={[point[0], 0.06, point[1]]}
            color={index === 0 ? "#bef264" : "#22c55e"}
            onPointerDown={(event) => {
              if (event.altKey || event.metaKey || event.ctrlKey) {
                event.stopPropagation();
                removeVertexPoint(node.nodeType, index);
                return;
              }
              beginDrag("vertex", index)(event);
            }}
            label={`V${index + 1}`}
          />
        ))}
        {node.polygon.map((point, index) => {
          const nextPoint = node.polygon[(index + 1) % node.polygon.length];
          if (!nextPoint) return null;
          const midpoint: [number, number, number] = [
            (point[0] + nextPoint[0]) / 2,
            0.06,
            (point[1] + nextPoint[1]) / 2,
          ];
          return (
            <HandleSphere
              key={`insert-${node.id}-${point[0].toFixed(1)}-${point[1].toFixed(1)}`}
              position={midpoint}
              color="#38bdf8"
              onPointerDown={beginDrag("polygon_insert", index)}
              label="Add point"
              dim
            />
          );
        })}
      </group>
    );
  }

  if (node.nodeType === "path") {
    const points = node.points.map((point) => point.position);
    if (isGroupSelection) {
      return (
        <GizmoRig center={[groupAnchor[0], 0.05, groupAnchor[1]]}>
          <CenterPuck color="#fb923c" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
      );
    }

    return (
      <group>
        <GizmoRig center={[center[0], 0.05, center[1]]}>
          <CenterPuck color="#fb923c" onPointerDown={beginDrag("move")} label="Move path" />
          <AxisArrow direction={[1, 0, 0]} color={GIZMO_AXIS_COLORS.x} onPointerDown={beginDrag("move_x")} label="Move X" />
          <AxisArrow direction={[0, 0, 1]} color={GIZMO_AXIS_COLORS.z} onPointerDown={beginDrag("move_z")} label="Move Z" />
        </GizmoRig>
        {points.slice(0, -1).map((point, index) => {
          const nextPoint = points[index + 1]!;
          const midpoint: [number, number, number] = [
            (point[0] + nextPoint[0]) / 2,
            0.06,
            (point[1] + nextPoint[1]) / 2,
          ];
          return (
            <HandleSphere
              key={`insert-${node.id}-${point[0].toFixed(1)}-${point[1].toFixed(1)}`}
              position={midpoint}
              color="#38bdf8"
              onPointerDown={beginDrag("path_insert", index)}
              label="Add point"
              dim
            />
          );
        })}
        {points.map((point, index) => (
          <HandleSphere
            key={`${node.id}-${point[0].toFixed(1)}-${point[1].toFixed(1)}`}
            position={[point[0], 0.06, point[1]]}
            color={index === 0 ? "#fde68a" : "#fb923c"}
            onPointerDown={(event) => {
              if (event.altKey || event.metaKey || event.ctrlKey) {
                event.stopPropagation();
                const nextPoints = removePathPoint(points, index);
                if (!nextPoints) {
                  setEditorFeedbackMessage("Path needs at least 2 points");
                  return;
                }
                updateNode(node.id, {
                  points: nextPoints.map((position) => ({ position })),
                } as Partial<AnyEditableNode>);
                setEditorFeedbackMessage(null);
                return;
              }
              beginDrag("path_point", index)(event);
            }}
            label={`P${index + 1}`}
          />
        ))}
        <SceneHtml position={[center[0], 0.22, center[1]]} center style={{ pointerEvents: "none" }}>
          <div className="rounded border border-[#24304a] bg-[#0b0f17]/90 px-2 py-1 text-[8px] font-semibold text-[#d2d9e8]">
            {pathLength(points).toFixed(2)}m
          </div>
        </SceneHtml>
      </group>
    );
  }

  return null;
}
