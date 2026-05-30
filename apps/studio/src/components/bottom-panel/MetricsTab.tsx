"use client";

import { useStudioStore } from "@/store/studio-store";
import { DonutChart } from "@/components/shared/DonutChart";
import { Badge } from "@/components/shared/Badge";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { qualityToScore } from "@/simulation/dori";
import { computeCoverageEntropy } from "@/simulation/coverage-entropy";
import { truthLabelDetail } from "@/lib/truth-labels";
import { QUALITY_COLOR } from "@/lib/quality-display";
import { getTargetRequirementInfo } from "@/lib/target-quality-requirements";

function MetricCard({ label, children, className = "" }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-between px-3 py-2.5 border-r border-[#1e2130] min-w-0 ${className}`}>
      <div className="text-[9px] text-[#4a5568] font-medium tracking-wide uppercase mb-2 text-center w-full">
        {label}
      </div>
      {children}
    </div>
  );
}

function SignalRow({ label, value, detail, status }: {
  label: string; value: string; detail: string; status?: "good" | "warn" | "neutral";
}) {
  const dotColor = status === "good" ? "bg-emerald-500"
    : status === "warn" ? "bg-amber-500"
    : "bg-[#3a4158]";
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span className="min-w-[100px] text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{label}</span>
      <span className="ml-auto text-[10px] font-semibold text-[#d2d9e8]">{value}</span>
      <span className="hidden text-[8px] text-[#5a6a88] sm:inline">{detail}</span>
    </div>
  );
}

