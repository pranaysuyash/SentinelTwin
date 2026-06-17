"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, Camera, Clock3, Crosshair, Layers, ShieldAlert, Sparkles, Compass, Clapperboard } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  buildSecurityAnalyticsModel,
  type AnalyticsKpi,
  type AnalyticsTone,
  type TemporalSeriesPoint,
} from "@/lib/security-analytics";
import { buildCoverageRegressionReport, type RegressionStatus } from "@/lib/coverage-regression";
import { buildCameraDriftReport, type DriftSeverity } from "@/lib/camera-drift";
import { buildFramingGradeReport, type FramingGrade } from "@/lib/framing-grade";
import { buildDirectorsCutSequence, type DirectorsCutGrade } from "@/lib/directors-cut";
import { buildObservedVsPlannedReport } from "@/lib/observed-vs-planned";
import { useStudioStore, type BottomTab, type ViewMode } from "@/store/studio-store";

const TONE_CARD_CLASSES: Record<AnalyticsTone, string> = {
  good: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
  warn: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  bad: "border-rose-400/30 bg-rose-500/10 text-rose-100",
  neutral: "border-[#28304a] bg-[#101627] text-[#c0cbe4]",
};

const DORI_BAND_COLORS: Record<string, string> = {
  identification: "#34d399",
  recognition: "#38bdf8",
  observation: "#fbbf24",
  detection: "#fb923c",
  blind: "#475067",
};

const REGRESSION_STATUS_CLASSES: Record<RegressionStatus, string> = {
  pass: "border-emerald-400/20 bg-emerald-500/8 text-emerald-100",
  warn: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  fail: "border-rose-400/25 bg-rose-500/10 text-rose-100",
};

const LIVE_HEALTH_STATUS_CLASSES: Record<"degraded" | "fault", string> = {
  degraded: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  fault: "border-rose-400/25 bg-rose-500/10 text-rose-100",
};

const DRIFT_SEVERITY_CLASSES: Record<DriftSeverity, string> = {
  minor: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  major: "border-rose-400/25 bg-rose-500/10 text-rose-100",
};

const FRAMING_GRADE_CLASSES: Record<FramingGrade, string> = {
  well_framed: "border-emerald-400/20 bg-emerald-500/8 text-emerald-100",
  edge_of_frame: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  foreshortened: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  out_of_frame: "border-rose-400/25 bg-rose-500/10 text-rose-100",
};

const FRAMING_GRADE_LABELS: Record<FramingGrade, string> = {
  well_framed: "well framed",
  edge_of_frame: "edge of frame",
  foreshortened: "foreshortened",
  out_of_frame: "out of frame",
};

const DIRECTORS_CUT_GRADE_LABELS: Record<DirectorsCutGrade, string> = {
  well_framed: "Well framed",
  edge_of_frame: "Edge of frame",
  foreshortened: "Foreshortened",
  out_of_frame: "Out of frame",
  no_coverage: "No coverage",
};

const DIRECTORS_CUT_GRADE_CLASSES: Record<DirectorsCutGrade, string> = {
  well_framed: "border-emerald-400/20 bg-emerald-500/8 text-emerald-100",
  edge_of_frame: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  foreshortened: "border-amber-400/20 bg-amber-500/8 text-amber-100",
  out_of_frame: "border-rose-400/25 bg-rose-500/10 text-rose-100",
  no_coverage: "border-rose-400/25 bg-rose-500/10 text-rose-100",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f43f5e",
  high: "#fb923c",
  medium: "#fbbf24",
  low: "#94a3b8",
};

