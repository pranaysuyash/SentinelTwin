"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Camera, VideoOff } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import "@/lib/three-compat";
import { cn } from "@/lib/cn";
import {
  CoverageHeatmapInstanced,
  ENVIRONMENT_THEMES,
  SceneDoors,
  SceneFloor,
  SceneLighting,
  SceneObstructions,
  SceneWalls,
  SceneWindows,
  ScenePrivacyZones,
} from "@/components/workspace/SharedScene";
import { CameraRigFixed, nowTimestamp, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import { useStudioStore } from "@/store/studio-store";
import type { CameraNode } from "@/schema/security-scene";
import { QUALITY_RANK } from "@/lib/quality-display";

const CAMERA_WALL_THEME = ENVIRONMENT_THEMES.day;

/** Short label like "CAM 1" from camera name */
function shortTag(name: string) {
  const match = name.match(/\d+/);
  return match ? `CAM ${match[0]}` : name.toUpperCase().slice(0, 6);
}

function coverageStatusFromRatio(ratio: number) {
  if (ratio > 0.7) {
    return {
      label: "Strong Route Visibility",
      className: "text-emerald-300",
    };
  }
  if (ratio > 0.35) {
    return {
      label: "Partial Route Visibility",
      className: "text-amber-300",
    };
  }
  return {
    label: "Weak Route Visibility",
    className: "text-rose-300",
  };
}

function LiveFeedOverlay({
  camera: camData,
  pathVisibility,
  isBestCamera = false,
}: {
  camera: CameraNode;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  isBestCamera?: boolean;
}) {
  const isActive = camData.status === "on";
  const timestamp = nowTimestamp();
  const ratio = pathVisibility && pathVisibility.totalDurationS > 0
    ? pathVisibility.visibleS / pathVisibility.totalDurationS
    : 0;
  const visiblePct = Math.round(ratio * 100);
  const visibilityStatus = coverageStatusFromRatio(ratio);

  return (
    <>
      {/* Top gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 to-transparent" />
      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent" />

      {/* Top-left: status dot + tag + name */}
      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" : "bg-red-400"}`}
        />
        <span className="text-[9px] font-bold tracking-wide text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {shortTag(camData.name)} · {camData.name}
        </span>
        <span
          className={`rounded px-1 py-0.5 text-[7px] font-semibold uppercase tracking-wide ${
            isActive ? "bg-emerald-500/25 text-emerald-300" : "bg-red-500/25 text-red-300"
          }`}
        >
          {isActive ? "Active" : "Offline"}
        </span>
        {isBestCamera ? (
          <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-emerald-200">
            Best feed
          </span>
        ) : null}
      </div>

      {/* Top-right: resolution + timestamp */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-0.5">
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[7px] font-semibold text-[#93c5fd]">
          {camData.resolutionMP}MP
        </span>
        <span className="font-mono text-[8px] text-white/60 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {timestamp}
        </span>
      </div>

      {/* Bottom metadata */}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-2">
        <span className="text-[8px] text-white/50">{camData.fovHorizontalDeg}°</span>
        <span className="text-[8px] text-white/25">·</span>
        <span className="text-[8px] capitalize text-white/50">{camData.mountType}</span>
        <span className="text-[8px] text-white/25">·</span>
        <span className="text-[8px] text-white/50">{camData.rangeM}m range</span>
      </div>

      {pathVisibility ? (
        <div className="absolute bottom-1.5 right-2 rounded-md border border-[#27405f] bg-black/65 px-2 py-1">
          <div className="text-[7px] uppercase tracking-[0.14em] text-[#7dd3fc]">
            Route Visibility
          </div>
          <div className={`text-[8px] font-semibold ${visibilityStatus.className}`}>
            {visibilityStatus.label}
          </div>
          <div className="text-[8px] text-[#b6c2db]">
            {visiblePct}% visible • max {pathVisibility.maxQuality.toUpperCase()}
          </div>
        </div>
      ) : null}
    </>
  );
}

function CameraFeedPanel({
  camera: camData,
  isSelected,
  isBestCamera = false,
  pathVisibility,
}: {
  camera: CameraNode;
  isSelected: boolean;
  isBestCamera?: boolean;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
}) {
  const isActive = camData.status === "on";

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-lg border bg-[#07090d]",
        isSelected ? "border-blue-500/70" : isBestCamera ? "border-emerald-400/70" : "border-[#1f2536]",
      )}
    >
      {isActive ? (
        <>
          <Canvas
            camera={{
              position: camData.position,
              fov: Math.min(camData.fovHorizontalDeg, 100),
              near: 0.1,
              far: 50,
            }}
            dpr={[0.8, 1.1]}
            gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
            frameloop="demand"
            style={{ width: "100%", height: "100%" }}
          >
            <Suspense fallback={null}>
              <SceneFeedGeometry theme={CAMERA_WALL_THEME} showPrivacyZones />
            </Suspense>
            <CameraRigFixed camera={camData} />
            <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
          </Canvas>
          {/* Subtle scanline overlay for authenticity */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
            }}
          />
          <LiveFeedOverlay camera={camData} pathVisibility={pathVisibility} isBestCamera={isBestCamera} />
        </>
      ) : (
        <>
          {/* Offline state */}
          <div className="pointer-events-none absolute inset-0 bg-[#070a10]">
            {/* Subtle noise/static texture */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(200,200,200,0.04) 2px, rgba(200,200,200,0.04) 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(200,200,200,0.02) 3px, rgba(200,200,200,0.02) 6px)",
              }}
            />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="rounded-full border border-red-500/25 bg-red-500/10 p-2.5">
              <VideoOff className="h-5 w-5 text-red-400/70" />
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-300/70">
                Camera Offline
              </div>
              <div className="mt-0.5 text-[8px] text-[#4a5568]">{camData.name}</div>
            </div>
          </div>
          {/* Offline overlay header */}
          <div className="absolute inset-x-0 top-0 px-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[9px] font-bold text-white/60">
                  {shortTag(camData.name)} · {camData.name}
                </span>
              </div>
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[7px] font-semibold text-red-300">
                OFFLINE
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WallOverviewPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const theme = CAMERA_WALL_THEME;
  const { width, depth } = scene.dimensions;

  const cameraPos = useMemo<[number, number, number]>(() => {
    const cx = width / 2;
    const cz = depth / 2;
    const span = Math.max(width, depth);
    return [cx + width * 0.35, span * 0.95, cz + depth * 0.35];
  }, [width, depth]);

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-[#1f2536] bg-[#07090d]">
      <div className="absolute left-3 top-3 z-20 rounded-lg border border-[#27364e] bg-black/55 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#c7d0e4]">
        3D Map
      </div>
      <Canvas
        camera={{ position: cameraPos, fov: 48, near: 0.1, far: 200 }}
        shadows={false}
        dpr={[0.8, 1.05]}
        frameloop="demand"
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%", background: theme.background }}
      >
        <color attach="background" args={[theme.background]} />
        <SceneLighting theme={theme} />
        <Suspense fallback={null}>
          <SceneFloor width={width} depth={depth} showGrid={false} />
          <SceneWalls walls={scene.walls} />
          <SceneDoors doors={scene.doors} />
          <SceneWindows windows={scene.windows} />
          <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} />
          {scene.privacyZones.length > 0 ? <ScenePrivacyZones zones={scene.privacyZones} /> : null}
          {result?.coverageCells?.length ? <CoverageHeatmapInstanced cells={result.coverageCells} /> : null}
        </Suspense>
        <OrbitControls
          makeDefault
          target={[width / 2, 0.1, depth / 2]}
          minDistance={8}
          maxDistance={40}
          minPolarAngle={Math.PI / 4.1}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

function CameraGhost() {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="12" width="56" height="30" rx="4" />
      <circle cx="32" cy="27" r="10" />
      <circle cx="32" cy="27" r="4" />
      <rect x="18" y="8" width="10" height="5" rx="2" />
      <circle cx="50" cy="22" r="1.5" />
      <path d="M26 42 v4 h12 v-4" />
    </svg>
  );
}

function EmptySlot() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#1f2536] bg-[#0a0d14]">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(37,53,84,0.07) 2px, rgba(37,53,84,0.07) 4px)",
          animation: "scanDrift 8s linear infinite",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1a2538]/20 via-transparent to-transparent" />
      <div className="relative z-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center text-[#1f2c44]">
          <CameraGhost />
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Camera className="h-2.5 w-2.5 text-[#2a3a54]" />
          <p className="text-[9px] font-medium text-[#3a4a60]">Empty Slot</p>
        </div>
      </div>
      <style>{`
        @keyframes scanDrift {
          0% { transform: translateY(0); }
          100% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

function CameraSlotButton({
  camera: cam,
  isSelected,
  isBestCamera,
  onSelect,
  pathVisibility,
  className = "",
}: {
  camera: CameraNode;
  isSelected: boolean;
  isBestCamera?: boolean;
  onSelect: () => void;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`cursor-pointer overflow-hidden rounded-lg text-left ${className}`}
      style={{ display: "block" }}
    >
      <CameraFeedPanel camera={cam} isSelected={isSelected} isBestCamera={isBestCamera} pathVisibility={pathVisibility} />
    </button>
  );
}

export function CameraWallView() {
  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const [layoutMode, setLayoutMode] = useState<"quad" | "overview">("quad");

  const cameras = useMemo(() => {
    // Sort: selected first, then active, then offline
    return [...scene.cameras].sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      if (a.status === "on" && b.status !== "on") return -1;
      if (a.status !== "on" && b.status === "on") return 1;
      return 0;
    });
  }, [scene.cameras, selectedId]);
  const activePath = useMemo(() => {
    if (!scene.paths.length) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? scene.paths[0] ?? null;
  }, [activePathId, scene.paths]);
  const activePathResult = useMemo(() => {
    if (!activePath || !simulationResult) return null;
    return simulationResult.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, simulationResult]);
  const bestCameraId = useMemo(() => {
    if (!activePathResult) return null;
    const entries = Object.entries(activePathResult.visibilityByCamera);
    if (entries.length === 0) return null;
    const best = entries.sort((a, b) => {
      const qualityDiff = QUALITY_RANK[(b[1]?.maxQuality ?? "none") as keyof typeof QUALITY_RANK] - QUALITY_RANK[(a[1]?.maxQuality ?? "none") as keyof typeof QUALITY_RANK];
      if (qualityDiff !== 0) return qualityDiff;
      return (b[1]?.visibleS ?? 0) - (a[1]?.visibleS ?? 0);
    })[0];
    return best?.[0] ?? null;
  }, [activePathResult]);

  if (cameras.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 text-[#1f2c44]">
            <CameraGhost />
          </div>
          <p className="mt-3 text-[11px] font-medium text-[#4a5568]">No cameras in scene</p>
          <p className="mt-1 text-[9px] text-[#3a4158]">
            Place cameras on the map to see live POV feeds
          </p>
        </div>
      </div>
    );
  }

  const visibleCount = layoutMode === "quad" ? 4 : 5;
  const visible = cameras.slice(0, visibleCount);
  const hiddenCount = Math.max(0, cameras.length - visible.length);
  const viewCount = layoutMode === "quad" ? 4 : Math.min(visible.length + 1, 6);
  const activeCount = cameras.filter((cam) => cam.status === "on").length;
  const offlineCount = cameras.length - activeCount;
  const selectedCamera = cameras.find((cam) => cam.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#07090d] p-2.5">
      <div className="mb-2 flex items-center justify-between rounded-xl border border-[#1f2536] bg-[#0b0f17] px-3 py-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">Camera Wall</div>
          <div className="mt-0.5 text-[11px] text-[#94a3b8]">
            {visible.length} camera feed{visible.length === 1 ? "" : "s"} + map overview
            {hiddenCount > 0 ? ` + ${hiddenCount} more` : ""}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-[#6b7c95]">
            <span className="rounded-md border border-emerald-500/15 bg-emerald-500/8 px-2 py-0.5 text-emerald-300">
              Active {activeCount}
            </span>
            <span className="rounded-md border border-rose-500/15 bg-rose-500/8 px-2 py-0.5 text-rose-300">
              Offline {offlineCount}
            </span>
            <span className="rounded-md border border-[#27364e] bg-black/30 px-2 py-0.5 text-[#c7d0e4]">
              Selected {selectedCamera?.name ?? "None"}
            </span>
            {activePath ? (
              <span className="rounded-md border border-[#24527b] bg-[#0b1a2d]/60 px-2 py-0.5 text-[#93c5fd]">
                Route Context {activePath.label}
              </span>
            ) : (
              <span className="rounded-md border border-[#334155] bg-[#0f172a]/50 px-2 py-0.5 text-[#9ca3af]">
                Route Context unavailable
              </span>
            )}
            {bestCameraId ? (
              <span className="rounded-md border border-emerald-500/15 bg-emerald-500/8 px-2 py-0.5 text-emerald-300">
                Best camera now {scene.cameras.find((cam) => cam.id === bestCameraId)?.name ?? bestCameraId}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-[#27364e] bg-black/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c7d0e4]">
            <span>Layout</span>
            <select
              value={layoutMode}
              onChange={(event) => setLayoutMode(event.target.value as "quad" | "overview")}
              className="bg-transparent text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c7d0e4] outline-none"
            >
              <option value="quad">4-Panel Layout</option>
              <option value="overview">6-Panel Layout</option>
            </select>
          </label>
          <div className="rounded-lg border border-[#27364e] bg-black/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c7d0e4]">
            {viewCount} Views
          </div>
        </div>
      </div>

      {layoutMode === "overview" && visible.length >= 5 ? (
        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-2.5">
          {visible.slice(0, 5).map((cam) => (
            <CameraSlotButton
              key={cam.id}
              camera={cam}
              isSelected={cam.id === selectedId}
              isBestCamera={cam.id === bestCameraId}
              onSelect={() => selectNode(cam.id)}
              pathVisibility={
                activePathResult
                  ? {
                    visibleS: activePathResult.visibilityByCamera[cam.id]?.visibleS ?? 0,
                    totalDurationS: activePathResult.totalDurationS,
                    maxQuality: activePathResult.visibilityByCamera[cam.id]?.maxQuality ?? "none",
                  }
                  : null
              }
              className="h-full w-full"
            />
          ))}
          <WallOverviewPanel />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2.5">
          {visible[0] ? (
            <CameraSlotButton
              camera={visible[0]}
              isSelected={visible[0].id === selectedId}
              isBestCamera={visible[0].id === bestCameraId}
              onSelect={() => selectNode(visible[0].id)}
              pathVisibility={
                activePathResult
                  ? {
                    visibleS: activePathResult.visibilityByCamera[visible[0].id]?.visibleS ?? 0,
                    totalDurationS: activePathResult.totalDurationS,
                    maxQuality: activePathResult.visibilityByCamera[visible[0].id]?.maxQuality ?? "none",
                  }
                  : null
              }
              className="h-full w-full"
            />
          ) : (
            <EmptySlot />
          )}
          {visible[1] ? (
            <CameraSlotButton
              camera={visible[1]}
              isSelected={visible[1].id === selectedId}
              isBestCamera={visible[1].id === bestCameraId}
              onSelect={() => selectNode(visible[1].id)}
              pathVisibility={
                activePathResult
                  ? {
                    visibleS: activePathResult.visibilityByCamera[visible[1].id]?.visibleS ?? 0,
                    totalDurationS: activePathResult.totalDurationS,
                    maxQuality: activePathResult.visibilityByCamera[visible[1].id]?.maxQuality ?? "none",
                  }
                  : null
              }
              className="h-full w-full"
            />
          ) : (
            <EmptySlot />
          )}
          {visible[2] ? (
            <CameraSlotButton
              camera={visible[2]}
              isSelected={visible[2].id === selectedId}
              isBestCamera={visible[2].id === bestCameraId}
              onSelect={() => selectNode(visible[2].id)}
              pathVisibility={
                activePathResult
                  ? {
                    visibleS: activePathResult.visibilityByCamera[visible[2].id]?.visibleS ?? 0,
                    totalDurationS: activePathResult.totalDurationS,
                    maxQuality: activePathResult.visibilityByCamera[visible[2].id]?.maxQuality ?? "none",
                  }
                  : null
              }
              className="h-full w-full"
            />
          ) : (
            <EmptySlot />
          )}
          <WallOverviewPanel />
        </div>
      )}
    </div>
  );
}
