"use client";

import { FileText, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { TruthBadge } from "@/components/shared/TruthBadge";

import { cn } from "@/lib/cn";
import { ReportLiteTab } from "@/components/bottom-panel/ReportLiteTab";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import {
  computeCoverageEntropy,
  computeCoveragePostureVariation,
  computeCoverageUncertainty,
} from "@sentineltwin/simulation";
import { buildRedundancyMatrixReport } from "@sentineltwin/report";
import { useStudioStore } from "@/store/studio-store";
import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";
import { computeSceneInputHash } from "@sentineltwin/simulation";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const REPORT_VIEW_UNCERTAINTY_SAMPLE_COUNT = 2;
const REPORT_VIEW_SIMULATION_STALE_BUFFER_MS = 1_500;
const REPORT_VIEW_ACTION_LIMIT = 5;
const REPORT_VIEW_TOP_RECOMMENDATION_LIMIT = 3;
const REPORT_VIEW_TOP_ISSUE_LIMIT = 2;
const REPORT_VIEW_METRIC_VALUE_CAP = 120;

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "sky" | "rose";
}) {
  const toneClass = {
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-200",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-xl border px-3 py-2", toneClass)}>
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</div>
      <div className="mt-0.5 truncate text-base font-semibold">{value}</div>
    </div>
  );
}

