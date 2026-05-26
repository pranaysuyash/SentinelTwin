"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Layers, RefreshCcw } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { type CameraNode, type CoverageCellResult, type SecurityIssue } from "@/schema/security-scene";
import { getYawPitchDirection } from "@/simulation/geometry";
import { useStudioStore } from "@/store/studio-store";
import { CoverageLegend } from "./CoverageLegend";

const QUALITY_COLORS: Record<string, THREE.Color> = {
  identification: new THREE.Color("#3b82f6"),
  recognition: new THREE.Color("#22c55e"),
  observation: new THREE.Color("#eab308"),
  detection: new THREE.Color("#f97316"),
  none: new THREE.Color("#25090b"),
};

const ENVIRONMENT_THEMES = {
  day: {
    background: "#0a0d13",
    ambient: 0.66,
    hemisphere: 0.62,
    directional: 2.3,
    fill: 0.55,
    poolOpacity: 0.17,
  },
  dusk: {
    background: "#090b12",
    ambient: 0.48,
    hemisphere: 0.46,
    directional: 1.6,
    fill: 0.42,
    poolOpacity: 0.12,
  },
  night: {
    background: "#06080d",
    ambient: 0.3,
    hemisphere: 0.28,
    directional: 0.95,
    fill: 0.3,
    poolOpacity: 0.08,
  },
} as const;

