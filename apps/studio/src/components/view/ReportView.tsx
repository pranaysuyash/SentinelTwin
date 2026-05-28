"use client";

import { FileText, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { ReportLiteTab } from "@/components/bottom-panel/ReportLiteTab";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import { computeCoveragePostureVariation } from "@/simulation/coverage-posture";
import { computeCoverageUncertainty } from "@/simulation/coverage-uncertainty";
import { buildRedundancyMatrixReport } from "@/report/redundancy-matrix";
import { useStudioStore } from "@/store/studio-store";

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
    <div className={cn("rounded-2xl border px-4 py-3", toneClass)}>
      <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function ReportView() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const summary = useMemo(() => {
    const issues = result?.issues.length ?? 0;
    const recs = result?.recommendations.length ?? 0;
    const coverage = result ? `${Math.round(result.totalCoveragePct)}%` : "--";
    const critical = result?.criticalZoneResults.length ?? 0;
    const privacyZones = scene.privacyZones.length;
    const restrictedCells = result?.coverageCells.filter((cell) => cell.privacyRestricted).length ?? 0;
    const privacyIssues = result?.issues.filter((issue) => issue.category === "privacy").length ?? 0;
    const fragility = result?.fragilitySummary ? `${Math.round(result.fragilitySummary.meanFragility * 100)}%` : "--";
    const kRobustness = result?.kRobustness ? `K=${result.kRobustness.kRobustness}` : "--";
    const blindRegions = result?.blindRegions?.length ?? 0;
    const temporalWindows = scene.temporalProfile?.anomalyWindows.length ?? 0;
    const temporalWorstDrop = scene.temporalProfile?.anomalySummary?.worstCoverageDropPct;
    const uncertainty = computeCoverageUncertainty(scene, { sampleCount: 12 });
    const postureVariation = computeCoveragePostureVariation(scene);
    const redundancyMatrix = result ? buildRedundancyMatrixReport(scene, result) : null;
    const uncertaintySummary = uncertainty
      ? `${uncertainty.meanCoveragePct.toFixed(1)}% (${uncertainty.p5CoveragePct.toFixed(1)}–${uncertainty.p95CoveragePct.toFixed(1)})`
      : "--";
    const postureSummary = postureVariation
      ? `${postureVariation.worstProfileLabel ?? "—"} ${postureVariation.worstProfileCoveragePct != null ? `${postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""}`.trim()
      : "--";
    return {
      issues,
      recs,
      coverage,
      critical,
      privacyZones,
      restrictedCells,
      privacyIssues,
      fragility,
      kRobustness,
      blindRegions,
      uncertaintySummary,
      postureSummary,
      temporalWindows,
      temporalWorstDrop,
      redundancyMatrix,
    };
  }, [result, scene]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_34%),linear-gradient(180deg,#07090d_0%,#0a0f18_46%,#0a0c11_100%)]">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-500/10 to-transparent" />
      <div className="relative flex h-full min-h-0 flex-col p-4">
        <div className="flex items-start gap-3 rounded-[28px] border border-[#1f2536] bg-[#0b0f17]/90 p-4 shadow-2xl shadow-black/25 backdrop-blur">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/12 text-sky-200">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a86a0]">Report Workspace</div>
              <span className="rounded-full border border-sky-400/20 bg-sky-500/12 px-2 py-0.5 text-[9px] font-semibold text-sky-200">
                {workspacePreset.replace(/_/g, " ")}
              </span>
              <span className="rounded-full border border-[#2a3246] bg-[#111521] px-2 py-0.5 text-[9px] font-semibold text-[#8f9bb1]">
                {scene.name}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Client-ready evidence summary</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#90a0bc]">
              The report view surfaces the verified simulation outcome, the strongest findings, and a concise handoff narrative without forcing the user back into the editing shell.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Coverage" value={summary.coverage} tone="sky" />
            <StatCard label="Open Issues" value={String(summary.issues)} tone={summary.issues > 0 ? "rose" : "emerald"} />
            <StatCard label="Recommendations" value={String(summary.recs)} tone="amber" />
            <StatCard label="Critical Zones" value={String(summary.critical)} tone="emerald" />
            <StatCard label="Fragility" value={summary.fragility} tone={summary.fragility === "--" ? "emerald" : "amber"} />
            <StatCard label="K-Robustness" value={summary.kRobustness} tone={summary.kRobustness === "--" ? "emerald" : "sky"} />
            <StatCard label="Blind Regions" value={String(summary.blindRegions)} tone={summary.blindRegions > 0 ? "amber" : "emerald"} />
            <StatCard label="Uncertainty" value={summary.uncertaintySummary} tone={summary.uncertaintySummary === "--" ? "emerald" : "rose"} />
            <StatCard label="Posture" value={summary.postureSummary} tone={summary.postureSummary === "--" ? "emerald" : "sky"} />
            <StatCard label="Temporal Anomalies" value={String(summary.temporalWindows)} tone={summary.temporalWindows > 0 ? "amber" : "emerald"} />
            <StatCard label="Worst Drop" value={summary.temporalWorstDrop != null ? `${Math.abs(summary.temporalWorstDrop).toFixed(1)}%` : "--"} tone={summary.temporalWorstDrop != null ? "rose" : "emerald"} />
            <StatCard label="Privacy Zones" value={String(summary.privacyZones)} tone={summary.privacyZones > 0 ? "rose" : "emerald"} />
            <StatCard label="Restricted Cells" value={String(summary.restrictedCells)} tone={summary.restrictedCells > 0 ? "amber" : "emerald"} />
            <StatCard label="Privacy Issues" value={String(summary.privacyIssues)} tone={summary.privacyIssues > 0 ? "rose" : "emerald"} />
            <StatCard label="Redundant Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.redundantZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.redundantZoneCount > 0 ? "emerald" : "amber"} />
            <StatCard label="SPOF Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.spofZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.spofZoneCount > 0 ? "rose" : "emerald"} />
            <StatCard label="Uncovered Zones" value={summary.redundancyMatrix ? String(summary.redundancyMatrix.uncoveredZoneCount) : "--"} tone={summary.redundancyMatrix && summary.redundancyMatrix.uncoveredZoneCount > 0 ? "rose" : "emerald"} />
          </div>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
          <section className="min-h-0 overflow-hidden rounded-[28px] border border-[#1f2536] bg-[#0b0f17]/92 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2 border-b border-[#1e2130] px-4 py-3">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a86a0]">Verified Outcome</div>
                <div className="text-[11px] text-[#8d98b0]">Simulation-backed conclusions and risk summary</div>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <SecurityOutcomePanel compact={false} />
            </div>
          </section>

          <section className="min-h-0 overflow-hidden rounded-[28px] border border-[#1f2536] bg-[#0b0f17]/92 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2 border-b border-[#1e2130] px-4 py-3">
              <LayoutDashboard className="h-4 w-4 text-sky-300" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a86a0]">Report Lite</div>
                <div className="text-[11px] text-[#8d98b0]">Handoff-ready narrative, evidence, and recommendations</div>
              </div>
              <span className="ml-auto rounded-full border border-sky-400/20 bg-sky-500/12 px-2 py-0.5 text-[9px] font-semibold text-sky-200">
                {result ? "Simulation verified" : "Run simulation to populate"}
              </span>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <ReportLiteTab />
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#1f2536] bg-[#0b0f17]/85 px-4 py-3 text-[11px] text-[#8d98b0]">
          <Sparkles className="h-4 w-4 text-amber-300" />
          Report view is a workspace destination, not just a drawer tab. You can still switch back to map, wall, replay, or compare without losing the current scene context.
        </div>
      </div>
    </div>
  );
}
