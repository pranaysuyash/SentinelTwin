"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Play, GitCompare, FileText, Columns2, Route, Shield, Play as PlayIcon, X, AlertTriangle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { UI_TONES } from "@/lib/design-tokens";
import { useStudioStore } from "@/store/studio-store";
import { cloneSecurityScene, type CameraNode, type SecurityScene } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const DEMO_STEPS = [
  {
    id: "problem",
    timestamp: "0:00",
    title: "Problem framing",
    shortTitle: "0:00 Problem",
    description: "CCTV placement creates false confidence. Coverage cones do not guarantee useful identification evidence in real incidents.",
    icon: AlertTriangle,
  },
  {
    id: "product_intro",
    timestamp: "0:20",
    title: "SentinelTwin framing",
    shortTitle: "0:20 Intro",
    description: "Introduce SentinelTwin as an AI-native physical security digital twin for deterministic coverage failure analysis and audit reporting.",
    icon: Shield,
  },
  {
    id: "dashboard",
    timestamp: "0:45",
    title: "Dashboard and current workspace",
    shortTitle: "0:45 Dashboard",
    description: "Show the deployed app command center and current Site Twin status before entering Studio.",
    icon: Shield,
  },
  {
    id: "studio_map",
    timestamp: "1:10",
    title: "Camera Studio map scene",
    shortTitle: "1:10 Studio",
    description: "Show map/scene geometry, camera placements, critical zones, obstructions, and heatmap-backed risk context.",
    icon: Route,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("coverage");
      s.setViewMode("map");
      s.setBottomTab("metrics");
      s.setDemoMode(true);
    },
  },
  {
    id: "simulation",
    timestamp: "1:45",
    title: "Run deterministic simulation",
    shortTitle: "1:45 Sim",
    description: "Run simulation and explain detection, observation, recognition, and identification quality outcomes.",
    icon: PlayIcon,
    actionLabel: "Run Simulation",
    requiresAction: true,
  },
  {
    id: "camera_replay_path",
    timestamp: "2:15",
    title: "Camera view, replay, path visibility",
    shortTitle: "2:15 Replay",
    description: "Open camera operations and path replay views to show per-camera perspective plus path-visibility timeline.",
    icon: Columns2,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("replay");
      s.setViewMode("replay");
      s.setBottomTab("timeline");
      s.setActivePathId("path_front_to_counter");
    },
  },
  {
    id: "failure_case",
    timestamp: "2:45",
    title: "Failure case under stress",
    shortTitle: "2:45 Failure",
    description: "Switch to night conditions and force one camera offline to surface a real failure case before remediation.",
    icon: AlertTriangle,
    actionLabel: "Apply Failure Case",
    requiresAction: true,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("coverage");
      s.setViewMode("map");
      s.setBottomTab("issues");
    },
  },
  {
    id: "compare_report",
    timestamp: "3:15",
    title: "Before/after compare and report",
    shortTitle: "3:15 Compare",
    description: "Show compare and report surfaces to communicate delta impact and exportable audit narrative.",
    icon: GitCompare,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("compare");
      s.setViewMode("compare");
      s.setBottomTab("beforeafter");
    },
  },
  {
    id: "judge_focus",
    timestamp: "3:45",
    title: "Judge focus callouts",
    shortTitle: "3:45 Focus",
    description: "Emphasize deterministic simulation logic, DORI-style scoring, SecurityScene schema integrity, counterfactual comparisons, temporal/profile/report/provenance surfaces.",
    icon: Sparkles,
    transition: () => {
      const s = useStudioStore.getState();
      s.setWorkspacePreset("report");
      s.setViewMode("report");
      s.setBottomTab("report");
    },
  },
  {
    id: "close",
    timestamp: "4:15",
    title: "Close",
    shortTitle: "4:15 Close",
    description: "Close with product thesis: SentinelTwin is not a cone viewer; it is a deterministic security audit workspace.",
    icon: FileText,
    actionLabel: "Finish Judge Demo",
    isLast: true,
  },
];

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function StepStatusIcon({ completed, current }: { completed: boolean; current: boolean }) {
  if (completed) return <CheckCircle2 className={cn("h-4 w-4", UI_TONES.success.text)} />;
  if (current) return <Play className={cn("h-3.5 w-3.5", UI_TONES.info.text)} />;
  return <div className="h-2 w-2 rounded-full ${UI_SURFACES.borderDark}" />;
}

