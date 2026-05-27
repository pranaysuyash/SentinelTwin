"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";

import type {
  AnyEditableNode,
  CameraNode,
  CriticalZoneNode,
  ObstructionNode,
  PrivacyZoneNode,
  ScenarioPath,
  SecurityLightNode,
  WallNode,
} from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { pathLength, type Point2 } from "./editor-geometry";

export type TransformableNode =
  | CameraNode
  | SecurityLightNode
  | ObstructionNode
  | WallNode
  | CriticalZoneNode
  | PrivacyZoneNode
  | ScenarioPath;

type HandleKind = "move" | "rotate" | "height" | "pitch" | "scale_x" | "scale_z" | "wall_start" | "wall_end" | "vertex" | "path_point";

type DragState = {
  handle: HandleKind;
  index?: number;
  startClient: { x: number; y: number };
  startWorld: Point2;
  currentWorld: Point2;
  startNode: TransformableNode;
};

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
): TransformableNode {
  const next = cloneNode(node);
  const startPoint = drag.startWorld;
  const currentPoint = getPointFromEvent(event, camera, size, raycaster, 0) ?? startPoint;
  const deltaX = currentPoint[0] - startPoint[0];
  const deltaZ = currentPoint[1] - startPoint[1];

  if (drag.handle === "move") {
    if (next.nodeType === "camera" || next.nodeType === "security_light" || next.nodeType === "obstruction") {
      const sn = drag.startNode as CameraNode | SecurityLightNode | ObstructionNode;
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
    next.start = currentPoint;
    return next;
  }

  if (drag.handle === "wall_end" && next.nodeType === "wall") {
    next.end = currentPoint;
    return next;
  }

  if (drag.handle === "vertex") {
    if (next.nodeType === "critical_zone" || next.nodeType === "privacy_zone") {
      const snZone = drag.startNode as CriticalZoneNode | PrivacyZoneNode;
      const nextPolygon = [...snZone.polygon];
      if (drag.index !== undefined && nextPolygon[drag.index]) {
        nextPolygon[drag.index] = currentPoint;
      }
      next.polygon = nextPolygon;
    } else if (next.nodeType === "path") {
      const snPath = drag.startNode as ScenarioPath;
      const nextPoints = [...snPath.points];
      if (drag.index !== undefined && nextPoints[drag.index]) {
        nextPoints[drag.index] = { ...nextPoints[drag.index]!, position: currentPoint };
      }
      next.points = nextPoints;
    }
    return next;
  }

  if (drag.handle === "path_point" && next.nodeType === "path") {
    const snPath = drag.startNode as ScenarioPath;
    const nextPoints = [...snPath.points];
    if (drag.index !== undefined && nextPoints[drag.index]) {
      nextPoints[drag.index] = { ...nextPoints[drag.index]!, position: currentPoint };
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
}: {
  position: [number, number, number];
  color: string;
  onPointerDown: (event: ReactPointerEvent) => void;
  label?: string;
}) {
  return (
    <group position={position} onPointerDown={onPointerDown}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} />
      </mesh>
      {label ? (
        <Html center position={[0, 0.18, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded border border-[#24304a] bg-[#0b0f17]/90 px-1.5 py-0.5 text-[8px] font-semibold text-[#d2d9e8]">
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

export function TransformHandles() {
  const scene = useStudioStore((s) => s.scene);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const updateNode = useStudioStore((s) => s.updateNode);
  const translateSelectedNodes = useStudioStore((s) => s.translateSelectedNodes);
  const setEditorMode = useStudioStore((s) => s.setEditorMode);
  const setSelectedHandle = useStudioStore((s) => s.setSelectedHandle);
  const selected = useMemo<TransformableNode | null>(() => {
    const collections: TransformableNode[] = [
      ...scene.cameras,
      ...scene.securityLights,
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
  }, [selected, setEditorMode]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current || !selected) return;
      if (isGroupSelection && dragRef.current.handle === "move") {
        const currentPoint = getPointFromEvent(event, camera, size, raycaster, 0) ?? dragRef.current.startWorld;
        dragRef.current.currentWorld = currentPoint;
        return;
      }
      const next = updateDraft(selected, dragRef.current, event, camera, size, raycaster);
      previewRef.current = next;
      setPreview(next);
    };

    const onUp = () => {
      if (!dragRef.current || !selected) return;
      if (isGroupSelection && dragRef.current.handle === "move") {
        const finalPoint = dragRef.current.currentWorld;
        const deltaX = finalPoint[0] - dragRef.current.startWorld[0];
        const deltaZ = finalPoint[1] - dragRef.current.startWorld[1];
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
  }, [camera, isGroupSelection, preview, raycaster, selected, setEditorMode, setSelectedHandle, size, translateSelectedNodes, updateNode]);

  if (!selected) return null;

  const node = preview ?? selected;
  const center = getCenterForNode(node);

  const beginDrag = (handle: HandleKind, index?: number) => (event: ReactPointerEvent) => {
    event.stopPropagation();
    const startWorld = getPointFromEvent(event.nativeEvent, camera, size, raycaster, 0) ?? getCenterForNode(selected);
    dragRef.current = {
      handle,
      index,
      startClient: { x: event.clientX, y: event.clientY },
      startWorld,
      currentWorld: startWorld,
      startNode: selected,
    };
    const initialPreview = cloneNode(selected);
    previewRef.current = initialPreview;
    setPreview(initialPreview);
    setEditorMode("transforming");
    setSelectedHandle(`${handle}${index !== undefined ? `:${index}` : ""}`);
  };

  if (node.nodeType === "camera") {
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], node.position[1], groupAnchor[1]]} color="#60a5fa" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <HandleSphere position={[node.position[0], node.position[1], node.position[2]]} color="#60a5fa" onPointerDown={beginDrag("move")} label="Move" />
        <HandleSphere position={[node.position[0], Math.max(0.5, node.position[1] + 0.7), node.position[2]]} color="#f59e0b" onPointerDown={beginDrag("height")} label="Height" />
        <HandleSphere position={[node.position[0], node.position[1] + 0.95, node.position[2] + 0.12]} color="#38bdf8" onPointerDown={beginDrag("pitch")} label="Pitch" />
        <HandleSphere position={[node.position[0] + Math.cos((node.yawDeg * Math.PI) / 180) * 0.8, node.position[1], node.position[2] + Math.sin((node.yawDeg * Math.PI) / 180) * 0.8]} color="#22c55e" onPointerDown={beginDrag("rotate")} label="Yaw" />
      </group>
    );
  }

  if (node.nodeType === "security_light") {
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], node.position[1], groupAnchor[1]]} color="#eab308" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <HandleSphere position={[node.position[0], node.position[1], node.position[2]]} color="#eab308" onPointerDown={beginDrag("move")} label="Move" />
        <HandleSphere position={[node.position[0], node.position[1] + 0.7, node.position[2]]} color="#f59e0b" onPointerDown={beginDrag("height")} label="Height" />
      </group>
    );
  }

  if (node.nodeType === "obstruction") {
    const [w, d, h] = node.dimensions;
    const { xAxis, zAxis } = getObstructionAxis(node.rotationYDeg);
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], node.position[1], groupAnchor[1]]} color="#fb923c" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <HandleSphere position={[node.position[0], node.position[1], node.position[2]]} color="#fb923c" onPointerDown={beginDrag("move")} label="Move" />
        <HandleSphere position={[node.position[0], node.position[1] + h / 2 + 0.3, node.position[2]]} color="#f59e0b" onPointerDown={beginDrag("height")} label="Height" />
        <HandleSphere position={[node.position[0] + Math.cos((node.rotationYDeg * Math.PI) / 180) * (Math.max(w, d) / 2 + 0.45), node.position[1] + 0.1, node.position[2] + Math.sin((node.rotationYDeg * Math.PI) / 180) * (Math.max(w, d) / 2 + 0.45)]} color="#22c55e" onPointerDown={beginDrag("rotate")} label="Rotate" />
        <HandleSphere position={[node.position[0] + xAxis[0] * (w / 2 + 0.45), node.position[1] + 0.08, node.position[2] + xAxis[1] * (w / 2 + 0.45)]} color="#38bdf8" onPointerDown={beginDrag("scale_x")} label="W" />
        <HandleSphere position={[node.position[0] + zAxis[0] * (d / 2 + 0.45), node.position[1] + 0.08, node.position[2] + zAxis[1] * (d / 2 + 0.45)]} color="#38bdf8" onPointerDown={beginDrag("scale_z")} label="D" />
      </group>
    );
  }

  if (node.nodeType === "wall") {
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], 0.1, groupAnchor[1]]} color="#22c55e" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <HandleSphere position={[node.start[0], 0.08, node.start[1]]} color="#60a5fa" onPointerDown={beginDrag("wall_start")} label="A" />
        <HandleSphere position={[node.end[0], 0.08, node.end[1]]} color="#60a5fa" onPointerDown={beginDrag("wall_end")} label="B" />
        <HandleSphere position={[center[0], 0.1, center[1]]} color="#22c55e" onPointerDown={beginDrag("move")} label="Move" />
      </group>
    );
  }

  if (node.nodeType === "critical_zone" || node.nodeType === "privacy_zone") {
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], 0.08, groupAnchor[1]]} color={node.nodeType === "critical_zone" ? "#22c55e" : "#8b5cf6"} onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <mesh position={[center[0], 0.014, center[1]]}>
          <ringGeometry args={[0.16, 0.24, 20]} />
          <meshBasicMaterial color={node.nodeType === "critical_zone" ? "#22c55e" : "#8b5cf6"} transparent opacity={0.85} />
        </mesh>
        <HandleSphere position={[center[0], 0.08, center[1]]} color={node.nodeType === "critical_zone" ? "#22c55e" : "#8b5cf6"} onPointerDown={beginDrag("move")} label="Move" />
        {node.polygon.map((point, index) => (
          <HandleSphere
            key={`${node.id}-${index}`}
            position={[point[0], 0.06, point[1]]}
            color={index === 0 ? "#bef264" : "#22c55e"}
            onPointerDown={beginDrag("vertex", index)}
            label={`V${index + 1}`}
          />
        ))}
      </group>
    );
  }

  if (node.nodeType === "path") {
    const points = node.points.map((point) => point.position);
    if (isGroupSelection) {
      return (
        <group>
          <HandleSphere position={[groupAnchor[0], 0.06, groupAnchor[1]]} color="#fb923c" onPointerDown={beginDrag("move")} label={`Move ${groupSelection.length}`} />
        </group>
      );
    }

    return (
      <group>
        <HandleSphere position={[center[0], 0.06, center[1]]} color="#fb923c" onPointerDown={beginDrag("move")} label="Move" />
        {points.map((point, index) => (
          <HandleSphere
            key={`${node.id}-${index}`}
            position={[point[0], 0.06, point[1]]}
            color={index === 0 ? "#fde68a" : "#fb923c"}
            onPointerDown={beginDrag("path_point", index)}
            label={`P${index + 1}`}
          />
        ))}
        <Html position={[center[0], 0.22, center[1]]} center style={{ pointerEvents: "none" }}>
          <div className="rounded border border-[#24304a] bg-[#0b0f17]/90 px-2 py-1 text-[8px] font-semibold text-[#d2d9e8]">
            {pathLength(points).toFixed(2)}m
          </div>
        </Html>
      </group>
    );
  }

  return null;
}
