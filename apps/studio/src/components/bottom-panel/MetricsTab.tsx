"use client";

import { useStudioStore } from "@/store/studio-store";
import { DonutChart } from "@/components/shared/DonutChart";
import { Badge } from "@/components/shared/Badge";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { qualityToScore } from "@/simulation/dori";
import { computeCoverageEntropy } from "@/simulation/coverage-entropy";
import { truthLabelDetail } from "@/lib/truth-labels";

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

export function MetricsTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedCriticalZone = scene.criticalZones.find((zone) => zone.id === selectedNodeId) ?? null;

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
  const qualityColor = qualityScore >= 3 ? "#22c55e" : qualityScore >= 2 ? "#eab308" : "#f97316";

  const worstQuality = result.worstAreaQuality;
  const worstColor = worstQuality === "none" ? "#ef4444" : worstQuality === "detection" ? "#f97316" : "#eab308";
  const worstLabel = worstQuality === "none" ? "NO COVERAGE" : worstQuality.toUpperCase();
  const worstScore = qualityToScore(worstQuality);

  // Data-driven: extract obstruction label from first blindspot issue description
  const firstBlindspotIssue = result.issues.find((i) => i.category === "blindspot");
  const blockageLabel = firstBlindspotIssue
    ? firstBlindspotIssue.description.split(" is obstructing")[0] ?? "—"
    : "—";

  // Compute coverage delta from second-to-last snapshot
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
  const advancedSignals = [
    {
      label: "Coverage Entropy",
      value: coverageEntropy ? `${coverageEntropy.normalizedEntropy.toFixed(2)} norm` : "—",
      detail: coverageEntropy
        ? `dominant ${coverageEntropy.dominantQuality} ${coverageEntropy.dominantQualityShare.toFixed(1)}%`
        : "Not computed",
    },
    {
      label: "K-Robustness",
      value: kRobustness ? `K=${kRobustness.kRobustness}` : "—",
      detail: kRobustness ? `${kRobustness.isRobust ? "robust" : "fragile"} · ${kRobustness.criticalSets.length} critical sets` : "Not computed",
    },
    {
      label: "Placement Oracle",
      value: placementOracle?.bestCandidate ? `${placementOracle.candidateCount} candidates` : "—",
      detail: placementOracle?.bestCandidate
        ? `best ${placementOracle.bestCandidate.mountType} score ${placementOracle.bestCandidate.score.toFixed(1)}`
        : "Not computed",
    },
    {
      label: "Blind Spot Fingerprint",
      value: blindSpotFingerprint ? blindSpotFingerprint.fingerprint : "—",
      detail: blindSpotFingerprint
        ? `${blindSpotFingerprint.regionCount} regions · ${blindSpotFingerprint.totalBlindAreaSqM.toFixed(1)} m²`
        : "Not computed",
    },
    {
      label: "Reflective Bounce",
      value: reflectiveBounce ? `${reflectiveBounce.reflectiveWindowCount} windows` : "—",
      detail: reflectiveBounce
        ? `${reflectiveBounce.affectedCellCount} cells · ${reflectiveBounce.affectedCameraCount} cameras`
        : "Not computed",
    },
    {
      label: "Temporal Anomalies",
      value: temporalSummary ? `${temporalSummary.totalAnomalies} windows` : "—",
      detail: temporalSummary
        ? `${temporalSummary.highSeverityCount} high · worst ${temporalSummary.worstCoverageDropPct.toFixed(1)}% drop`
        : "Not computed",
    },
    {
      label: "Occlusion Blame",
      value: occlusionBlameCount > 0 ? `${occlusionBlameCount} zones` : "—",
      detail: occlusionBlameCount > 0 ? "Blame fractions from obstruction analysis" : "Not computed",
    },
  ];
  const baseColCount = fragilitySummary ? 8 : 7;

  return (
    <div className="h-full">
      <div
        className="flex items-center justify-between border-b border-[#1e2130] px-3 py-2 text-[9px] text-[#8090a8]"
        aria-label="Truth: Simulated"
        title="Derived from the current scene and simulation state."
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-[0.14em] text-[#c7d0e4]">Truth:</span>
          <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-sky-200">Simulated</span>
        </div>
        <div className="max-w-[32rem] truncate text-right" title={truthLabelDetail("simulated")}>{truthLabelDetail("simulated")}</div>
      </div>
      <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${baseColCount}, minmax(0, 1fr))`}}>
      {/* 1: Overall Coverage */}
      <MetricCard label="Overall Coverage (Detection)">
        <DonutChart
          value={result.totalCoveragePct}
          size={72}
          strokeWidth={7}
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
          size={72}
          strokeWidth={7}
          color={qualityColor}
          label={qualityScore.toFixed(1)}
          sublabel={qualityLabel}
        />
        {selectedCriticalZone ? (
          <div className="mt-1 text-[9px] text-[#68738a]">
            Target: <span className="text-[#c0c8da] font-semibold">
              {selectedCriticalZone.requiredQuality.toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[9px] text-[#68738a]">
            Select a critical zone to show the target quality requirement.
          </div>
        )}
      </MetricCard>

      {/* 5: Worst Area Quality */}
      <MetricCard label="Worst Area Quality">
        <div className="text-center">
          <div className="text-[28px] font-bold leading-none" style={{ color: worstColor }}>{worstScore}</div>
          <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: worstColor }}>
            {worstLabel}
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">{blockageLabel}</div>
          <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-[#4a5568]">
            Why: {blockageLabel !== "—" ? `${blockageLabel} is the current obstruction driver` : "No blindspot cause identified"}
          </div>
        </div>
      </MetricCard>

      {/* 6: Recognition Area */}
      <MetricCard label="Recognition Area">
        <div className="text-center">
          <div className="text-[28px] font-bold text-[#22c55e] leading-none">
            {Math.round(result.recognitionAreaPct)}%
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">of Walkable Area</div>
        </div>
      </MetricCard>

      {/* 7: Identification Area */}
      <MetricCard label="Identification Area">
        <div className="text-center">
          <div className="text-[28px] font-bold text-[#3b82f6] leading-none">
            {Math.round(result.identificationAreaPct)}%
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">of Walkable Area</div>
        </div>
      </MetricCard>

      {/* 8: Coverage Fragility — only rendered when simulation includes fragility data */}
      {fragilitySummary ? (
        <MetricCard label="Coverage Fragility">
          <div className="text-center">
            <div className="text-[28px] font-bold leading-none" style={{ color: fragilityColor }}>
              {fragilityPct}%
            </div>
            <div className="mt-1 text-[9px] font-semibold tracking-wide" style={{ color: fragilityColor }}>
              {fragilityPct! <= 30 ? "ROBUST" : fragilityPct! <= 60 ? "MODERATE" : "FRAGILE"}
            </div>
            <div className="mt-2 text-[9px] text-[#68738a]">
              {fragilitySummary.fragileCellCount} fragile cells
            </div>
            <div className="text-[9px] text-[#4a5568]">
              {fragilitySummary.robustCellCount} robust
            </div>
          </div>
        </MetricCard>
      ) : null}

      </div>

      <div className="mt-2 grid gap-2" style={{gridTemplateColumns: "repeat(4, minmax(0, 1fr))"}}>
        {advancedSignals.map((signal) => (
          <MetricCard key={signal.label} label={signal.label}>
            <div className="text-center">
              <div className="max-w-[120px] truncate text-[16px] font-semibold text-[#e5ecfb]" title={signal.value}>
                {signal.value}
              </div>
              <div className="mt-1 text-[9px] text-[#68738a]">{signal.detail}</div>
            </div>
          </MetricCard>
        ))}
      </div>
    </div>
  );
}