function CoverageHeatmap({ cells }: { cells: CoverageCellResult[] }) {
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

function CameraFrustum({ camera, selected }: { camera: CameraNode; selected: boolean }) {
  const [px, py, pz] = camera.position;
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg);
  const range = Math.min(camera.rangeM, 12);

  const quaternion = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(up, forward);
  }, [forward]);

  const centerPos = useMemo(
    () => new THREE.Vector3(px, py, pz).add(forward.clone().multiplyScalar(range / 2)),
    [px, py, pz, forward, range],
  );

  const radius = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180)) * range;

  return (
    <mesh position={centerPos} quaternion={quaternion}>
      <coneGeometry args={[radius, range, 18, 1, true]} />
      <meshBasicMaterial
        color={camera.status === "on" ? "#60a5fa" : "#6b7280"}
        transparent
        opacity={selected ? 0.18 : 0.08}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function CameraMarker({ camera, selected }: { camera: CameraNode; selected: boolean }) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const layers = useStudioStore((s) => s.layerVisibility);
  const [px, py, pz] = camera.position;
  const isActive = camera.status === "on";

  return (
    <group position={[px, py, pz]}>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
          <ringGeometry args={[0.16, 0.22, 28]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.9} />
        </mesh>
      )}

      <group onClick={() => selectNode(camera.id)}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 18]} />
          <meshStandardMaterial color={selected ? "#71b0ff" : "#4d89eb"} emissive="#25497a" emissiveIntensity={selected ? 1.1 : 0.55} roughness={0.34} metalness={0.65} />
        </mesh>
        <mesh position={[0.06, 0, 0.07]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <boxGeometry args={[0.09, 0.05, 0.11]} />
          <meshStandardMaterial color="#dce6f7" roughness={0.26} metalness={0.55} />
        </mesh>
      </group>

      {layers.labels && (
        <Html position={[0, 0.34, 0]} center distanceFactor={11} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div
            style={{
              background: "rgba(10,13,19,0.9)",
              border: `1px solid ${selected ? "#60a5fa" : "#29456d"}`,
              borderRadius: 6,
              padding: "4px 8px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.26)",
              backdropFilter: "blur(5px)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 9, color: selected ? "#cfe2ff" : "#8bc0ff" }}>
              {camera.name.toUpperCase()}
            </div>
            <div style={{ fontWeight: 400, fontSize: 8, color: "#73809a" }}>
              {camera.resolutionMP}MP {camera.mountType === "ceiling" ? "Dome" : "Bullet"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: isActive ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 7, color: isActive ? "#4ade80" : "#ef4444" }}>
                {isActive ? "Active" : camera.status}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function WallSegment({
  start,
  end,
  height,
  material,
}: {
  start: [number, number];
  end: [number, number];
  height: number;
  material: string;
}) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;
  const isGlass = material === "glass";

  return (
    <mesh position={[cx, height / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, height, 0.18]} />
      <meshStandardMaterial
        color={isGlass ? "#cfe5ff" : "#d4dae6"}
        transparent={isGlass}
        opacity={isGlass ? 0.2 : 1}
        roughness={isGlass ? 0.08 : 0.78}
        metalness={isGlass ? 0.28 : 0.02}
      />
    </mesh>
  );
}

const OBSTRUCTION_COLORS: Record<string, string> = {
  shelf: "#5c4324",
  cupboard: "#624633",
  counter: "#786552",
  storage_boxes: "#5b4428",
  other: "#414456",
};

function ObstructionBox({
  obs,
}: {
  obs: {
    id: string;
    label: string;
    position: [number, number, number];
    dimensions: [number, number, number];
    rotationYDeg: number;
    obstructionType: string;
  };
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const isSelected = selectedId === obs.id;
  const [width, depth, height] = obs.dimensions;
  const [px, py, pz] = obs.position;
  const color = OBSTRUCTION_COLORS[obs.obstructionType] ?? OBSTRUCTION_COLORS.other;
  const highlightBox = useMemo(
    () => new THREE.BoxGeometry(width * 1.02, height * 1.02, depth * 1.02),
    [depth, height, width],
  );

  return (
    <group
      position={[px, py, pz]}
      rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); selectNode(obs.id); }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
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
      <mesh position={[0, height / 2 - 0.03, 0]} castShadow>
        <boxGeometry args={[width * 0.96, 0.05, depth * 0.92]} />
        <meshStandardMaterial color="#8f7a64" roughness={0.72} metalness={0.06} />
      </mesh>
    </group>
  );
}

function DecorativeShelving() {
  const shelves = useMemo(
    () => [
      { position: [1.15, 0.65, 1.3], size: [0.34, 1.3, 2.6], rotation: 0 },
      { position: [1.15, 0.65, 4.95], size: [0.34, 1.3, 2.9], rotation: 0 },
      { position: [8.85, 0.65, 1.3], size: [0.34, 1.3, 2.6], rotation: 0 },
      { position: [8.85, 0.65, 4.95], size: [0.34, 1.3, 2.9], rotation: 0 },
      { position: [3.2, 0.75, 2.1], size: [1.85, 1.5, 0.48], rotation: Math.PI / 2 },
      { position: [6.8, 0.75, 2.1], size: [1.85, 1.5, 0.48], rotation: Math.PI / 2 },
      { position: [3.1, 0.6, 5.9], size: [1.55, 1.2, 0.48], rotation: Math.PI / 2 },
      { position: [6.9, 0.6, 5.9], size: [1.55, 1.2, 0.48], rotation: Math.PI / 2 },
    ],
    [],
  );

  return (
    <group>
      {shelves.map((shelf, index) => (
        <group key={index} position={shelf.position as [number, number, number]} rotation={[0, shelf.rotation, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={shelf.size as [number, number, number]} />
            <meshStandardMaterial color="#4c3824" roughness={0.84} metalness={0.06} />
          </mesh>
          {[0.42, 0.05, -0.32].map((offset) => (
            <mesh key={offset} position={[0, offset, 0]} castShadow>
              <boxGeometry args={[shelf.size[0] * 0.95, 0.03, shelf.size[2] * 0.94]} />
              <meshStandardMaterial color="#6d522f" roughness={0.86} />
            </mesh>
          ))}
        </group>
      ))}
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

function CeilingLightMarkers() {
  const scene = useStudioStore((s) => s.scene);

  return (
    <group>
      {scene.securityLights.map((light) => (
        <group key={light.id} position={light.position}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.05, 22]} />
            <meshStandardMaterial color="#eceff7" emissive="#f8f2c0" emissiveIntensity={0.45} roughness={0.2} metalness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CriticalZoneOverlay({
  zone,
  result,
}: {
  zone: { id: string; label: string; polygon: [number, number][]; heightM: number; requiredQuality: string };
  result?: { status: string; actualQuality: string };
}) {
  const layers = useStudioStore((s) => s.layerVisibility);
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
    <group>
      <mesh position={[cx, 0.012, cz]}>
        <boxGeometry args={[w, 0.01, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <lineSegments position={[cx, 0.014, cz]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, 0.01, d)]} />
        <lineBasicMaterial color={color} transparent opacity={0.72} />
      </lineSegments>
      <Html position={[cx, 0.05, cz]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(10,13,19,0.92)",
            border: `1.5px solid ${color}`,
            borderRadius: 6,
            padding: "4px 8px",
            textAlign: "center",
            whiteSpace: "nowrap",
            boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#f7d94a" }}>{zone.label.toUpperCase()}</div>
          <div style={{ fontSize: 8, color: "#e5d875", fontWeight: 600, marginTop: 1 }}>
            {zone.requiredQuality.toUpperCase()} REQUIRED
          </div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 8,
                fontWeight: 700,
                background: badgeBg,
                color: badgeText,
              }}
            >
              {status === "pass" ? "PASS" : status === "fail" ? "FAILS" : status.toUpperCase()}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}

function ObstructionWarning({
  issue,
  position,
}: {
  issue: SecurityIssue;
  position: [number, number, number];
}) {
  const layers = useStudioStore((s) => s.layerVisibility);
  const scene = useStudioStore((s) => s.scene);
  if (!layers.labels) return null;

  const affectedCamera = scene.cameras.find((camera) => camera.id === issue.affectedCameras[0]);

  return (
    <Html position={position} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(16,10,10,0.9)",
          border: "1.5px solid #ef4444",
          borderRadius: 6,
          padding: "4px 10px",
          textAlign: "left",
          whiteSpace: "nowrap",
          boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
          backdropFilter: "blur(5px)",
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: "#fca5a5" }}>CUPBOARD</div>
        <div style={{ fontSize: 8, color: "#fecaca", marginTop: 1 }}>
          Blocking {affectedCamera?.name ?? "Camera 1"}
        </div>
        <div style={{ fontSize: 8, fontWeight: 500, color: "#fca5a5", marginTop: 2 }}>View obstructed</div>
      </div>
    </Html>
  );
}

function EntryDoorLabel({ position }: { position: [number, number] }) {
  const layers = useStudioStore((s) => s.layerVisibility);
  if (!layers.labels) return null;

  return (
    <Html position={[position[0], 0.14, position[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(76,29,149,0.75)",
          border: "1px solid #a78bfa",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 9,
          fontWeight: 700,
          color: "#ddd6fe",
          whiteSpace: "nowrap",
        }}
      >
        ENTRY DOOR
      </div>
    </Html>
  );
}

function PathLine({ points, color = "#7c3aed" }: { points: [number, number][]; color?: string }) {
  const verts = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.045;
      arr[index * 3 + 2] = z;
    });
    return arr;
  }, [points]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    return geo;
  }, [verts]);

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
      {start ? (
        <mesh position={[start[0], 0.065, start[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      ) : null}
      {end ? (
        <mesh position={[end[0], 0.065, end[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      ) : null}
    </group>
  );
}

function AdversarialPath({ waypoints }: { waypoints: [number, number][] }) {
  const verts = useMemo(() => {
    const arr = new Float32Array(waypoints.length * 3);
    waypoints.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.05;
      arr[index * 3 + 2] = z;
    });
    return arr;
  }, [waypoints]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    return geo;
  }, [verts]);

  const line = useMemo(() => {
    const dashedLine = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: "#f43f5e", dashSize: 0.1, gapSize: 0.06, scale: 1 }),
    );
    dashedLine.computeLineDistances();
    return dashedLine;
  }, [geometry]);

  return <primitive object={line} />;
}

function SceneGeometry({ theme }: { theme: (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES] }) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const layers = useStudioStore((s) => s.layerVisibility);

  const { width, depth } = scene.dimensions;
  const cupboard = scene.obstructions.find((obs) => obs.obstructionType === "cupboard");
  const blockingIssues = result?.issues.filter((issue) => issue.category === "blindspot") ?? [];
  const entryDoor = scene.entryPoints[0];

  return (
    <>
      {layers.walls_floors && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.0015, depth / 2]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#252d3a" roughness={0.97} />
        </mesh>
      )}

      {layers.walls_floors && (
        <>
          <AccentSurface position={[width / 2, 0.002, depth / 2]} size={[width * 0.94, depth * 0.94]} color="#5b677d" opacity={0.06} />
          <AccentSurface position={[5, 0.0025, 5.58]} size={[2.5, 1.45]} color="#d7c542" opacity={0.16} />
          <AccentSurface position={[5, 0.003, 6.56]} size={[2, 0.34]} color="#7e8797" opacity={0.18} />
          <AccentSurface position={[8.25, 0.003, 1.12]} size={[2.9, 2.08]} color="#39404d" opacity={0.18} />
          <AccentSurface position={[5, 0.005, 3.55]} size={[3.9, 5.1]} color="#ffffff" opacity={theme.poolOpacity} />
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

      {layers.walls_floors ? scene.walls.map((wall) => (
        <WallSegment key={wall.id} start={wall.start} end={wall.end} height={wall.heightM} material={wall.material} />
      )) : null}

      {layers.obstructions ? scene.obstructions.map((obs) => <ObstructionBox key={obs.id} obs={obs} />) : null}
      {layers.walls_floors ? <DecorativeShelving /> : null}
      {layers.lights ? <CeilingLightMarkers /> : null}

      {blockingIssues.length > 0 && cupboard && layers.labels ? (
        <ObstructionWarning
          issue={blockingIssues[0]!}
          position={[cupboard.position[0], cupboard.position[1] + cupboard.dimensions[1] + 0.3, cupboard.position[2]]}
        />
      ) : null}

      {layers.heatmap && result?.coverageCells ? <CoverageHeatmap cells={result.coverageCells} /> : null}

      {scene.criticalZones.map((zone) => (
        <CriticalZoneOverlay key={zone.id} zone={zone} result={result?.criticalZoneResults.find((entry) => entry.zoneId === zone.id)} />
      ))}

      {entryDoor ? <EntryDoorLabel position={entryDoor.position} /> : null}

      {layers.cameras ? scene.cameras.map((cam) => <CameraMarker key={cam.id} camera={cam} selected={selected === cam.id} />) : null}
      {layers.camera_cones ? scene.cameras.map((cam) => <CameraFrustum key={`frust_${cam.id}`} camera={cam} selected={selected === cam.id} />) : null}

      {layers.paths ? scene.paths.map((path) => (
        <PathLine key={path.id} points={path.points.map((point) => point.position)} />
      )) : null}

      {layers.paths && result?.adversarialPath ? (
        <AdversarialPath waypoints={result.adversarialPath.waypoints.map((waypoint) => waypoint.position)} />
      ) : null}
    </>
  );
}

