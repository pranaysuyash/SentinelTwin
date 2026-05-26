"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Camera, Layers, Lightbulb, MousePointer2, RefreshCcw, Square } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  type CameraNode,
  type SecurityIssue,
} from "@/schema/security-scene";
import { getYawPitchDirection } from "@/simulation/geometry";
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
import { SelectionOverlay } from "./editing/SelectionOverlay";
import { WallDrawTool } from "./editing/WallDrawTool";
import { applyShiftLock, clampToScene, pathLength, pointDistance } from "./editing/editor-geometry";
import { pointOnPathAtProgress } from "@/components/map/map-utils";
import { CoverageLegend } from "./CoverageLegend";
import {
  createCameraNode,
  createObstructionNode,
  createWallNode,
  createDoorNode,
  createWindowNode,
  createCriticalZoneNode,
  createScenarioPathNode,
  createSecurityLightNode,
} from "@/lib/node-factory";
import { CameraPresetPicker, applyCameraPreset, getCameraPreset } from "./CameraPresetPicker";

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

function CameraFrustum({ camera, selected }: { camera: CameraNode; selected: boolean }) {
  const [px, py, pz] = camera.position;
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg);
  const range = Math.min(camera.rangeM, 12);

  const quaternion = useMemo(() => {
    // Flip: -Y (base/wide end) points in forward direction → tip at camera, base at far end
    const down = new THREE.Vector3(0, -1, 0);
    return new THREE.Quaternion().setFromUnitVectors(down, forward);
  }, [forward]);

  const centerPos = useMemo(
    () => new THREE.Vector3(px, py, pz).add(forward.clone().multiplyScalar(range / 2)),
    [px, py, pz, forward, range],
  );

  const radius = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180)) * range;

  const color = camera.status === "on" ? "#60a5fa" : "#6b7280";

  return (
    <group>
      {/* Lateral surface — solid tri shape from above */}
      <mesh position={centerPos} quaternion={quaternion}>
        <coneGeometry args={[radius, range, 24, 1, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.55 : 0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Edge outline for the cone boundary */}
      <lineSegments position={centerPos} quaternion={quaternion}>
        <edgesGeometry args={[new THREE.ConeGeometry(radius, range, 24, 1, false)]} />
        <lineBasicMaterial color={color} transparent opacity={selected ? 0.85 : 0.65} />
      </lineSegments>
    </group>
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
  obstructionLabel,
  position,
}: {
  issue: SecurityIssue;
  obstructionLabel: string;
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
        <div style={{ fontSize: 9, fontWeight: 700, color: "#fca5a5" }}>{obstructionLabel.toUpperCase()}</div>
        <div style={{ fontSize: 8, color: "#fecaca", marginTop: 1 }}>
          Blocking {affectedCamera?.name ?? "camera view"}
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

function SceneGeometry() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const layers = useStudioStore((s) => s.layerVisibility);

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
        <SceneWalls walls={scene.walls} />
      ) : null}

      <SceneDoors doors={scene.doors} />
      <SceneWindows windows={scene.windows} />

      {layers.obstructions ? (
        <SceneObstructions obstructions={scene.obstructions} selectedId={selected} />
      ) : null}
      {layers.lights ? <CeilingLightMarkers /> : null}

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

      {layers.heatmap && result?.coverageCells ? <CoverageHeatmapInstanced cells={result.coverageCells} /> : null}

      {scene.criticalZones.map((zone) => (
        <CriticalZoneOverlay key={zone.id} zone={zone} result={result?.criticalZoneResults.find((entry) => entry.zoneId === zone.id)} />
      ))}

      {entryDoor ? <EntryDoorLabel position={entryDoor.position} /> : null}

      {layers.cameras ? scene.cameras.map((cam) => <CameraMarker key={cam.id} camera={cam} selected={selected === cam.id} />) : null}
      {layers.camera_cones ? scene.cameras.map((cam) => <CameraFrustum key={`frust_${cam.id}`} camera={cam} selected={selected === cam.id} />) : null}

      {layers.paths ? scene.paths.map((path) => (
        <ScenePathLine key={path.id} points={path.points.map((point) => point.position)} />
      )) : null}

      {layers.paths && result?.adversarialPath ? (
        <CoverageSegmentPath waypoints={result.adversarialPath.waypoints} />
      ) : null}

      {layers.privacy_zones && scene.privacyZones.length > 0 ? (
        <ScenePrivacyZones zones={scene.privacyZones} />
      ) : null}

      {layers.paths ? <PathReplayActor /> : null}
    </>
  );
}

