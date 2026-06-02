"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { ListRestart, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { QUALITY_ABBR, QUALITY_COLOR, QUALITY_RANK } from "@/lib/quality-display";
import { useStudioStore } from "@/store/studio-store";
import "@/lib/three-compat";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  ScenePrivacyZones,
  CoverageTileFloor,
  CoverageHeatmapInstanced,
  CoverageSegmentPath,
  PathActor,
} from "@/components/workspace/SharedScene";
import { pathLength } from "@/components/workspace/editing/editor-geometry";
import { samplePathQuality } from "@/components/map/path-quality";
import { VisibilityTimeline } from "@/components/view/VisibilityTimeline";
import { safeParseSecurityScene, type DoriQuality, type ScenarioPath } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { getYawPitchDirection } from "@sentineltwin/core";
import { getCameraColorForId } from "@/lib/camera-colors";
import { buildCoverageGrid } from "@sentineltwin/core";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import {
  buildReplayStateByCameraAtTime,
  clampPathDuration,
  getPathReplayDurationS,
  clampReplayProgress,
  findLatestTimelineEventAtOrBeforeTime,
  findNextTimelineEventAfterTime,
  sortTimelineEvents,
} from "@/components/view/camera-view-utils";

// ── Shared scene ──

const PATH_REPLAY_THEME = ENVIRONMENT_THEMES.day;
const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4] as const;
const SHARED_REPLAY_PROGRESS_PUBLISH_INTERVAL_MS = 1000 / 24;
const MIN_PATH_SEGMENT_DURATION_DISTANCE_M = 0.22;
const DEFAULT_PATH_SPEED_MPS = 1.2;
const MIN_PLAYBACK_STEP_SECONDS = 2;
const MIN_PLAYBACK_WAYPOINT_TIME_GAP_S = 0.0001;

function SceneView() {
  const scene = useStudioStore((s) => s.scene);
  const { width, depth } = scene.dimensions;
  const result = useStudioStore((s) => s.simulationResult);
  const selectedId = useStudioStore((s) => s.selectedNodeId);

  return (
    <>
      <SceneLighting theme={PATH_REPLAY_THEME} />
      <SceneFloor width={width} depth={depth} />
      <SceneWalls walls={scene.walls} />
      <SceneDoors doors={scene.doors} />
      <SceneWindows windows={scene.windows} />
      <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} />
      {scene.privacyZones.length > 0 ? <ScenePrivacyZones zones={scene.privacyZones} /> : null}
      {result?.coverageCells && (
        <CoverageHeatmapInstanced cells={result.coverageCells} />
      )}
    </>
  );
}

// ── Path Line + Markers ──

