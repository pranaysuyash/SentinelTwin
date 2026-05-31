"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ArrowLeftRight, Database, GitCompare, Globe, Lock, Plus, AlertTriangle, Share2, Sparkles, Unlock } from "lucide-react";
import { startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { qualityToScore } from "@sentineltwin/core";
import "@/lib/three-compat";
import { buildCompareShareLink } from "@/lib/compare-share-link";
import { shareLinkOrCopy } from "@/lib/share-link";
import { buildCompareReportData, exportCompareAsHtml, exportCompareAsMarkdown } from "@sentineltwin/report";
import { buildReportEvidenceBundle, stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  ScenePrivacyZones,
  CoverageHeatmapInstanced,
} from "@/components/workspace/SharedScene";
import { cn } from "@/lib/cn";
import { QUALITY_RANK, QUALITY_TEXT_COLOR } from "@/lib/quality-display";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import type { SceneSnapshot, SimulationResult } from "@/schema/security-scene";

type CoverageCell = SimulationResult["coverageCells"][number];
type SceneNodeLike = { id?: string };

type Metrics = {
  covered: number;
  recognition: number;
  blindspot: number;
  cameras: number;
  critZonePct: number;
  critZoneTotal: number;
  visiblePathPct: number;
  lostPathPct: number;
};

type DoriThresholds = {
  detection: number;
  observation: number;
  recognition: number;
  identification: number;
};

function computeCameraDoriRanges(camera: SceneSnapshot["scene"]["cameras"][number], ppm: DoriThresholds) {
  const resW = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  const cap = camera.rangeM;
  return {
    detection: Math.min(resW / (2 * ppm.detection * tanHalfFov), cap),
    observation: Math.min(resW / (2 * ppm.observation * tanHalfFov), cap),
    recognition: Math.min(resW / (2 * ppm.recognition * tanHalfFov), cap),
    identification: Math.min(resW / (2 * ppm.identification * tanHalfFov), cap),
  };
}

function computeMetrics(sim: SimulationResult | undefined, cells: CoverageCell[]): Metrics | null {
  if (!sim && cells.length === 0) return null;

  const covered = cells.length > 0 ? (cells.filter((c) => c.quality !== "none").length / cells.length) * 100 : 0;
  const recognition = cells.length > 0
    ? (cells.filter((c) => qualityToScore(c.quality) >= qualityToScore("recognition")).length / cells.length) * 100
    : 0;
  const blindspot = sim?.blindspotPct ?? (cells.length > 0 ? 100 - covered : 0);
  const cameras = sim?.cameraResults.length ?? 0;
  const critZonePass = sim ? sim.criticalZoneResults.filter((z) => z.status === "pass").length : 0;
  const critZoneTotal = sim?.criticalZoneResults.length ?? 0;
  const critZonePct = critZoneTotal > 0 ? (critZonePass / critZoneTotal) * 100 : 0;
  const visiblePathPct = sim ? (sim.pathResults.reduce((acc, path) => acc + (path.totalDurationS > 0 ? (path.visibleDurationS / path.totalDurationS) * 100 : 0), 0) / Math.max(sim.pathResults.length, 1)) : 0;
  const lostPathPct = sim ? (sim.pathResults.reduce((acc, path) => acc + (path.totalDurationS > 0 ? (path.lostDurationS / path.totalDurationS) * 100 : 0), 0) / Math.max(sim.pathResults.length, 1)) : 0;
  return { covered, recognition, blindspot, cameras, critZonePct, critZoneTotal, visiblePathPct, lostPathPct };
}

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function qualityLabel(value: string) {
  switch (value) {
    case "identification": return "Identification";
    case "recognition": return "Recognition";
    case "observation": return "Observation";
    case "detection": return "Detection";
    default: return value;
  }
}

function qualityForScore(score: number) {
  if (score >= 3.5) return "identification";
  if (score >= 2.5) return "recognition";
  if (score >= 1.5) return "observation";
  if (score >= 0.5) return "detection";
  return "none";
}

function timelineSeries(pathResult: SimulationResult["pathResults"][number] | null) {
  if (!pathResult?.timeline?.length) return [];
  return pathResult.timeline.map((event, index) => ({
    index,
    timeS: event.timeS,
    score: QUALITY_RANK[event.quality ?? "none"] ?? 0,
    quality: event.quality ?? "none",
  }));
}

function pickActivePathResult(snapshot: SceneSnapshot | null, activePathId: string | null) {
  const simulation = snapshot?.simulation;
  if (!simulation) return null;
  if (!activePathId) return null;
  if (!snapshot.scene.paths.some((path) => path.id === activePathId)) return null;
  return simulation.pathResults.find((entry) => entry.pathId === activePathId) ?? null;
}

function buildTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
}

/** Renders inside a Canvas context to sync camera position/target with the shared store. */
function CameraSyncController({
  orbitSync,
  orbitCameraState,
  onOrbitChange,
}: {
  orbitSync: boolean;
  orbitCameraState: { position: [number, number, number] | null; target: [number, number, number] | null };
  onOrbitChange: (state: { position: [number, number, number]; target: [number, number, number] }) => void;
}) {
  const { camera, controls } = useThree();
  const lastSentKey = useRef<string>("");
  const lastAppliedKey = useRef<string>("");
  const throttleRef = useRef(0);

  useFrame(() => {
    const orbitControls = controls as { target: THREE.Vector3 } | null;
    if (!orbitControls || !camera) return;

    const pos = camera.position;
    const tgt = orbitControls.target;

    const localKey = `${pos.x.toFixed(4)},${pos.y.toFixed(4)},${pos.z.toFixed(4)}|${tgt.x.toFixed(4)},${tgt.y.toFixed(4)},${tgt.z.toFixed(4)}`;

    if (orbitSync) {
      // If the shared state has been updated by the other panel, apply it to this camera
      if (orbitCameraState.position && orbitCameraState.target) {
        const sharedKey = `${orbitCameraState.position[0].toFixed(4)},${orbitCameraState.position[1].toFixed(4)},${orbitCameraState.position[2].toFixed(4)}|${orbitCameraState.target[0].toFixed(4)},${orbitCameraState.target[1].toFixed(4)},${orbitCameraState.target[2].toFixed(4)}`;

        if (sharedKey !== lastAppliedKey.current && sharedKey !== localKey) {
          lastAppliedKey.current = sharedKey;
          camera.position.set(orbitCameraState.position[0], orbitCameraState.position[1], orbitCameraState.position[2]);
          orbitControls.target.set(orbitCameraState.target[0], orbitCameraState.target[1], orbitCameraState.target[2]);
          return;
        }
      }

      // Throttle store emissions to ~15fps (67ms) during orbit drag
      const now = performance.now();
      if (now - throttleRef.current < 67) return;
      throttleRef.current = now;

      // If this camera moved locally, emit the new state to the store
      if (localKey !== lastSentKey.current) {
        lastSentKey.current = localKey;
        onOrbitChange({
          position: [pos.x, pos.y, pos.z],
          target: [tgt.x, tgt.y, tgt.z],
        });
      }
    } else {
      // Reset tracking when sync is off
      lastSentKey.current = "";
      lastAppliedKey.current = "";
    }
  });

  return null;
}

