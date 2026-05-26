"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { ListRestart, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  CoverageHeatmapInstanced,
  CoverageSegmentPath,
} from "@/components/workspace/SharedScene";
import { VisibilityTimeline } from "@/components/view/VisibilityTimeline";
import type { DoriQuality, SimulationResult } from "@/schema/security-scene";

// ── Shared scene ──

const PATH_REPLAY_THEME = ENVIRONMENT_THEMES.day;

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
  coverageFailurePath: SimulationResult["adversarialPath"] | undefined,
  currentTime: number,
) {
  if (!coverageFailurePath || coverageFailurePath.waypoints.length < 2) {
    return { currentIndex: 0, progress: 0 };
  }

  const wps = coverageFailurePath.waypoints;
  let cumulativeTime = 0;

  for (let i = 0; i < wps.length - 1; i++) {
    const segmentDuration = (wps[i + 1].timeS ?? 0) - (wps[i].timeS ?? 0);
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

// ── Animated Actor (useFrame for R3F-native per-frame updates) ──

function PathActor({ waypoints, currentIndex, progress }: {
  waypoints: [number, number][];
  currentIndex: number;
  progress: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  // Ref to latest props so useFrame always reads fresh values
  const propsRef = useRef({ waypoints, currentIndex, progress });

  useEffect(() => {
    propsRef.current = { waypoints, currentIndex, progress };
  }, [waypoints, currentIndex, progress]);

  // Directly mutate the Three.js object every frame — no React re-render
  useFrame(() => {
    const { waypoints: wps, currentIndex: idx, progress: prog } = propsRef.current;
    if (!groupRef.current || wps.length < 2) return;

    let x: number, z: number, dx = 0, dz = 0;
    if (idx >= wps.length - 1) {
      x = wps[wps.length - 1][0];
      z = wps[wps.length - 1][1];
    } else {
      const a = wps[idx];
      const b = wps[Math.min(idx + 1, wps.length - 1)];
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
      {/* Actor shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      {/* Body - capsule torso */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.14, 0.82, 0]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.03, 0.2, 4, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.14, 0.82, 0]} rotation={[0, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.03, 0.2, 4, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.06, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.03, 0.25, 4, 6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.06, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.03, 0.25, 4, 6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Detection state indicator ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.12, 0.28, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
      </mesh>
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 }}
      className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-3 pt-10"
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
            onClick={() => onSeek(Math.max(0, currentTime - 2))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Skip back 2s"
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
            onClick={() => onSeek(Math.min(duration, currentTime + 2))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Skip forward 2s"
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
          {[0.5, 1, 2, 4].map((s) => (
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
      {scene.cameras.map((cam) => (
        <group key={cam.id} position={cam.position}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 14]} />
            <meshStandardMaterial color="#4d89eb" emissive="#25497a" emissiveIntensity={0.55} roughness={0.34} metalness={0.65} />
          </mesh>
          <Html position={[0, 0.28, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "rgba(10,13,19,0.85)",
                border: "1px solid #29456d",
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
          </Html>
        </group>
      ))}
    </group>
  );
}

// ── Coverage quality color constants ──

const QUALITY_COLORS: Record<DoriQuality, string> = {
  identification: "#3b82f6",
  recognition: "#22c55e",
  observation: "#eab308",
  detection: "#f97316",
  none: "#ef4444",
};

const QUALITY_RANK: Record<DoriQuality, number> = {
  identification: 4,
  recognition: 3,
  observation: 2,
  detection: 1,
  none: 0,
};

const QUALITY_LABELS: Record<DoriQuality, string> = {
  identification: "ID",
  recognition: "REC",
  observation: "OBS",
  detection: "DET",
  none: "NONE",
};

// ── Coverage quality bands on the scrub bar ──

function CoverageQualityBands({ waypoints, totalDuration }: {
  waypoints: { position: [number, number]; timeS: number; detectionQuality: DoriQuality }[];
  totalDuration: number;
}) {
  if (waypoints.length < 2 || totalDuration <= 0) return null;

  const bands: { color: string; leftPct: number; widthPct: number; label: string }[] = [];

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
      color: QUALITY_COLORS[quality],
      leftPct: ((curr.timeS ?? 0) / totalDuration) * 100,
      widthPct: (segDuration / totalDuration) * 100,
      label: QUALITY_LABELS[quality],
    });
  }

  return (
    <div className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-full" style={{ pointerEvents: "none" }}>
      {bands.map((band, i) => (
        <div
          key={i}
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
            style={{ backgroundColor: QUALITY_COLORS[q] }}
          />
          <span className="text-[7px] uppercase tracking-[0.08em] text-[#5b667c]">
            {QUALITY_LABELS[q]}
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
};
const EXPOSURE_KEYS: (keyof QualityExposure)[] = ["identification", "recognition", "observation", "detection"];

function InfoOverlay({ waypointCount, exposureScore, targetReached, qualityBands }: {
  waypointCount: number;
  exposureScore: number;
  targetReached: boolean;
  qualityBands: QualityExposure;
}) {
  const maxExposure = Math.max(...EXPOSURE_KEYS.map((k) => qualityBands[k] ?? 0), 1);

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="absolute left-3 top-12 z-10 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)] backdrop-blur-sm"
    >
      <div className="mb-2.5 flex items-center gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5b667c]">Coverage Failure Path</div>
        {targetReached && (
          <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-red-400">
            Breach
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
          <div className="mt-0.5 text-[11px] font-mono font-semibold text-[#f43f5e]">{exposureScore.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[8px] text-[#5b667c]">Status</div>
          <div className={`mt-0.5 text-[11px] font-semibold ${targetReached ? "text-red-400" : "text-[#5b667c]"}`}>
            {targetReached ? "BREACHED" : "Secure"}
          </div>
        </div>
      </div>

      {/* Coverage quality exposure breakdown */}
      <div className="border-t border-[#1f2536]/60 pt-2">
        <div className="mb-1.5 text-[7px] font-semibold uppercase tracking-[0.15em] text-[#4a5568]">Exposure by quality</div>
        <div className="space-y-1">
          {EXPOSURE_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: QUALITY_COLORS[key] }} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[7px] uppercase tracking-[0.05em] text-[#5b667c]">{key}</span>
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
                      backgroundColor: QUALITY_COLORS[key],
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

function EmptyReplayState() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#07090d]">
      <div className="text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-full border border-dashed border-[#1f2536] flex items-center justify-center">
          <Play className="h-5 w-5 text-[#2a3246] ml-0.5" />
        </div>
        <p className="text-[11px] text-[#4a5568]">Run simulation to generate coverage failure path</p>
        <p className="mt-1 text-[9px] text-[#3a4158]">Toggle Path Replay after simulation completes</p>
      </div>
    </div>
  );
}

// ── Main Path Replay View ──

export function PathReplayView() {
  const result = useStudioStore((s) => s.simulationResult);
  const coverageFailurePath = result?.adversarialPath;

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Derived data
  const waypoints: [number, number][] = useMemo(() => {
    if (!coverageFailurePath) return [];
    return coverageFailurePath.waypoints.map((wp) => wp.position);
  }, [coverageFailurePath]);

  // Coverage bands data for the scrub bar (full waypoint objects with quality)
  const coverageBands = useMemo(() => {
    return coverageFailurePath?.waypoints ?? [];
  }, [coverageFailurePath]);

  // Quality exposure breakdown for info overlay
  const qualityExposure = useMemo(() => {
    if (!coverageFailurePath) {
      return { detection: 0, observation: 0, recognition: 0, identification: 0 };
    }
    return coverageFailurePath.detectionQualityExposure;
  }, [coverageFailurePath]);

  const totalDuration = coverageFailurePath?.totalDurationS ?? 0;

  // Find current segment index + progress based on elapsed time.
  const { currentIndex, progress } = getPlaybackPosition(coverageFailurePath, currentTime);

  // Auto-advance time when playing
  // Use a ref to track the "anchor" (time when playback was last resumed) so
  // seeking while playing doesn't jump back to the pre-seek position.
  const playbackAnchorRef = useRef({ startWallTime: 0, startPlaybackTime: 0 });

  useEffect(() => {
    // currentTime intentionally excluded from deps below: captured once in the ref when
    // playback starts. Adding it would reset the anchor on every tick (break seek-while-playing).
    if (!playing || totalDuration <= 0) return;

    // Reset anchor when playback starts or restarts
    playbackAnchorRef.current = { startWallTime: performance.now(), startPlaybackTime: currentTime };

    let rafId: number;

    const tick = (now: number) => {
      const elapsed = (now - playbackAnchorRef.current.startWallTime) / 1000;
      const nextTime = Math.min(
        playbackAnchorRef.current.startPlaybackTime + elapsed * speed,
        totalDuration,
      );
      setCurrentTime(nextTime);

      if (nextTime >= totalDuration) {
        setPlaying(false);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, totalDuration]);

  // Reset
  const handleReset = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  // Play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (currentTime >= totalDuration && totalDuration > 0) {
      // At end, reset first
      setCurrentTime(0);
    }
    setPlaying((p) => !p);
  }, [currentTime, totalDuration]);

  // Seek
  const handleSeek = useCallback((t: number) => {
    const clamped = Math.min(t, totalDuration);
    setCurrentTime(clamped);
    setPlaying((prev) => {
      // Re-anchor RAF if currently playing (seek-while-playing edge case)
      if (prev) {
        playbackAnchorRef.current = { startWallTime: performance.now(), startPlaybackTime: clamped };
      }
      return prev; // don't change playing state
    });
  }, [totalDuration]);

  if (!coverageFailurePath || waypoints.length < 2) {
    return <EmptyReplayState />;
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-[#07090d]">
      {coverageFailurePath && (
        <InfoOverlay
          waypointCount={waypoints.length}
          exposureScore={coverageFailurePath.totalExposureScore}
          targetReached={coverageFailurePath.targetReached}
          qualityBands={qualityExposure}
        />
      )}

      <Canvas
        camera={{ position: [12.8, 7.6, 11.6], fov: 31, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ background: "#0a0d13" }}
        shadows="percentage"
      >
        <Suspense fallback={null}>
          <SceneView />
        </Suspense>

        {/* Coverage-failure path line — colored segments by DORI quality */}
        {coverageFailurePath && (
          <CoverageSegmentPath waypoints={coverageFailurePath.waypoints} />
        )}
        <PathMarkers waypoints={waypoints} />

        {/* Actor */}
        <PathActor waypoints={waypoints} currentIndex={currentIndex} progress={progress} />

        {/* Camera markers */}
        <CameraMarkers />

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

      <PlaybackControls
        playing={playing}
        currentTime={currentTime}
        duration={totalDuration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onReset={handleReset}
        speed={speed}
        onSpeedChange={setSpeed}
        coverageBands={coverageBands}
      />

      {/* Visibility Timeline — shown below the canvas */}
      <div className="absolute bottom-[100px] left-3 right-3 z-10">
        <VisibilityTimeline
          pathResult={result?.pathResults[0] ?? null}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