function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  /** Technical/standard term shown as a smaller secondary label next to the plain-language title. */
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#1f2536] bg-[#0d1220]/80 p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a86a0]">
          {icon}
          <span>{title}</span>
          {subtitle ? <span className="font-normal tracking-normal text-[#3a4158]">({subtitle})</span> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Animates the numeric prefix of a KPI value (e.g. "81.9%") counting up from
 * zero on mount/change; non-numeric values render as-is.
 */
function AnimatedValue({ value }: { value: string }) {
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  const target = match ? Number(match[1]) : null;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const [display, setDisplay] = useState(target === null ? value : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const durationMs = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(target * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);

  if (target === null) return <>{value}</>;
  return <>{`${Number(display).toFixed(decimals)}${suffix}`}</>;
}

function KpiCard({ kpi, index, onDrill }: { kpi: AnalyticsKpi; index: number; onDrill: (kpi: AnalyticsKpi) => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onDrill(kpi)}
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2 text-left transition hover:brightness-125",
        TONE_CARD_CLASSES[kpi.tone],
      )}
      title={`Open ${kpi.label} detail`}
    >
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{kpi.label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold">
        <AnimatedValue value={kpi.value} />
      </div>
      <div className="truncate text-[10px] text-white/55">{kpi.detail}</div>
    </motion.button>
  );
}

/**
 * Interactive 24h coverage chart. Hover inspects a time slice; click scrubs the
 * canonical temporal store state so the 3D scene and 24H PROFILE tab follow.
 */