function ScenePanel({
  label,
  accent,
  scene,
  coverageCells,
  orbitSync,
  orbitCameraState,
  onOrbitChange,
}: {
  label: string;
  accent: "baseline" | "proposed";
  scene: SceneSnapshot["scene"];
  coverageCells: CoverageCell[];
  orbitSync: boolean;
  orbitCameraState: { position: [number, number, number] | null; target: [number, number, number] | null };
  onOrbitChange: (state: { position: [number, number, number]; target: [number, number, number] }) => void;
}) {
  const { width, depth } = scene.dimensions;

  const theme = ENVIRONMENT_THEMES.day;
  const cameraPos = useMemo<[number, number, number]>(() => {
    const cx = width / 2;
    const cz = depth / 2;
    const span = Math.max(width, depth);
    return [cx + width * 0.42, span * 0.72, cz + depth * 0.98];
  }, [width, depth]);

  return (
    <div className={cn(
      "relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-[#07090d]",
      accent === "baseline" ? "border-[#3b1f24]" : "border-[#1f3b27]",
    )}>
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
        accent === "baseline"
          ? "border-b border-red-500/15 bg-red-500/6 text-red-300"
          : "border-b border-emerald-500/15 bg-emerald-500/6 text-emerald-300",
      )}>
        <span>{label}</span>
        <span className="font-mono text-[10px] text-[#8090a8]">
          {coverageCells.length > 0 ? `${Math.round((coverageCells.filter((c) => c.quality !== "none").length / coverageCells.length) * 100)}% covered` : "--"}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <Canvas
          camera={{ position: cameraPos, fov: 44, near: 0.1, far: 200 }}
          shadows="percentage"
          dpr={[0.85, 1.15]}
          frameloop="demand"
          gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
          className="absolute inset-0"
          style={{ background: theme.background }}
        >
          <color attach="background" args={[theme.background as THREE.ColorRepresentation]} />
          <ambientLight intensity={theme.ambient} />
          <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={theme.hemisphere} />
          <directionalLight position={[10, 14, 8]} intensity={theme.directional} color="#eef4ff" castShadow />
          <Suspense fallback={<CanvasLoadingOverlay label="Loading compare scene" />}>
            <SceneLighting theme={theme} />
            <SceneFloor width={width} depth={depth} showGrid={false} />
            <SceneWalls walls={scene.walls} />
            <SceneDoors doors={scene.doors} />
            <SceneWindows windows={scene.windows} />
            <SceneObstructions obstructions={scene.obstructions} selectedId={null} />
            {scene.privacyZones.length > 0 ? <ScenePrivacyZones zones={scene.privacyZones} /> : null}
            {coverageCells.length > 0 && <CoverageHeatmapInstanced cells={coverageCells} />}
          </Suspense>
          <OrbitControls
            makeDefault
            target={[width / 2, 0.1, depth / 2]}
            minDistance={5.5}
            maxDistance={40}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 2.1}
            enableDamping
            dampingFactor={0.08}
          />
          <CameraSyncController
            orbitSync={orbitSync}
            orbitCameraState={orbitCameraState}
            onOrbitChange={onOrbitChange}
          />
        </Canvas>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  beforeValue,
  afterValue,
  delta,
  tone,
  suffix = "%",
}: {
  label: string;
  beforeValue: number | null;
  afterValue: number | null;
  delta: number | null;
  tone: string;
  suffix?: string;
}) {
  const positive = delta != null ? delta >= 0 : false;

  return (
    <div className="flex min-w-[128px] flex-1 flex-col rounded-lg border border-[#1d2330] bg-[#0b1018] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65718a]">{label}</div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <div className="font-mono text-[16px] font-semibold text-white">{afterValue == null ? "--" : `${afterValue.toFixed(1)}${suffix}`}</div>
        {delta != null ? (
          <div className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", positive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            {formatDelta(delta)}
          </div>
        ) : null}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#65718a]">
        <span>{beforeValue == null ? "Baseline unavailable" : `Was ${beforeValue.toFixed(1)}${suffix}`}</span>
        <span style={{ color: tone }} />
      </div>
    </div>
  );
}

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#1d2330] bg-[#090d14] px-1.5 py-1">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65718a]">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function ToolbarButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function QualityTrend({
  snapshotA,
  snapshotB,
  activePathId,
}: {
  snapshotA: SceneSnapshot | null;
  snapshotB: SceneSnapshot | null;
  activePathId: string | null;
}) {
  const resultA = pickActivePathResult(snapshotA, activePathId);
  const resultB = pickActivePathResult(snapshotB, activePathId);
  const seriesA = timelineSeries(resultA);
  const seriesB = timelineSeries(resultB);
  const width = 420;
  const height = 160;
  const paddingX = 18;
  const paddingY = 16;
  const trendPoints = (series: ReturnType<typeof timelineSeries>) => {
    if (series.length === 0) return [];
    const maxIndex = Math.max(series.length - 1, 1);
    return series.map((point, index) => {
      const x = paddingX + (index / maxIndex) * (width - paddingX * 2);
      const y = height - paddingY - ((point.score / 4) * (height - paddingY * 2));
      return { x, y };
    });
  };
  const pathA = buildTrendPath(trendPoints(seriesA));
  const pathB = buildTrendPath(trendPoints(seriesB));

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Quality Over Time</div>
          <div className="text-[10px] text-[#556076]">
            {activePathId ? "Camera quality along the selected replay path" : "Select a path in Scenario Path to show route quality"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-[#9aa6bf]"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Baseline</span>
          <span className="flex items-center gap-1 text-[#9aa6bf]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Proposed</span>
        </div>
      </div>
      {activePathId ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[160px] w-full overflow-visible rounded-lg bg-[#090d14]">
          <defs>
            <linearGradient id="compare-trend-a" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="compare-trend-b" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1={paddingX}
              x2={width - paddingX}
              y1={paddingY + ((height - paddingY * 2) / 4) * line}
              y2={paddingY + ((height - paddingY * 2) / 4) * line}
              stroke="#1f2737"
              strokeWidth="1"
            />
          ))}
          {pathA ? (
            <>
              <path d={`${pathA} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`} fill="url(#compare-trend-a)" />
              <path d={pathA} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeDasharray="5 4" />
            </>
          ) : null}
          {pathB ? (
            <>
              <path d={`${pathB} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`} fill="url(#compare-trend-b)" />
              <path d={pathB} fill="none" stroke="#22c55e" strokeWidth="2.4" />
            </>
          ) : null}
          {[seriesA, seriesB].flat().slice(-1).map((pt, index) => {
            const x = paddingX + ((pt.index / Math.max((seriesB.length || seriesA.length) - 1, 1)) * (width - paddingX * 2));
            const y = height - paddingY - ((pt.score / 4) * (height - paddingY * 2));
            const color = index === 0 ? "#ef4444" : "#22c55e";
            return <circle key={`${pt.index}-${index}`} cx={x} cy={y} r="3.5" fill={color} />;
          })}
        </svg>
      ) : (
        <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-[#1f2737] bg-[#090d14] px-4 text-center">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#556076]">No path selected</div>
            <div className="mt-1 text-[10px] text-[#7f8ca6]">
              Pick a scenario path in the Path panel to compare route quality over time.
            </div>
          </div>
        </div>
      )}
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-[#91a0bc]">
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2 py-1.5">
          <div className="text-[#556076]">Baseline quality</div>
          <div className="mt-0.5 font-semibold text-red-300">{qualityLabel(qualityForScore(seriesA.at(-1)?.score ?? 0))}</div>
        </div>
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2 py-1.5">
          <div className="text-[#556076]">Proposed quality</div>
          <div className="mt-0.5 font-semibold text-emerald-300">{qualityLabel(qualityForScore(seriesB.at(-1)?.score ?? 0))}</div>
        </div>
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2 py-1.5">
          <div className="text-[#556076]">Path visibility</div>
          <div className="mt-0.5 font-semibold text-[#d9e6ff]">{formatPct(((resultB?.visibleDurationS ?? resultA?.visibleDurationS ?? 0) / Math.max(resultB?.totalDurationS ?? resultA?.totalDurationS ?? 1, 1)) * 100)}</div>
        </div>
      </div>
    </div>
  );
}