function PathMarkers({ waypoints }: { waypoints: [number, number][] }) {
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  return (
    <>
      {start && (
        <mesh position={[start[0], 0.065, start[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      )}
      {end && (
        <mesh position={[end[0], 0.065, end[1]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}
    </>
  );
}

function getPlaybackPosition(
  playbackWaypoints: { timeS: number }[] | undefined,
  currentTime: number,
) {
  if (!playbackWaypoints || playbackWaypoints.length < 2) {
    return { currentIndex: 0, progress: 0 };
  }

  const wps = playbackWaypoints;
  let cumulativeTime = 0;

  for (let i = 0; i < wps.length - 1; i++) {
    const segmentDuration = (wps[i + 1].timeS ?? 0) - (wps[i].timeS ?? 0);
    if (segmentDuration <= 0) {
      continue;
    }

    if (currentTime >= cumulativeTime && currentTime < cumulativeTime + segmentDuration) {
      const segProgress = segmentDuration > 0
        ? (currentTime - cumulativeTime) / segmentDuration
        : 0;
      return { currentIndex: i, progress: Math.min(segProgress, 1) };
    }
    cumulativeTime += segmentDuration;
  }

  return { currentIndex: wps.length - 1, progress: 1 };
}

function buildPlaybackWaypoints(path: ScenarioPath) {
  if (path.points.length < 2) return [];

  const waypoints: { position: [number, number]; timeS: number }[] = [];
  const safeSpeedMps = getSafePathSpeedMps(path.speedMps);
  let elapsed = 0;

  for (let index = 0; index < path.points.length; index += 1) {
    const current = path.points[index]!;
    if (index > 0) {
      const previous = path.points[index - 1]!;
      const segmentLength = Math.hypot(
        current.position[0] - previous.position[0],
        current.position[1] - previous.position[1],
      );
      elapsed += segmentLength / safeSpeedMps;
    }

    waypoints.push({
      position: current.position,
      timeS: elapsed,
    });
  }

  return waypoints;
}

function getSafePathSpeedMps(speedMps: number | undefined): number {
  return (Number.isFinite(speedMps) && speedMps! > 0 ? speedMps! : DEFAULT_PATH_SPEED_MPS) ?? DEFAULT_PATH_SPEED_MPS;
}

type ReplaySample = {
  position: [number, number];
  rawPosition: [number, number];
  timeS: number;
  collided: boolean;
  blockedBy?: string;
};

function sanitizeReplayWaypointsForPlayback(rawWaypoints: ReplaySample[]) {
  if (!rawWaypoints.length) return [];

  const normalized: ReplaySample[] = [];
  let lastTime = Number.NEGATIVE_INFINITY;

  for (const sample of rawWaypoints) {
    const [x, z] = sample.position;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (!Number.isFinite(sample.timeS) || sample.timeS < 0) continue;

    const timeS = Math.max(sample.timeS, lastTime + MIN_PLAYBACK_WAYPOINT_TIME_GAP_S);
    if (normalized.length > 0) {
      const previous = normalized[normalized.length - 1]!;
      if (previous.position[0] === x && previous.position[1] === z && Math.abs(previous.timeS - timeS) < MIN_PLAYBACK_WAYPOINT_TIME_GAP_S) {
        continue;
      }
    }

    normalized.push({
      position: sample.position,
      rawPosition: sample.rawPosition,
      timeS,
      collided: sample.collided,
      blockedBy: sample.blockedBy,
    });
    lastTime = timeS;
  }

  const startTime = normalized[0]?.timeS ?? 0;
  return normalized.map((sample) => ({ ...sample, timeS: Math.max(0, sample.timeS - startTime) }));
}

function pointInsideOrientedRect(
  point: [number, number],
  center: [number, number],
  width: number,
  depth: number,
  rotationDeg: number,
) {
  const [px, pz] = point;
  const [cx, cz] = center;
  const dx = px - cx;
  const dz = pz - cz;
  const radians = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(-radians);
  const sinR = Math.sin(-radians);
  const localX = dx * cosR - dz * sinR;
  const localZ = dx * sinR + dz * cosR;
  return Math.abs(localX) <= width / 2 && Math.abs(localZ) <= depth / 2;
}

function findPointCollision(
  point: [number, number],
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
) {
  for (const obstruction of scene.obstructions) {
    const [width, , depth] = obstruction.dimensions;
    const [ox, , oz] = obstruction.position;

    if (
      pointInsideOrientedRect(
        point,
        [ox, oz],
        Math.max(width, 0.01),
        Math.max(depth, 0.01),
        obstruction.rotationYDeg,
      )
    ) {
      return obstruction;
    }
  }

  return null;
}

function findNearestWalkablePoint(
  point: [number, number],
  walkableCells: { x: number; z: number; walkable: boolean }[],
) {
  if (walkableCells.length === 0) {
    return point;
  }

  let closest = walkableCells[0] ?? null;
  let best = Number.POSITIVE_INFINITY;

  for (const cell of walkableCells) {
    const distance = Math.hypot(cell.x - point[0], cell.z - point[1]);
    if (distance < best) {
      best = distance;
      closest = cell;
    }
  }

  return closest ? [closest.x, closest.z] as [number, number] : point;
}

function buildLegalizedReplayWaypoints(
  sourceWaypoints: { position: [number, number]; timeS: number }[],
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
) {
  if (sourceWaypoints.length < 2) return sourceWaypoints.map((waypoint) => ({
    ...waypoint,
    rawPosition: waypoint.position,
    collided: false,
    blockedBy: undefined as string | undefined,
  }));

  const canonicalScene = safeParseSecurityScene(scene);
  const normalizedScene = canonicalScene.success
    ? canonicalScene.data
    : {
        ...scene,
        assumptions: {
          ...createBlankSecurityScene().assumptions,
          ...scene.assumptions,
        },
      };
  const grid = buildCoverageGrid(normalizedScene, 6);
  const walkableCells = grid.cells.filter((cell) => cell.walkable);
  const legalized: Array<{
    position: [number, number];
    rawPosition: [number, number];
    timeS: number;
    collided: boolean;
    blockedBy?: string;
  }> = [];

  for (let index = 0; index < sourceWaypoints.length - 1; index += 1) {
    const current = sourceWaypoints[index]!;
    const next = sourceWaypoints[index + 1]!;
    const segmentDistance = Math.hypot(
      next.position[0] - current.position[0],
      next.position[1] - current.position[1],
    );
    const steps = Math.max(1, Math.ceil(segmentDistance / MIN_PATH_SEGMENT_DURATION_DISTANCE_M));
    const startStep = index === 0 ? 0 : 1;

    for (let step = startStep; step < steps; step += 1) {
      const ratio = step / steps;
      const rawPoint: [number, number] = [
        current.position[0] + (next.position[0] - current.position[0]) * ratio,
        current.position[1] + (next.position[1] - current.position[1]) * ratio,
      ];
      const timeS = current.timeS + (next.timeS - current.timeS) * ratio;
      const obstruction = findPointCollision(rawPoint, scene);
      const adjustedPoint = obstruction
        ? findNearestWalkablePoint(rawPoint, walkableCells)
        : rawPoint;

      legalized.push({
        position: adjustedPoint,
        rawPosition: rawPoint,
        timeS,
        collided: Boolean(obstruction),
        blockedBy: obstruction?.label,
      });
    }
  }

  const last = sourceWaypoints[sourceWaypoints.length - 1]!;
  if (legalized.length === 0 || legalized[legalized.length - 1]!.timeS !== last.timeS) {
    const obstruction = findPointCollision(last.position, scene);
    legalized.push({
      position: obstruction ? findNearestWalkablePoint(last.position, walkableCells) : last.position,
      rawPosition: last.position,
      timeS: last.timeS,
      collided: Boolean(obstruction),
      blockedBy: obstruction?.label,
    });
  }

  return legalized;
}

function formatSecondsShort(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}


function ReplayCameraConeItem({
  camera,
}: {
  camera: ReturnType<typeof useStudioStore.getState>["scene"]["cameras"][number];
}) {
  const coneMemo = useMemo(() => {
    const direction = getYawPitchDirection(camera.yawDeg, camera.pitchDeg);
    const forward = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    const nextRange = Math.min(camera.rangeM, 12);
    const nextRadius = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180)) * nextRange;
    const nextCenterPos = new THREE.Vector3(...camera.position).add(forward.clone().multiplyScalar(nextRange / 2));
    const nextQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), forward);
    const cameraColor = getCameraColorForId(camera.id);
    const nextColor = camera.status === "on" ? cameraColor : "#64748b";
    const coneGeometry = new THREE.ConeGeometry(nextRadius, nextRange, 24, 1, false);
    const nextConeEdgeSource = new THREE.EdgesGeometry(coneGeometry);

    return {
      centerPos: nextCenterPos,
      quaternion: nextQuaternion,
      color: nextColor,
      coneGeometry,
      coneEdgeSource: nextConeEdgeSource,
    };
  }, [camera.fovHorizontalDeg, camera.id, camera.pitchDeg, camera.position, camera.rangeM, camera.status, camera.yawDeg]);

  useEffect(() => () => {
    coneMemo.coneGeometry.dispose();
    coneMemo.coneEdgeSource.dispose();
  }, [coneMemo]);

  const { centerPos, quaternion, color, coneGeometry, coneEdgeSource } = coneMemo;

  return (
    <group>
      <mesh position={centerPos} quaternion={quaternion}>
        <primitive attach="geometry" object={coneGeometry} />
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments position={centerPos} quaternion={quaternion}>
        <primitive attach="geometry" object={coneEdgeSource} />
        <lineBasicMaterial color={color} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}



function ReplayCameraCones() {
  const scene = useStudioStore((s) => s.scene);

  return (
    <group>
      {scene.cameras.map((camera) => (
        <ReplayCameraConeItem key={camera.id} camera={camera} />
      ))}
    </group>
  );
}

function ReplayCollisionMarkers({
  samples,
}: {
  samples: {
    position: [number, number];
    rawPosition: [number, number];
    timeS: number;
    collided: boolean;
    blockedBy?: string;
  }[];
}) {
  const firstCollision = samples.find((sample) => sample.collided);
  const collisionLine = useMemo(() => {
    if (!firstCollision) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          firstCollision.rawPosition[0], 0.04, firstCollision.rawPosition[1],
          firstCollision.position[0], 0.04, firstCollision.position[1],
        ]),
        3,
      ),
    );
    return geometry;
  }, [firstCollision]);

  useEffect(() => () => {
    if (collisionLine) {
      collisionLine.dispose();
    }
  }, [collisionLine]);

  if (!firstCollision) return null;

  return (
    <group>
      <mesh position={[firstCollision.rawPosition[0], 0.03, firstCollision.rawPosition[1]]}>
        <ringGeometry args={[0.18, 0.3, 24]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.95} />
      </mesh>
      <mesh position={[firstCollision.position[0], 0.02, firstCollision.position[1]]}>
        <ringGeometry args={[0.08, 0.16, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.7} />
      </mesh>
      {collisionLine && (
        <lineSegments geometry={collisionLine}>
          <lineBasicMaterial color="#f97316" transparent opacity={0.85} />
        </lineSegments>
      )}
      <SceneHtml position={[firstCollision.rawPosition[0], 0.55, firstCollision.rawPosition[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div className="rounded-md border border-[#f97316]/50 bg-black/80 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#fdba74]">
          Collision corrected
        </div>
      </SceneHtml>
    </group>
  );
}

// ── Playback Controls (framer-motion) ──

const controlBtnVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.08 },
  tap: { scale: 0.92 },
};

function PlaybackControls({
  playing,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onReset,
  speed,
  onSpeedChange,
  coverageBands,
}: {
  playing: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  coverageBands?: { position: [number, number]; timeS: number; detectionQuality: DoriQuality }[];
}) {
  const progress = duration > 0 ? currentTime / duration : 0;
  const isEnd = currentTime >= duration && duration > 0;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 }}
      className="absolute bottom-0 left-0 right-0 z-10 bg-linear-to-t from-black/90 via-black/70 to-transparent px-4 pb-3 pt-10"
    >
      {/* Progress bar with coverage quality bands */}
      <div className="group relative mb-1.5">
        {/* Coverage quality bands rendered behind the slider */}
        {coverageBands && (
          <CoverageQualityBands waypoints={coverageBands} totalDuration={duration} />
        )}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#60a5fa] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(96,165,250,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:active:scale-90"
          style={{
            background: `linear-gradient(to right, #60a5fa ${progress * 100}%, #1f2536 ${progress * 100}%)`,
          }}
        />
      </div>

      {/* Coverage mini legend */}
      {coverageBands && coverageBands.length >= 2 && (
        <div className="mb-2 flex justify-center">
          <CoverageMiniLegend />
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Left: transport controls */}
        <div className="flex items-center gap-1.5">
          <motion.button
            variants={controlBtnVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={onReset}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Reset"
          >
            <ListRestart className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            variants={controlBtnVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={() => onSeek(Math.max(0, currentTime - MIN_PLAYBACK_STEP_SECONDS))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title={`Skip back ${MIN_PLAYBACK_STEP_SECONDS}s`}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            variants={controlBtnVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={onPlayPause}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
              playing
                ? "bg-[#60a5fa] text-white shadow-[0_0_14px_rgba(96,165,250,0.5)] hover:shadow-[0_0_20px_rgba(96,165,250,0.6)]"
                : "bg-[#1a2333] text-[#93c5fd] hover:bg-[#253454]"
            }`}
            title={playing ? "Pause" : "Play"}
          >
            {isEnd ? (
              <ListRestart className="h-3.5 w-3.5" />
            ) : playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 ml-0.5" />
            )}
          </motion.button>
          <motion.button
            variants={controlBtnVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={() => onSeek(Math.min(duration, currentTime + MIN_PLAYBACK_STEP_SECONDS))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title={`Skip forward ${MIN_PLAYBACK_STEP_SECONDS}s`}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </motion.button>
        </div>

        {/* Center: time display */}
        <div className="flex items-center gap-3">
      <motion.span
            key={currentTime}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-mono tabular-nums text-[#8b96ab]"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </motion.span>
        </div>

        {/* Right: speed selector */}
        <div className="flex items-center gap-0.5">
            {REPLAY_SPEED_OPTIONS.map((s) => (
              <motion.button
              key={s}
              variants={controlBtnVariants}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              onClick={() => onSpeedChange(s)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                speed === s
                  ? "bg-[#1a2333] text-[#93c5fd]"
                  : "text-[#4a5568] hover:bg-[#131a28] hover:text-[#8b96ab]"
              }`}
            >
              {s}×
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Camera markers in replay ──

function CameraMarkers() {
  const scene = useStudioStore((s) => s.scene);

  return (
    <group>
      {scene.cameras.map((cam) => {
        const cameraColor = getCameraColorForId(cam.id);
        return (
          <group key={cam.id} position={cam.position}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 14]} />
              <meshStandardMaterial color={cameraColor} emissive={cameraColor} emissiveIntensity={0.4} roughness={0.34} metalness={0.65} />
            </mesh>
            <SceneHtml position={[0, 0.28, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  background: "rgba(10,13,19,0.85)",
                  border: `1px solid ${cameraColor}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 7,
                  color: "#8bc0ff",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {cam.name}
              </div>
            </SceneHtml>
          </group>
        );
      })}
    </group>
  );
}

// ── Coverage quality bands on the scrub bar ──

function CoverageQualityBands({ waypoints, totalDuration }: {
  waypoints: { position: [number, number]; timeS: number; detectionQuality: DoriQuality }[];
  totalDuration: number;
}) {
  if (waypoints.length < 2 || totalDuration <= 0) return null;

  const bands: { color: string; leftPct: number; widthPct: number; label: string; key: string }[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    const segDuration = (next.timeS ?? 0) - (curr.timeS ?? 0);
    if (segDuration <= 0) continue;

    // Use the more conservative (worse) quality for the segment
    const quality = QUALITY_RANK[curr.detectionQuality] <= QUALITY_RANK[next.detectionQuality]
      ? curr.detectionQuality
      : next.detectionQuality;

    bands.push({
      color: QUALITY_COLOR[quality],
      leftPct: ((curr.timeS ?? 0) / totalDuration) * 100,
      widthPct: (segDuration / totalDuration) * 100,
      label: QUALITY_ABBR[quality],
      key: `${i}-${curr.timeS ?? 0}-${next.timeS ?? 0}`,
    });
  }

  return (
    <div className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-full" style={{ pointerEvents: "none" }}>
      {bands.map((band) => (
        <div
          key={`band-${band.key}`}
          className="absolute top-0 h-full opacity-25 transition-opacity duration-200 group-hover:opacity-35"
          style={{
            left: `${band.leftPct}%`,
            width: `${Math.max(band.widthPct, 0.5)}%`,
            backgroundColor: band.color,
          }}
          title={`${band.label}`}
        />
      ))}
    </div>
  );
}

// ── Mini coverage legend ──

function CoverageMiniLegend() {
  return (
    <div className="flex items-center gap-3">
      {(["identification", "recognition", "observation", "detection", "none"] as DoriQuality[]).map((q) => (
        <div key={q} className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: QUALITY_COLOR[q] }}
          />
          <span className="text-[7px] uppercase tracking-[0.08em] text-[#5b667c]">
            {QUALITY_ABBR[q]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Info overlay (framer-motion) ──

type QualityExposure = {
  detection: number;
  observation: number;
  recognition: number;
  identification: number;
  none?: number;
  [key: string]: number | undefined;
};
const EXPOSURE_KEYS: DoriQuality[] = ["identification", "recognition", "observation", "detection"];
type ReplayCameraStateSummary = {
  cameraId: string;
  cameraName: string;
  visible: boolean;
  quality?: DoriQuality;
  reason?: string;
};

function InfoOverlay({
  pathLabel,
  waypointCount,
  exposureScore,
  criticalZoneReachableAlongRoute,
  qualityBands,
  collisionCount,
  firstCollisionLabel,
  firstCollisionTimeS,
  currentTime,
  currentSegmentLabel,
  currentQualityLabel,
  bestCameraLabel,
  nextEventLabel,
}: {
  pathLabel: string;
  waypointCount: number;
  exposureScore?: number;
  criticalZoneReachableAlongRoute?: boolean;
  qualityBands: QualityExposure;
  collisionCount: number;
  firstCollisionLabel?: string;
  firstCollisionTimeS?: number;
  currentTime: number;
  currentSegmentLabel?: string;
  currentQualityLabel?: string;
  bestCameraLabel?: string;
  nextEventLabel?: string;
}) {
  const maxExposure = Math.max(...EXPOSURE_KEYS.map((k) => qualityBands[k] ?? 0), 1);
  const exposureLabel = typeof exposureScore === "number" ? exposureScore.toFixed(1) : "—";
  const hasCoverageRisk = criticalZoneReachableAlongRoute === true;
  const hasCoverageSummary = typeof criticalZoneReachableAlongRoute === "boolean"
    || typeof exposureScore === "number";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="absolute left-3 z-10 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
      style={{ top: "calc(var(--st-full-canvas-safe-top, 4.25rem) + 0.75rem)" }}
    >
      <div className="mb-2.5 flex items-center gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5b667c]">{pathLabel}</div>
        {hasCoverageRisk && (
          <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-red-400">
            Critical Zone Reachable
          </span>
        )}
      </div>

      {/* Main stats */}
      <div className="mb-2.5 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[8px] text-[#5b667c]">Waypoints</div>
          <div className="mt-0.5 text-[11px] font-mono font-semibold text-[#c7d0e4]">{waypointCount}</div>
        </div>
        <div>
          <div className="text-[8px] text-[#5b667c]">Exposure</div>
          <div className="mt-0.5 text-[11px] font-mono font-semibold text-[#f43f5e]">{exposureLabel}</div>
        </div>
        <div>
          <div className="text-[8px] text-[#5b667c]">Status</div>
          <div className={`mt-0.5 text-[11px] font-semibold ${hasCoverageRisk ? "text-red-400" : "text-[#5b667c]"}`}>
            {hasCoverageSummary
              ? hasCoverageRisk
                ? "Coverage Failure Risk"
                : "Route Covered"
              : "Summary pending"}
          </div>
        </div>
      </div>

      <div className="mb-2 rounded-lg border border-[#243146] bg-[#111521] px-2 py-1.5">
        <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-[#7dd3fc]">Current state</div>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-[#d2d9e8]">
          <div>
            <span className="text-[#6a748b]">Time:</span> {currentTime.toFixed(1)}s
          </div>
          <div className="truncate">
            <span className="text-[#6a748b]">Quality:</span> {currentQualityLabel ?? "—"}
          </div>
          <div className="col-span-2 truncate">
            <span className="text-[#6a748b]">Segment:</span> {currentSegmentLabel ?? "Route summary"}
          </div>
          <div className="col-span-2 truncate">
            <span className="text-[#6a748b]">Best camera:</span> {bestCameraLabel ?? "unavailable"}
          </div>
          <div className="col-span-2 truncate">
            <span className="text-[#6a748b]">Next event:</span> {nextEventLabel ?? "No upcoming event"}
          </div>
        </div>
      </div>

      {collisionCount > 0 && (
        <div className="mb-2 rounded-lg border border-[#f97316]/30 bg-[#451a03]/40 px-2 py-1.5">
          <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-[#fdba74]">Collision guard</div>
          <div className="mt-0.5 text-[9px] text-[#fed7aa]">
            {collisionCount} path sample{collisionCount === 1 ? "" : "s"} corrected away from
            {firstCollisionLabel ? ` ${firstCollisionLabel}` : " an obstruction"}
            {typeof firstCollisionTimeS === "number" ? ` at ${firstCollisionTimeS.toFixed(1)}s.` : "."}
          </div>
        </div>
      )}

      {/* Coverage quality exposure breakdown */}
      <div className="border-t border-[#1f2536]/60 pt-2">
        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#4a5568]">Exposure by quality</div>
        <div className="space-y-1">
          {EXPOSURE_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: QUALITY_COLOR[key] }} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[7px] uppercase tracking-wider text-[#5b667c]">{key}</span>
                  <span className="text-[7px] font-mono text-[#8b96ab]">
                    {(qualityBands[key] ?? 0).toFixed(0)}s
                  </span>
                </div>
                {/* Mini bar */}
                <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-[#1a2333]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(((qualityBands[key] ?? 0) / maxExposure) * 100)}%`,
                      backgroundColor: QUALITY_COLOR[key],
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ──

function EmptyReplayState({ showActivePathHint }: { showActivePathHint: boolean }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#07090d]">
      <RunSimulationPrompt
        className="px-4"
        message={
          showActivePathHint
            ? "Run the shared simulation, then pick a path or return to Coverage Failure Path to replay."
            : "Run the shared simulation to generate a coverage failure path for replay."
        }
      />
    </div>
  );
}

function CurrentVisibilityPanel({
  currentTime,
  visibleNow,
  lostNow,
}: {
  currentTime: number;
  visibleNow: ReplayCameraStateSummary[];
  lostNow: ReplayCameraStateSummary[];
}) {
  return (
    <div
      className="absolute right-3 z-10 w-76 rounded-xl border border-[#1f2536] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
      style={{ top: "calc(var(--st-full-canvas-safe-top, 4.25rem) + 0.875rem)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">Current Visibility</div>
        <div className="text-[8px] font-mono text-[#8b96ab]">@ {currentTime.toFixed(1)}s</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1">
          <div className="text-[7px] uppercase tracking-[0.14em] text-[#86efac]">Visible now</div>
          <div className="mt-0.5 text-[12px] font-semibold text-emerald-200">{visibleNow.length}</div>
        </div>
        <div className="rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-1">
          <div className="text-[7px] uppercase tracking-[0.14em] text-[#fda4af]">Lost now</div>
          <div className="mt-0.5 text-[12px] font-semibold text-rose-200">{lostNow.length}</div>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {[...visibleNow.slice(0, 3), ...lostNow.slice(0, 2)].map((entry) => (
          <div key={entry.cameraId} className="rounded-md border border-[#243146] bg-[#111521] px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[9px] font-medium text-[#d2d9e8]">{entry.cameraName}</span>
              <span
                className={`rounded px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em] ${
                  entry.visible ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
                }`}
              >
                {entry.visible ? "Visible" : "Lost"}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[8px] text-[#8b96ab]">
              {entry.quality ? `${entry.quality.toUpperCase()} • ` : ""}{entry.reason ?? "No reason annotation"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Path Replay View ──

export function PathReplayView() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setActivePathId = useStudioStore((s) => s.setActivePathId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const setPathReplaySpeed = useStudioStore((s) => s.setPathReplaySpeed);
  const pathReplaySpeed = useStudioStore((s) => s.pathReplay.speed);
  const followActor = useStudioStore((s) => s.pathReplay.followActor);
  const coverageFailurePath = result?.adversarialPath;
  const activePath = useMemo(() => {
    if (!scene.paths.length || !activePathId) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? null;
  }, [scene.paths, activePathId]);
  const activePathResult = useMemo(() => {
    if (!activePath || !result?.pathResults.length) return null;
    return result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result]);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(pathReplaySpeed);

  useEffect(() => {
    startTransition(() => {
      setSpeed(pathReplaySpeed);
    });
  }, [pathReplaySpeed]);

  // Derived data
  const playbackWaypoints = useMemo(() => {
    if (activePath) {
      return buildPlaybackWaypoints(activePath);
    }

    if (!coverageFailurePath) return [];
    return coverageFailurePath.waypoints.map((wp) => ({ position: wp.position, timeS: wp.timeS }));
  }, [activePath, coverageFailurePath]);

  const replaySamples = useMemo(
    () => sanitizeReplayWaypointsForPlayback(
      buildLegalizedReplayWaypoints(playbackWaypoints, scene),
    ),
    [playbackWaypoints, scene],
  );
  const hasReplaySummary = Boolean(coverageFailurePath);
  const replayDurationS = clampPathDuration(replaySamples[replaySamples.length - 1]?.timeS ?? 0);

  const waypoints: [number, number][] = useMemo(
    () => replaySamples.map((wp) => wp.position),
    [replaySamples],
  );
  const controlsRef = useRef<{ target: THREE.Vector3; update?: () => void } | null>(null);
  const handleControlsRef = useCallback((instance: unknown) => {
    controlsRef.current = instance as { target: THREE.Vector3; update?: () => void } | null;
  }, []);
  const pathLengthM = useMemo(() => {
    if (!activePath) return 0;
    return pathLength(activePath.points.map((point) => point.position));
  }, [activePath]);
  const estimatedTimeS = useMemo(() => clampPathDuration(activePath ? getPathReplayDurationS(activePath) : 0), [activePath]);
  const selectedPathLabel = activePath?.label ?? "Coverage Failure Path";
  const timelineEvents = useMemo(() => sortTimelineEvents(activePathResult?.timeline), [activePathResult?.timeline]);
  const totalDuration = clampPathDuration(
    activePathResult?.totalDurationS
      ?? coverageFailurePath?.totalDurationS
      ?? replayDurationS
      ?? 0,
  );
  const safeCurrentTime = useMemo(() => {
    const safe = clampPathDuration(currentTime);
    return totalDuration > 0 ? Math.min(safe, totalDuration) : 0;
  }, [currentTime, totalDuration]);
  const currentTimelineEvent = useMemo(
    () => findLatestTimelineEventAtOrBeforeTime(timelineEvents, safeCurrentTime),
    [timelineEvents, safeCurrentTime],
  );
  const nextTimelineEvent = useMemo(
    () => findNextTimelineEventAfterTime(timelineEvents, safeCurrentTime),
    [timelineEvents, safeCurrentTime],
  );

  // Coverage bands data for the scrub bar (full waypoint objects with quality)
  const coverageBands = useMemo(() => {
    if (activePath) {
      if (!result?.coverageCells?.length) return [];
      return samplePathQuality(activePath, result?.coverageCells ?? [], 0.25).map((sample) => ({
        position: sample.position,
        timeS: sample.timeS,
        detectionQuality: sample.quality,
      }));
    }

    if (activePathResult) {
      return activePathResult.timeline.map((event) => ({
        position: [0, 0] as [number, number],
        timeS: event.timeS,
        detectionQuality: event.quality ?? "none",
      }));
    }

    return coverageFailurePath?.waypoints ?? [];
  }, [activePath, activePathResult, coverageFailurePath, result?.coverageCells]);

  // Quality exposure breakdown for info overlay
  const qualityExposure = useMemo((): QualityExposure => {
    const base = hasReplaySummary ? coverageFailurePath?.detectionQualityExposure ?? {} : {};
    return {
      detection: base.detection ?? 0,
      observation: base.observation ?? 0,
      recognition: base.recognition ?? 0,
      identification: base.identification ?? 0,
      ...base,
    };
  }, [coverageFailurePath, hasReplaySummary]);
  const collisionCount = useMemo(
    () => replaySamples.filter((sample) => sample.collided).length,
    [replaySamples],
  );
  const firstCollision = useMemo(
    () => replaySamples.find((sample) => sample.collided) ?? null,
    [replaySamples],
  );
  const criticalZoneReachableAlongRoute = hasReplaySummary
    ? coverageFailurePath?.criticalZoneReachable ?? false
    : undefined;
  const currentQualityLabel = currentTimelineEvent?.quality?.toUpperCase() ?? (hasReplaySummary ? "Route replay" : undefined);
  const currentSegmentLabel = currentTimelineEvent?.reason
    ?? (currentTimelineEvent?.event === "lost"
      ? "Visibility loss"
      : currentTimelineEvent?.event === "quality_change"
        ? "Quality transition"
        : currentTimelineEvent?.event === "visible"
          ? "Visible segment"
          : undefined);
  const bestCameraLabel = useMemo(() => {
    if (!activePathResult) return undefined;
    const entries = Object.entries(activePathResult.visibilityByCamera);
    if (entries.length === 0) return undefined;
    const best = entries.sort((a, b) => {
      const diff = (b[1]?.maxQuality ? QUALITY_RANK[b[1].maxQuality] : 0) - (a[1]?.maxQuality ? QUALITY_RANK[a[1].maxQuality] : 0);
      if (diff !== 0) return diff;
      return (b[1]?.visibleS ?? 0) - (a[1]?.visibleS ?? 0);
    })[0];
    if (!best) return undefined;
    return scene.cameras.find((camera) => camera.id === best[0])?.name ?? best[0];
  }, [activePathResult, scene.cameras]);
  const replayCameraStateSummary = useMemo(() => {
    if (!timelineEvents.length) {
      return { visibleNow: [] as ReplayCameraStateSummary[], lostNow: [] as ReplayCameraStateSummary[] };
    }
    const stateByCamera = buildReplayStateByCameraAtTime(timelineEvents, safeCurrentTime);
    const entries: ReplayCameraStateSummary[] = Object.entries(stateByCamera).map(([cameraId, state]) => ({
      cameraId,
      cameraName: scene.cameras.find((camera) => camera.id === cameraId)?.name ?? cameraId,
      visible: state.visible,
      quality: state.quality,
      reason: state.reason,
    }));
    const sortByPriority = (a: ReplayCameraStateSummary, b: ReplayCameraStateSummary) =>
      (QUALITY_RANK[b.quality ?? "none"] - QUALITY_RANK[a.quality ?? "none"])
      || a.cameraName.localeCompare(b.cameraName);
    return {
      visibleNow: entries.filter((entry) => entry.visible).sort(sortByPriority),
      lostNow: entries.filter((entry) => !entry.visible).sort(sortByPriority),
    };
  }, [scene.cameras, timelineEvents, safeCurrentTime]);

  // Find current segment index + progress based on elapsed time.
  const { currentIndex, progress } = getPlaybackPosition(replaySamples, safeCurrentTime);
  const actorPosition = useMemo<[number, number] | null>(() => {
    if (waypoints.length === 0) return null;
    if (currentIndex >= waypoints.length - 1) return waypoints[waypoints.length - 1] ?? null;

    const current = waypoints[currentIndex] ?? null;
    const next = waypoints[currentIndex + 1] ?? null;
    if (!current || !next) return current;

    return [
      current[0] + (next[0] - current[0]) * progress,
      current[1] + (next[1] - current[1]) * progress,
    ];
  }, [currentIndex, progress, waypoints]);

  // Auto-advance time when playing
  // Use refs for values that change during animation to avoid effect re-triggering every frame.
  const playbackAnchorRef = useRef({ startWallTime: 0, startPlaybackTime: 0 });
  const lastSharedProgressPublishAtRef = useRef(0);
  const playbackRafRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const totalDurationRef = useRef(0);
  currentTimeRef.current = currentTime;
  totalDurationRef.current = totalDuration;

  useEffect(() => {
    if (!playing || totalDurationRef.current <= 0) return;

    const startWallTime = performance.now();
    playbackAnchorRef.current = { startWallTime, startPlaybackTime: currentTimeRef.current };
    lastSharedProgressPublishAtRef.current = startWallTime;

    const tick = (now: number) => {
      const elapsedWallSeconds = (now - playbackAnchorRef.current.startWallTime) / 1000;
      const nextTime = playbackAnchorRef.current.startPlaybackTime + elapsedWallSeconds * speed;
      const clampedTime = Math.min(nextTime, totalDurationRef.current);

      setCurrentTime(clampedTime);
      const nowMs = performance.now();
      if (nowMs - lastSharedProgressPublishAtRef.current >= SHARED_REPLAY_PROGRESS_PUBLISH_INTERVAL_MS) {
        lastSharedProgressPublishAtRef.current = nowMs;
        setPathReplayProgress(clampReplayProgress(totalDurationRef.current > 0 ? clampedTime / totalDurationRef.current : 0));
      }

      if (clampedTime >= totalDurationRef.current) {
        setPathReplayProgress(clampReplayProgress(1));
        setCurrentTime(totalDurationRef.current);
        setPlaying(false);
        setPathReplayPlaying(false);
        playbackRafRef.current = null;
        return;
      }

      playbackRafRef.current = requestAnimationFrame(tick);
    };

    playbackRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackRafRef.current !== null) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [playing, speed, setPathReplayPlaying, setPathReplayProgress]);

  useEffect(() => {
    if (!followActor || !actorPosition || !controlsRef.current) return;
    controlsRef.current.target.set(actorPosition[0], 0.6, actorPosition[1]);
    controlsRef.current.update?.();
  }, [actorPosition, followActor]);

  // Reset
  const handleReset = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
  }, [setPathReplayPlaying, setPathReplayProgress]);

  // Play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (safeCurrentTime >= totalDuration && totalDuration > 0) {
      // At end, reset first
      setCurrentTime(0);
      setPathReplayProgress(clampReplayProgress(0));
    }
    setPlaying((prev) => {
      const next = !prev;
      setPathReplayPlaying(next);
      if (!next) {
        setPathReplayProgress(clampReplayProgress(totalDuration > 0 ? safeCurrentTime / totalDuration : 0));
      }
      return next;
    });
  }, [safeCurrentTime, setPathReplayPlaying, setPathReplayProgress, totalDuration]);

  // Seek
  const handleSeek = useCallback((t: number) => {
    const clamped = clampPathDuration(Math.min(t, totalDuration));
    setCurrentTime(clamped);
    setPathReplayProgress(clampReplayProgress(totalDuration > 0 ? clamped / totalDuration : 0));
    setPlaying((prev) => {
      // Re-anchor RAF if currently playing (seek-while-playing edge case)
      if (prev) {
        playbackAnchorRef.current = { startWallTime: performance.now(), startPlaybackTime: clamped };
      }
      return prev; // don't change playing state
    });
  }, [setPathReplayProgress, totalDuration]);

  const handlePathChange = useCallback((nextPathId: string | null) => {
    setActivePathId(nextPathId);
    setPlaying(false);
    setCurrentTime(0);
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
  }, [setActivePathId, setPathReplayPlaying, setPathReplayProgress]);

  const handleEditPath = useCallback(() => {
    if (!activePath) return;
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
    setWorkspacePreset("edit");
    setViewMode("map");
    setBottomTab("timeline");
    setActiveTool("path");
  }, [activePath, setActiveTool, setBottomTab, setPathReplayPlaying, setPathReplayProgress, setViewMode, setWorkspacePreset]);

  const handleSpeedChange = useCallback((nextSpeed: number) => {
    setSpeed(nextSpeed);
    setPathReplaySpeed(nextSpeed);
  }, [setPathReplaySpeed]);

  if (waypoints.length < 2) {
    return <EmptyReplayState showActivePathHint={Boolean(scene.paths.length)} />;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07090d]" style={{ paddingTop: "var(--st-full-canvas-safe-top, 4.25rem)" }}>
      <div className="flex items-center justify-between gap-4 border-b border-[#1f2536] bg-[#0b0f17] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">
            Incident Review — Coverage Replay
          </div>
          <div className="mt-1 text-[9px] leading-4 text-[#556076]">
            Defensive analysis: subject visibility along the selected route.
            Use the timeline controls below to review camera responsibility and coverage loss events.
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              className="min-w-55 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[11px] font-medium text-[#d7deed] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
              value={activePathId ?? ""}
              onChange={(event) => handlePathChange(event.target.value || null)}
              aria-label="Select active replay path"
            >
              <option value="">Coverage Failure Path</option>
              {scene.paths.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleEditPath}
              disabled={!activePath}
              className="rounded-lg border border-[#24283a] bg-[#111521] px-3 py-1.5 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Edit Path
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
            >
              {playing ? "Pause" : "Play"} Path
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-right text-[9px]">
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5">
            <div className="uppercase tracking-[0.16em] text-[#556076]">Path Length</div>
            <div className="mt-0.5 font-mono text-[#c7d0e4]">{pathLengthM.toFixed(1)}m</div>
          </div>
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5">
            <div className="uppercase tracking-[0.16em] text-[#556076]">Est. Time</div>
            <div className="mt-0.5 font-mono text-[#c7d0e4]">{estimatedTimeS > 0 ? formatSecondsShort(estimatedTimeS) : "--"}</div>
          </div>
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5">
            <div className="uppercase tracking-[0.16em] text-[#556076]">Start Time</div>
            <div className="mt-0.5 font-mono text-[#c7d0e4]">{formatSecondsShort(playbackWaypoints[0]?.timeS ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5">
            <div className="uppercase tracking-[0.16em] text-[#556076]">Visible Now</div>
            <div className="mt-0.5 font-mono text-[#c7d0e4]">
              {activePathResult ? `${replayCameraStateSummary.visibleNow.length}/${scene.cameras.length}` : "--"}
            </div>
          </div>
        </div>
      </div>

        <InfoOverlay
          pathLabel={selectedPathLabel}
          waypointCount={waypoints.length}
          exposureScore={hasReplaySummary ? coverageFailurePath?.totalExposureScore : undefined}
          criticalZoneReachableAlongRoute={criticalZoneReachableAlongRoute}
          qualityBands={qualityExposure}
          collisionCount={collisionCount}
        firstCollisionLabel={firstCollision?.blockedBy}
        firstCollisionTimeS={firstCollision?.timeS}
        currentTime={safeCurrentTime}
        currentSegmentLabel={currentSegmentLabel}
        currentQualityLabel={currentQualityLabel}
        bestCameraLabel={bestCameraLabel}
        nextEventLabel={nextTimelineEvent?.reason ?? nextTimelineEvent?.event?.replace(/_/g, " ")}
      />
      {activePathResult ? (
        <CurrentVisibilityPanel
          currentTime={safeCurrentTime}
          visibleNow={replayCameraStateSummary.visibleNow}
          lostNow={replayCameraStateSummary.lostNow}
        />
      ) : null}

      <Canvas
        camera={{ position: [12.8, 7.6, 11.6], fov: 31, near: 0.1, far: 200 }}
        shadows="percentage"
        gl={{ antialias: true }}
        className="flex-1 min-h-0"
        style={{ background: "#0a0d13" }}
      >
        <Suspense fallback={<CanvasLoadingOverlay label="Loading replay scene" />}>
          <SceneView />
        </Suspense>

        <CoverageTileFloor cells={result?.coverageCells ?? []} />

        {/* Coverage-failure path line — colored segments by DORI quality */}
        {!activePath && coverageFailurePath && (
          <CoverageSegmentPath waypoints={coverageFailurePath.waypoints} />
        )}
        <PathMarkers waypoints={waypoints} />

        {/* Actor */}
        <PathActor waypoints={waypoints} currentIndex={currentIndex} progress={progress} />

        {/* Replay proof overlays */}
        <ReplayCameraCones />
        <ReplayCollisionMarkers samples={replaySamples} />

        {/* Camera markers */}
        <CameraMarkers />

        <OrbitControls
          ref={handleControlsRef}
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

      <PlaybackControls
        playing={playing}
        currentTime={safeCurrentTime}
        duration={totalDuration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onReset={handleReset}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        coverageBands={coverageBands}
      />

      {/* Visibility Timeline — shown below the canvas */}
      <div className="absolute bottom-25 left-3 right-3 z-10">
        <VisibilityTimeline
          pathResult={activePathResult}
          currentTime={safeCurrentTime}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
