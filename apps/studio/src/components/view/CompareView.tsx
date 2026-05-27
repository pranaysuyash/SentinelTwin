"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ArrowLeftRight, GitCompare, Plus, AlertTriangle, Sparkles } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import { qualityToScore } from "@/simulation/dori";
import "@/lib/three-compat";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  CoverageHeatmapInstanced,
} from "@/components/workspace/SharedScene";
import { cn } from "@/lib/cn";
import { QUALITY_RANK } from "@/lib/quality-display";
import type { SceneSnapshot, SimulationResult } from "@/schema/security-scene";

type CoverageCell = SimulationResult["coverageCells"][number];

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

function pickPrimaryPathResult(snapshot: SceneSnapshot | null) {
  const simulation = snapshot?.simulation;
  if (!simulation) return null;
  const authoredPaths = snapshot.scene.paths.map((path) => path.id);

  for (const pathId of authoredPaths) {
    const match = simulation.pathResults.find((entry) => entry.pathId === pathId);
    if (match) return match;
  }

  return simulation.pathResults[0] ?? null;
}

function buildTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
}

function ScenePanel({
  label,
  accent,
  coverageCells,
}: {
  label: string;
  accent: "baseline" | "proposed";
  coverageCells: CoverageCell[];
}) {
  const scene = useStudioStore((s) => s.scene);
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
          gl={{ antialias: true, alpha: false }}
          className="absolute inset-0"
          style={{ background: theme.background }}
        >
          <color attach="background" args={[theme.background as THREE.ColorRepresentation]} />
          <ambientLight intensity={theme.ambient} />
          <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={theme.hemisphere} />
          <directionalLight position={[10, 14, 8]} intensity={theme.directional} color="#eef4ff" castShadow />
          <Suspense fallback={null}>
            <SceneLighting theme={theme} />
            <SceneFloor width={width} depth={depth} showGrid={false} />
            <SceneWalls walls={scene.walls} />
            <SceneDoors doors={scene.doors} />
            <SceneWindows windows={scene.windows} />
            <SceneObstructions obstructions={scene.obstructions} selectedId={null} />
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
    <div className="flex min-w-[140px] flex-1 flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] px-3 py-2">
      <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="font-mono text-[16px] font-semibold text-white">{afterValue == null ? "--" : `${afterValue.toFixed(1)}${suffix}`}</div>
        {delta != null ? (
          <div className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", positive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            {formatDelta(delta)}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between text-[8px] text-[#556076]">
        <span>{beforeValue == null ? "Baseline unavailable" : `Was ${beforeValue.toFixed(1)}${suffix}`}</span>
        <span style={{ color: tone }} />
      </div>
    </div>
  );
}

function QualityTrend({ snapshotA, snapshotB }: { snapshotA: SceneSnapshot | null; snapshotB: SceneSnapshot | null; }) {
  const resultA = pickPrimaryPathResult(snapshotA);
  const resultB = pickPrimaryPathResult(snapshotB);
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
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Quality Over Time</div>
          <div className="text-[9px] text-[#556076]">Best camera quality along the active replay path</div>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1 text-[#9aa6bf]"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Baseline</span>
          <span className="flex items-center gap-1 text-[#9aa6bf]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Proposed</span>
        </div>
      </div>
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
        <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-[#91a0bc]">
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
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Changes in Scenario B</div>
          <div className="text-[9px] text-[#556076]">What changed, what failed, and what got better.</div>
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
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Issues</div>
          <div className="mt-1 space-y-1">
            {(issues.length ? issues : [{ severity: "low", description: "No issues reported", category: "blindspot" }]).slice(0, 4).map((issue, index) => (
              <div key={`${issue.description}-${index}`} className="flex items-start gap-2 text-[9px] text-[#c7d0e4]">
                <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", issue.severity === "critical" ? "bg-red-400" : issue.severity === "high" ? "bg-orange-400" : issue.severity === "medium" ? "bg-yellow-400" : "bg-emerald-400")} />
                <span className="leading-snug">{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#1d2330] bg-[#090d14] p-2">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Recommended next steps</div>
          <div className="mt-1 space-y-1">
            {(recommendations.length ? recommendations : [{ description: "Open report lite for the full hardening summary." }]).slice(0, 4).map((rec, index) => (
              <div key={`${rec.description}-${index}`} className="flex items-start gap-2 text-[9px] text-[#c7d0e4]">
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

export function CompareView() {
  const snapshots = useStudioStore((s) => s.snapshots);
  const result = useStudioStore((s) => s.simulationResult);
  const saveSnapshot = useStudioStore((s) => s.saveSnapshot);
  const [comparisonAId, setComparisonAId] = useState<string | null>(null);
  const [comparisonBId, setComparisonBId] = useState<string | null>(null);

  useEffect(() => {
    if (snapshots.length === 0) return;
    const defaultA = snapshots[Math.max(snapshots.length - 2, 0)]?.id ?? null;
    const defaultB = snapshots[snapshots.length - 1]?.id ?? null;
    setComparisonAId((current) => (current && snapshots.some((snapshot) => snapshot.id === current) ? current : defaultA));
    setComparisonBId((current) => (current && snapshots.some((snapshot) => snapshot.id === current) ? current : defaultB));
  }, [snapshots]);

  const snapshotA = snapshots.find((snapshot) => snapshot.id === comparisonAId) ?? snapshots[Math.max(snapshots.length - 2, 0)] ?? snapshots[0] ?? null;
  const snapshotB = snapshots.find((snapshot) => snapshot.id === comparisonBId) ?? snapshots[snapshots.length - 1] ?? null;

  const cellsA = useMemo(() => snapshotA?.simulation?.coverageCells ?? [], [snapshotA]);
  const cellsB = useMemo(() => snapshotB?.simulation?.coverageCells ?? result?.coverageCells ?? [], [snapshotB, result]);

  const mA = useMemo(() => computeMetrics(snapshotA?.simulation, cellsA), [snapshotA, cellsA]);
  const mB = useMemo(() => computeMetrics(snapshotB?.simulation, cellsB), [snapshotB, cellsB]);

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
      <div className="flex items-center gap-2 border-b border-[#1e2130] bg-[#0c0f16] px-3 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">Compare Scenarios</span>
        <div className="flex items-center gap-1.5">
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-medium text-red-300">
            {snapshotA?.label ?? "Scenario A"}
          </div>
          <ArrowLeftRight className="h-3 w-3 text-[#556076]" />
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-300">
            {snapshotB?.label ?? "Scenario B"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => saveSnapshot(`Scenario ${snapshots.length + 1}`)}
          className="ml-auto flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[9px] text-[#8090a8] hover:text-white"
        >
          <Plus className="h-2.5 w-2.5" />
          Add Scenario
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[#1e2130] bg-[#0a0d14] px-3 py-2">
        <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[56px] text-[#9aa6bf]">Scenario A</span>
          <select
            value={snapshotA?.id ?? ""}
            onChange={(event) => setComparisonAId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none"
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[56px] text-[#d2f5db]">Scenario B</span>
          <select
            value={snapshotB?.id ?? ""}
            onChange={(event) => setComparisonBId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none"
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-2 gap-2 p-2">
        <ScenePanel label={`Scenario A — ${snapshotA?.label ?? "Baseline"}`} accent="baseline" coverageCells={cellsA} />
        <ScenePanel label={`Scenario B — ${snapshotB?.label ?? "Proposed Fix"}`} accent="proposed" coverageCells={cellsB} />
      </div>

      <div className="px-2 pb-2">
        <div className="grid grid-cols-5 gap-2">
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
      </div>

      <div className="grid min-h-[220px] grid-cols-[1.1fr_1.2fr_1fr] gap-2 px-2 pb-2">
        <NotesPanel snapshotA={snapshotA} snapshotB={snapshotB} />
        <QualityTrend snapshotA={snapshotA} snapshotB={snapshotB} />
        <div className="flex h-full flex-col rounded-xl border border-[#1d2330] bg-[#0b1018] p-3">
          <div className="mb-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7f8da8]">Scenario Notes</div>
            <div className="text-[9px] text-[#556076]">Short summary of the current comparison context.</div>
          </div>
          <div className="space-y-2 text-[9px] text-[#c7d0e4]">
            <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Baseline</div>
              <div className="mt-1 leading-snug">
                {snapshotA?.label ?? "Baseline"} shows the current coverage pattern and failing critical zone state.
              </div>
            </div>
            <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Proposed</div>
              <div className="mt-1 leading-snug">
                {snapshotB?.label ?? "Proposed Fix"} represents the edited scene and its recomputed security impact.
              </div>
            </div>
            <div className="rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Outcome</div>
              <div className="mt-1 leading-snug">
                Compare the coverage delta, path exposure, and critical zone pass/fail results before exporting a report.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
