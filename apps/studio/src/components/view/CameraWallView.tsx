"use client";

import { OrbitControls, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Camera, VideoOff } from "lucide-react";
import { memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import "@/lib/three-compat";
import { cn } from "@/lib/cn";
import { TYPE_SCALE, UI_TONES } from "@/lib/design-tokens";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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
  SceneEnvironmentSetup,
  SceneShadowCaster,
} from "@/components/workspace/SharedScene";
import { CameraRigFixed, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import { CameraFeedPostProcessing } from "@/components/view/CameraFeedPostProcessing";
import { useStudioStore } from "@/store/studio-store";
import type { CameraNode, DoriQuality, SimulationResult } from "@/schema/security-scene";
import { STUDIO_SHORTCUT_EVENTS } from "@/lib/studio-shortcuts";
import { QUALITY_RANK } from "@/lib/quality-display";
import {
  WALL_PERF_MONITOR_ITERATIONS,
  WALL_PERF_MONITOR_MS,
  WALL_PERF_DPR_STEP,
  WALL_PERF_FLIPFLOPS,
  wallPerformanceBounds,
  computeWallTileDpr,
} from "@/lib/adaptive-dpr-budget";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";

import {
  clampPathDuration,
  clampReplayProgress,
  buildReplayStateByCameraAtTime,
  orderCamerasForReplayPlayback,
  sampleCameraReplayPose,
  type CameraReplayPose,
} from "@/components/view/camera-view-utils";

const CAMERA_WALL_THEME = ENVIRONMENT_THEMES.day;

/** Debug flag: when true, CameraWall tiles log adaptive-DPR decisions to the
 *  console. Controlled by the existing `showDebugOverlays` path in the future;
 *  for now it is off by default and can be enabled by changing this constant. */
const DEBUG_WALL_PERF = false;

type CameraWallLayoutMode = "auto" | "quad" | "overview" | "dense";
type CameraReplayState = {
  visible: boolean;
  quality?: DoriQuality;
  reason?: string;
};
type CameraWallLayoutSpec = {
  cameraSlots: number;
  gridClass: string;
  viewCount: number;
};
const CAMERA_WALL_LAYOUTS: Record<CameraWallLayoutMode, CameraWallLayoutSpec> = {
  auto: { cameraSlots: 4, gridClass: "grid-cols-2 grid-rows-2", viewCount: 4 },
  quad: { cameraSlots: 4, gridClass: "grid-cols-2 grid-rows-2", viewCount: 4 },
  overview: { cameraSlots: 6, gridClass: "grid-cols-3 grid-rows-2", viewCount: 6 },
  dense: { cameraSlots: 16, gridClass: "grid-cols-4 grid-rows-4", viewCount: 16 },
};
const CAMERA_WALL_SURFACES = {
  page: UI_SURFACES.page,
  panel: UI_SURFACES.panel,
  panelSoft: UI_SURFACES.panelSoft,
  card: UI_SURFACES.card,
  border: UI_SURFACES.border,
  borderSubtle: UI_SURFACES.borderSubtle,
  muted: UI_SURFACES.textMuted,
  muted2: UI_SURFACES.textMuted2,
  muted3: UI_SURFACES.textMuted3,
  body: UI_SURFACES.textBody,
  accent: UI_SURFACES.textAccent,
};

/** Short label like "CAM 1" from camera name */
function shortTag(name: string) {
  const match = name.match(/\d+/);
  return match ? `CAM ${match[0]}` : name.toUpperCase().slice(0, 6);
}

function coverageStatusFromRatio(ratio: number) {
  if (ratio > 0.7) {
    return {
      label: "Strong Route Visibility",
      className: UI_TONES.success.text,
    };
  }
  if (ratio > 0.35) {
    return {
      label: "Partial Route Visibility",
      className: UI_TONES.warning.text,
    };
  }
  return {
    label: "Weak Route Visibility",
    className: UI_TONES.danger.text,
  };
}

function getBestZoneQuality(cameraResult?: SimulationResult["cameraResults"][number] | null) {
  if (!cameraResult) return "none" as DoriQuality;

  return Object.values(cameraResult.qualityByZone).reduce((best, quality) => (
    QUALITY_RANK[quality] > QUALITY_RANK[best] ? quality : best
  ), "none" as DoriQuality);
}

function formatWallTimestamp(timestampMs: number | null | undefined) {
  const source = timestampMs ?? Date.now();
  const d = new Date(source);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function getEffectiveCameraWallLayout(
  layoutMode: CameraWallLayoutMode,
  cameraCount: number,
) {
  if (layoutMode !== "auto") return layoutMode;
  if (cameraCount >= 12) return "dense";
  if (cameraCount >= 5) return "overview";
  return "quad";
}

/**
 * Real live-feed renderer. Renders the bound video stream for a camera that
 * has a `liveFeedUrl`. The video element is the source of truth for the
 * surface; the existing `LiveFeedOverlay` (HUD with status, timestamps,
 * zone quality) sits on top of it like on top of the R3F synthetic POV.
 *
 * Notes for operators reading this:
 * - The `<video>` element plays whatever the URL serves: an MJPEG stream,
 *   an HTTP progressive MP4, or any browser-supported format. RTSP is NOT
 *   supported natively by browsers; users who bind an RTSP URL will need
 *   an external proxy that exposes HLS or MJPEG (this matches the existing
 *   `camera-live-connection` library's expectation).
 * - `liveFeedUrl` is the URL on the SecurityScene's camera node, populated
 *   by the camera inspector's "Live Camera Binding" form.
 * - When the URL fails to load (404, auth, CORS), we fall back to the
 *   static "Feed unreachable" badge so the tile doesn't go blank.
 */
function LiveFeedVideo({
  camera: camData,
  cameraResult,
  pathVisibility,
  replayState,
  isBestCamera = false,
  timestampLabel,
}: {
  camera: CameraNode;
  cameraResult?: SimulationResult["cameraResults"][number] | null;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  replayState?: CameraReplayState | null;
  isBestCamera?: boolean;
  timestampLabel: string;
}) {
  const [loadState, setLoadState] = useState<"loading" | "playing" | "error">("loading");
  const feedUrl = camData.liveFeedUrl ?? "";

  useEffect(() => {
    setLoadState("loading");
  }, [feedUrl]);

  return (
    <>
      <video
        key={feedUrl}
        src={feedUrl}
        autoPlay
        muted
        playsInline
        loop
        controls={false}
        className="absolute inset-0 h-full w-full bg-black object-cover"
        onPlaying={() => setLoadState("playing")}
        onError={() => setLoadState("error")}
        onLoadedData={() => setLoadState("playing")}
      />
      {/* Subtle scanline overlay for visual consistency with the synthetic
          POV tiles; also hides a small letterbox when the stream aspect
          ratio differs from the tile. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
        }}
      />
      {loadState === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className={`rounded-md border ${UI_TONES.warning.border} ${UI_TONES.warning.bg} px-3 py-2 text-center`}>
            <div className={`font-semibold uppercase tracking-[0.18em] ${TYPE_SCALE.caption.class} ${UI_TONES.warning.text}`}>
              Feed Unreachable
            </div>
            <div className={`mt-1 max-w-[18ch] truncate font-mono ${TYPE_SCALE.micro.class} ${UI_TONES.warning.text}`}>
              {feedUrl}
            </div>
            <div className={`mt-1 ${TYPE_SCALE.micro.class} ${UI_TONES.warning.text}`}>
              Browser couldn't decode this URL. RTSP needs an HLS/MJPEG proxy.
            </div>
          </div>
        </div>
      ) : null}
      {loadState === "loading" ? (
        <div className={`absolute left-2 top-9 flex items-center gap-1.5 rounded ${UI_TONES.info.bg} px-2 py-0.5 uppercase tracking-[0.16em] ${TYPE_SCALE.micro.class} ${UI_TONES.info.text}`}>
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${UI_TONES.info.dot}`} />
          Connecting live feed
        </div>
      ) : null}
      <div className={`pointer-events-none absolute right-2 top-2 rounded px-1.5 py-0.5 font-semibold uppercase tracking-[0.16em] ${TYPE_SCALE.micro.class} ${UI_TONES.success.bg} ${UI_TONES.success.text}`}>
        Live
      </div>
      <LiveFeedOverlay
        camera={camData}
        cameraResult={cameraResult}
        pathVisibility={pathVisibility}
        replayState={replayState}
        isBestCamera={isBestCamera}
        timestampLabel={timestampLabel}
      />
    </>
  );
}

/**
 * Dense-mode performance guard.
 *
 * The 16-tile dense layout renders 16 R3F canvases simultaneously. On
 * modest hardware each canvas competes for the GPU and the
 * simulation worker — frame rate drops and the input pipeline
 * stutters. This component surfaces the cost in the layout bar so
 * operators understand what they're trading for, and offers a
 * one-click "drop one" affordance that keeps dense mode but reduces
 * the per-tile render cost.
 *
 * The threshold is the 16-tile layout itself: any camera count
 * lower than 16 still uses the same number of canvases (the empty
 * slots are just blank), so the warning is appropriate whenever the
 * dense layout is active. The guard is purely advisory — it never
 * disables the layout, only informs.
 */
function DenseModePerfGuard({ cameraCount }: { cameraCount: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      role="status"
      data-testid="wall-dense-perf-guard"
      className={`ml-1 flex items-center gap-1.5 rounded-md border ${UI_TONES.warning.border} ${UI_TONES.warning.bg} px-2 py-0.5 ${TYPE_SCALE.micro.class} font-semibold ${UI_TONES.warning.text}`}
      title={`Rendering ${cameraCount} active camera${cameraCount === 1 ? "" : "s"} in 16-tile dense mode. Each tile is an R3F canvas; expect heavier GPU and CPU usage.`}
    >
      <span>Heavy: 16 R3F canvases</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss dense-mode performance warning for this session"
        className="ml-0.5 text-amber-300/70 transition-colors hover:text-amber-100"
      >
        ×
      </button>
    </div>
  );
}

function LiveFeedOverlay({
  camera: camData,
  cameraResult,
  pathVisibility,
  replayState,
  isBestCamera = false,
  timestampLabel,
}: {
  camera: CameraNode;
  cameraResult?: SimulationResult["cameraResults"][number] | null;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  replayState?: CameraReplayState | null;
  isBestCamera?: boolean;
  timestampLabel: string;
}) {
  const isActive = camData.status === "on";
  const safePathDurationS = clampPathDuration(pathVisibility?.totalDurationS);
  const ratio = safePathDurationS > 0 ? (pathVisibility?.visibleS ?? 0) / safePathDurationS : 0;
  const visiblePct = Math.round(ratio * 100);
  const visibilityStatus = coverageStatusFromRatio(ratio);
  const bestZoneQuality = getBestZoneQuality(cameraResult);
  const coveredZones = cameraResult?.criticalZonesCovered.length ?? 0;
  const failedZones = cameraResult?.criticalZonesFailed.length ?? 0;

  return (
    <>
      {/* Top gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 to-transparent" />
      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent" />

      {/* Top-left: status dot + tag + name */}
      <div className="absolute left-2 top-2 flex max-w-[calc(100%-5.5rem)] items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" : "bg-red-400"}`}
        />
        <span className={`min-w-0 truncate font-bold tracking-wide text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)] ${TYPE_SCALE.caption.class}`}>
          {shortTag(camData.name)} · {camData.name}
        </span>
        <span
          className={`flex-shrink-0 rounded px-1.5 py-0.5 ${TYPE_SCALE.micro.class} font-semibold uppercase tracking-wide ${
            isActive ? `${UI_TONES.success.bg} ${UI_TONES.success.text}` : `${UI_TONES.danger.bg} ${UI_TONES.danger.text}`
          }`}
        >
          {isActive ? "Active" : "Offline"}
        </span>
        {isBestCamera ? (
          <span className={`hidden flex-shrink-0 rounded px-1.5 py-0.5 ${TYPE_SCALE.micro.class} font-semibold uppercase tracking-wide md:inline ${UI_TONES.success.bg} ${UI_TONES.success.text}`}>
            Best feed
          </span>
        ) : null}
      </div>

      {/* Top-right: resolution + timestamp */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-0.5">
        <span className={`rounded px-1.5 py-0.5 ${TYPE_SCALE.micro.class} font-semibold ${UI_TONES.info.bg} ${UI_TONES.info.text}`}>
          {camData.resolutionMP}MP
        </span>
        <span className={`font-mono ${TYPE_SCALE.micro.class} text-white/60 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]`}>
          {timestampLabel}
        </span>
      </div>

      {/* Bottom metadata */}
      <div className={`absolute bottom-1.5 left-2 flex max-w-[52%] items-center gap-1.5 overflow-hidden ${TYPE_SCALE.micro.class}`}>
        <span className="text-white/50">{camData.fovHorizontalDeg}°</span>
        <span className="text-white/25">·</span>
        <span className="truncate capitalize text-white/50">{camData.mountType}</span>
        <span className="text-white/25">·</span>
        <span className="text-white/50">{camData.rangeM}m range</span>
      </div>

      <div className="absolute bottom-1.5 right-2 flex flex-col gap-1">
        {cameraResult ? (
          <div className={`rounded-md border ${UI_TONES.success.border} bg-black/65 px-2 py-1`}>
            <div className={`uppercase tracking-[0.12em] ${TYPE_SCALE.micro.class} ${UI_TONES.success.text}`}>
              Zone Quality
            </div>
            <div className={`font-semibold ${TYPE_SCALE.micro.class} ${UI_TONES.success.text}`}>
              {bestZoneQuality.toUpperCase()}
            </div>
            <div className={`text-[#b6c2db] ${TYPE_SCALE.micro.class}`}>
              {coveredZones} covered • {failedZones} failed
            </div>
          </div>
        ) : null}
        {pathVisibility ? (
          <div className={`rounded-md border ${UI_TONES.info.border} bg-black/65 px-2 py-1`}>
            <div className={`uppercase tracking-[0.12em] ${TYPE_SCALE.micro.class} ${UI_TONES.info.text}`}>
              Route Visibility
            </div>
            <div className={`font-semibold ${TYPE_SCALE.micro.class} ${visibilityStatus.className}`}>
              {visibilityStatus.label}
            </div>
            <div className={`text-[#b6c2db] ${TYPE_SCALE.micro.class}`}>
              {visiblePct}% visible • max {pathVisibility.maxQuality.toUpperCase()}
            </div>
          </div>
        ) : null}
        {replayState ? (
          <div className={cn(
            "rounded-md border px-2 py-1",
            replayState.visible ? `${UI_TONES.success.border} ${UI_TONES.success.bg}` : `${UI_TONES.danger.border} ${UI_TONES.danger.bg}`,
          )}>
            <div className={`uppercase tracking-[0.12em] ${TYPE_SCALE.micro.class} text-[#e2e8f0]`}>
              Current Replay
            </div>
            <div className={cn(`font-semibold ${TYPE_SCALE.micro.class}`, replayState.visible ? UI_TONES.success.text : UI_TONES.danger.text)}>
              {replayState.visible ? "Actor visible now" : "Actor lost now"}
              {replayState.quality ? ` · ${replayState.quality.toUpperCase()}` : ""}
            </div>
            {replayState.reason ? (
              <div className={`text-[#b6c2db] ${TYPE_SCALE.micro.class}`}>{replayState.reason}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

const CameraFeedPanel = memo(function CameraFeedPanel({
  camera: camData,
  isSelected,
  isBestCamera = false,
  cameraResult,
  replayPose,
  pathVisibility,
  replayState,
  timestampLabel,
  isDense = false,
  sceneMaxDimension = 12,
}: {
  camera: CameraNode;
  isSelected: boolean;
  isBestCamera?: boolean;
  cameraResult?: SimulationResult["cameraResults"][number] | null;
  replayPose?: CameraReplayPose;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  replayState?: CameraReplayState | null;
  timestampLabel: string;
  isDense?: boolean;
  sceneMaxDimension?: number;
}) {
  const isActive = camData.status === "on";

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-lg border ${UI_SURFACES.page} transition-all duration-200",
        isSelected
          ? `border-2 ${UI_TONES.info.border} shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-1 ring-[#38bdf8]/40`
          : isBestCamera
            ? `border-2 ${UI_TONES.success.border} shadow-[0_0_20px_rgba(52,211,153,0.25)] ring-1 ring-[#34d399]/40`
            : "border-[#1e293b]/80 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:border-[#334155]",
      )}
    >
      {isActive ? (
        camData.liveFeedUrl ? (
          // Real live feed path: render the bound RTSP/HTTP video stream when the
          // camera has a `liveFeedUrl`. Falls back to the synthetic R3F POV
          // below for cameras that aren't bound to a live feed.
          <LiveFeedVideo
            camera={camData}
            cameraResult={cameraResult}
            pathVisibility={pathVisibility}
            replayState={replayState}
            isBestCamera={isBestCamera}
            timestampLabel={timestampLabel}
          />
        ) : (
          <>
          <Canvas
            camera={{
              position: camData.position,
              fov: Math.min(camData.fovHorizontalDeg, 100),
              near: 0.1,
              far: 50,
            }}
            dpr={computeWallTileDpr(1, isDense)}
            gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
            frameloop="demand"
            style={{ width: "100%", height: "100%" }}
          >
            <SceneEnvironmentSetup tier="low" />
            <SceneShadowCaster tier="low" maxDimension={sceneMaxDimension} />
            <PerformanceMonitor
              iterations={WALL_PERF_MONITOR_ITERATIONS}
              ms={WALL_PERF_MONITOR_MS}
              step={WALL_PERF_DPR_STEP}
              flipflops={WALL_PERF_FLIPFLOPS}
              bounds={wallPerformanceBounds}
              onDecline={(api) => {
                if (DEBUG_WALL_PERF) {
                  // eslint-disable-next-line no-console
                  console.debug("[CameraWall] perf decline", {
                    camera: camData.name,
                    fps: api.fps,
                    factor: api.factor,
                    dpr: computeWallTileDpr(api.factor, isDense),
                  });
                }
              }}
            >
              <AdaptiveDpr pixelated />
              <CameraFeedPostProcessing mode="normal" intensityScale={0.5} />
              <Suspense fallback={<CanvasLoadingOverlay label="Loading wall feed" />}>
                <SceneFeedGeometry theme={CAMERA_WALL_THEME} showPrivacyZones />
              </Suspense>
              <CameraRigFixed camera={camData} poseOverride={replayPose} />
              <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
            </PerformanceMonitor>
          </Canvas>
          {/* Subtle scanline overlay for authenticity */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
            }}
          />
          <LiveFeedOverlay
            camera={camData}
            cameraResult={cameraResult}
            pathVisibility={pathVisibility}
            replayState={replayState}
            isBestCamera={isBestCamera}
            timestampLabel={timestampLabel}
          />
        </>
        )
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
            <div className={`font-semibold uppercase tracking-[0.18em] ${TYPE_SCALE.caption.class} ${UI_TONES.danger.text}`}>
                Camera Offline
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className={`rounded border ${UI_TONES.danger.border} bg-red-950/60 px-1.5 py-0.5 font-mono ${TYPE_SCALE.micro.class} ${UI_TONES.danger.text}`}>
                  ⚠️ STREAM LEASE EXPIRED
                </span>
              </div>
          <div className={`mt-0.5 ${CAMERA_WALL_SURFACES.muted} ${TYPE_SCALE.micro.class}`}>{camData.name} · RTSP Bridge Unreachable</div>
            </div>
          </div>
          {/* Offline overlay header */}
          <div className="absolute inset-x-0 top-0 px-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${UI_TONES.danger.dot}`} />
                <span className={`font-bold text-white/60 ${TYPE_SCALE.micro.class}`}>
                  {shortTag(camData.name)} · {camData.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${TYPE_SCALE.micro.class} ${UI_TONES.danger.bg} ${UI_TONES.danger.text}`}>
                  OFFLINE
                </span>
                <span className={`rounded px-1.5 py-0.5 font-semibold ${TYPE_SCALE.micro.class} ${UI_TONES.warning.bg} ${UI_TONES.warning.text}`} title="Live session health check failed for this RTSP endpoint">
                  ERR_503
                </span>
              </div>
            </div>
          </div>
      </>
    )}
  </div>
  );
});

const WallOverviewPanel = memo(function WallOverviewPanel({ isDense = false }: { isDense?: boolean }) {
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
    <div className={`relative h-full overflow-hidden rounded-lg border ${UI_TONES.neutral.border} ${CAMERA_WALL_SURFACES.page}`}>
      <div className={`absolute left-3 top-3 z-20 rounded-lg border ${UI_TONES.neutral.border} bg-black/55 px-2.5 py-1.5 ${TYPE_SCALE.micro.class} font-semibold uppercase tracking-[0.18em] ${UI_TONES.neutral.text}`}>
        3D Map
      </div>
      <Canvas
        camera={{ position: cameraPos, fov: 48, near: 0.1, far: 200 }}
        shadows
        dpr={computeWallTileDpr(1, isDense)}
        frameloop="demand"
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%", background: theme.background }}
      >
        <SceneEnvironmentSetup tier="medium" />
        <SceneShadowCaster tier="medium" maxDimension={Math.max(width, depth)} />
        <PerformanceMonitor
          iterations={WALL_PERF_MONITOR_ITERATIONS}
          ms={WALL_PERF_MONITOR_MS}
          step={WALL_PERF_DPR_STEP}
          flipflops={WALL_PERF_FLIPFLOPS}
          bounds={wallPerformanceBounds}
        >
          <AdaptiveDpr pixelated />
          <color attach="background" args={[theme.background]} />
          <SceneLighting theme={theme} />
          <Suspense fallback={<CanvasLoadingOverlay label="Loading coverage overview" />}>
            <SceneFloor width={width} depth={depth} showGrid={false} appearance={scene.sceneAppearance?.surfaces?.floor} />
            <SceneWalls walls={scene.walls} selectable={false} defaultAppearance={scene.sceneAppearance?.surfaces?.wall} />
            <SceneDoors doors={scene.doors} selectable={false} />
            <SceneWindows windows={scene.windows} selectable={false} />
            <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} onSelect={() => {}} />
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
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
});

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
    <div className={`relative flex h-full items-center justify-center overflow-hidden rounded-lg border border-dashed ${CAMERA_WALL_SURFACES.borderSubtle} bg-[#0a0d14]`}>
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
          <p className={`text-[9px] font-medium ${CAMERA_WALL_SURFACES.muted2}`}>Empty Slot</p>
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

const CameraSlotButton = memo(function CameraSlotButton({
  camera: cam,
  isSelected,
  isBestCamera,
  cameraResult,
  pathVisibility,
  replayState,
  replayPose,
  className = "",
  timestampLabel,
  isDense = false,
  sceneMaxDimension,
}: {
  camera: CameraNode;
  isSelected: boolean;
  isBestCamera?: boolean;
  cameraResult?: SimulationResult["cameraResults"][number] | null;
  replayPose?: CameraReplayPose;
  pathVisibility?: {
    visibleS: number;
    totalDurationS: number;
    maxQuality: string;
  } | null;
  replayState?: CameraReplayState | null;
  className?: string;
  timestampLabel: string;
  isDense?: boolean;
  sceneMaxDimension: number;
}) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const handleSelect = useCallback(() => {
    setSelectedCameraId(cam.id);
    selectNode(cam.id);
  }, [cam.id, selectNode, setSelectedCameraId]);

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`cursor-pointer overflow-hidden rounded-lg text-left ${className}`}
      style={{ display: "block" }}
    >
      <CameraFeedPanel
        camera={cam}
        isSelected={isSelected}
        isBestCamera={isBestCamera}
        cameraResult={cameraResult}
        pathVisibility={pathVisibility}
        replayState={replayState}
        replayPose={replayPose}
        timestampLabel={timestampLabel}
        isDense={isDense}
        sceneMaxDimension={sceneMaxDimension}
      />
    </button>
  );
});

export function CameraWallView() {
  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const compactViewport = useStudioStore((s) => s.compactViewport);
  const [layoutMode, setLayoutMode] = useState<CameraWallLayoutMode>("auto");
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [syncTime, setSyncTime] = useState(true);
  const [freeRunningTimestamp, setFreeRunningTimestamp] = useState(() => Date.now());
  const [immersiveMode, setImmersiveMode] = useState(false);
  const toggleImmersiveMode = useCallback(() => {
    setImmersiveMode((value) => !value);
  }, []);

  const [sessionHealth, setSessionHealth] = useState<{
    totals?: { active: number; expiringSoon: number; expired: number; closed: number };
    sessions?: { id: string; cameraId?: string; status: string; reason?: string }[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/camera-live-session-health");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data.ok) {
          setSessionHealth({
            totals: data.totals,
            sessions: data.sessions,
          });
        }
      } catch {
        // Silently ignore offline/network errors
      }
    };
    void fetchHealth();
    const timer = window.setInterval(fetchHealth, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const cameras = useMemo(() => {
    return orderCamerasForReplayPlayback(scene.cameras, selectedCameraId, selectedId);
  }, [scene.cameras, selectedCameraId, selectedId]);
  const activePath = useMemo(() => {
    if (!scene.paths.length || !activePathId) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? null;
  }, [activePathId, scene.paths]);
  const activePathResult = useMemo(() => {
    if (!activePath || !simulationResult) return null;
    return simulationResult.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, simulationResult]);
  const safePathDuration = clampPathDuration(activePathResult?.totalDurationS);
  const cameraResultById = useMemo(
    () => Object.fromEntries((simulationResult?.cameraResults ?? []).map((entry) => [entry.cameraId, entry])),
    [simulationResult],
  );
  const pathVisibilityByCameraId = useMemo(() => {
    const visibility = activePathResult?.visibilityByCamera ?? {};
    return Object.fromEntries(
      Object.entries(visibility).map(([cameraId, entry]) => [
        cameraId,
        entry
          ? {
              visibleS: entry.visibleS,
              totalDurationS: safePathDuration,
              maxQuality: entry.maxQuality,
            }
          : null,
      ]),
    ) as Record<string, { visibleS: number; totalDurationS: number; maxQuality: string } | null>;
  }, [activePathResult, safePathDuration]);
  const bestCameraId = useMemo(() => {
    if (!activePathResult) return null;
    const entries = Object.entries(activePathResult.visibilityByCamera);
    if (entries.length === 0) return null;
    const cameraOrder = new Map(cameras.map((camera, index) => [camera.id, index]));
    const best = entries.sort((a, b) => {
      const qualityDiff = QUALITY_RANK[(b[1]?.maxQuality ?? "none") as keyof typeof QUALITY_RANK] - QUALITY_RANK[(a[1]?.maxQuality ?? "none") as keyof typeof QUALITY_RANK];
      if (qualityDiff !== 0) return qualityDiff;
      if ((b[1]?.visibleS ?? 0) !== (a[1]?.visibleS ?? 0)) {
        return (b[1]?.visibleS ?? 0) - (a[1]?.visibleS ?? 0);
      }
      return (cameraOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (cameraOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER);
    })[0];
    return best?.[0] ?? null;
  }, [activePathResult, cameras]);
  const safeReplayProgress = clampReplayProgress(pathReplay.progress);
  const pathTimeS = safePathDuration * safeReplayProgress;
  const replayStateByCameraId = useMemo<Record<string, CameraReplayState | null>>(() => {
    return buildReplayStateByCameraAtTime(activePathResult?.timeline, pathTimeS);
  }, [activePathResult, pathTimeS]);
  const replayPoseByCameraId = useMemo<Record<string, CameraReplayPose>>(() => {
    return Object.fromEntries(
      cameras.map((cam) => [cam.id, sampleCameraReplayPose(cam, pathTimeS)]),
    );
  }, [cameras, pathTimeS]);
  const effectiveLayout = getEffectiveCameraWallLayout(layoutMode, cameras.length);
  const layoutSpec = CAMERA_WALL_LAYOUTS[effectiveLayout];
  const visibleCount = Math.min(layoutSpec.cameraSlots, cameras.length);
  const visible = cameras.slice(0, visibleCount);
  const hiddenCount = Math.max(0, cameras.length - visible.length);
  const viewCount = layoutSpec.viewCount;
  const timestampLabel = syncTime
    ? activePathResult
      ? `Replay ${pathTimeS.toFixed(1)}s / ${safePathDuration.toFixed(1)}s`
      : formatWallTimestamp(simulationResult?.computedAt)
    : formatWallTimestamp(freeRunningTimestamp);

  useEffect(() => {
    if (syncTime) return;
    setFreeRunningTimestamp(Date.now());
    const timer = window.setInterval(() => {
      setFreeRunningTimestamp(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [syncTime]);

  useEffect(() => {
    window.addEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);
    return () => window.removeEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);
  }, [toggleImmersiveMode]);

  const activeCount = cameras.filter((cam) => cam.status === "on").length;
  const offlineCount = cameras.length - activeCount;
  const selectedCamera = cameras.find((cam) => cam.id === selectedId)
    ?? cameras.find((cam) => cam.id === selectedCameraId)
    ?? null;

  const weakRouteCameras = useMemo(() => {
    if (safePathDuration <= 0) return 0;
    return cameras.filter((cam) => {
      const vis = pathVisibilityByCameraId[cam.id];
      if (!vis) return false;
      return vis.visibleS / safePathDuration <= 0.35;
    }).length;
  }, [cameras, pathVisibilityByCameraId]);

  if (cameras.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 text-[#1f2c44]">
            <CameraGhost />
          </div>
          <p className={`mt-3 text-[11px] font-medium ${CAMERA_WALL_SURFACES.muted}`}>No cameras in scene</p>
          <p className={`mt-1 text-[9px] ${UI_SURFACES.textDim}`}>
            Place cameras on the map to see live POV feeds
          </p>
        </div>
      </div>
    );
  }

  const wallActionHint = activePath
    ? weakRouteCameras > 0
      ? `Action: ${weakRouteCameras} feed${weakRouteCameras === 1 ? "" : "s"} weak on route. Re-aim or add coverage.`
      : "Action: Route coverage stable. Validate with replay evidence."
    : "Action: Pick a route to prioritize wall feeds by visibility.";

  return (
    <div className={`flex h-full flex-col overflow-hidden ${CAMERA_WALL_SURFACES.page} p-2.5`} style={{ paddingTop: "var(--st-full-canvas-safe-top, 4.25rem)" }}>
      {immersiveMode ? (
        <div className={`mb-2 flex items-center justify-between rounded-xl border ${CAMERA_WALL_SURFACES.borderSubtle} ${CAMERA_WALL_SURFACES.panel} px-3 py-2${compactViewport ? "" : ""}`}>
          <div>
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${CAMERA_WALL_SURFACES.accent}`}>Camera Wall Focus Mode</div>
            {!compactViewport && (
              <div className={`mt-0.5 text-[11px] ${CAMERA_WALL_SURFACES.muted3}`}>
                {viewCount} view layout · {selectedCamera?.name ?? "None"}
              </div>
            )}
            {!compactViewport && (
              <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[9px] ${CAMERA_WALL_SURFACES.muted2}`}>
                <span className="rounded-md border border-emerald-500/15 bg-emerald-500/8 px-2 py-0.5 text-emerald-300">Active {activeCount}</span>
                <span className="rounded-md border border-rose-500/15 bg-rose-500/8 px-2 py-0.5 text-rose-300">Offline {offlineCount}</span>
                <span className="rounded-md border border-sky-500/15 bg-sky-500/8 px-2 py-0.5 text-sky-300" title="Telemetry from /api/camera-live-session-health">
                  Bridge Health: {sessionHealth?.totals?.active ?? activeCount} Active · {sessionHealth?.totals?.expired ?? offlineCount} Expired
                </span>
                {activePath ? (
                  <span className="rounded-md border border-[#24527b] bg-[#0b1a2d]/60 px-2 py-0.5 text-[#93c5fd]">
                    Route {activePath.label}
                  </span>
                ) : (
                  <span className={`rounded-md border border-[#334155] bg-[#0f172a]/50 px-2 py-0.5 ${UI_SURFACES.textSoftMuted}`}>
                    Route unavailable
                  </span>
                )}
              </div>
            )}
            {!compactViewport && (
              <div className={`mt-1 text-[9px] ${CAMERA_WALL_SURFACES.muted3}`}>
                Focus mode collapses the layout controls so the operator can read the wall at a glance. Press F to exit focus.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`mb-2 flex items-center justify-between rounded-xl border ${CAMERA_WALL_SURFACES.borderSubtle} ${CAMERA_WALL_SURFACES.panel} px-3 py-2`}>
          <div>
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${CAMERA_WALL_SURFACES.accent}`}>Camera Wall - Multi Camera</div>
            <div className={`mt-0.5 text-[11px] ${CAMERA_WALL_SURFACES.muted3}`}>
              {viewCount} view layout
              {hiddenCount > 0 ? ` · ${hiddenCount} more camera${hiddenCount === 1 ? "" : "s"}` : ""}
            </div>
            <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[9px] ${CAMERA_WALL_SURFACES.muted2}`}>
              <span className="rounded-md border border-emerald-500/15 bg-emerald-500/8 px-2 py-0.5 text-emerald-300">
                Active {activeCount}
              </span>
              <span className="rounded-md border border-rose-500/15 bg-rose-500/8 px-2 py-0.5 text-rose-300">
                Offline {offlineCount}
              </span>
              <span className="rounded-md border border-sky-500/15 bg-sky-500/8 px-2 py-0.5 text-sky-300" title="Telemetry from /api/camera-live-session-health">
                Bridge Health: {sessionHealth?.totals?.active ?? activeCount} Active · {sessionHealth?.totals?.expired ?? offlineCount} Expired
              </span>
              <span className={`rounded-md border ${UI_SURFACES.borderStrong} bg-black/30 px-2 py-0.5 ${CAMERA_WALL_SURFACES.body}`}>
                Selected {selectedCamera?.name ?? "None"}
              </span>
              {activePath ? (
                <span className="rounded-md border border-[#24527b] bg-[#0b1a2d]/60 px-2 py-0.5 text-[#93c5fd]">
                  Route Context {activePath.label}
                </span>
              ) : (
                <span className={`rounded-md border border-[#334155] bg-[#0f172a]/50 px-2 py-0.5 ${UI_SURFACES.textSoftMuted}`}>
                  Route Context unavailable
                </span>
              )}
              {bestCameraId ? (
                <span className="rounded-md border border-emerald-500/15 bg-emerald-500/8 px-2 py-0.5 text-emerald-300">
                  Best camera now {scene.cameras.find((cam) => cam.id === bestCameraId)?.name ?? bestCameraId}
                </span>
              ) : null}
              {activePath ? (
                <span className={cn(
                  "rounded-md border px-2 py-0.5",
                  weakRouteCameras > 0
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                )}>
                  Route risk {weakRouteCameras > 0 ? "Elevated" : "Low"}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setSyncTime((prev) => !prev)}
                className={`rounded-md border px-2 py-0.5 transition-colors ${
                  syncTime
                    ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
                    : "${UI_SURFACES.borderStrong} bg-black/30 ${UI_SURFACES.textSoftMuted}"
                }`}
              >
                {syncTime ? "Synchronized Time" : "Free Running Time"}
              </button>
            </div>
            <div className={`mt-1 text-[9px] ${CAMERA_WALL_SURFACES.muted3}`}>{wallActionHint}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 rounded-lg border ${UI_SURFACES.borderStrong} bg-black/40 p-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${CAMERA_WALL_SURFACES.body}`}>
              <button
                type="button"
                onClick={() => setLayoutMode("quad")}
                className={`rounded-md px-2 py-1 transition-colors ${effectiveLayout === "quad" ? "bg-[#1d2b40] text-white" : "${UI_SURFACES.textSoftMuted}"}`}
              >
                4 Views
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("overview")}
                className={`rounded-md px-2 py-1 transition-colors ${effectiveLayout === "overview" ? "bg-[#1d2b40] text-white" : "${UI_SURFACES.textSoftMuted}"}`}
              >
                6 Views
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("dense")}
                className={`rounded-md px-2 py-1 transition-colors ${effectiveLayout === "dense" ? "bg-[#1d2b40] text-white" : "${UI_SURFACES.textSoftMuted}"}`}
                data-testid="wall-layout-dense"
              >
                16 Views
              </button>
              {effectiveLayout === "dense" ? (
                <DenseModePerfGuard cameraCount={visibleCount} />
              ) : null}
              <button
                type="button"
                onClick={() => setLayoutMode("auto")}
                className={`rounded-md px-2 py-1 transition-colors ${layoutMode === "auto" ? "bg-emerald-500/20 text-emerald-200" : "${UI_SURFACES.textSoftMuted}"}`}
              >
                Auto Layout
              </button>
              <button
                type="button"
                onClick={() => setShowMapPreview((prev) => !prev)}
                className={`rounded-md px-2 py-1 transition-colors ${showMapPreview ? "bg-sky-500/20 text-sky-200" : "${UI_SURFACES.textSoftMuted}"}`}
              >
                3D Map
              </button>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderStrong} bg-black/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${CAMERA_WALL_SURFACES.body}`}>
              {viewCount} Views
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggleImmersiveMode}
        className={`absolute right-3 top-[calc(var(--st-full-canvas-safe-top,4.25rem)+0.5rem)] z-30 rounded-lg border ${UI_SURFACES.borderDark} ${UI_SURFACES.bgDeep}/90 px-3 py-1.5 text-[10px] font-medium ${CAMERA_WALL_SURFACES.body} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverText}`}
      >
        {immersiveMode ? "Exit Focus" : "Focus"}
      </button>

      <div className={`relative grid flex-1 gap-2 rounded-xl border border-[#141b28] bg-[#05070a]/60 p-1.5 ${layoutSpec.gridClass}`}>
        {effectiveLayout === "dense" ? (
          <>
            {visible.map((cam) => (
              <CameraSlotButton
                key={cam.id}
                camera={cam}
                isSelected={cam.id === selectedId}
                isBestCamera={cam.id === bestCameraId}
                cameraResult={cameraResultById[cam.id] ?? null}
                pathVisibility={pathVisibilityByCameraId[cam.id] ?? null}
                replayState={replayStateByCameraId[cam.id] ?? null}
                replayPose={replayPoseByCameraId[cam.id]}
                timestampLabel={timestampLabel}
                className="h-full w-full"
                isDense
                sceneMaxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)}
              />
            ))}
            {Array.from({ length: Math.max(0, layoutSpec.cameraSlots - visible.length) }).map((_, index) => (
              <EmptySlot key={`dense-empty-${index}`} />
            ))}
          </>
        ) : effectiveLayout === "overview" ? (
          <>
            {visible.map((cam) => (
              <CameraSlotButton
                key={cam.id}
                camera={cam}
                isSelected={cam.id === selectedId}
                isBestCamera={cam.id === bestCameraId}
                cameraResult={cameraResultById[cam.id] ?? null}
                pathVisibility={pathVisibilityByCameraId[cam.id] ?? null}
                replayState={replayStateByCameraId[cam.id] ?? null}
                replayPose={replayPoseByCameraId[cam.id]}
                timestampLabel={timestampLabel}
                className="h-full w-full"
                isDense={false}
                sceneMaxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)}
              />
            ))}
            {Array.from({ length: Math.max(0, layoutSpec.cameraSlots - visible.length) }).map((_, index) => (
              <EmptySlot key={`overview-empty-${index}`} />
            ))}
          </>
        ) : (
          <>
            {visible.map((cam) => (
              <CameraSlotButton
                key={cam.id}
                camera={cam}
                isSelected={cam.id === selectedId}
                isBestCamera={cam.id === bestCameraId}
                cameraResult={cameraResultById[cam.id] ?? null}
                pathVisibility={pathVisibilityByCameraId[cam.id] ?? null}
                replayState={replayStateByCameraId[cam.id] ?? null}
                replayPose={replayPoseByCameraId[cam.id]}
                timestampLabel={timestampLabel}
                className="h-full w-full"
                isDense={false}
                sceneMaxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)}
              />
            ))}
            {Array.from({ length: Math.max(0, layoutSpec.cameraSlots - visible.length) }).map((_, index) => (
              <EmptySlot key={`quad-empty-${index}`} />
            ))}
          </>
        )}
      </div>
      {showMapPreview && (
        <div className={`absolute bottom-5 right-5 z-40 h-60 w-80 overflow-hidden rounded-xl border ${UI_SURFACES.borderStrong} ${CAMERA_WALL_SURFACES.panelSoft} shadow-[0_16px_48px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-300`}>
          <div className={`absolute left-2.5 top-2.5 z-50 flex items-center gap-1.5 rounded-lg border ${UI_SURFACES.borderStrong} bg-black/70 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] ${CAMERA_WALL_SURFACES.accent}`}>
            <span>3D Map Overview</span>
          </div>
          <button
            type="button"
            onClick={() => setShowMapPreview(false)}
            className={`absolute right-2.5 top-2.5 z-50 rounded-lg border ${UI_SURFACES.borderStrong} bg-black/70 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${CAMERA_WALL_SURFACES.muted3} transition-colors hover:border-[#4a5f80] ${UI_SURFACES.hoverText}`}
          >
            Hide
          </button>
          <WallOverviewPanel isDense={false} />
        </div>
      )}
    </div>
  );
}