function PathReplayActor() {
  const scene = useStudioStore((s) => s.scene);
  const activePathId = useStudioStore((s) => s.activePathId);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);

  const path = scene.paths.find((item) => item.id === activePathId) ?? null;
  const meshRef = useRef<THREE.Mesh>(null);

  const totalDuration = useMemo(() => {
    if (!path || path.points.length < 2) return 1;
    let dist = 0;
    for (let i = 1; i < path.points.length; i++) {
      const [x0, z0] = path.points[i - 1].position;
      const [x1, z1] = path.points[i].position;
      dist += Math.sqrt((x1 - x0) ** 2 + (z1 - z0) ** 2);
    }
    return dist / (path.speedMps ?? 1.2);
  }, [path]);

  useFrame((_, delta) => {
    if (!pathReplay.playing || !path || path.points.length < 2) return;
    const next = pathReplay.progress + (delta * pathReplay.speed) / totalDuration;
    if (next >= 1) {
      setPathReplayPlaying(false);
      setPathReplayProgress(0);
      return;
    }
    setPathReplayProgress(next);
  });

  const actorPos = useMemo(() => {
    if (!path || path.points.length < 2) return new THREE.Vector3(0, 0.18, 0);
    const [x, z] = pointOnPathAtProgress(path, pathReplay.progress);
    return new THREE.Vector3(x, 0.18, z);
  }, [path, pathReplay.progress]);

  if (!path || (!pathReplay.playing && pathReplay.progress === 0)) return null;

  return (
    <mesh ref={meshRef} position={actorPos}>
      <sphereGeometry args={[0.18, 12, 12]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.5} />
    </mesh>
  );
}

function SceneFrameRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const scene = useStudioStore((s) => s.scene);
  const { width: sceneWidth, depth: sceneDepth } = scene.dimensions;

  useEffect(() => {
    const { target, position } = getMapFrame(sceneWidth, sceneDepth);

    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    const orbitControls = controls as unknown as { target: THREE.Vector3; update: () => void } | undefined;

    if (orbitControls) {
      orbitControls.target.copy(target);
      orbitControls.update();
    }
  }, [camera, controls, sceneDepth, sceneWidth]);

  return null;
}

const TOOL_GHOST_COLORS: Record<string, string> = {
  camera: "#60a5fa",
  obstruction: "#f97316",
  light: "#eab308",
  default: "#60a5fa",
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  camera: <Camera className="h-3 w-3" />,
  obstruction: <Square className="h-3 w-3" />,
  light: <Lightbulb className="h-3 w-3" />,
};

const TOOL_LABELS: Record<string, string> = {
  camera: "Place Camera",
  obstruction: "Place Obstruction",
  light: "Place Light",
};

/**
 * Invisible floor plane that catches pointer events for tool placement.
 * Shows ghost preview, places object on click.
 */