export function MetricsTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedCriticalZone = scene.criticalZones.find((zone) => zone.id === selectedNodeId) ?? null;
  const selectedTargetRequirement = selectedCriticalZone ? getTargetRequirementInfo(selectedCriticalZone.targetType) : null;

  if (!result) {
    return (
      <RunSimulationPrompt
        className="h-full px-4"
        message="Run the shared simulation to populate the live metrics for this scene."
      />
    );
  }

  const activeCams = scene.cameras.filter((c) => c.status === "on").length;
  const offlineCams = scene.cameras.filter((c) => c.status !== "on").length;
  const zonesPass = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const zonesTotal = result.criticalZoneResults.length;

  const qualityScore = result.averageWalkableQuality;
  const qualityLabel = qualityScore >= 3 ? "RECOGNITION"
    : qualityScore >= 2 ? "OBSERVATION"
    : qualityScore >= 1 ? "DETECTION"
    : "NONE";
  const qualityColor = qualityScore >= 3 ? QUALITY_COLOR.recognition
    : qualityScore >= 2 ? QUALITY_COLOR.observation
    : qualityScore >= 1 ? QUALITY_COLOR.detection
    : QUALITY_COLOR.none;

  const worstQuality = result.worstAreaQuality;
  const worstColor = QUALITY_COLOR[worstQuality] ?? QUALITY_COLOR.none;
  const worstLabel = worstQuality === "none" ? "NO COVERAGE" : worstQuality.toUpperCase();
  const worstScore = qualityToScore(worstQuality);

  const firstBlindspotIssue = result.issues.find((i) => i.category === "blindspot");
  const blockageLabel = firstBlindspotIssue
    ? firstBlindspotIssue.description.split(" is obstructing")[0] ?? "—"
    : "—";

  const prevCoverage = snapshots.length >= 2
    ? snapshots[snapshots.length - 2]?.simulation?.totalCoveragePct
    : undefined;
  const coverageDelta = prevCoverage !== undefined
    ? result.totalCoveragePct - prevCoverage
    : undefined;

  const coverageColor = result.totalCoveragePct > 80 ? "#22c55e"
    : result.totalCoveragePct > 60 ? "#f97316"
    : "#ef4444";

  const fragilitySummary = result.fragilitySummary;
  const fragilityPct = fragilitySummary
    ? Math.round(fragilitySummary.meanFragility * 100)
    : null;
  const fragilityColor = fragilityPct === null ? "#4a5568"
    : fragilityPct <= 30 ? "#22c55e"
    : fragilityPct <= 60 ? "#f5a623"
    : "#ef4444";

  const coverageEntropy = computeCoverageEntropy(result.coverageCells);
  const blindSpotFingerprint = result.blindSpotFingerprint;
  const kRobustness = result.kRobustness;
  const placementOracle = result.placementOracle;
  const reflectiveBounce = result.reflectiveBounce;
  const occlusionBlameCount = result.occlusionBlame?.length ?? 0;
  const temporalSummary = scene.temporalProfile?.anomalySummary;

  const advancedSignals: { label: string; value: string; detail: string; status: "good" | "warn" | "neutral" }[] = [];
  if (coverageEntropy) {
    advancedSignals.push({
      label: "Coverage Entropy",
      value: `${coverageEntropy.normalizedEntropy.toFixed(2)} norm`,
      detail: `dominant ${coverageEntropy.dominantQuality} ${coverageEntropy.dominantQualityShare.toFixed(1)}%`,
      status: coverageEntropy.normalizedEntropy < 0.5 ? "good" : "warn",
    });
  }
  if (kRobustness) {
    advancedSignals.push({
      label: "K-Robustness",
      value: `K=${kRobustness.kRobustness}`,
      detail: `${kRobustness.isRobust ? "robust" : "fragile"} · ${kRobustness.criticalSets.length} critical sets`,
      status: kRobustness.isRobust ? "good" : "warn",
    });
  }
  if (placementOracle) {
    advancedSignals.push({
      label: "Placement Oracle",
      value: `${placementOracle.candidateCount} candidates`,
      detail: placementOracle.bestCandidate
        ? `best ${placementOracle.bestCandidate.mountType} score ${placementOracle.bestCandidate.score.toFixed(1)}`
        : "no recommendation",
      status: placementOracle.bestCandidate && placementOracle.bestCandidate.score > 0.6 ? "good" : "neutral",
    });
  }
  if (blindSpotFingerprint) {
    advancedSignals.push({
      label: "Blind Spot FP",
      value: blindSpotFingerprint.fingerprint,
      detail: `${blindSpotFingerprint.regionCount} regions · ${blindSpotFingerprint.totalBlindAreaSqM.toFixed(1)} m²`,
      status: blindSpotFingerprint.regionCount > 3 ? "warn" : "neutral",
    });
  }
  if (reflectiveBounce) {
    advancedSignals.push({
      label: "Reflective Bounce",
      value: `${reflectiveBounce.reflectiveWindowCount} windows`,
      detail: `${reflectiveBounce.affectedCellCount} cells · ${reflectiveBounce.affectedCameraCount} cameras`,
      status: reflectiveBounce.affectedCellCount > 10 ? "warn" : "neutral",
    });
  }
  if (temporalSummary) {
    advancedSignals.push({
      label: "Temporal Anomalies",
      value: `${temporalSummary.totalAnomalies} windows`,
      detail: `${temporalSummary.highSeverityCount} high · worst ${temporalSummary.worstCoverageDropPct.toFixed(1)}% drop`,
      status: temporalSummary.totalAnomalies > 3 ? "warn" : temporalSummary.totalAnomalies > 0 ? "neutral" : "good",
    });
  }
  if (occlusionBlameCount > 0) {
    advancedSignals.push({
      label: "Occlusion Blame",
      value: `${occlusionBlameCount} zones`,
      detail: "Blame fractions from obstruction analysis",
      status: occlusionBlameCount > 3 ? "warn" : "neutral",
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex items-center justify-between border-b border-[#1e2130] px-3 py-2 text-[9px] text-[#8090a8] shrink-0"
        aria-label="Truth: Simulated"
        title="Derived from the current scene and simulation state."
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-[0.14em] text-[#c7d0e4]">Truth:</span>
          <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-sky-200">Simulated</span>
        </div>
        <div className="max-w-[32rem] truncate text-right" title={truthLabelDetail("simulated")}>{truthLabelDetail("simulated")}</div>
      </div>

      {/* ── Main metric cards: 6-column grid ── */}
      <div className="grid shrink-0 gap-2 border-b border-[#1e2130] py-2" style={{gridTemplateColumns: "repeat(6, minmax(0, 1fr))"}}>

        {/* 1: Overall Coverage */}
        <MetricCard label="Overall Coverage (Detection)">
          <DonutChart
            value={result.totalCoveragePct}
            size={68}
            strokeWidth={6}
            color={coverageColor}
            label={`${Math.round(result.totalCoveragePct)}%`}
            sublabel="Walkable Area"
          />
          {coverageDelta !== undefined ? (
            <div className={`mt-1 text-[9px] font-medium ${coverageDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
              {coverageDelta >= 0 ? "+" : ""}{coverageDelta.toFixed(1)}% vs previous
            </div>
          ) : null}
        </MetricCard>

        {/* 2: Critical Zones */}
        <MetricCard label="Critical Zones">
          <div className="text-center">
            <div className="text-[28px] font-bold text-white leading-none">
              {zonesPass}<span className="text-[16px] text-[#4a5568]">/{zonesTotal}</span>
            </div>
            <div className="text-[9px] text-[#68738a] mt-0.5">Zones Passing</div>
            {result.criticalZoneResults.map((z) => (
              <div key={z.zoneId} className="mt-2">
                <div className="text-[9px] text-[#8090a8] mb-0.5">{z.label}</div>
                <Badge variant={z.status === "pass" ? "green" : "red"}>
                  {z.status === "pass" ? "PASS" : "FAILS"}
                </Badge>
              </div>
            ))}
          </div>
        </MetricCard>

        {/* 3: Cameras */}
        <MetricCard label="Cameras">
          <div className="text-center">
            <div className="text-[28px] font-bold text-white leading-none">{activeCams}</div>
            <div className="text-[9px] text-green-400 mt-0.5">Active</div>
            {offlineCams > 0 && (
              <>
                <div className="text-[18px] font-bold text-[#ef4444] mt-1 leading-none">{offlineCams}</div>
                <div className="text-[9px] text-[#ef4444] mt-0.5">Offline</div>
              </>
            )}
            {offlineCams === 0 && (
              <div className="text-[9px] text-[#4a5568] mt-1">0 Offline</div>
            )}
          </div>
        </MetricCard>

        {/* 4: Average Quality */}
        <MetricCard label="Average Quality (Walkable)">
          <DonutChart
            value={(qualityScore / 4) * 100}
            size={68}
            strokeWidth={6}
            color={qualityColor}
            label={qualityScore.toFixed(1)}
            sublabel={qualityLabel}
          />
          {selectedCriticalZone ? (
            <div className="mt-1 space-y-0.5 text-[9px] text-[#68738a]">
              <div>
                Target: <span className="font-semibold text-[#c0c8da]">
                  {selectedCriticalZone.requiredQuality.toUpperCase()}
                </span>
                {selectedTargetRequirement ? (
                  <span className="text-[#4a5568]"> · default {selectedTargetRequirement.defaultRequiredQuality} for {selectedCriticalZone.targetType.replace(/_/g, " ")}</span>
                ) : null}
              </div>
              {selectedTargetRequirement ? (
                <div className="text-[#5a6a88]">
                  Threshold: {selectedTargetRequirement.ppmThreshold} · {selectedTargetRequirement.rationale}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 text-[9px] text-[#68738a]">
              Select a critical zone to show the target quality requirement.
            </div>
          )}
        </MetricCard>

        {/* 5: Worst Area + Fragility (merged) */}
        <MetricCard label="Worst Area Quality">
          <div className="text-center">
            <div className="text-[28px] font-bold leading-none" style={{ color: worstColor }}>{worstScore}</div>
            <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: worstColor }}>
              {worstLabel}
            </div>
            <div className="text-[9px] text-[#68738a] mt-1">{blockageLabel}</div>
            {fragilityPct !== null ? (
              <div className="mt-2 border-t border-[#1e2130] pt-1.5">
                <div className="text-[8px] uppercase tracking-[0.14em] text-[#4a5568]">Fragility</div>
                <div className="text-[13px] font-semibold leading-none" style={{ color: fragilityColor }}>
                  {fragilityPct}% <span className="text-[9px] font-normal" style={{ color: fragilityColor }}>
                    {fragilityPct <= 30 ? "ROBUST" : fragilityPct <= 60 ? "MODERATE" : "FRAGILE"}
                  </span>
                </div>
                <div className="mt-0.5 text-[8px] text-[#4a5568]">
                  {fragilitySummary!.fragileCellCount} fragile · {fragilitySummary!.robustCellCount} robust
                </div>
              </div>
            ) : null}
          </div>
        </MetricCard>

        {/* 6: Recognition + Identification (merged) */}
        <MetricCard label="Walkable Area Quality">
          <div className="flex w-full items-center justify-center gap-3">
            <div className="text-center">
              <div className="text-[22px] font-bold text-[#22c55e] leading-none">
                {Math.round(result.recognitionAreaPct)}%
              </div>
              <div className="text-[8px] text-[#68738a] mt-1">Recognition</div>
            </div>
            <div className="h-8 w-px bg-[#1e2130]" />
            <div className="text-center">
              <div className="text-[22px] font-bold text-[#3b82f6] leading-none">
                {Math.round(result.identificationAreaPct)}%
              </div>
              <div className="text-[8px] text-[#68738a] mt-1">Identification</div>
            </div>
          </div>
        </MetricCard>

      </div>

      {/* ── Advanced Signals: compact table ── */}
      {advancedSignals.length > 0 ? (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
            <span>Advanced Coverage Signals</span>
            <span className="text-[#3a4158] font-normal">· {advancedSignals.length} metrics</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {advancedSignals.map((signal) => (
              <SignalRow key={signal.label} {...signal} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
