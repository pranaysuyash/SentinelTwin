"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Play, RotateCcw, RotateCw, Move, BarChart3, GitCompare, FileText, Camera, Map, Columns2, Route, Shield, Play as PlayIcon, X, AlertTriangle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";
import type { Recommendation, CameraNode, ObstructionNode } from "@/schema/security-scene";

const DEMO_STEPS = [
  {
    id: "baseline",
    title: "Baseline Coverage",
    shortTitle: "Baseline",
    description: "Run the simulation to see the current security posture: coverage % across the retail shop, critical zone status, and detected issues.",
    icon: PlayIcon,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("coverage");
      s.setViewMode("map");
      s.setBottomTab("metrics");
      s.setDemoMode(true);
    },
    action: () => {
      const s = useStudioStore.getState();
      s.runSimulation();
    },
    actionLabel: "Run Baseline Simulation",
    requiresAction: true,
  },
  {
    id: "camera_wall",
    title: "Camera Wall",
    shortTitle: "Camera Wall",
    description: "See all five camera feeds in the multi-camera wall view. Each camera's coverage zone, quality, and status are displayed side by side.",
    icon: Columns2,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("camera_wall");
      s.setViewMode("wall");
      s.setBottomTab("metrics");
    },
  },
  {
    id: "path_replay",
    title: "Replay Path: Entry → Counter",
    shortTitle: "Replay",
    description: "Watch the 'Night Entry → Cash Counter' path replay. The actor moves through the shop — coverage quality along the path is shown in the timeline.",
    icon: Route,
    transition: () => {
      const s = useStudioStore.getState();
      s.setActivePathId("path_front_to_counter");
      s.setWorkspacePreset("replay");
      s.setViewMode("replay");
      s.setBottomTab("timeline");
    },
  },
  {
    id: "failure",
    title: "Identify Weak Zone",
    shortTitle: "Failure",
    description: "The cash counter zone has reduced coverage because the cupboard obstructs Camera 1's view. Open the Issues tab to see detected problems.",
    icon: AlertTriangle,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("coverage");
      s.setViewMode("map");
      s.setBottomTab("issues");
    },
  },
  {
    id: "apply_fix",
    title: "Apply Suggested Fix",
    shortTitle: "Fix",
    description: "Move the cupboard away from the cash counter zone, then re-run the simulation to verify the improvement.",
    icon: Move,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("coverage");
      s.setViewMode("map");
      s.setBottomTab("metrics");
    },
    actionLabel: "Move Cupboard & Rerun",
    requiresAction: true,
  },
  {
    id: "compare",
    title: "Before / After Comparison",
    shortTitle: "Compare",
    description: "Compare the baseline simulation against the fixed scene. Coverage delta, zone status changes, and path visibility improvements are shown.",
    icon: GitCompare,
    transition: () => {
      const s = useStudioStore.getState();
      const snapshots = s.snapshots;
      const baselineSnap = snapshots.find((snap) => snap.label === "Baseline") ?? snapshots[0] ?? null;
      const proposedSnap = snapshots[snapshots.length - 1] ?? null;
      if (baselineSnap && proposedSnap && baselineSnap.id !== proposedSnap.id) {
        s.snapshots; // trigger re-read
      }
      s.setWorkspacePreset("compare");
      s.setViewMode("compare");
      s.setBottomTab("beforeafter");
    },
  },
  {
    id: "report",
    title: "Generate Report",
    shortTitle: "Report",
    description: "Open the report view with the before/after comparison data, issues, and recommendations ready for export.",
    icon: FileText,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("report");
      s.setViewMode("report");
      s.setBottomTab("report");
    },
    actionLabel: "Finish Walkthrough",
    isLast: true,
  },
];

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function StepStatusIcon({ completed, current }: { completed: boolean; current: boolean }) {
  if (completed) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (current) return <Play className="h-3.5 w-3.5 text-cyan-400" />;
  return <div className="h-2 w-2 rounded-full bg-[#2a3246]" />;
}

function DemoMetricCard({ label, value, delta, accent }: { label: string; value: string; delta?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#1d2330] bg-[#0b1018] px-2.5 py-1.5">
      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#556076]">{label}</div>
      <div className={cn("mt-0.5 font-mono text-[13px] font-semibold", accent ?? "text-white")}>{value}</div>
      {delta ? <div className="mt-0.5 text-[8px] text-[#556076]">{delta}</div> : null}
    </div>
  );
}