function StatGroup({
  title,
  truthLabel,
  children,
}: {
  title: string;
  truthLabel?: "computed" | "simulated";
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep}/70 p-2`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textSoftDim}`}>{title}</div>
        {truthLabel ? <TruthBadge label={truthLabel} /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

type ActionPriority = {
  id: string;
  title: string;
  detail: string;
  source: "simulation" | "issue" | "ai";
  tone: "emerald" | "amber" | "rose";
};

type CriticalSetRow = {
  k: number;
  cameraIds: string[];
  cameraNames: string[];
  exposureScore: number;
  waypointCount: number;
};

type ReportSummary = {
  issues: number;
  recs: number;
  coverage: string;
  critical: number;
  privacyZones: number;
  restrictedCells: number;
  privacyIssues: number;
  sensorCount: number;
  fragility: string;
  kRobustness: string;
  blindRegions: number;
  temporalWindows: number;
  temporalWorstDrop?: number;
  coverageEntropySummary: string;
  uncertaintySummary: string;
  postureSummary: string;
  redundancyMatrix: ReturnType<typeof buildRedundancyMatrixReport> | null;
  kCriticalSets: CriticalSetRow[];
};

function pickFirstWords(input: string) {
  return input.length <= REPORT_VIEW_METRIC_VALUE_CAP ? input : `${input.slice(0, REPORT_VIEW_METRIC_VALUE_CAP).trimEnd()}…`;
}

function simulationFreshnessClass(hasResult: boolean, isFresh: boolean) {
  if (!hasResult) return "${UI_SURFACES.borderDark} ${UI_SURFACES.card} ${UI_SURFACES.textSoftBright}";
  return isFresh
    ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
    : "border-rose-400/20 bg-rose-500/12 text-rose-200";
}

function sourceTone(source: ActionPriority["source"]): string {
  if (source === "simulation") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (source === "issue") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  return "border-sky-400/20 bg-sky-500/10 text-sky-200";
}

function actionToneClass(tone: ActionPriority["tone"]): string {
  if (tone === "emerald") return "border-emerald-400/20 bg-emerald-500/8";
  if (tone === "rose") return "border-rose-400/20 bg-rose-500/8";
  return "border-amber-400/20 bg-amber-500/8";
}

export function ReportView() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const latestAiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry[0] ?? null);
  const simulationIsFresh = useMemo(() => {
    if (!result) return false;
    if (result.sceneHash) {
      const currentHash = computeSceneInputHash(scene);
      return result.sceneHash.hash === currentHash.hash;
    }
    return result.computedAt + REPORT_VIEW_SIMULATION_STALE_BUFFER_MS >= scene.updatedAt;
  }, [result, scene]);
  const simulationFreshnessLabel = simulationIsFresh
    ? "Simulation fresh"
    : result
      ? "Simulation stale"
      : "No simulation";
  const outcome = useMemo(
    () => selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId }),
    [activePathId, result, scene],
  );
  const summary = useMemo<ReportSummary>(() => {
    const validForDisplay = Boolean(result && simulationIsFresh);
    const summaryResult = validForDisplay ? result : null;
    const issues = summaryResult ? summaryResult.issues.length : 0;
    const recs = summaryResult ? summaryResult.recommendations.length : 0;
    const coverage = summaryResult ? `${Math.round(summaryResult.totalCoveragePct)}%` : "--";
    const critical = summaryResult ? summaryResult.criticalZoneResults.length : 0;
    const privacyZones = scene.privacyZones.length;
    const restrictedCells = summaryResult ? summaryResult.coverageCells.filter((cell) => cell.privacyRestricted).length : 0;
    const privacyIssues = summaryResult ? summaryResult.issues.filter((issue) => issue.category === "privacy").length : 0;
    const sensorCount = scene.sensors.length;
    const fragility = summaryResult?.fragilitySummary ? `${Math.round(summaryResult.fragilitySummary.meanFragility * 100)}%` : "--";
    const kRobustness = summaryResult?.kRobustness ? `K=${summaryResult.kRobustness.kRobustness}` : "--";
    const blindRegions = summaryResult?.blindRegions ? summaryResult.blindRegions.length : 0;
    const temporalWindows = scene.temporalProfile?.anomalyWindows.length ?? 0;
    const temporalWorstDrop = scene.temporalProfile?.anomalySummary?.worstCoverageDropPct;
    const coverageEntropy = summaryResult ? computeCoverageEntropy(summaryResult.coverageCells) : null;
    const coverageEntropySummary = coverageEntropy
      ? `${coverageEntropy.normalizedEntropy.toFixed(2)} norm`
      : "--";
    const uncertainty = summaryResult
      ? computeCoverageUncertainty(scene, { sampleCount: REPORT_VIEW_UNCERTAINTY_SAMPLE_COUNT })
      : null;
    const postureVariation = summaryResult ? computeCoveragePostureVariation(scene) : null;
    const redundancyMatrix = summaryResult ? buildRedundancyMatrixReport(scene, summaryResult) : null;
    const uncertaintySummary = uncertainty
      ? `${uncertainty.meanCoveragePct.toFixed(1)}% (${uncertainty.p5CoveragePct.toFixed(1)}–${uncertainty.p95CoveragePct.toFixed(1)})`
      : "--";
    const postureSummary = postureVariation
      ? `${postureVariation.worstProfileLabel ?? "—"} ${postureVariation.worstProfileCoveragePct != null ? `${postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""}`.trim()
      : "--";
    const kCriticalSets = summaryResult?.kRobustness?.criticalSets ?? [];
    return {
      issues,
      recs,
      coverage,
      critical,
      privacyZones,
      restrictedCells,
      privacyIssues,
      sensorCount,
      fragility,
      kRobustness,
      blindRegions,
      coverageEntropySummary,
      uncertaintySummary,
      postureSummary,
      temporalWindows,
      temporalWorstDrop,
      redundancyMatrix,
      kCriticalSets,
    };
  }, [result, scene, simulationIsFresh]);

  const prioritizedActions = useMemo<ActionPriority[]>(() => {
    if (!result || !simulationIsFresh) {
      return [{
        id: "run_baseline",
        title: "Run baseline simulation",
        detail: result
          ? "Decision-grade recommendations are out of date for the current scene."
          : "Decision-grade recommendations are generated after a full simulation run.",
        source: "simulation",
        tone: "amber",
      }];
    }

    const recActions = result.recommendations.slice(0, REPORT_VIEW_TOP_RECOMMENDATION_LIMIT).map((rec, index) => ({
      id: `rec_${index}`,
      title: rec.description,
      detail: `${rec.verified ? "Verified" : "Needs verification"} · ${rec.estimatedImpact}`,
      source: "simulation" as const,
      tone: rec.verified ? "emerald" as const : "amber" as const,
    }));

    const issueActions = result.issues
      .filter((issue) => issue.severity === "critical" || issue.severity === "high")
      .slice(0, REPORT_VIEW_TOP_ISSUE_LIMIT)
      .map((issue, index) => ({
        id: `issue_${index}`,
        title: issue.description,
        detail: `Severity: ${issue.severity.toUpperCase()} · Category: ${issue.category.replaceAll("_", " ")}`,
        source: "issue" as const,
        tone: "rose" as const,
      }));

    const aiAction = latestAiActionTelemetry
      ? [{
          id: "ai_last_action",
          title: "Latest AI recommendation pass",
          detail: `${latestAiActionTelemetry.stage} · ${latestAiActionTelemetry.durationMs} ms · ~${latestAiActionTelemetry.estimatedTotalTokens} tokens`,
          source: "ai" as const,
          tone: latestAiActionTelemetry.status === "success" ? "emerald" as const : "amber" as const,
        }]
      : [];

    return [...recActions, ...issueActions, ...aiAction].slice(0, REPORT_VIEW_ACTION_LIMIT);
  }, [latestAiActionTelemetry, result, simulationIsFresh]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_34%),linear-gradient(180deg,#07090d_0%,#0a0f18_46%,#0a0c11_100%)]">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-500/10 to-transparent" />
      <div className="relative flex h-full min-h-0 flex-col p-4">
        <div className={`flex items-start gap-3 rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/90 p-4 shadow-2xl shadow-black/25`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/12 text-sky-200">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`text-xs font-semibold uppercase tracking-[0.24em] ${UI_SURFACES.textSoftDim}`}>Report Workspace</div>
              <span className="rounded-full border border-sky-400/20 bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                {workspacePreset.replace(/_/g, " ")}
              </span>
              <span className={`rounded-full border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-2 py-0.5 text-[10px] font-semibold ${UI_SURFACES.textSoftBright}`}>
                Outcome {outcome.summary.status.replace(/_/g, " ")}
              </span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", simulationFreshnessClass(Boolean(result), simulationIsFresh))}>
                {simulationFreshnessLabel}
              </span>
              <span className={`rounded-full border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-2 py-0.5 text-[10px] font-semibold ${UI_SURFACES.textSoftBright}`}>
                {scene.name}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Client-ready evidence summary</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#90a0bc]">
              The report view surfaces the verified simulation outcome, the strongest findings, and a concise handoff narrative without forcing the user back into the editing shell.
            </p>
            {outcome.summary.primaryRisk ? (
              <p className="mt-1 max-w-3xl text-xs text-amber-200">
                Primary risk: {outcome.summary.primaryRisk}
              </p>
            ) : null}
          </div>
        </div>

        <section className={`mt-3 grid gap-3 rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/92 p-3 shadow-2xl shadow-black/20 xl:grid-cols-2`}>
          <StatGroup title="Operational Snapshot" truthLabel="computed">
            <StatCard label="Coverage" value={summary.coverage} tone="sky" />
            <StatCard label="Open Issues" value={String(summary.issues)} tone={summary.issues > 0 ? "rose" : "emerald"} />
            <StatCard label="Recommendations" value={String(summary.recs)} tone="amber" />
            <StatCard label="Critical Zones" value={String(summary.critical)} tone="emerald" />
          </StatGroup>
          <StatGroup title="Model Confidence" truthLabel="computed">
            <StatCard label="Fragility" value={summary.fragility} tone={summary.fragility === "--" ? "emerald" : "amber"} />
            <StatCard label="Coverage Stability Index" value={summary.coverageEntropySummary} tone={summary.coverageEntropySummary === "--" ? "emerald" : "sky"} />
            <StatCard label="Uncertainty" value={summary.uncertaintySummary} tone={summary.uncertaintySummary === "--" ? "emerald" : "rose"} />
            <StatCard label="Posture" value={summary.postureSummary} tone={summary.postureSummary === "--" ? "emerald" : "sky"} />
          </StatGroup>
          <StatGroup title="Temporal And Privacy" truthLabel="computed">
            <StatCard label="Temporal Anomalies" value={String(summary.temporalWindows)} tone={summary.temporalWindows > 0 ? "amber" : "emerald"} />
            <StatCard label="Worst Drop" value={summary.temporalWorstDrop != null ? `${Math.abs(summary.temporalWorstDrop).toFixed(1)}%` : "--"} tone={summary.temporalWorstDrop != null ? "rose" : "emerald"} />
            <StatCard label="Privacy Zones" value={String(summary.privacyZones)} tone={summary.privacyZones > 0 ? "rose" : "emerald"} />
            <StatCard label="Privacy Issues" value={String(summary.privacyIssues)} tone={summary.privacyIssues > 0 ? "rose" : "emerald"} />
          </StatGroup>
          <StatGroup title="Resilience And Sensors" truthLabel="computed">
            <StatCard label="Backup Coverage" value={summary.kRobustness} tone={summary.kRobustness === "--" ? "emerald" : "sky"} />
            <StatCard label="Blind Regions" value={String(summary.blindRegions)} tone={summary.blindRegions > 0 ? "amber" : "emerald"} />
            <StatCard label="Sensors" value={String(summary.sensorCount)} tone={summary.sensorCount > 0 ? "amber" : "emerald"} />
            <StatCard label="Restricted Cells" value={String(summary.restrictedCells)} tone={summary.restrictedCells > 0 ? "amber" : "emerald"} />
            <StatCard label="Redundant Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.redundantZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.redundantZoneCount > 0 ? "emerald" : "amber"} />
            <StatCard label="SPOF Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.spofZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.spofZoneCount > 0 ? "rose" : "emerald"} />
            <StatCard label="Uncovered Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.uncoveredZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.uncoveredZoneCount > 0 ? "rose" : "emerald"} />
          </StatGroup>
        </section>

        <section className={`mt-4 rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/92 px-4 py-3 shadow-2xl shadow-black/20`}>
          <div className="flex items-center gap-2">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textSoftDim}`}>Decision Priorities</div>
            <span className={`rounded-full border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-2 py-0.5 text-[10px] font-semibold ${UI_SURFACES.textSoftBright}`}>
              {prioritizedActions.length} actions
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {prioritizedActions.map((action) => (
              <div key={action.id} className={cn("rounded-2xl border px-3 py-2", actionToneClass(action.tone))}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">{action.title}</div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]", sourceTone(action.source))}>
                    {action.source}
                  </span>
                </div>
                <div className={`mt-1 text-[11px] ${UI_SURFACES.textSoftBright}`}>{pickFirstWords(action.detail)}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
          {summary.kCriticalSets.length > 0 ? (
            <section className={`mb-4 rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/92 px-4 py-3 shadow-2xl shadow-black/20 xl:col-span-2`}>
              <div className="flex items-center gap-2">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textSoftDim}`}>Backup Coverage Critical Sets</div>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                  {summary.kCriticalSets.length} sets
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {summary.kCriticalSets.slice(0, 3).map((set) => (
                  <div key={`${set.k}-${set.cameraIds.join("-")}`} className={`rounded-2xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} px-3 py-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[10px] uppercase tracking-[0.18em] ${UI_SURFACES.textSoftDim}`}>K={set.k}</div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", set.exposureScore < 3 ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-200")}>
                        {set.exposureScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {set.cameraNames.join(", ")}
                    </div>
                    <div className={`mt-1 text-[11px] ${UI_SURFACES.textSoftBright}`}>
                      {set.waypointCount} waypoints · {result?.kRobustness?.isRobust ? "robust" : "critical"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className={`min-h-0 overflow-hidden rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/92 shadow-2xl shadow-black/20`}>
            <div className={`{flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-4 py-3}`}>
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <div>
                <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textSoftDim}`}>Verified Outcome</div>
                <div className={`text-[11px] ${UI_SURFACES.textSoftBright}`}>Simulation-backed conclusions and risk summary</div>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <SecurityOutcomePanel compact={false} />
            </div>
          </section>

          <section className={`min-h-0 overflow-hidden rounded-[28px] border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/92 shadow-2xl shadow-black/20`}>
            <div className={`{flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-4 py-3}`}>
              <LayoutDashboard className="h-4 w-4 text-sky-300" />
              <div>
                <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textSoftDim}`}>Report Lite</div>
                <div className={`text-[11px] ${UI_SURFACES.textSoftBright}`}>Handoff-ready narrative, evidence, and recommendations</div>
              </div>
              <span className="ml-auto rounded-full border border-sky-400/20 bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                {simulationIsFresh ? "Simulation verified" : result ? "Simulation stale" : "Run simulation to populate"}
              </span>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <ReportLiteTab />
            </div>
          </section>
        </div>

        <div className={`mt-4 flex items-center gap-2 rounded-2xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/85 px-4 py-3 text-[11px] ${UI_SURFACES.textSoftBright}`}>
          <Sparkles className="h-4 w-4 text-amber-300" />
          Report view is a workspace destination, not just a drawer tab. You can still switch back to map, wall, replay, or compare without losing the current scene context.
        </div>
      </div>
    </div>
  );
}