function DemoMetricCard({ label, value, delta, accent }: { label: string; value: string; delta?: string; accent?: string }) {
  return (
    <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panel} px-2.5 py-1.5`}>
      <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>{label}</div>
      <div className={cn("mt-0.5 font-mono text-[13px] font-semibold", accent ?? "text-white")}>{value}</div>
      {delta ? <div className={`mt-0.5 text-[8px] ${UI_SURFACES.textDimMid}`}>{delta}</div> : null}
    </div>
  );
}

function CoverageMetricsPanel({ className }: { className?: string }) {
  const result = useStudioStore((s) => s.simulationResult);
  const _scene = useStudioStore((s) => s.scene);
  const zoneResults = result?.criticalZoneResults ?? [];
  const counterZone = zoneResults.find((z) => z.zoneId === "zone_cash_counter");
  const issues = result?.issues ?? [];

  const criticalIssues = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const passCount = zoneResults.filter((z) => z.status === "pass").length;
  const coverageTone = result?.totalCoveragePct != null && result.totalCoveragePct >= 70
    ? UI_TONES.success.text
    : result?.totalCoveragePct != null && result.totalCoveragePct >= 50
      ? UI_TONES.warning.text
      : UI_TONES.danger.text;
  const counterTone = counterZone?.status === "pass" ? UI_TONES.success.text : UI_TONES.danger.text;
  const issueTone = criticalIssues.length > 0 ? UI_TONES.warning.text : UI_TONES.success.text;

  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      <DemoMetricCard label="Coverage" value={formatPct(result?.totalCoveragePct)} accent={coverageTone} />
      <DemoMetricCard label="Zones Passed" value={`${passCount}/${zoneResults.length}`} />
      <DemoMetricCard label="Counter Zone" value={counterZone?.status === "pass" ? "Pass" : counterZone?.status === "partial" ? "Partial" : "Fail"} accent={counterTone} />
      <DemoMetricCard label="Issues" value={`${criticalIssues.length} critical/high`} accent={issueTone} />
    </div>
  );
}

type DemoFailureRecoveryState = {
  scene: SecurityScene;
  environmentMode: "day" | "night" | "dusk";
};

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
  const _scene = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const updateNode = useStudioStore((s) => s.updateNode);
  const setEnvironmentMode = useStudioStore((s) => s.setEnvironmentMode);
  const commitSceneChange = useStudioStore((s) => s.commitSceneChange);

  const [failureCaseApplied, setFailureCaseApplied] = useState(false);
  const [lastActionStep, setLastActionStep] = useState<number | null>(null);
  const failureRecoveryRef = useRef<DemoFailureRecoveryState | null>(null);

  const step = DEMO_STEPS[demoStep];
  const isFirst = demoStep === 0;
  const isLast = !!step?.isLast;
  const progress = ((demoStep + 1) / DEMO_STEPS.length) * 100;

  const stepCompleted = useMemo(() => {
    return lastActionStep != null && lastActionStep >= demoStep;
  }, [lastActionStep, demoStep]);

  const hasSnapshotToCompare = snapshots.length >= 2;

  const restoreFailureCase = useCallback(() => {
    const recovery = failureRecoveryRef.current;
    if (!recovery) return false;

    failureRecoveryRef.current = null;
    commitSceneChange(
      () => cloneSecurityScene(recovery.scene),
      "Demo walkthrough failure state restored",
    );
    setEnvironmentMode(recovery.environmentMode);
    runSimulation();
    return true;
  }, [commitSceneChange, runSimulation, setEnvironmentMode]);

  const handleNext = useCallback(() => {
    if (isLast) {
      void restoreFailureCase();
      setDemoMode(false);
      setDemoStep(0);
      onFinish();
      return;
    }
    const nextIndex = demoStep + 1;
    setDemoStep(nextIndex);
    DEMO_STEPS[nextIndex]?.transition?.();
  }, [demoStep, isLast, onFinish, restoreFailureCase, setDemoMode, setDemoStep]);

  const handlePrev = useCallback(() => {
    if (demoStep <= 0) return;
    const prevIndex = demoStep - 1;
    setDemoStep(prevIndex);
    DEMO_STEPS[prevIndex]?.transition?.();
  }, [demoStep, setDemoStep]);

  const handleSkip = useCallback(() => {
    void restoreFailureCase();
    setDemoMode(false);
    setDemoStep(0);
    onFinish();
  }, [onFinish, restoreFailureCase, setDemoMode, setDemoStep]);

  const handleAction = useCallback(() => {
    if (demoStep === 4) {
      runSimulation();
      setLastActionStep(4);
      return;
    }

    if (demoStep === 6) {
      const applyFailureCase = () => {
        const state = useStudioStore.getState();
        const fallbackCamera = state.scene.cameras[0]?.id ?? null;
        const targetCameraId = state.scene.cameras.find((camera) => camera.id === "cam_1")?.id ?? fallbackCamera;
        if (!targetCameraId) return false;

        if (!failureRecoveryRef.current) {
          failureRecoveryRef.current = {
            scene: cloneSecurityScene(state.scene),
            environmentMode: state.environmentMode,
          };
        }

        setEnvironmentMode("night");
        updateNode(targetCameraId, { status: "off" as CameraNode["status"] });
        runSimulation();
        setFailureCaseApplied(true);
        return true;
      };

      const applied = applyFailureCase();
      if (applied) setLastActionStep(6);
      return;
    }
  }, [demoStep, runSimulation, setEnvironmentMode, updateNode]);

  const Icon = step?.icon ?? Shield;
  const showRerunWarning = demoStep > 0 && simulationDirty && !failureCaseApplied;
  const simulationStepComplete = lastActionStep != null && lastActionStep >= 4;
  const failureStepComplete = lastActionStep != null && lastActionStep >= 6;
  const canAction = useMemo(() => {
    if (demoStep === 4) return !simulationRunning;
    if (demoStep === 6) return simulationStepComplete && !failureCaseApplied && !simulationRunning;
    return false;
  }, [demoStep, failureCaseApplied, simulationRunning, simulationStepComplete]);

  useEffect(() => {
    DEMO_STEPS[demoStep]?.transition?.();
  }, [demoStep]);

  useEffect(() => () => {
    void restoreFailureCase();
  }, [restoreFailureCase]);

  return (
    <div         className={`{pointer-events-auto absolute inset-y-0 left-0 z-40 flex w-[340px] max-w-[90vw] flex-col border-r ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}/95 shadow-[4px_0_24px_rgba(0,0,0,0.3)]}`}>
      <div className={`{flex items-center justify-between border-b ${UI_SURFACES.borderPanel} px-3 py-2}`}>
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted}`}>Judge Demo Walkthrough (4:15)</span>
        </div>
        <button type="button"
          onClick={handleSkip}
          className={`flex h-5 w-5 items-center justify-center rounded ${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverBg} hover:text-white`}
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
                  s.transition?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors",
                  isCurrent
                    ? "bg-cyan-500/10 text-cyan-100"
                    : isCompleted
                      ? "${UI_SURFACES.textMuted5}"
                      : "${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverBgMuted}",
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

        <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeep} p-3`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 mb-2">
            <Icon className="h-4 w-4 text-emerald-400" />
          </div>

          <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted}`}>
            Step {demoStep + 1} of {DEMO_STEPS.length}
          </div>
          <h3 className={`mt-1 text-[13px] font-semibold ${UI_SURFACES.textNear}`}>{step?.timestamp ? `${step.timestamp} — ` : ""}{step?.title}</h3>
          <p className={`mt-1 text-[10px] leading-relaxed ${UI_SURFACES.textSoftBright}`}>{step?.description}</p>

          {showRerunWarning ? (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                Simulation dirty
              </div>
              <div className="mt-0.5 text-amber-100/70">Scene has unapplied changes. Run simulation to refresh metrics.</div>
            </div>
          ) : null}

          {demoStep === 4 && simulationStepComplete ? (
            <div className="mt-3">
              <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Simulation metrics</div>
              <CoverageMetricsPanel />
            </div>
          ) : null}

          {demoStep === 6 && failureStepComplete ? (
            <div className="mt-3">
              <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Failure metrics</div>
              <CoverageMetricsPanel />
            </div>
          ) : null}

          {demoStep === 7 ? (
            <div className="mt-3">
              <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Judge focus areas</div>
              <CoverageMetricsPanel />
              {hasSnapshotToCompare ? (
                <div className={`mt-2 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panelDeepAlt} px-2.5 py-2 text-[9px] ${UI_SURFACES.textSoftBright}`}>
                  <div className={cn("font-semibold uppercase tracking-[0.14em]", UI_TONES.info.text)}>Comparison ready</div>
                  <div className="mt-0.5">Two or more snapshots are available for compare and report surfaces.</div>
                </div>
              ) : null}
              <div className={`mt-2 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panelDeepAlt} px-2.5 py-2 text-[10px] ${UI_SURFACES.textSoftBright}`}>
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
                  <Sparkles className="h-3 w-3" />
                  Evaluation priorities
                </div>
                <div className="text-[9px]">
                  Deterministic simulation · DORI-style scoring · SecurityScene schema · counterfactual deltas · temporal/profile/report/provenance
                </div>
                <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                  Emphasize verified outputs over AI narration claims.
                </div>
              </div>
            </div>
          ) : null}

          {demoStep === 8 ? (
            <div className="mt-3">
              <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Close line</div>
              <CoverageMetricsPanel />
              <div className={`mt-2 text-[9px] ${UI_SURFACES.textDimMid}`}>
                SentinelTwin is a security audit workspace, not a static cone viewer.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`{border-t ${UI_SURFACES.borderPanel} px-3 py-2}`}>
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full ${UI_SURFACES.hoverBg}">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className={`flex h-7 items-center gap-1 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 text-[9px] font-medium ${UI_SURFACES.textSoftMuted} transition-colors ${UI_SURFACES.hoverBorderSubtle} hover:text-white disabled:cursor-not-allowed disabled:opacity-50`}
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
              {(failureCaseApplied && demoStep === 6) || (simulationStepComplete && demoStep === 4) ? (
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

        {demoStep === 4 && simulationStepComplete ? (
          <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-500/8 px-2 py-1 text-center text-[8px] text-emerald-200">
            Simulation complete — proceed to replay and failure demonstration
          </div>
        ) : null}

        {demoStep === 6 && failureStepComplete ? (
          <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-500/8 px-2 py-1 text-center text-[8px] text-emerald-200">
            Failure case applied — proceed to compare/report and judge focus
          </div>
        ) : null}
      </div>
    </div>
  );
}