function CoverageMetricsPanel({ className }: { className?: string }) {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const zoneResults = result?.criticalZoneResults ?? [];
  const counterZone = zoneResults.find((z) => z.zoneId === "zone_cash_counter");
  const issues = result?.issues ?? [];

  const criticalIssues = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const passCount = zoneResults.filter((z) => z.status === "pass").length;

  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      <DemoMetricCard label="Coverage" value={formatPct(result?.totalCoveragePct)} accent={result?.totalCoveragePct != null && result.totalCoveragePct >= 70 ? "text-emerald-300" : result?.totalCoveragePct != null && result.totalCoveragePct >= 50 ? "text-amber-300" : "text-red-300"} />
      <DemoMetricCard label="Zones Passed" value={`${passCount}/${zoneResults.length}`} />
      <DemoMetricCard label="Counter Zone" value={counterZone?.status === "pass" ? "Pass" : counterZone?.status === "partial" ? "Partial" : "Fail"} accent={counterZone?.status === "pass" ? "text-emerald-300" : "text-red-300"} />
      <DemoMetricCard label="Issues" value={`${criticalIssues.length} critical/high`} accent={criticalIssues.length > 0 ? "text-amber-300" : "text-emerald-300"} />
    </div>
  );
}

type DemoWalkthroughPanelProps = {
  onFinish: () => void;
};

