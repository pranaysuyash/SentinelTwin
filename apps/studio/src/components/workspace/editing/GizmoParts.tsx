"use client";

import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SceneHtml } from "@/components/shared/SceneHtml";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
/**
 * Unity / three.js-style transform gizmo primitives.
 *
 * These are presentation parts only — every pointer-down routes into the
 * existing TransformHandles drag machinery (snap engine, preview, store
 * commit, undo), so the manipulation semantics are unchanged. Axis colors
 * follow the industry convention: X = red, Y (up) = green, Z = blue.
 * Gizmo meshes render unlit and on top of scene geometry (depthTest off,
 * high renderOrder) exactly like native editors, and labels appear only
 * while a part is hovered to keep the canvas quiet.
 */

export const GIZMO_RENDER_ORDER = 999;
export const GIZMO_AXIS_COLORS = {
  x: "#ef4444",
  y: "#22c55e",
  z: "#3b82f6",
} as const;

function HoverChip({ label, position }: { label: string; position: [number, number, number] }) {
  return (
    <SceneHtml center position={position} style={{ pointerEvents: "none" }}>
      <div className={`rounded border border-[#24304a] ${UI_SURFACES.panel}/92 px-1.5 py-0.5 text-[8px] font-semibold ${UI_SURFACES.textBody2} whitespace-nowrap`}>
        {label}
      </div>
    </SceneHtml>
  );
}

/**
 * Keeps the gizmo at a roughly constant screen size (Unity behavior): the
 * rig rescales with camera distance every frame, clamped so it never
 * collapses up close or dominates from afar. Children are positioned in
 * rig-local space around the origin.
 */
export function GizmoRig({
  center,
  children,
}: {
  center: [number, number, number];
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    target.current.set(center[0], center[1], center[2]);
    const distance = camera.position.distanceTo(target.current);
    const scale = THREE.MathUtils.clamp(distance / 13, 0.55, 2.2);
    group.scale.setScalar(scale);
  });
  return (
    <group ref={groupRef} position={center}>
      {children}
    </group>
  );
}

/**
 * Directional arrow (shaft + cone tip) with a fat invisible hit volume so
 * grabbing an axis doesn't require pixel-perfect aim. `direction` is a
 * rig-local unit vector.
 */
export function AxisArrow({
  direction,
  color,
  length = 1.05,
  label,
  onPointerDown,
}: {
  direction: [number, number, number];
  color: string;
  length?: number;
  label?: string;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dir = new THREE.Vector3(...direction).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const shaftLength = length * 0.72;
  const tipLength = length - shaftLength;
  const activeColor = hovered ? "#ffe9a8" : color;

  return (
    <group quaternion={quaternion}>
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event as unknown as ReactPointerEvent);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Invisible fat hit volume (opacity 0 keeps it raycastable). */}
        <mesh position={[0, length / 2, 0]}>
          <cylinderGeometry args={[0.16, 0.16, length + 0.12, 6]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, shaftLength / 2, 0]} renderOrder={GIZMO_RENDER_ORDER}>
          <cylinderGeometry args={[hovered ? 0.036 : 0.026, hovered ? 0.036 : 0.026, shaftLength, 10]} />
          <meshBasicMaterial color={activeColor} depthTest={false} transparent opacity={hovered ? 1 : 0.9} />
        </mesh>
        <mesh position={[0, shaftLength + tipLength / 2, 0]} renderOrder={GIZMO_RENDER_ORDER}>
          <coneGeometry args={[hovered ? 0.11 : 0.09, tipLength, 12]} />
          <meshBasicMaterial color={activeColor} depthTest={false} transparent opacity={hovered ? 1 : 0.92} />
        </mesh>
      </group>
      {hovered && label ? <HoverChip label={label} position={[0, length + 0.22, 0]} /> : null}
    </group>
  );
}

/**
 * Flat rotation ring on the ground plane (torus), matching the circular
 * rotate control of native editors. Dragging anywhere on the ring starts
 * the rotation handle.
 */
export function RotationRing({
  radius = 0.85,
  color = "#22c55e",
  y = 0.04,
  label,
  onPointerDown,
}: {
  radius?: number;
  color?: string;
  y?: number;
  label?: string;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const activeColor = hovered ? "#ffe9a8" : color;
  return (
    <group position={[0, y, 0]}>
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event as unknown as ReactPointerEvent);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Invisible fat hit torus. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.14, 6, 48]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={GIZMO_RENDER_ORDER}>
          <torusGeometry args={[radius, hovered ? 0.042 : 0.026, 8, 64]} />
          <meshBasicMaterial color={activeColor} depthTest={false} transparent opacity={hovered ? 1 : 0.82} />
        </mesh>
      </group>
      {hovered && label ? <HoverChip label={label} position={[radius + 0.28, 0.1, 0]} /> : null}
    </group>
  );
}

/**
 * Center puck: free XZ move (the unconstrained drag every object supports).
 */
export function CenterPuck({
  color = "#e2e8f0",
  label,
  onPointerDown,
}: {
  color?: string;
  label?: string;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group>
      <mesh
        renderOrder={GIZMO_RENDER_ORDER}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event as unknown as ReactPointerEvent);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[hovered ? 0.12 : 0.095, 16, 16]} />
        <meshBasicMaterial color={hovered ? "#ffffff" : color} depthTest={false} transparent opacity={hovered ? 1 : 0.95} />
      </mesh>
      {hovered && label ? <HoverChip label={label} position={[0, 0.3, 0]} /> : null}
    </group>
  );
}