function ToolPlacementFloor() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const addNode = useStudioStore((s) => s.addNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const scene = useStudioStore((s) => s.scene);
  const editor = useStudioStore((s) => s.editor);
  const { draftWallStart, draftPolygonPoints, draftPathPoints, hoverPoint } = editor;
  const setEditorHoverPoint = useStudioStore((s) => s.setEditorHoverPoint);
  const setDraftWallStart = useStudioStore((s) => s.setDraftWallStart);
  const setDraftPolygonPoints = useStudioStore((s) => s.setDraftPolygonPoints);
  const setDraftPathPoints = useStudioStore((s) => s.setDraftPathPoints);
  const setEditorMode = useStudioStore((s) => s.setEditorMode);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const { camera, size } = useThree();

  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const floorRef = useRef<THREE.Mesh>(null!);
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

  const isPlacing = activeTool !== "select";

  const wallDraft = draftWallStart && hoverPoint
    ? { start: draftWallStart, current: hoverPoint, length: pointDistance(draftWallStart, hoverPoint) }
    : null;

  const wallLength = wallDraft ? wallDraft.length : 0;

  useEffect(() => {
    if (activeTool !== "wall") setDraftWallStart(undefined);
    if (activeTool !== "zone") setDraftPolygonPoints([]);
    if (activeTool !== "path") setDraftPathPoints([]);
    if (activeTool === "select") setEditorMode("idle");
  }, [activeTool, setDraftWallStart, setDraftPathPoints, setDraftPolygonPoints, setEditorMode]);

  const getFloorPoint = useCallback(
    (event: ThreeEvent<PointerEvent>): THREE.Vector3 | null => {
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
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPlacing) return;
      const point = getFloorPoint(event);
      if (!point) return;

      const basePoint = snapEngine.snapToGrid([point.x, point.z]);
      let snapped = basePoint;

      if (activeTool === "wall" && draftWallStart) {
        const constrained = applyShiftLock(draftWallStart, basePoint, event.nativeEvent.shiftKey);
        const profile = snapEngine.snapForPlacement(constrained, false);
        snapped = profile.point;
      } else if (activeTool === "door_window") {
        const profile = snapEngine.snapToWall(basePoint);
        if (profile.snappedToWall) {
          snapped = profile.point;
        }
      }

      setEditorHoverPoint(snapped);
      setHoverPos(new THREE.Vector3(snapped[0], 0.02, snapped[1]));
    },
    [activeTool, draftWallStart, getFloorPoint, isPlacing, setEditorHoverPoint, snapEngine],
  );

  const commitDraftPolygon = useCallback(() => {
    if (draftPolygonPoints.length < 3) return;
    const zone = createCriticalZoneNode(draftPolygonPoints);
    addNode(zone);
    selectNode(zone.id);
    setDraftPolygonPoints([]);
    setEditorMode("idle");
  }, [addNode, draftPolygonPoints, selectNode, setDraftPolygonPoints, setEditorMode]);

  const commitDraftPath = useCallback(() => {
    if (draftPathPoints.length < 2) return;
    const path = createScenarioPathNode(
      draftPathPoints.map((point) => ({ position: point })),
    );
    addNode(path);
    selectNode(path.id);
    setDraftPathPoints([]);
    setEditorMode("idle");

    if (!hasEntryPointsRef.current) {
      const first = draftPathPoints[0];
      if (first) {
        useStudioStore.getState().addNode({
          id: `entry_${Date.now().toString(36)}`,
          nodeType: "entry_point",
          label: "Entry",
          position: first,
        });
      }
    }
  }, [addNode, draftPathPoints, selectNode, setDraftPathPoints, setEditorMode]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
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
        selectNode(node.id);
      } else if (activeTool === "obstruction") {
        const node = createObstructionNode([pos[0], 1, pos[2]]);
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "light") {
        const node = createSecurityLightNode([pos[0], 2.8, pos[2]]);
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "wall") {
        if (!draftWallStart) {
          setDraftWallStart(workingSnap);
          setEditorMode("drawing_wall");
          return;
        }

        const constrained = applyShiftLock(draftWallStart, workingSnap, event.nativeEvent.shiftKey);
        const segmentLength = pointDistance(draftWallStart, constrained);
        if (segmentLength < 0.2) return;
        const wall = createWallNode(draftWallStart, constrained, {
          wallHeightM: scene.assumptions.wallHeightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
        });
        addNode(wall);
        setDraftWallStart(constrained);
        selectNode(wall.id);
      } else if (activeTool === "zone") {
        setDraftPolygonPoints([...draftPolygonPoints, workingSnap]);
      } else if (activeTool === "path") {
        setDraftPathPoints([...draftPathPoints, workingSnap]);
      } else if (activeTool === "door_window") {
        const wallProfile = snapEngine.snapToWall(workingSnap);
        if (!wallProfile.snappedToWall) return;

        const wantsWindow = event.nativeEvent.ctrlKey || event.nativeEvent.altKey;
        const node = wantsWindow
          ? createWindowNode([wallProfile.point[0], 1.4, wallProfile.point[1]])
          : createDoorNode([wallProfile.point[0], 0, wallProfile.point[1]]);

        addNode(node);
        selectNode(node.id);
      }
    },
    [
      addNode,
      activeTool,
      commitDraftPath,
      commitDraftPolygon,
      draftPathPoints,
      draftPolygonPoints,
      draftWallStart,
      getFloorPoint,
      hoverPoint,
      isPlacing,
      scene.assumptions.wallHeightM,
      selectNode,
      setDraftPathPoints,
      setDraftPolygonPoints,
      setDraftWallStart,
      setEditorMode,
      snapEngine,
    ],
  );

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

    return TOOL_LABELS[activeTool] ?? "Place";
  }, [activeTool, wallLength, draftPolygonPoints.length, draftPathPoints, hoverPoint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        if (activeTool === "zone") {
          commitDraftPolygon();
          return;
        }
        if (activeTool === "path") {
          commitDraftPath();
          return;
        }
      }

      if (event.key === "Escape") {
        setActiveTool("select");
        setDraftWallStart(undefined);
        setDraftPolygonPoints([]);
        setDraftPathPoints([]);
        setEditorMode("idle");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTool, commitDraftPath, commitDraftPolygon, setActiveTool, setDraftPathPoints, setDraftPolygonPoints, setDraftWallStart, setEditorMode]);

  if (!isPlacing) return null;

  const ghostColor = TOOL_GHOST_COLORS[activeTool] ?? TOOL_GHOST_COLORS.default;

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
          setEditorHoverPoint(undefined);
        }}
      >
        <planeGeometry args={[sceneWidth * 2, sceneDepth * 2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Active draw previews */}
      {activeTool === "wall" && wallDraft ? (
        <WallDrawTool draft={{ start: wallDraft.start, current: wallDraft.current, length: wallDraft.length, snappedToWallEndpoint: false }} />
      ) : null}

      {activeTool === "zone" ? <PolygonDrawTool points={draftPolygonPoints} hoverPoint={hoverPoint} /> : null}
      {activeTool === "path" ? <PathDrawTool points={draftPathPoints} hoverPoint={hoverPoint} /> : null}

      {/* Ghost preview */}
      {hoverPos && isHovering && (
        <group position={[hoverPos.x, 0.02, hoverPos.z]}>
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
              {tooltipText}
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
  const activeTool = useStudioStore((s) => s.activeTool);

  if (activeTool !== "select") {
    const toolLabel = TOOL_LABELS[activeTool] ?? "Place";
    const color = TOOL_GHOST_COLORS[activeTool] ?? TOOL_GHOST_COLORS.default;
    return (
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1 backdrop-blur-sm">
        <span className="text-[8px]" style={{ color }}>◉ {toolLabel}</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Click floor to place</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Press {activeTool === 'camera' ? 'C' : activeTool === 'obstruction' ? 'B' : 'L'} or Esc to cancel</span>
      </div>
    );
  }

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
  const scene = useStudioStore((s) => s.scene);
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;
  const frame = useMemo(
    () => getMapFrame(scene.dimensions.width, scene.dimensions.depth),
    [scene.dimensions.depth, scene.dimensions.width],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#07090d]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.06),transparent_46%),linear-gradient(180deg,rgba(6,9,14,0.1),rgba(6,9,14,0.48)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/28 to-transparent" />

      <CoverageLegend />
      <NorthCompass />
      <ViewControls />
      <ControlHintBar />

      {/* Camera preset picker — shown when camera tool is active */}
      <div className="absolute left-1/2 top-12 z-10 -translate-x-1/2">
        <CameraPresetPicker />
      </div>

      <Canvas
        camera={{ position: [frame.position.x, frame.position.y, frame.position.z], fov: 44, near: 0.1, far: 260 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", background: theme.background }}
        shadows="percentage"
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
        <pointLight position={[5, 2.8, 3.5]} intensity={envMode === "night" ? 1.0 : 1.45} distance={10} color="#fff6d8" />

        <Suspense fallback={null}>
          <SceneGeometry />
        </Suspense>

        <SceneFrameRig />
        <ToolPlacementFloor />

        <OrbitControls
          makeDefault
          target={[frame.target.x, frame.target.y, frame.target.z]}
          minDistance={5.5}
          maxDistance={40}
          minPolarAngle={Math.PI / 4.2}
          maxPolarAngle={Math.PI / 2.08}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