export function DemoWalkthroughPanel({ onFinish }: DemoWalkthroughPanelProps) {
  const demoStep = useStudioStore((s) => s.demoStep);
  const setDemoStep = useStudioStore((s) => s.setDemoStep);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const scene = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const updateNode = useStudioStore((s) => s.updateNode);

  const [fixApplied, setFixApplied] = useState(false);
  const [lastActionStep, setLastActionStep] = useState<number | null>(null);

  const step = DEMO_STEPS[demoStep];
  const isFirst = demoStep === 0;
  const isLast = !!step?.isLast;
  const progress = ((demoStep + 1) / DEMO_STEPS.length) * 100;

  const stepCompleted = useMemo(() => {
    return lastActionStep != null && lastActionStep >= demoStep;
  }, [lastActionStep, demoStep]);

  const simulationComplete = !!simulationResult && !simulationDirty;
  const hasSnapshotToCompare = snapshots.length >= 2;

  const handleNext = useCallback(() => {
    if (isLast) {
      setDemoMode(false);
      setDemoStep(0);
      onFinish();
      return;
    }
    const nextIndex = demoStep + 1;
    setDemoStep(nextIndex);
    DEMO_STEPS[nextIndex]?.transition?.();
  }, [demoStep, isLast, onFinish, setDemoMode, setDemoStep]);

  const handlePrev = useCallback(() => {
    if (demoStep <= 0) return;
    const prevIndex = demoStep - 1;
    setDemoStep(prevIndex);
    DEMO_STEPS[prevIndex]?.transition?.();
  }, [demoStep, setDemoStep]);

  const handleSkip = useCallback(() => {
    setDemoMode(false);
    setDemoStep(0);
    onFinish();
  }, [onFinish, setDemoMode, setDemoStep]);

  const handleAction = useCallback(() => {
    if (demoStep === 0) {
      runSimulation();
      setLastActionStep(0);
      return;
    }

    if (demoStep === 4) {
      const moveCupboardAway = () => {
        const state = useStudioStore.getState();
        const obstruction = state.scene.obstructions.find((o) => o.id === "obs_cupboard_blocker") ?? null;
        if (!obstruction) return false;

        const originalPosition: [number, number, number] = [obstruction.position[0], obstruction.position[1], obstruction.position[2]];
        const newPosition: [number, number, number] = [3.2, obstruction.position[1], 2.4];

        state.commitSceneChange((scene) => {
          const next = structuredClone(scene) as typeof scene;
          const target = next.obstructions.find((o) => o.id === "obs_cupboard_blocker");
          if (target) {
            target.position = newPosition;
          }
          return next;
        }, "Walkthrough: Move cupboard away from cash counter zone");

        setFixApplied(true);
        return true;
      };

      const moved = moveCupboardAway();
      if (moved) {
        setTimeout(() => {
          runSimulation();
          setLastActionStep(4);
        }, 50);
      }
      return;
    }
  }, [demoStep, runSimulation]);

  const canAction = useMemo(() => {
    if (demoStep === 0) return !simulationRunning;
    if (demoStep === 4) return !fixApplied && !simulationRunning;
    return false;
  }, [demoStep, fixApplied, simulationRunning]);

  const Icon = step?.icon ?? Shield;
  const showRerunWarning = demoStep > 0 && simulationDirty && !fixApplied;
  const baselineComplete = lastActionStep != null && lastActionStep >= 0;
  const fixComplete = lastActionStep != null && lastActionStep >= 4;

  useEffect(() => {
    DEMO_STEPS[demoStep]?.transition?.();
  }, [demoStep]);

  return (
    <div         className="pointer-events-auto absolute inset-y-0 left-0 z-40 flex w-[340px] max-w-[90vw] flex-col border-r border-[#1e2130] bg-[#0b0f17]/95 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between border-b border-[#1e2130] px-3 py-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">Guided Walkthrough</span>
        </div>
        <button type="button"
          onClick={handleSkip}
          className="flex h-5 w-5 items-center justify-center rounded text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
          title="Exit walkthrough"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 space-y-1">
          {DEMO_STEPS.map((s, index) => {
            const isCurrent = index === demoStep;
            const isCompleted = lastActionStep != null && index <= lastActionStep;

            return (
              <button type="button"
                key={s.id}
                onClick={() => {
                  setDemoStep(index);
                  s.transition();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors",
                  isCurrent
                    ? "bg-cyan-500/10 text-cyan-100"
                    : isCompleted
                      ? "text-[#7a8aa8]"
                      : "text-[#5b667c] hover:bg-[#151b28]",
                )}
              >
                <StepStatusIcon completed={isCompleted} current={isCurrent} />
                <span className="min-w-0 truncate font-medium">{s.shortTitle}</span>
                {isCurrent && simulationDirty && index > 0 ? (
                  <span className="ml-auto shrink-0 rounded border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] text-amber-200">
                    Rerun
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#1f2536] bg-[#0d111a] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 mb-2">
            <Icon className="h-4 w-4 text-emerald-400" />
          </div>

          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">
            Step {demoStep + 1} of {DEMO_STEPS.length}
          </div>
          <h3 className="mt-1 text-[13px] font-semibold text-[#d7deed]">{step?.title}</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-[#8b96ab]">{step?.description}</p>

          {showRerunWarning ? (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                Simulation dirty
              </div>
              <div className="mt-0.5 text-amber-100/70">Scene has unapplied changes. Run simulation to refresh metrics.</div>
            </div>
          ) : null}

          {demoStep === 0 && baselineComplete ? (
            <div className="mt-3">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#4a5568]">Baseline metrics</div>
              <CoverageMetricsPanel />
            </div>
          ) : null}

          {demoStep === 4 && fixComplete ? (
            <div className="mt-3">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#4a5568]">After fix metrics</div>
              <CoverageMetricsPanel />
            </div>
          ) : null}

          {demoStep === 5 ? (
            <div className="mt-3">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#4a5568]">Comparison</div>
              <CoverageMetricsPanel />
              <div className="mt-2 rounded-lg border border-[#1d2330] bg-[#090d14] px-2.5 py-2 text-[10px] text-[#8b96ab]">
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
                  <Sparkles className="h-3 w-3" />
                  Snapshots saved
                </div>
                <div className="text-[9px]">
                  {'Before: "'}{snapshots[0]?.label ?? 'Baseline'}{'" \u2014 After: "'}{snapshots[snapshots.length - 1]?.label ?? 'Fixed'}{'"'}
                </div>
                <div className="mt-1 text-[9px] text-[#556076]">
                  Select snapshots A and B above to compare coverage, critical zones, and path quality.
                </div>
              </div>
            </div>
          ) : null}

          {demoStep === 6 ? (
            <div className="mt-3">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#4a5568]">Report</div>
              <CoverageMetricsPanel />
              <div className="mt-2 text-[9px] text-[#556076]">
                Issues and recommendations from the latest simulation are included in the report.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-2">
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#1a2333]">
          <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="flex h-7 items-center gap-1 rounded-lg border border-[#24283a] bg-[#111521] px-2 text-[9px] font-medium text-[#9da8c0] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>

          {step?.requiresAction ? (
            <button type="button"
              onClick={handleAction}
              disabled={!canAction}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60"
            >
              {(fixApplied && demoStep === 4) || (baselineComplete && demoStep === 0) ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {step.actionLabel}
            </button>
          ) : null}

          <button type="button"
            onClick={handleNext}
            disabled={step?.requiresAction && !stepCompleted}
            className="flex h-7 items-center gap-1 rounded-lg bg-cyan-600 px-3 text-[9px] font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/60"
          >
            {isLast ? "Finish" : "Next"}
            {!isLast ? <ArrowRight className="h-3 w-3" /> : null}
          </button>
        </div>

        {demoStep === 0 && baselineComplete ? (
          <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-500/8 px-2 py-1 text-center text-[8px] text-emerald-200">
            Baseline complete — proceed to Camera Wall
          </div>
        ) : null}

        {demoStep === 4 && fixComplete ? (
          <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-500/8 px-2 py-1 text-center text-[8px] text-emerald-200">
            Cupboard moved & simulation re-run — proceed to Compare
          </div>
        ) : null}
      </div>
    </div>
  );
}