function NotesPanel({
  snapshotA,
  snapshotB,
}: {
  snapshotA: SceneSnapshot | null;
  snapshotB: SceneSnapshot | null;
}) {
  const mA = computeMetrics(snapshotA?.simulation, snapshotA?.simulation?.coverageCells ?? []) ?? null;
  const mB = computeMetrics(snapshotB?.simulation, snapshotB?.simulation?.coverageCells ?? []) ?? null;
  const deltaCoverage = (mA && mB) ? mB.covered - mA.covered : null;
  const deltaRecognition = (mA && mB) ? mB.recognition - mA.recognition : null;
  const deltaBlindspot = (mA && mB) ? mB.blindspot - mA.blindspot : null;
  const issues = snapshotB?.simulation?.issues ?? [];
  const recommendations = snapshotB?.simulation?.recommendations ?? [];

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Changes in Scenario B</div>
          <div className="text-[10px] text-[#556076]">What changed, what failed, and what got better.</div>
        </div>
        <ArrowLeftRight className="h-3.5 w-3.5 text-[#4a5568]" />
      </div>

      <div className="space-y-2 text-[10px]">
        {[
          { label: "Coverage", value: deltaCoverage, tone: deltaCoverage != null && deltaCoverage >= 0 ? "text-emerald-300" : "text-rose-300", icon: deltaCoverage != null && deltaCoverage >= 0 ? Sparkles : AlertTriangle },
          { label: "Recognition", value: deltaRecognition, tone: deltaRecognition != null && deltaRecognition >= 0 ? "text-emerald-300" : "text-rose-300", icon: deltaRecognition != null && deltaRecognition >= 0 ? Sparkles : AlertTriangle },
          { label: "Blindspot", value: deltaBlindspot, tone: deltaBlindspot != null && deltaBlindspot <= 0 ? "text-emerald-300" : "text-rose-300", icon: deltaBlindspot != null && deltaBlindspot <= 0 ? Sparkles : AlertTriangle },
        ].map((entry) => {
          const Icon = entry.icon;
          return (
            <div key={entry.label} className="flex items-center justify-between rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-3 w-3", entry.tone)} />
                <span className="text-[#b8c3d9]">{entry.label}</span>
              </div>
              <span className={cn("font-mono font-semibold", entry.tone)}>
                {entry.value == null ? "--" : formatDelta(entry.value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] p-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#556076]">Issues</div>
          <div className="mt-1 space-y-1">
            {(issues.length ? issues : [{ severity: "low", description: "No issues reported", category: "blindspot" }]).slice(0, 4).map((issue) => (
              <div key={`${issue.severity}-${issue.description}`} className="flex items-start gap-2 text-[10px] text-[#c7d0e4]">
                <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", issue.severity === "critical" ? "bg-red-400" : issue.severity === "high" ? "bg-orange-400" : issue.severity === "medium" ? "bg-yellow-400" : "bg-emerald-400")} />
                <span className="leading-snug">{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] p-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#556076]">Recommended next steps</div>
          <div className="mt-1 space-y-1">
            {(recommendations.length ? recommendations : [{ description: "Open report lite for the full hardening summary." }]).slice(0, 4).map((rec) => (
              <div key={rec.description} className="flex items-start gap-2 text-[10px] text-[#c7d0e4]">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="leading-snug">{rec.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildComparisonExport(snapshotA: SceneSnapshot | null, snapshotB: SceneSnapshot | null, metricsA: Metrics | null, metricsB: Metrics | null) {
  return {
    exportedAt: new Date().toISOString(),
    scenarioA: snapshotA
      ? {
          id: snapshotA.id,
          label: snapshotA.label,
          createdAt: snapshotA.createdAt,
          metrics: metricsA,
        }
      : null,
    scenarioB: snapshotB
      ? {
          id: snapshotB.id,
          label: snapshotB.label,
          createdAt: snapshotB.createdAt,
          metrics: metricsB,
        }
      : null,
    delta: metricsA && metricsB
      ? {
          coverage: Number((metricsB.covered - metricsA.covered).toFixed(1)),
          recognition: Number((metricsB.recognition - metricsA.recognition).toFixed(1)),
          blindspot: Number((metricsB.blindspot - metricsA.blindspot).toFixed(1)),
          criticalZones: Number((metricsB.critZonePct - metricsA.critZonePct).toFixed(1)),
          pathVisibility: Number((metricsB.visiblePathPct - metricsA.visiblePathPct).toFixed(1)),
        }
      : null,
  };
}

function diffNodeCollection<T extends SceneNodeLike>(baseline: T[], proposed: T[]) {
  const baselineById = new Map(baseline.filter((item): item is T & { id: string } => Boolean(item.id)).map((item) => [item.id, item]));
  const proposedById = new Map(proposed.filter((item): item is T & { id: string } => Boolean(item.id)).map((item) => [item.id, item]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, node] of proposedById.entries()) {
    const prev = baselineById.get(id);
    if (!prev) {
      added.push(id);
      continue;
    }
    if (JSON.stringify(prev) !== JSON.stringify(node)) {
      changed.push(id);
    }
  }
  for (const id of baselineById.keys()) {
    if (!proposedById.has(id)) removed.push(id);
  }

  return {
    before: baseline.length,
    after: proposed.length,
    added,
    removed,
    changed,
  };
}

function ChangedObjectsPanel({ snapshotA, snapshotB }: { snapshotA: SceneSnapshot | null; snapshotB: SceneSnapshot | null }) {
  if (!snapshotA || !snapshotB) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Changed Objects</div>
        <div className="mt-2 text-[10px] text-[#556076]">Select two snapshots to compare object-level changes.</div>
      </div>
    );
  }

  const diffRows = [
    { label: "Cameras", diff: diffNodeCollection(snapshotA.scene.cameras, snapshotB.scene.cameras) },
    { label: "Obstructions", diff: diffNodeCollection(snapshotA.scene.obstructions, snapshotB.scene.obstructions) },
    { label: "Lights", diff: diffNodeCollection(snapshotA.scene.securityLights, snapshotB.scene.securityLights) },
    { label: "Walls", diff: diffNodeCollection(snapshotA.scene.walls, snapshotB.scene.walls) },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
      <div className="mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Changed Objects</div>
        <div className="text-[10px] text-[#556076]">Scenario B deltas vs Scenario A by object class and IDs.</div>
      </div>
      <div className="space-y-2">
        {diffRows.map(({ label, diff }) => (
          <div key={label} className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-[#c7d0e4]">{label}</span>
              <span className="font-mono text-[#91a0bc]">{diff.before} → {diff.after}</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
              <span className="rounded border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">+{diff.added.length}</span>
              <span className="rounded border border-rose-400/25 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">-{diff.removed.length}</span>
              <span className="rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">~{diff.changed.length}</span>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[10px] text-[#9aa6bf]">
              <div className="truncate">Added IDs: {diff.added.length > 0 ? diff.added.join(", ") : "--"}</div>
              <div className="truncate">Removed IDs: {diff.removed.length > 0 ? diff.removed.join(", ") : "--"}</div>
              <div className="truncate">Changed IDs: {diff.changed.length > 0 ? diff.changed.join(", ") : "--"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-[#1f2737] bg-[#090d14] px-4 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#556076]">{title}</div>
      <div className="mt-2 max-w-[280px] text-[10px] text-[#7f8ca6]">{description}</div>
    </div>
  );
}

export function CompareView() {
  const snapshots = useStudioStore((s) => s.snapshots);
  const scene = useStudioStore((s) => s.scene);
  const simulation = useStudioStore((s) => s.simulationResult);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const simulateSnapshot = useStudioStore((s) => s.simulateSnapshot);
  const setCompareVisualEvidence = useStudioStore((s) => s.setCompareVisualEvidence);
  const setCompareReportSelection = useStudioStore((s) => s.setCompareReportSelection);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const compareReportSelection = useStudioStore((s) => s.compareReportSelection);
  const compareVisualEvidence = useStudioStore((s) => s.compareVisualEvidence);
  const activePathId = useStudioStore((s) => s.activePathId);
  const compareOrbitSync = useStudioStore((s) => s.compareOrbitSync);
  const compareOrbitCameraState = useStudioStore((s) => s.compareOrbitCameraState);
  const setCompareOrbitSync = useStudioStore((s) => s.setCompareOrbitSync);
  const setCompareOrbitCameraState = useStudioStore((s) => s.setCompareOrbitCameraState);
  const demoMode = useStudioStore((s) => s.demoMode);
  const demoStep = useStudioStore((s) => s.demoStep);
  const [comparisonAId, setComparisonAId] = useState<string | null>(null);
  const [comparisonBId, setComparisonBId] = useState<string | null>(null);
  const [cameraComparisonAId, setCameraComparisonAId] = useState<string | null>(null);
  const [cameraComparisonBId, setCameraComparisonBId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const panelARef = useRef<HTMLDivElement | null>(null);
  const panelBRef = useRef<HTMLDivElement | null>(null);
  const sceneName = scene.name;

  const validComparisonAId = comparisonAId && snapshots.some((snapshot) => snapshot.id === comparisonAId) ? comparisonAId : null;
  const validComparisonBId = comparisonBId && snapshots.some((snapshot) => snapshot.id === comparisonBId) ? comparisonBId : null;

  const snapshotA = validComparisonAId ? snapshots.find((snapshot) => snapshot.id === validComparisonAId) ?? null : null;
  const snapshotB = validComparisonBId ? snapshots.find((snapshot) => snapshot.id === validComparisonBId) ?? null : null;
  const seededCompareSelection = compareReportSelection?.snapshotAId === snapshotA?.id && compareReportSelection?.snapshotBId === snapshotB?.id
    ? compareReportSelection
    : null;
  const compareSelectionProvenanceNote = seededCompareSelection?.provenanceNote ?? null;
  const latestSimulatedSnapshot = [...snapshots].reverse().find((snapshot) => Boolean(snapshot.simulation)) ?? null;

  const cellsA = useMemo(() => snapshotA?.simulation?.coverageCells ?? [], [snapshotA]);
  const cellsB = useMemo(() => snapshotB?.simulation?.coverageCells ?? [], [snapshotB]);
  const snapshotBSimulationMissing = Boolean(snapshotB && !snapshotB.simulation);

  const mA = useMemo(() => computeMetrics(snapshotA?.simulation, cellsA), [snapshotA, cellsA]);
  const mB = useMemo(() => computeMetrics(snapshotB?.simulation, cellsB), [snapshotB, cellsB]);
  const defaultCameraAId = null;
  const defaultCameraBId = null;
  const validCameraAId = cameraComparisonAId && scene.cameras.some((camera) => camera.id === cameraComparisonAId)
    ? cameraComparisonAId
    : defaultCameraAId;
  const validCameraBId = cameraComparisonBId && scene.cameras.some((camera) => camera.id === cameraComparisonBId)
    ? cameraComparisonBId
    : defaultCameraBId;
  const cameraA = scene.cameras.find((camera) => camera.id === validCameraAId) ?? null;
  const cameraB = scene.cameras.find((camera) => camera.id === validCameraBId) ?? null;
  const cameraResultA = simulation?.cameraResults.find((entry) => entry.cameraId === cameraA?.id) ?? null;
  const cameraResultB = simulation?.cameraResults.find((entry) => entry.cameraId === cameraB?.id) ?? null;
  const cameraDeltas = useMemo(() => {
    if (!cameraA || !cameraB || !cameraResultA || !cameraResultB) return null;
    return {
      coverage: cameraResultB.coveragePct - cameraResultA.coveragePct,
      passedZones: cameraResultB.criticalZonesCovered.length - cameraResultA.criticalZonesCovered.length,
      failedZones: cameraResultB.criticalZonesFailed.length - cameraResultA.criticalZonesFailed.length,
      doriA: computeCameraDoriRanges(cameraA, scene.assumptions.pixelsPerMeter),
      doriB: computeCameraDoriRanges(cameraB, scene.assumptions.pixelsPerMeter),
    };
  }, [cameraA, cameraB, cameraResultA, cameraResultB, scene.assumptions.pixelsPerMeter]);
  const comparisonExport = useMemo(() => buildComparisonExport(snapshotA, snapshotB, mA, mB), [snapshotA, snapshotB, mA, mB]);
  const outcomeA = useMemo(() => {
    if (!snapshotA?.simulation) return null;
    const snapshotScene = { ...snapshotA.scene, snapshots: [], scenarios: [] };
    const activePath = activePathId ? snapshotScene.paths.find((path) => path.id === activePathId) ?? null : null;
    return buildSecurityOutcomeModel(snapshotScene, snapshotA.simulation, activePath ?? null);
  }, [activePathId, snapshotA]);
  const outcomeB = useMemo(() => {
    if (!snapshotB?.simulation) return null;
    const snapshotScene = { ...snapshotB.scene, snapshots: [], scenarios: [] };
    const activePath = activePathId ? snapshotScene.paths.find((path) => path.id === activePathId) ?? null : null;
    return buildSecurityOutcomeModel(snapshotScene, snapshotB.simulation, activePath ?? null);
  }, [activePathId, snapshotB]);
  const compareReportData = useMemo(() => {
    if (!snapshotA?.simulation || !snapshotB?.simulation) return null;
    const compare = buildCompareReportData(
      { ...snapshotA.scene, snapshots: [], scenarios: [] } as never,
      snapshotA.simulation,
      { ...snapshotB.scene, snapshots: [], scenarios: [] } as never,
      snapshotB.simulation,
    );
    const visuals = compareVisualEvidence &&
      compareVisualEvidence.snapshotAId === snapshotA.id &&
      compareVisualEvidence.snapshotBId === snapshotB.id &&
      compareVisualEvidence.capturedAt >= Math.max(snapshotA.createdAt, snapshotB.createdAt)
      ? {
          beforeImageDataUrl: compareVisualEvidence.beforeImageDataUrl,
          afterImageDataUrl: compareVisualEvidence.afterImageDataUrl,
        }
      : undefined;
    return { compare, visuals };
  }, [compareVisualEvidence, snapshotA, snapshotB]);
  const handleExportComparison = useCallback(() => {
    const blob = new Blob([JSON.stringify(comparisonExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-comparison-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportToast("Comparison JSON exported");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [comparisonExport]);
  const handleExportEvidenceBundle = useCallback(() => {
    if (!compareReportData?.compare || !snapshotB?.simulation) return;
    const afterScene = { ...snapshotB.scene, snapshots: [], scenarios: [] } as never;
    const bundle = buildReportEvidenceBundle({
      scene: afterScene,
      report: compareReportData.compare.after,
      simulationResult: snapshotB.simulation,
      compare: compareReportData.compare,
      visualEvidence: compareReportData.visuals,
      notes: ["Compare-mode evidence bundle exported from the compare surface."],
    });
    const blob = new Blob([stringifyReportEvidenceBundle(bundle)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-evidence-bundle-${sceneName.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportToast("Evidence bundle exported");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [compareReportData, sceneName, snapshotB]);
  const handleExportMarkdown = useCallback(() => {
    if (!compareReportData) return;
    const markdown = exportCompareAsMarkdown(compareReportData.compare);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-comparison-${sceneName.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportToast("Comparison Markdown exported");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [compareReportData, sceneName]);
  const handleExportHtml = useCallback(() => {
    if (!compareReportData) return;
    const html = exportCompareAsHtml(compareReportData.compare, compareReportData.visuals);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-comparison-${sceneName.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setExportToast("Comparison HTML exported");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [compareReportData, sceneName]);
  const handleCopySummary = useCallback(async () => {
    const summary = [
      `Scenario A: ${snapshotA?.label ?? "Baseline"}`,
      `Scenario B: ${snapshotB?.label ?? "Proposed Fix"}`,
      `Coverage delta: ${mA && mB ? formatDelta(mB.covered - mA.covered) : "--"}`,
      `Recognition delta: ${mA && mB ? formatDelta(mB.recognition - mA.recognition) : "--"}`,
      `Blindspot delta: ${mA && mB ? formatDelta(mB.blindspot - mA.blindspot) : "--"}`,
      `Critical zones: ${mA && mB ? formatDelta(mB.critZonePct - mA.critZonePct) : "--"}`,
      `Path visibility: ${mA && mB ? formatDelta(mB.visiblePathPct - mA.visiblePathPct) : "--"}`,
    ].join("\n");
    await navigator.clipboard.writeText(summary);
    setExportToast("Summary copied");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [mA, mB, snapshotA, snapshotB]);
  const handleCopyCompareLink = useCallback(async () => {
    if (!snapshotA || !snapshotB) return;
    const link = buildCompareShareLink(
      window.location.origin + window.location.pathname,
      window.location.search,
      {
        compareSnapshotAId: snapshotA.id,
        compareSnapshotBId: snapshotB.id,
        compareMode: "beforeafter",
      },
      window.location.hash,
    );
    await navigator.clipboard.writeText(link);
    setExportToast("Compare link copied");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [snapshotA, snapshotB]);
  const handleShareCompareLink = useCallback(async () => {
    if (!snapshotA || !snapshotB) return;
    const link = buildCompareShareLink(
      window.location.origin + window.location.pathname,
      window.location.search,
      {
        compareSnapshotAId: snapshotA.id,
        compareSnapshotBId: snapshotB.id,
        compareMode: "beforeafter",
        compareProvenanceNote: compareReportSelection?.provenanceNote ?? null,
      },
      window.location.hash,
    );
    const status = await shareLinkOrCopy({
      title: "SentinelTwin compare handoff",
      text: `Open ${snapshotA.label} vs ${snapshotB.label} in SentinelTwin compare view.`,
      url: link,
    });
    setExportToast(status === "shared" ? "Compare link shared" : status === "copied" ? "Compare link copied" : "Compare link unavailable");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [compareReportSelection?.provenanceNote, snapshotA, snapshotB]);

  const handleCaptureVisualEvidence = useCallback(() => {
    if (!snapshotA || !snapshotB) return;
    const canvasA = panelARef.current?.querySelector("canvas");
    const canvasB = panelBRef.current?.querySelector("canvas");
    if (!(canvasA instanceof HTMLCanvasElement) || !(canvasB instanceof HTMLCanvasElement)) {
      setExportToast("Could not capture compare canvases");
      window.setTimeout(() => setExportToast(null), 2500);
      return;
    }
    const beforeImageDataUrl = canvasA.toDataURL("image/png");
    const afterImageDataUrl = canvasB.toDataURL("image/png");
    setCompareVisualEvidence({
      snapshotAId: snapshotA.id,
      snapshotBId: snapshotB.id,
      beforeImageDataUrl,
      afterImageDataUrl,
      capturedAt: Date.now(),
    });
    setExportToast("Visual evidence captured for report export");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [setCompareVisualEvidence, snapshotA, snapshotB]);
  const handleOrbitChange = useCallback(
    (state: { position: [number, number, number]; target: [number, number, number] }) => {
      setCompareOrbitCameraState(state);
    },
    [setCompareOrbitCameraState],
  );

  const handleToggleOrbitSync = useCallback(() => {
    setCompareOrbitSync(!compareOrbitSync);
  }, [compareOrbitSync, setCompareOrbitSync]);

  const handleOpenReplay = useCallback(() => {
    setBottomTab("timeline");
    setViewMode("replay");
    setExportToast("Opened replay view");
    window.setTimeout(() => setExportToast(null), 2500);
  }, [setBottomTab, setViewMode]);

  useEffect(() => {
    if (!snapshotA || !snapshotB) return;
    const timer = window.setTimeout(() => {
      const canvasA = panelARef.current?.querySelector("canvas");
      const canvasB = panelBRef.current?.querySelector("canvas");
      if (!(canvasA instanceof HTMLCanvasElement) || !(canvasB instanceof HTMLCanvasElement)) return;
      const beforeImageDataUrl = canvasA.toDataURL("image/png");
      const afterImageDataUrl = canvasB.toDataURL("image/png");
      setCompareVisualEvidence({
        snapshotAId: snapshotA.id,
        snapshotBId: snapshotB.id,
        beforeImageDataUrl,
        afterImageDataUrl,
        capturedAt: Date.now(),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [setCompareVisualEvidence, snapshotA, snapshotB, cellsA, cellsB]);

  useEffect(() => {
    if (!demoMode || demoStep < 5) return;
    if (snapshots.length < 2) return;
    if (comparisonAId && comparisonBId) return;
    const baselineSnap = snapshots.find((s) => s.label === "Baseline") ?? snapshots[0];
    const proposedSnap = snapshots[snapshots.length - 1];
    if (!baselineSnap || !proposedSnap || baselineSnap.id === proposedSnap.id) return;
    startTransition(() => {
      setComparisonAId(baselineSnap.id);
      setComparisonBId(proposedSnap.id);
    });
  }, [demoMode, demoStep, snapshots, comparisonAId, comparisonBId]);

  const prioritizedActions = useMemo(() => {
    const actions: string[] = [];
    if (mA && mB) {
      if (mB.blindspot > mA.blindspot) {
        actions.push("Blindspot increased — run obstruction and angle review first.");
      }
      if (mB.visiblePathPct < mA.visiblePathPct) {
        actions.push("Path visibility regressed — open 3D replay and inspect lost segments.");
      }
      if (mB.critZonePct < mA.critZonePct) {
        actions.push("Critical-zone pass rate dropped — prioritize failing zones in camera comparison.");
      }
      if (mB.covered > mA.covered && mB.recognition > mA.recognition) {
        actions.push("Coverage and recognition improved — capture visual evidence and export compare report.");
      }
    }

    const topIssue = snapshotB?.simulation?.issues?.[0];
    if (topIssue?.description) {
      actions.push(`Top issue in Scenario B: ${topIssue.description}`);
    }

    if (actions.length === 0) {
      actions.push("No critical regressions detected — validate with report export and evidence bundle.");
    }

    return actions.slice(0, 3);
  }, [mA, mB, snapshotB?.simulation?.issues]);

  if (snapshots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#07090d]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-[#1f2536]">
          <GitCompare className="h-6 w-6 text-[#2a3246]" />
        </div>
        <div className="text-center">
          <div className="text-[12px] font-medium text-[#4a5568]">No snapshots to compare</div>
          <div className="mt-1 text-[10px] text-[#3a4158]">Save snapshots from the map view to compare scenarios.</div>
        </div>
      </div>
    );
  }

  const comparisonCards = [
    { label: "Overall Coverage", beforeValue: mA?.covered ?? null, afterValue: mB?.covered ?? null, delta: mA && mB ? mB.covered - mA.covered : null, tone: "#9ae6b4" },
    { label: "Recognition", beforeValue: mA?.recognition ?? null, afterValue: mB?.recognition ?? null, delta: mA && mB ? mB.recognition - mA.recognition : null, tone: "#93c5fd" },
    { label: "Blindspot", beforeValue: mA?.blindspot ?? null, afterValue: mB?.blindspot ?? null, delta: mA && mB ? mB.blindspot - mA.blindspot : null, tone: "#fca5a5" },
    { label: "Critical Zones", beforeValue: mA?.critZonePct ?? null, afterValue: mB?.critZonePct ?? null, delta: mA && mB ? mB.critZonePct - mA.critZonePct : null, tone: "#fdba74" },
    { label: "Path Visibility", beforeValue: mA?.visiblePathPct ?? null, afterValue: mB?.visiblePathPct ?? null, delta: mA && mB ? mB.visiblePathPct - mA.visiblePathPct : null, tone: "#c4b5fd" },
  ] as const;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07090d]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1e2130] bg-[#0c0f16] px-3 py-2">
        <div className="flex min-w-[260px] items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#65718a]">Compare - Before / After</span>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300">
            {snapshotA?.label ?? "Scenario A"}
          </div>
          <ArrowLeftRight className="h-3 w-3 text-[#556076]" />
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
            {snapshotB?.label ?? "Scenario B"}
          </div>
        </div>
        <ToolbarButton
          onClick={handleToggleOrbitSync}
          className={cn(
            compareOrbitSync
              ? "border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              : "border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white",
          )}
        >
          {compareOrbitSync
            ? <Lock className="h-3 w-3" />
            : <Unlock className="h-3 w-3" />
          }
          <span>Synchronize View</span>
          <span className={cn(
            "ml-0.5 rounded px-1 py-0.5 text-[10px] uppercase tracking-[0.1em]",
            compareOrbitSync
              ? "bg-sky-500/15 text-sky-300"
              : "bg-[#1d2330] text-[#556076]",
          )}>
            {compareOrbitSync ? "Synced" : "Independent"}
          </span>
        </ToolbarButton>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {exportToast ? (
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">
              {exportToast}
            </span>
          ) : null}
          <ToolbarGroup label="Primary">
            <ToolbarButton
              onClick={handleShareCompareLink}
              disabled={!snapshotA || !snapshotB}
              className="border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15"
            >
              <Share2 className="h-3 w-3" />
              Share compare link
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                if (!snapshotA || !snapshotB) return;
                setCompareReportSelection({
                  snapshotAId: snapshotA.id,
                  snapshotBId: snapshotB.id,
                  provenanceNote: compareSelectionProvenanceNote,
                });
                setBottomTab("report");
                setExportToast("Compare selection sent to report");
                window.setTimeout(() => setExportToast(null), 2500);
              }}
              className="border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            >
              Export Compare Report
            </ToolbarButton>
            <ToolbarButton
              onClick={handleCaptureVisualEvidence}
              className="border-[#24283a] bg-[#111521] text-[#b8c3d9] hover:text-white"
            >
              Capture Visual Evidence
            </ToolbarButton>
            <ToolbarButton
              onClick={() => saveSnapshot(`Scenario ${snapshots.length + 1}`)}
              className="border-[#24283a] bg-[#111521] text-[#b8c3d9] hover:text-white"
            >
              <Plus className="h-3 w-3" />
              Add Scenario
            </ToolbarButton>
          </ToolbarGroup>
          <ToolbarGroup label="Handoff">
            <ToolbarButton
              onClick={handleCopySummary}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              Copy Summary
            </ToolbarButton>
            <ToolbarButton
              onClick={handleCopyCompareLink}
              disabled={!snapshotA || !snapshotB}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              Copy compare link
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExportComparison}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              Export Compare Data
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExportEvidenceBundle}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              <Database className="h-3 w-3" />
              Evidence Bundle
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExportMarkdown}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              <Globe className="h-3 w-3" />
              Export MD
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExportHtml}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              <Globe className="h-3 w-3" />
              Export HTML
            </ToolbarButton>
            <ToolbarButton
              onClick={handleOpenReplay}
              className="border-[#24283a] bg-[#111521] text-[#8090a8] hover:text-white"
            >
              Open 3D Replay
            </ToolbarButton>
          </ToolbarGroup>
        </div>
      </div>
      <div className="border-b border-[#1e2130] px-3 py-1.5 text-[10px] text-[#74809a]">
        {compareSelectionProvenanceNote ? (
          <span>Compare provenance: {compareSelectionProvenanceNote}</span>
        ) : (
          <span>Scene Intelligence can seed exact/derived checkpoint provenance before this view is exported.</span>
        )}
      </div>
      {(outcomeA || outcomeB) ? (
        <div className="border-b border-[#1e2130] px-3 py-1.5 text-[10px] text-[#8ea0bf]">
          <span>
            Scenario A outcome: {outcomeA?.summary.status.replace(/_/g, " ") ?? "not_run"}
            {outcomeA?.summary.primaryRisk ? ` · risk: ${outcomeA.summary.primaryRisk}` : ""}
          </span>
          <span className="mx-2 text-[#556076]">|</span>
          <span>
            Scenario B outcome: {outcomeB?.summary.status.replace(/_/g, " ") ?? "not_run"}
            {outcomeB?.summary.primaryRisk ? ` · risk: ${outcomeB.summary.primaryRisk}` : ""}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 border-b border-[#1e2130] bg-[#0a0d14] px-3 py-2">
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[56px] text-[#9aa6bf]">Scenario A</span>
          <select
            value={validComparisonAId ?? ""}
            onChange={(event) => setComparisonAId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
          >
            <option value="" disabled>
              Select snapshot
            </option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[56px] text-[#d2f5db]">Scenario B</span>
          <select
            value={validComparisonBId ?? ""}
            onChange={(event) => setComparisonBId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
          >
            <option value="" disabled>
              Select snapshot
            </option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {snapshotBSimulationMissing ? (
        <div className="mx-2 mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-300">
          <div className="flex items-center justify-between gap-2">
            <span>Scenario B has no saved simulation result yet. Run simulation before trusting before/after deltas.</span>
            {latestSimulatedSnapshot ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!snapshotB) return;
                    const ok = simulateSnapshot(snapshotB.id);
                    if (!ok) return;
                    setExportToast("Scenario B simulated");
                    window.setTimeout(() => setExportToast(null), 2500);
                  }}
                  className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                >
                  Simulate Scenario B Now
                </button>
                <button
                  type="button"
                  onClick={() => setComparisonBId(latestSimulatedSnapshot.id)}
                  className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:bg-amber-500/20"
                >
                  Use Latest Simulated
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid flex-1 min-h-0 grid-cols-2 gap-2 p-2">
        <div ref={panelARef} className="min-h-0">
          {snapshotA ? (
            <ScenePanel
              label={`Scenario A — ${snapshotA.label ?? "Baseline"}`}
              accent="baseline"
              scene={snapshotA.scene}
              coverageCells={cellsA}
              orbitSync={compareOrbitSync}
              orbitCameraState={compareOrbitCameraState}
              onOrbitChange={handleOrbitChange}
            />
          ) : (
            <SnapshotPlaceholder
              title="Select Scenario A"
              description="Choose the baseline snapshot you want to compare against. Until then, this side stays empty on purpose."
            />
          )}
        </div>
        <div ref={panelBRef} className="min-h-0">
          {snapshotB ? (
            <ScenePanel
              label={`Scenario B — ${snapshotB.label ?? "Proposed Fix"}`}
              accent="proposed"
              scene={snapshotB.scene}
              coverageCells={cellsB}
              orbitSync={compareOrbitSync}
              orbitCameraState={compareOrbitCameraState}
              onOrbitChange={handleOrbitChange}
            />
          ) : (
            <SnapshotPlaceholder
              title="Select Scenario B"
              description="Choose the proposed or after snapshot to compare. This avoids silently defaulting to the newest save."
            />
          )}
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">
          {comparisonCards.map((card) => (
            <MetricCard
              key={card.label}
              label={card.label}
              beforeValue={card.beforeValue}
              afterValue={card.afterValue}
              delta={card.delta}
              tone={card.tone}
            />
          ))}
        </div>
        {snapshotA && snapshotB ? (
          <div className="mt-2 rounded-xl border border-[#1d2330] bg-[#0b1018] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">What Changed</div>
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">
                Verified by simulation
              </span>
            </div>
            <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
              {comparisonCards.filter((card) => card.delta != null && card.delta !== 0).map((card) => (
                <div key={card.label} className="flex items-center justify-between rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-1.5 text-[10px] text-[#b7c5de]">
                  <span className="text-[#7a86a0]">{card.label}</span>
                  <span className="font-semibold" style={{ color: card.tone }}>
                    {card.beforeValue != null ? `${Math.round(card.beforeValue)}%` : "—"} → {card.afterValue != null ? `${Math.round(card.afterValue)}%` : "—"}
                    <span className="ml-1 text-[#556076]">({card.delta != null ? `${card.delta >= 0 ? "+" : ""}${Math.round(card.delta)}%` : "—"})</span>
                  </span>
                </div>
              ))}
              {comparisonCards.every((card) => card.delta == null || card.delta === 0) ? (
                <div className="col-span-2 rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-1.5 text-[10px] text-[#556076]">
                  No measurable changes between scenarios. Run simulation on both sides to surface deltas.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-2 rounded-xl border border-[#1d2330] bg-[#0b1018] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Actionable Next Move</div>
          <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
            {prioritizedActions.map((action, i) => (
              <div key={action} className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2 py-1.5 text-[10px] text-[#b7c5de]">
                <span className="mr-1 text-[#7dd3fc]">{i + 1}.</span>
                {action}
              </div>
            ))}
          </div>
          {snapshotB ? (
            <button
              type="button"
              onClick={() => {
                const changedCards = comparisonCards.filter(c => c.delta != null && c.delta !== 0);
                const summary = `Apply Scenario B: ${snapshotB.label ?? "Proposed Fix"}\n${changedCards.map(c => `${c.label}: ${c.beforeValue != null ? `${Math.round(c.beforeValue)}%` : "—"} → ${c.afterValue != null ? `${Math.round(c.afterValue)}%` : "—"} (${c.delta != null ? `${c.delta >= 0 ? "+" : ""}${Math.round(c.delta)}%` : "—"})`).join("\n")}`;
                navigator.clipboard.writeText(summary);
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
            >
              Apply Scenario B to Current Scene
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Camera Comparison</div>
              <div className="text-[10px] text-[#556076]">Compare two cameras from the current scene using live simulation results.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#556076]">
              <label className="flex items-center gap-1.5 rounded-md border border-[#1d2330] bg-[#090d14] px-2 py-1">
                <span className="text-[#9aa6bf]">Camera A</span>
                <select
                  value={validCameraAId ?? ""}
                  onChange={(event) => setCameraComparisonAId(event.target.value)}
                  className="rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
                >
                  <option value="">Select camera</option>
                  {scene.cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 rounded-md border border-[#1d2330] bg-[#090d14] px-2 py-1">
                <span className="text-[#d2f5db]">Camera B</span>
                <select
                  value={validCameraBId ?? ""}
                  onChange={(event) => setCameraComparisonBId(event.target.value)}
                  className="rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
                >
                  <option value="">Select camera</option>
                  {scene.cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!cameraA || !cameraB || !cameraResultA || !cameraResultB || !cameraDeltas ? (
            <div className="rounded-lg border border-dashed border-[#1d2330] bg-[#090d14] px-3 py-4 text-[10px] text-[#556076]">
              Select two cameras and run simulation to compare their coverage, zone performance, and DORI reach side by side.
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {[
                { camera: cameraA, result: cameraResultA, dori: cameraDeltas.doriA, tone: "baseline" as const },
                { camera: cameraB, result: cameraResultB, dori: cameraDeltas.doriB, tone: "proposed" as const },
              ].map(({ camera, result, dori, tone }) => (
                <div key={camera.id} className="rounded-lg border border-[#1d2330] bg-[#090d14] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", tone === "baseline" ? "text-red-300" : "text-emerald-300")}>
                        {tone === "baseline" ? "Camera A" : "Camera B"}
                      </div>
                      <div className="text-[12px] font-semibold text-[#dfe7f7]">{camera.name}</div>
                      <div className="text-[10px] text-[#556076]">{camera.mountType} mount · {camera.fovHorizontalDeg}° FOV · {camera.rangeM}m range</div>
                    </div>
                    <div className={cn("rounded-md border px-2 py-1 text-right", tone === "baseline" ? "border-red-500/20 bg-red-500/10" : "border-emerald-500/20 bg-emerald-500/10")}>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#8da0bf]">Coverage</div>
                      <div className={cn("font-mono text-[15px] font-semibold", tone === "baseline" ? "text-red-300" : "text-emerald-300")}>
                        {result.coveragePct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded border border-[#1d2330] bg-[#0b1018] px-2 py-1.5">
                      <div className="text-[#556076]">Best zone quality</div>
                      <div className={cn("mt-0.5 font-semibold", tone === "baseline" ? "text-red-300" : "text-emerald-300")}>
                        {Object.values(result.qualityByZone).reduce((best, quality) => (
                          QUALITY_RANK[quality as keyof typeof QUALITY_RANK] > QUALITY_RANK[best as keyof typeof QUALITY_RANK] ? quality : best
                        ), "none" as keyof typeof QUALITY_RANK)}
                      </div>
                    </div>
                    <div className="rounded border border-[#1d2330] bg-[#0b1018] px-2 py-1.5">
                      <div className="text-[#556076]">Critical zones failed</div>
                      <div className="mt-0.5 font-semibold text-rose-300">{result.criticalZonesFailed.length}</div>
                    </div>
                    <div className="rounded border border-[#1d2330] bg-[#0b1018] px-2 py-1.5">
                      <div className="text-[#556076]">Critical zones passed</div>
                      <div className="mt-0.5 font-semibold text-emerald-300">{result.criticalZonesCovered.length}</div>
                    </div>
                    <div className="rounded border border-[#1d2330] bg-[#0b1018] px-2 py-1.5">
                      <div className="text-[#556076]">Detection range</div>
                      <div className={"mt-0.5 font-mono font-semibold " + QUALITY_TEXT_COLOR.detection}>{dori.detection.toFixed(1)}m</div>
                    </div>
                  </div>

                  <div className="mt-2 rounded border border-[#1d2330] bg-[#0b1018] px-2 py-1.5 text-[10px] text-[#9aa6bf]">
                    {result.offlineImpact.length > 0 ? result.offlineImpact[0] : "No offline impact warnings for this camera."}
                  </div>
                </div>
              ))}
              <div className="lg:col-span-2 rounded-lg border border-[#1d2330] bg-[#090d14] px-3 py-2 text-[10px] text-[#91a0bc]">
                Camera delta: coverage {cameraDeltas.coverage >= 0 ? "+" : ""}{cameraDeltas.coverage.toFixed(1)}%, passed zones {cameraDeltas.passedZones >= 0 ? "+" : ""}{cameraDeltas.passedZones}, failed zones {cameraDeltas.failedZones >= 0 ? "+" : ""}{cameraDeltas.failedZones}.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid min-h-[220px] grid-cols-[1.1fr_1.2fr_1fr] gap-2 px-2 pb-2">
        <NotesPanel snapshotA={snapshotA} snapshotB={snapshotB} />
        <QualityTrend snapshotA={snapshotA} snapshotB={snapshotB} activePathId={activePathId} />
        <ChangedObjectsPanel snapshotA={snapshotA} snapshotB={snapshotB} />
      </div>
    </div>
  );
}