function NorthCompass() {
  return (
    <div className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#2a3246] bg-[#0e1320]/90 backdrop-blur-sm">
      <div className="relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">N</span>
        <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-0 h-5 w-0.5 rotate-180 rounded-full bg-gradient-to-b from-[#4a5568] to-transparent" />
      </div>
    </div>
  );
}

function ViewControls() {
  return (
    <div className="absolute right-3 top-16 z-10 flex flex-col gap-1">
      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 text-[8px] font-bold text-white backdrop-blur-sm hover:bg-[#171e30]">3D</button>
      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 text-[8px] font-bold text-[#6b7280] backdrop-blur-sm hover:bg-[#171e30] hover:text-white">2D</button>
      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 backdrop-blur-sm hover:bg-[#171e30]">
        <RefreshCcw className="h-3.5 w-3.5 text-[#6b7280] hover:text-white" />
      </button>
      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a3246] bg-[#0e1320]/90 backdrop-blur-sm hover:bg-[#171e30]">
        <Layers className="h-3.5 w-3.5 text-[#6b7280] hover:text-white" />
      </button>
    </div>
  );
}

function ControlHintBar() {
  return (
    <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1 backdrop-blur-sm">
      <span className="text-[8px] text-[#4a5568]">Left: Orbit</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Middle: Pan</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Right: Zoom</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Scroll: Zoom</span>
    </div>
  );
}

export function WorkspaceCanvas() {
  const envMode = useStudioStore((s) => s.environmentMode);
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;

  return (
    <div className="relative flex-1 overflow-hidden bg-[#07090d]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.06),transparent_46%),linear-gradient(180deg,rgba(6,9,14,0.1),rgba(6,9,14,0.48)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/28 to-transparent" />

      <CoverageLegend />
      <NorthCompass />
      <ViewControls />
      <ControlHintBar />

      <Canvas
        camera={{ position: [12.8, 7.6, 11.6], fov: 31, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: theme.background }}
        shadows
      >
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
        <pointLight position={[5, 2.8, 3.5]} intensity={envMode === "night" ? 0.8 : 1.15} distance={8} color="#fff6d8" />

        <Suspense fallback={null}>
          <SceneGeometry theme={theme} />
        </Suspense>

        <OrbitControls
          makeDefault
          target={[5.05, 0.6, 3.8]}
          minDistance={5.5}
          maxDistance={22}
          minPolarAngle={Math.PI / 4.2}
          maxPolarAngle={Math.PI / 2.08}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
