"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";


import { useStudioStore } from "@/store/studio-store";

// ── Shared scene (mirror of WorkspaceCanvas internals) ──

const ENV_THEME = {
  background: "#0a0d13",
  ambient: 0.66,
  hemisphere: 0.62,
  directional: 2.3,
  fill: 0.55,
};

function SceneView() {
  const scene = useStudioStore((s) => s.scene);
  const { width, depth } = scene.dimensions;
  const result = useStudioStore((s) => s.simulationResult);

  return (
    <>
      <color attach="background" args={["#0a0d13"]} />
      <fog attach="fog" args={["#0a0d13", 12, 24]} />
      <ambientLight intensity={ENV_THEME.ambient} />
      <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={ENV_THEME.hemisphere} />
      <directionalLight position={[10, 14, 8]} intensity={ENV_THEME.directional} color="#eef4ff" castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-5, 8, -8]} intensity={ENV_THEME.fill} color="#a5c2ff" />
      <pointLight position={[5, 2.8, 3.5]} intensity={1.15} distance={8} color="#fff6d8" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.0015, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#252d3a" roughness={0.97} />
      </mesh>

      {/* Floor grid */}
      <gridHelper args={[Math.max(width, depth) + 1.5, (Math.max(width, depth) + 2) * 6, "#2d3444", "#181d28"]} position={[width / 2, 0.002, depth / 2]} />

      {/* Walls */}
      {scene.walls.map((wall) => {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const cx = (wall.start[0] + wall.end[0]) / 2;
        const cz = (wall.start[1] + wall.end[1]) / 2;
        const isGlass = wall.material === "glass";
        return (
          <mesh key={wall.id} position={[cx, wall.heightM / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, wall.heightM, 0.18]} />
            <meshStandardMaterial
              color={isGlass ? "#cfe5ff" : "#d4dae6"}
              transparent={isGlass}
              opacity={isGlass ? 0.2 : 1}
              roughness={0.78}
              metalness={0.02}
            />
          </mesh>
        );
      })}

      {/* Obstructions */}
      {scene.obstructions.map((obs) => {
        const [w, d, h] = obs.dimensions;
        return (
          <group key={obs.id} position={obs.position} rotation={[0, (obs.rotationYDeg * Math.PI) / 180, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#5c4324" roughness={0.82} metalness={0.08} />
            </mesh>
          </group>
        );
      })}

      {/* Coverage heatmap if available */}
      {result?.coverageCells && (
        <CoverageHeatmap cells={result.coverageCells} />
      )}
    </>
  );
}