function TemporalCoverageChart({
  series,
  onScrub,
}: {
  series: TemporalSeriesPoint[];
  onScrub: (point: TemporalSeriesPoint) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 640;
  const height = 140;
  const padX = 28;
  const padY = 14;

  const points = useMemo(() => {
    if (series.length === 0) return [];
    return series.map((point, index) => {
      const x = padX + (index / Math.max(1, series.length - 1)) * (width - padX * 2);
      const y = padY + (1 - point.coveragePct / 100) * (height - padY * 2);
      return { x, y, point, index };
    });
  }, [series]);

  if (points.length === 0) return null;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height - padY} L${points[0].x.toFixed(1)},${height - padY} Z`;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        role="img"
        aria-label="Coverage percentage across 24 hours"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relX = ((event.clientX - rect.left) / rect.width) * width;
          const ratio = (relX - padX) / (width - padX * 2);
          const index = Math.round(ratio * (points.length - 1));
          setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
        }}
        onClick={() => {
          if (hoverIndex !== null) onScrub(points[hoverIndex].point);
        }}
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padY + (1 - tick / 100) * (height - padY * 2);
          return (
            <g key={tick}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#1d2435" strokeWidth={1} />
              <text x={2} y={y + 3} fontSize={8} className="fill-[#5b6780]">{tick}</text>
            </g>
          );
        })}
        {[0, 6, 12, 18, 23].map((hour) => {
          const index = series.findIndex((p) => p.hour === hour && p.minute === 0);
          if (index < 0) return null;
          const x = points[index].x;
          return (
            <text key={hour} x={x} y={height - 2} textAnchor="middle" fontSize={8} className="fill-[#5b6780]">
              {`${hour.toString().padStart(2, "0")}:00`}
            </text>
          );
        })}
        <motion.path
          d={areaPath}
          fill="#38bdf8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.8}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />
        {hovered ? (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padY} y2={height - padY} stroke="#7dd3fc" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r={3.5} fill="#7dd3fc" />
          </g>
        ) : null}
      </svg>
      {hovered ? (
        <div className="pointer-events-none absolute left-2 top-1 rounded-lg border border-[#28304a] bg-[#0b1020]/95 px-2 py-1 text-[10px] text-sky-100">
          <span className="font-semibold">
            {`${hovered.point.hour.toString().padStart(2, "0")}:${hovered.point.minute.toString().padStart(2, "0")}`}
          </span>
          {" · "}
          {hovered.point.coveragePct.toFixed(1)}% coverage · zones {hovered.point.zonePassRate.toFixed(0)}% · {hovered.point.stateLabel}
          <span className="ml-1 text-sky-300/70">(click to scrub scene)</span>
        </div>
      ) : null}
    </div>
  );
}

function DoriDistributionBar({ bands }: { bands: { band: string; label: string; pct: number }[] }) {
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-[#1f2536]">
        {bands.map((band) =>
          band.pct > 0 ? (
            <motion.div
              key={band.band}
              initial={{ width: 0 }}
              animate={{ width: `${band.pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{ backgroundColor: DORI_BAND_COLORS[band.band] }}
              title={`${band.label}: ${band.pct.toFixed(1)}%`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8b96b3]">
        {bands.map((band) => (
          <span key={band.band} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DORI_BAND_COLORS[band.band] }} />
            {band.label} {band.pct.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function CoverageTrendSparkline({
  points,
}: {
  points: { label: string; coveragePct: number; isCurrent: boolean }[];
}) {
  const width = 280;
  const height = 64;
  const pad = 8;
  if (points.length < 2) {
    return <div className="text-[11px] text-[#7a86a0]">Save snapshots to build a coverage trend across design iterations.</div>;
  }
  const min = Math.min(...points.map((p) => p.coveragePct));
  const max = Math.max(...points.map((p) => p.coveragePct));
  const span = Math.max(1, max - min);
  const coords = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (width - pad * 2),
    y: pad + (1 - (p.coveragePct - min) / span) * (height - pad * 2),
    p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Coverage trend across snapshots">
      <motion.path
        d={path}
        fill="none"
        stroke="#a78bfa"
        strokeWidth={1.6}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {coords.map((c) => (
        <circle key={`${c.p.label}-${c.x}`} cx={c.x} cy={c.y} r={c.p.isCurrent ? 3.5 : 2.2} fill={c.p.isCurrent ? "#c4b5fd" : "#7c6cb5"}>
          <title>{`${c.p.label}: ${c.p.coveragePct.toFixed(1)}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function AnalyticsDashboardView() {
  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const snapshots = useStudioStore((s) => s.snapshots);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);

  const runSimulation = useStudioStore((s) => s.runSimulation);
  const computeTemporalProfile = useStudioStore((s) => s.computeTemporalProfile);
  const setTemporalScrub = useStudioStore((s) => s.setTemporalScrub);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);

  const model = useMemo(
    () =>
      buildSecurityAnalyticsModel({
        scene,
        simulationResult,
        temporalProfile,
        evidenceEvents: operationalEvidenceEvents,
        snapshots,
      }),
    [scene, simulationResult, temporalProfile, operationalEvidenceEvents, snapshots],
  );

  const regressionReport = useMemo(() => {
    if (!simulationResult) return null;
    const simulatedSnapshots = snapshots
      .filter((snapshot) => snapshot.simulation)
      .sort((a, b) => b.createdAt - a.createdAt);
    const baselineSnapshot = simulatedSnapshots[0] ?? null;
    if (!baselineSnapshot) return null;
    return buildCoverageRegressionReport(simulationResult, baselineSnapshot.simulation!, {
      label: baselineSnapshot.label,
      timestamp: baselineSnapshot.createdAt,
    });
  }, [simulationResult, snapshots]);

  const cameraDriftReport = useMemo(() => {
    const simulatedSnapshots = snapshots
      .filter((snapshot) => snapshot.simulation)
      .sort((a, b) => b.createdAt - a.createdAt);
    const baselineSnapshot = simulatedSnapshots[0] ?? null;
    if (!baselineSnapshot) return null;
    return buildCameraDriftReport(scene.cameras, baselineSnapshot.scene.cameras, {
      label: baselineSnapshot.label,
      timestamp: baselineSnapshot.createdAt,
    });
  }, [scene.cameras, snapshots]);

  const observedVsPlannedReport = useMemo(
    () => buildObservedVsPlannedReport(cameraDriftReport, model.liveHealth),
    [cameraDriftReport, model.liveHealth],
  );

  const framingGradeReport = useMemo(() => {
    if (!simulationResult) return null;
    return buildFramingGradeReport(scene, simulationResult);
  }, [scene, simulationResult]);

  const directorsCut = useMemo(() => {
    if (!simulationResult?.adversarialPath) return null;
    return buildDirectorsCutSequence(scene, simulationResult.adversarialPath);
  }, [scene, simulationResult]);

  const drillKpi = (kpi: AnalyticsKpi) => {
    if (kpi.drillTarget.kind === "bottom_tab") {
      setBottomTab(kpi.drillTarget.tab as BottomTab);
    } else {
      setViewMode(kpi.drillTarget.mode as ViewMode);
    }
  };

  if (!model.hasSimulation) {
    return (
      <div className="flex h-full items-center justify-center bg-[#070b14] p-6">
        <div className="max-w-md rounded-2xl border border-[#1f2536] bg-[#0d1220] p-6 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-sky-300" />
          <div className="text-sm font-semibold text-[#dde2ef]">No simulation data yet</div>
          <p className="mt-1 text-[12px] text-[#8b96b3]">
            The analytics dashboard reads from the deterministic simulation result. Run the simulation to populate it.
          </p>
          <button
            type="button"
            disabled={simulationRunning}
            onClick={runSimulation}
            className="mt-4 rounded-lg border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-[12px] font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-50"
          >
            {simulationRunning ? "Simulating..." : "Run Simulation"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#070b14] px-4 pb-6 pt-[var(--st-full-canvas-safe-top,4rem)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#dde2ef]">Security Analytics</h1>
            <p className="text-[11px] text-[#7a86a0]">
              {model.sceneName} · Truth: Simulated · deterministic engine output
              {model.computedAt ? ` · computed ${new Date(model.computedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={simulationRunning}
            onClick={runSimulation}
            className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
          >
            {simulationRunning ? "Simulating..." : "Recompute"}
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {model.kpis.map((kpi, index) => (
            <KpiCard key={kpi.id} kpi={kpi} index={index} onDrill={drillKpi} />
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <SectionCard
            title="24h Coverage Profile"
            icon={<Clock3 className="h-3.5 w-3.5" />}
            action={
              model.temporal ? (
                <button
                  type="button"
                  onClick={() => setBottomTab("temporal")}
                  className="rounded border border-[#28304a] px-2 py-0.5 text-[10px] text-[#9fb1cf] hover:bg-white/5"
                >
                  Open 24h Profile
                </button>
              ) : null
            }
          >
            {model.temporal ? (
              <>
                <TemporalCoverageChart
                  series={model.temporal.series}
                  onScrub={(point) => {
                    setTemporalScrub(point.hour, point.minute);
                    setBottomTab("temporal");
                  }}
                />
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#8b96b3]">
                  {model.temporal.worstPoint ? (
                    <span>
                      Worst {model.temporal.worstPoint.coveragePct.toFixed(1)}% at{" "}
                      {`${model.temporal.worstPoint.hour.toString().padStart(2, "0")}:${model.temporal.worstPoint.minute.toString().padStart(2, "0")}`}
                    </span>
                  ) : null}
                  <span>
                    Windows: {model.temporal.vulnerabilityCounts.high} high · {model.temporal.vulnerabilityCounts.medium} medium ·{" "}
                    {model.temporal.vulnerabilityCounts.low} low
                  </span>
                  <span>{model.temporal.anomalyCount} anomalies</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 text-[11px] text-[#8b96b3]">
                <span>No 24h profile computed for this scene yet.</span>
                <button
                  type="button"
                  onClick={computeTemporalProfile}
                  className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/20"
                >
                  Compute 24h Profile
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="What can you actually see?" subtitle="DORI quality distribution" icon={<Layers className="h-3.5 w-3.5" />}>
            <DoriDistributionBar bands={model.doriDistribution} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Issue Severity</div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {model.issueBreakdown.map((entry) => {
                    const maxCount = Math.max(1, ...model.issueBreakdown.map((e) => e.count));
                    return (
                      <button
                        key={entry.severity}
                        type="button"
                        onClick={() => setBottomTab("issues")}
                        className="group flex items-center gap-2 text-left"
                        title={`Open issues tab (${entry.count} ${entry.severity})`}
                      >
                        <span className="w-14 text-[10px] capitalize text-[#8b96b3] group-hover:text-white">{entry.severity}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a2030]">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(entry.count / maxCount) * 100}%`, backgroundColor: SEVERITY_COLORS[entry.severity] }}
                          />
                        </span>
                        <span className="w-5 text-right text-[10px] text-[#c0cbe4]">{entry.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Blind Spots</div>
                {model.blindSpots ? (
                  <div className="mt-1.5 space-y-0.5 text-[11px] text-[#c0cbe4]">
                    <div>{model.blindSpots.regionCount} regions · {model.blindSpots.criticalRegionCount} critical</div>
                    <div>{model.blindSpots.totalBlindAreaSqM.toFixed(1)} m² blind total</div>
                    <div>Largest {model.blindSpots.largestRegionAreaSqM.toFixed(1)} m²</div>
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] text-[#7a86a0]">No blind-spot fingerprint in this run.</div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <SectionCard title="Camera Leaderboard" icon={<Camera className="h-3.5 w-3.5" />}>
            {model.cameraLeaderboard.length === 0 ? (
              <div className="text-[11px] text-[#7a86a0]">No cameras in the scene.</div>
            ) : (
              <ul className="flex flex-col gap-1">
                {model.cameraLeaderboard.map((camera) => (
                  <li key={camera.cameraId}>
                    <button
                      type="button"
                      onClick={() => {
                        selectNode(camera.cameraId);
                        setSelectedCameraId(camera.cameraId);
                        setViewMode("camera_view");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left transition hover:border-[#28304a] hover:bg-white/5"
                      title={`Open ${camera.name} in Camera View`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-[#dde2ef]">{camera.name}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#1a2030]">
                        <span className="block h-full rounded-full bg-sky-400" style={{ width: `${camera.coveragePct}%` }} />
                      </span>
                      <span className="w-12 text-right text-[10px] text-[#9fb1cf]">{camera.coveragePct.toFixed(1)}%</span>
                      {camera.zonesFailed > 0 ? (
                        <span className="rounded bg-rose-500/15 px-1 text-[9px] text-rose-200">{camera.zonesFailed} fail</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Occlusion Offenders" icon={<Crosshair className="h-3.5 w-3.5" />}>
            {model.occlusionOffenders.length === 0 ? (
              <div className="text-[11px] text-[#7a86a0]">No obstruction is currently degrading a critical zone.</div>
            ) : (
              <ul className="flex flex-col gap-1">
                {model.occlusionOffenders.map((offender) => (
                  <li key={offender.obstructionId}>
                    <button
                      type="button"
                      onClick={() => {
                        selectNode(offender.obstructionId);
                        setBottomTab("counterfactual");
                        setViewMode("map");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left transition hover:border-[#28304a] hover:bg-white/5"
                      title="Select obstruction and open counterfactual analysis"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-[#dde2ef]">{offender.label}</span>
                      <span className="text-[10px] text-[#9fb1cf]">
                        {offender.affectedZoneCount} zone{offender.affectedZoneCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-200">
                        blame {(offender.totalBlame * 100).toFixed(0)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {model.placementSuggestion ? (
              <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-[11px] text-emerald-100">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  <Sparkles className="h-3 w-3" /> Placement Oracle
                </div>
                <div className="mt-0.5">
                  Best new {model.placementSuggestion.mountType} camera adds{" "}
                  {model.placementSuggestion.estimatedCoverageDeltaPct >= 0 ? "+" : ""}
                  {model.placementSuggestion.estimatedCoverageDeltaPct.toFixed(1)}% coverage
                  {model.placementSuggestion.estimatedCriticalZoneGain > 0
                    ? ` and recovers ${model.placementSuggestion.estimatedCriticalZoneGain} zone${model.placementSuggestion.estimatedCriticalZoneGain === 1 ? "" : "s"}`
                    : ""}
                  .
                </div>
                <button
                  type="button"
                  onClick={() => setBottomTab("novel")}
                  className="mt-1 rounded border border-emerald-400/25 px-2 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-500/15"
                >
                  Open Novel Algorithms
                </button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Trend & Activity" icon={<Activity className="h-3.5 w-3.5" />}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Coverage Across Snapshots</div>
            <div className="mt-1">
              <CoverageTrendSparkline points={model.coverageTrend} />
            </div>
            {model.coverageTrend.length >= 2 ? (
              <button
                type="button"
                onClick={() => setBottomTab("beforeafter")}
                className="mt-1 rounded border border-[#28304a] px-2 py-0.5 text-[10px] text-[#9fb1cf] hover:bg-white/5"
              >
                Open Before / After
              </button>
            ) : null}
            <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Evidence Ledger</div>
            <div className="mt-1 text-[11px] text-[#c0cbe4]">
              {model.evidenceActivity.totalEvents} recorded event{model.evidenceActivity.totalEvents === 1 ? "" : "s"}
              {model.evidenceActivity.lastEventTitle ? ` · last: ${model.evidenceActivity.lastEventTitle}` : ""}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {model.evidenceActivity.countsByKind.map((entry) => (
                <span key={entry.kind} className="rounded bg-[#161d30] px-1.5 py-0.5 text-[9px] text-[#8b96b3]">
                  {entry.kind.replace(/_/g, " ")} × {entry.count}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setBottomTab("provenance")}
              className="mt-2 rounded border border-[#28304a] px-2 py-0.5 text-[10px] text-[#9fb1cf] hover:bg-white/5"
            >
              Open Scene Intelligence
            </button>
          </SectionCard>
        </div>

        {regressionReport ? (
          <SectionCard title="Coverage CI" icon={<Activity className="h-3.5 w-3.5" />}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">
              vs. baseline: {regressionReport.baselineLabel}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {regressionReport.checks.map((check) => (
                <div
                  key={check.id}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px]",
                    REGRESSION_STATUS_CLASSES[check.status],
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{check.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em]">{check.status}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {check.baselineValue} → {check.currentValue} ({check.deltaLabel})
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {observedVsPlannedReport.hasData ? (
          <SectionCard
            title="Observed vs Planned"
            subtitle="camera drift + live ops"
            icon={<Compass className="h-3.5 w-3.5" />}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">
                {observedVsPlannedReport.trackedSensors + observedVsPlannedReport.trackedCameras > 0
                  ? `${observedVsPlannedReport.trackedSensors} sensor${observedVsPlannedReport.trackedSensors === 1 ? "" : "s"} · ${observedVsPlannedReport.trackedCameras} camera${observedVsPlannedReport.trackedCameras === 1 ? "" : "s"} tracked`
                  : observedVsPlannedReport.baselineLabel
                    ? `vs. baseline: ${observedVsPlannedReport.baselineLabel}`
                    : "design-time diff"}
              </div>
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                  observedVsPlannedReport.summary.totalIssues === 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : observedVsPlannedReport.summary.majorDriftCount > 0 || observedVsPlannedReport.summary.faultCount > 0
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                )}
              >
                {observedVsPlannedReport.summary.statusLabel}
              </span>
            </div>
            {observedVsPlannedReport.driftEntries.length > 0 ? (
              <div className="mt-2">
                <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#4a5568]">
                  Design drift
                  {observedVsPlannedReport.baselineLabel
                    ? ` · vs. ${observedVsPlannedReport.baselineLabel}`
                    : ""}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {observedVsPlannedReport.driftEntries.map((entry) => (
                    <div
                      key={`${entry.cameraId}-${entry.kind}`}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px]",
                        DRIFT_SEVERITY_CLASSES[entry.severity],
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{entry.cameraName}</span>
                        <span className="text-[10px] uppercase tracking-[0.1em]">{entry.severity}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-80">{entry.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {observedVsPlannedReport.liveAlerts.length > 0 ? (
              <div className="mt-2">
                <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#4a5568]">Live faults</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {observedVsPlannedReport.liveAlerts.map((alert) => (
                    <div
                      key={alert.nodeId}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px]",
                        LIVE_HEALTH_STATUS_CLASSES[alert.status === "fault" ? "fault" : "degraded"],
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{alert.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.1em]">{alert.status}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-80">{alert.lastEventTitle}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {framingGradeReport && framingGradeReport.zonesNeedingAttention.length > 0 ? (
          <SectionCard title="Shot Quality" icon={<Clapperboard className="h-3.5 w-3.5" />}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">
              Framing of critical zones — beyond pixel density
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {framingGradeReport.entries
                .filter((entry) => entry.grade !== "well_framed")
                .map((entry) => (
                  <div
                    key={`${entry.zoneId}-${entry.cameraId}`}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px]",
                      FRAMING_GRADE_CLASSES[entry.grade],
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{entry.zoneLabel}</span>
                      <span className="text-[10px] uppercase tracking-[0.1em]">
                        {FRAMING_GRADE_LABELS[entry.grade]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-80">{entry.detail}</div>
                  </div>
                ))}
            </div>
          </SectionCard>
        ) : null}

        {directorsCut && directorsCut.segments.length > 0 ? (
          <SectionCard title="Director's Cut" icon={<Clapperboard className="h-3.5 w-3.5" />}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">
              Camera-cut sequence following the adversarial path
              {directorsCut.totalDurationS > 0
                ? ` · ${Math.round((directorsCut.noCoverageDurationS / directorsCut.totalDurationS) * 100)}% with no usable shot`
                : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {directorsCut.segments.map((segment, index) => (
                <div
                  key={`${segment.startTimeS}-${index}`}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px]",
                    DIRECTORS_CUT_GRADE_CLASSES[segment.grade],
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{segment.cameraName ?? "No camera"}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em]">
                      {DIRECTORS_CUT_GRADE_LABELS[segment.grade]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {segment.startTimeS.toFixed(1)}s – {segment.endTimeS.toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}


        <SectionCard title="Resilience" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">
                Failure tolerance <span className="text-[#3a4158]">(k-robustness)</span>
              </div>
              <div className="mt-0.5 text-base font-semibold text-[#dde2ef]">
                {model.resilience.kRobustness === null ? "—" : `K=${model.resilience.kRobustness}`}
              </div>
              <div className="text-[10px] text-[#8b96b3]">
                {model.resilience.isRobust === null
                  ? "Not computed"
                  : model.resilience.isRobust
                    ? "Coverage survives any single camera failure"
                    : "A single failure can break critical coverage"}
              </div>
            </div>
            <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Fragile Cells</div>
              <div className="mt-0.5 text-base font-semibold text-[#dde2ef]">
                {model.resilience.fragileCellPct === null ? "—" : `${model.resilience.fragileCellPct.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-[#8b96b3]">Cells within noise of dropping a DORI band</div>
            </div>
            <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Critical Failure Sets</div>
              <div className="mt-0.5 text-base font-semibold text-[#dde2ef]">{model.resilience.criticalSetCount}</div>
              <div className="text-[10px] text-[#8b96b3]">Camera combinations that break coverage</div>
            </div>
            <div className="rounded-xl border border-[#1f2536] bg-[#101627] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a86a0]">Cameras</div>
              <div className="mt-0.5 text-base font-semibold text-[#dde2ef]">{model.resilience.totalCameras}</div>
              <button
                type="button"
                onClick={() => setBottomTab("redundancy")}
                className="mt-0.5 rounded border border-[#28304a] px-2 py-0.5 text-[10px] text-[#9fb1cf] hover:bg-white/5"
              >
                Open Redundancy Matrix
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