function CoverageHeatmap({ cells }: { cells: { x: number; z: number; quality: string }[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef(new THREE.Matrix4());
  const col = useRef(new THREE.Color());

  const QUALITY_COLORS: Record<string, THREE.Color> = {
    identification: new THREE.Color("#3b82f6"),
    recognition: new THREE.Color("#22c55e"),
    observation: new THREE.Color("#eab308"),
    detection: new THREE.Color("#f97316"),
    none: new THREE.Color("#25090b"),
  };

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

// ── Adversarial Path Line ──

function PathLine({ waypoints }: { waypoints: [number, number][] }) {
  const verts = useMemo(() => {
    const arr = new Float32Array(waypoints.length * 3);
    waypoints.forEach(([x, z], index) => {
      arr[index * 3] = x;
      arr[index * 3 + 1] = 0.045;
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

  // Start/end markers
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];

  return (
    <group>
      <primitive object={line} />
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
    </group>
  );
}

// ── Animated Actor ──

function PathActor({
  waypoints,
  currentIndex,
  progress,
}: {
  waypoints: [number, number][];
  currentIndex: number;
  progress: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);

  // Interpolate position between waypoints
  const pos = useMemo(() => {
    if (waypoints.length < 2) return null;
    if (currentIndex >= waypoints.length - 1) {
      return { x: waypoints[waypoints.length - 1][0], z: waypoints[waypoints.length - 1][1] };
    }
    const a = waypoints[currentIndex];
    const b = waypoints[Math.min(currentIndex + 1, waypoints.length - 1)];
    return {
      x: a[0] + (b[0] - a[0]) * progress,
      z: a[1] + (b[1] - a[1]) * progress,
      // Direction for rotation
      dx: b[0] - a[0],
      dz: b[1] - a[1],
    };
  }, [waypoints, currentIndex, progress]);

  // Apply position and rotation every frame
  useEffect(() => {
    if (!groupRef.current || !pos) return;
    groupRef.current.position.set(pos.x, 0.02, pos.z);
    if (pos.dx !== undefined && pos.dz !== undefined) {
      const angle = Math.atan2(pos.dx, pos.dz);
      groupRef.current.rotation.y = angle;
    }
  }, [pos]);

  if (!pos) return null;

  return (
    <group ref={groupRef}>
      {/* Actor shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      {/* Body - cylinder torso */}
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

// ── Playback Controls (HTML overlay) ──

function PlaybackControls({
  playing,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onReset,
  speed,
  onSpeedChange,
  waypointCount,
}: {
  playing: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  waypointCount: number;
}) {
  const progress = duration > 0 ? currentTime / duration : 0;
  const isEnd = currentTime >= duration && duration > 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-3 pt-10">
      {/* Progress bar */}
      <div className="mb-2">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#1f2536] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#60a5fa] [&::-webkit-slider-thumb]:shadow-lg"
          style={{
            background: `linear-gradient(to right, #60a5fa ${progress * 100}%, #1f2536 ${progress * 100}%)`,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        {/* Left: transport controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 2))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Skip back 2s"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onPlayPause}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              playing
                ? "bg-[#60a5fa] text-white shadow-[0_0_12px_rgba(96,165,250,0.4)]"
                : "bg-[#1a2333] text-[#93c5fd] hover:bg-[#253454]"
            }`}
            title={playing ? "Pause" : "Play"}
          >
            {isEnd ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 ml-0.5" />
            )}
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 2))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
            title="Skip forward 2s"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Center: time display */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono tabular-nums text-[#8b96ab]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span className="text-[8px] text-[#4a5568]">{waypointCount} waypoints</span>
        </div>

        {/* Right: speed selector */}
        <div className="flex items-center gap-0.5">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-all ${
                speed === s
                  ? "bg-[#1a2333] text-[#93c5fd]"
                  : "text-[#4a5568] hover:bg-[#131a28] hover:text-[#8b96ab]"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
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

// ── Info overlay (top left) ──

function InfoOverlay({ waypointCount, exposureScore, targetReached }: {
  waypointCount: number;
  exposureScore: number;
  targetReached: boolean;
}) {
  return (
    <div className="absolute left-3 top-12 z-10 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5b667c]">Adversarial Path</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[9px] text-[#8b96ab]">Waypoints</span>
          <span className="text-[9px] font-mono text-[#c7d0e4]">{waypointCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[9px] text-[#8b96ab]">Exposure</span>
          <span className="text-[9px] font-mono text-[#f43f5e]">{exposureScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[9px] text-[#8b96ab]">Status</span>
          <span className={`text-[9px] font-semibold ${targetReached ? "text-red-400" : "text-[#4a5568]"}`}>
            {targetReached ? "TARGET REACHED" : "In progress"}
          </span>
        </div>
      </div>
    </div>
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
        <p className="text-[11px] text-[#4a5568]">Run simulation to generate adversarial path</p>
        <p className="mt-1 text-[9px] text-[#3a4158]">Toggle Path Replay after simulation completes</p>
      </div>
    </div>
  );
}

// ── Main Path Replay View ──

export function PathReplayView() {
  const result = useStudioStore((s) => s.simulationResult);
  const adversarialPath = result?.adversarialPath;

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Derived data
  const waypoints: [number, number][] = useMemo(() => {
    if (!adversarialPath) return [];
    return adversarialPath.waypoints.map((wp) => wp.position);
  }, [adversarialPath]);

  const totalDuration = adversarialPath?.totalDurationS ?? 0;

  // Find current segment index + progress based on elapsed time
  const { currentIndex, progress } = useMemo(() => {
    if (!adversarialPath || waypoints.length < 2) {
      return { currentIndex: 0, progress: 0 };
    }

    const wps = adversarialPath.waypoints;
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

    // Past the end
    return { currentIndex: waypoints.length - 1, progress: 1 };
  }, [adversarialPath, waypoints, currentTime]);

  // Auto-advance time when playing
  // Use a ref to track the "anchor" (time when playback was last resumed) so
  // seeking while playing doesn't jump back to the pre-seek position.
  const playbackAnchorRef = useRef({ startWallTime: 0, startPlaybackTime: 0 });

  useEffect(() => {
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

  if (!adversarialPath || waypoints.length < 2) {
    return <EmptyReplayState />;
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-[#07090d]">
      {adversarialPath && (
        <InfoOverlay
          waypointCount={waypoints.length}
          exposureScore={adversarialPath.totalExposureScore}
          targetReached={adversarialPath.targetReached}
        />
      )}

      <Canvas
        camera={{ position: [12.8, 7.6, 11.6], fov: 31, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ background: "#0a0d13" }}
        shadows
      >
        <Suspense fallback={null}>
          <SceneView />
        </Suspense>

        {/* Adversarial path line */}
        <PathLine waypoints={waypoints} />

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
        waypointCount={waypoints.length}
      />
    </div>
  );
}
