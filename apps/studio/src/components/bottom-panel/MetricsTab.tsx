"use client";

import { useStudioStore } from "@/store/studio-store";
import { DonutChart } from "@/components/shared/DonutChart";
import { Badge } from "@/components/shared/Badge";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import type { ConfidenceBand } from "@sentineltwin/core";
import { qualityToScore } from "@sentineltwin/core";
import { computeCoverageEntropy, formatConfidenceSummary } from "@sentineltwin/simulation";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { truthLabelDetail } from "@/lib/truth-labels";
import { QUALITY_COLOR } from "@/lib/quality-display";
import { getTargetRequirementInfo } from "@/lib/target-quality-requirements";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import { UI_TONES } from "@/lib/design-tokens";

function MetricCard({ label, children, className = "" }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-between px-3 py-2.5 border-r UI_SURFACES.borderPanel min-w-0 ${className}`}>
      <div className={`text-[9px] UI_SURFACES.textMuted font-medium tracking-wide uppercase mb-2 text-center w-full`}>
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
    : "UI_SURFACES.textDim";
  return (
    <div className={`flex items-center gap-2 rounded-md border UI_SURFACES.borderFaint UI_SURFACES.bgDeep px-2 py-1.5`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span className={`min-w-[100px] text-[9px] uppercase tracking-[0.08em] UI_SURFACES.textSoftBright`}>{label}</span>
      <span className={`ml-auto text-[10px] font-semibold UI_SURFACES.textBody2`}>{value}</span>
      <span className="hidden text-[8px] UI_SURFACES.textMuted7 sm:inline">{detail}</span>
    </div>
  );
}

const CONFIDENCE_LEVEL_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  verified: { bg: UI_TONES.accent.bgSoft, text: UI_TONES.accent.text, border: UI_TONES.accent.border, label: "VERIFIED" },
  high:     { bg: UI_TONES.success.bgSoft, text: UI_TONES.success.textBright, border: UI_TONES.success.border, label: "HIGH" },
  medium:   { bg: UI_TONES.warning.bgSoft, text: UI_TONES.warning.textBright, border: UI_TONES.warning.border, label: "MEDIUM" },
  low:      { bg: UI_TONES.danger.bgSoft, text: UI_TONES.danger.textBright, border: UI_TONES.danger.border, label: "LOW" },
  none:     { bg: UI_SURFACES.card, text: UI_SURFACES.textDimMid, border: UI_SURFACES.borderSubtle, label: "NONE" },
};

function ConfidenceCard({ confidence, zones }: { confidence: ConfidenceBand; zones: { status: string }[] }) {
  const style = CONFIDENCE_LEVEL_STYLE[confidence.level] ?? CONFIDENCE_LEVEL_STYLE.none;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = formatConfidenceSummary(confidence, zones as any);
  return (
    <div className={`rounded-xl border UI_SURFACES.borderFaint UI_SURFACES.panel px-3 py-2.5`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textMuted`}>Simulation Confidence</span>
          <TruthBadge label="simulated" />
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-wider ${style.bg} ${style.text} ${style.border}`}>
          {style.label}
        </span>
      </div>
      <p className="mb-2 text-[9px] leading-relaxed UI_SURFACES.textMuted2">{summary}</p>
      {confidence.sensitiveTo.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className={`text-[8px] uppercase tracking-wider UI_SURFACES.textDim`}>Sensitive to:</span>
          {confidence.sensitiveTo.map((s) => (
            <span key={s} className={`rounded-md border UI_SURFACES.borderSubtle UI_SURFACES.panelDeepAlt px-1.5 py-0.5 text-[8px] UI_SURFACES.textSoftBright`}>{s}</span>
          ))}
        </div>
      )}
      {confidence.reasonCodes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {confidence.reasonCodes.map((r) => (
            <span key={r} className={`rounded-md border UI_SURFACES.borderFaint UI_SURFACES.page px-1.5 py-0.5 text-[7px] uppercase tracking-wider UI_SURFACES.textDim`}>{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const POSTURE_BAND_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  exceptional: { color: UI_TONES.accent.raw, bg: UI_TONES.accent.bgSoft, border: UI_TONES.accent.border },
  excellent:   { color: UI_TONES.success.raw, bg: UI_TONES.success.bgSoft, border: UI_TONES.success.border },
  good:        { color: UI_TONES.info.raw, bg: UI_TONES.info.bgSoft, border: UI_TONES.info.border },
  fair:        { color: UI_TONES.warning.raw, bg: UI_TONES.warning.bgSoft, border: UI_TONES.warning.border },
  poor:        { color: UI_TONES.danger.raw, bg: UI_TONES.danger.bgSoft, border: UI_TONES.danger.border },
};

const POSTURE_FACTOR_LABELS: Record<string, string> = {
  coverageCompleteness: "Coverage",
  temporalResilience: "Temporal",
  adversarialPathResistance: "Adversarial",
  redundancyDepth: "Redundancy",
  responseWindow: "Response",
};

function PostureScoreCard() {
  const posture = useStudioStore((s) => s.postureScore);
  if (!posture) return null;

  const style = POSTURE_BAND_STYLE[posture.band] ?? POSTURE_BAND_STYLE.poor;
  const pct = ((posture.score - 300) / 550) * 100;

  return (
    <div className={`flex items-center gap-4 rounded-lg border ${style.border} ${style.bg} px-4 py-2`}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold leading-none" style={{ color: style.color }}>
          {posture.score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: style.color }}>
          {posture.band}
        </span>
        {posture.delta !== null && (
          <span className={`ml-1 text-[10px] font-medium ${posture.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
            {posture.delta >= 0 ? "+" : ""}{posture.delta}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textMuted mb-1`}>Security Posture (300–850)</div>
        <div className={`h-1.5 w-full rounded-full UI_SURFACES.borderFaint overflow-hidden`}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: style.color }} />
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {Object.entries(posture.factorScores).map(([key, val]) => (
          <div key={key} className="text-center min-w-[40px]">
            <div className={`text-[11px] font-semibold UI_SURFACES.textBody`}>{val as number}</div>
            <div className={`text-[7px] uppercase tracking-wider UI_SURFACES.textMuted`}>{POSTURE_FACTOR_LABELS[key] ?? key}</div>
          </div>
        ))}
      </div>
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

  const coverageColor = result.totalCoveragePct > 80 ? UI_TONES.success.raw
    : result.totalCoveragePct > 60 ? UI_TONES.warning.raw
    : UI_TONES.danger.raw;

  const fragilitySummary = result.fragilitySummary;
  const fragilityPct = fragilitySummary
    ? Math.round(fragilitySummary.meanFragility * 100)
    : null;
  const fragilityColor = fragilityPct === null ? UI_TONES.neutral.raw
    : fragilityPct <= 30 ? UI_TONES.success.raw
    : fragilityPct <= 60 ? UI_TONES.warning.raw
    : UI_TONES.danger.raw;

  const coverageEntropy = computeCoverageEntropy(result.coverageCells);
  const blindSpotFingerprint = result.blindSpotFingerprint;
  const kRobustness = result.kRobustness;
  const placementOracle = result.placementOracle;
  const reflectiveBounce = result.reflectiveBounce;
  const occlusionBlameCount = result.occlusionBlame?.length ?? 0;
  const temporalSummary = scene.temporalProfile?.anomalySummary;
  const overallConfidence = (result as Record<string, unknown>).overallConfidence as ConfidenceBand | undefined;

  const advancedSignals: { label: string; value: string; detail: string; status: "good" | "warn" | "neutral" }[] = [];
  if (coverageEntropy) {
    advancedSignals.push({
      label: "Coverage Stability Index",
      value: `${coverageEntropy.normalizedEntropy.toFixed(2)} norm`,
      detail: `dominant ${coverageEntropy.dominantQuality} ${coverageEntropy.dominantQualityShare.toFixed(1)}%`,
      status: coverageEntropy.normalizedEntropy < 0.5 ? "good" : "warn",
    });
  }
  if (kRobustness) {
    advancedSignals.push({
      label: "Backup Coverage",
      value: `K=${kRobustness.kRobustness}`,
      detail: `${kRobustness.isRobust ? "robust" : "fragile"} · ${kRobustness.criticalSets.length} critical sets`,
      status: kRobustness.isRobust ? "good" : "warn",
    });
  }
  if (placementOracle) {
    advancedSignals.push({
      label: "Recommended Mounts",
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
      <div className={`{flex items-center justify-between border-b UI_SURFACES.borderPanel px-3 py-2 text-[9px] UI_SURFACES.textMuted5 shrink-0}`}>
        <div className="flex items-center gap-2">
          <span className={`font-semibold uppercase tracking-[0.14em] UI_SURFACES.textBody`}>Truth:</span>
          <TruthBadge label="simulated" />
        </div>
        <div className="max-w-[32rem] truncate text-right" title={truthLabelDetail("simulated")}>{truthLabelDetail("simulated")}</div>
      </div>

      {/* ── Posture Score headline ── */}
      <div className="shrink-0 px-3 pt-2">
        <PostureScoreCard />
      </div>

      {/* ── Main metric cards: 6-column grid ── */}
      <div className={`{grid shrink-0 gap-2 border-b UI_SURFACES.borderPanel py-2}`} style={{gridTemplateColumns: "repeat(6, minmax(0, 1fr))"}}>

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
              {zonesPass}<span className={`text-[16px] UI_SURFACES.textMuted`}>/{zonesTotal}</span>
            </div>
            <div className={`text-[9px] UI_SURFACES.textSoftMid mt-0.5`}>Zones Passing</div>
            {result.criticalZoneResults.map((z) => (
              <div key={z.zoneId} className="mt-2">
                <div className={`text-[9px] UI_SURFACES.textMuted5 mb-0.5`}>{z.label}</div>
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
                <div className={`text-[18px] font-bold ${UI_TONES.danger.textBright} mt-1 leading-none`}>{offlineCams}</div>
                <div className={`text-[9px] ${UI_TONES.danger.textBright} mt-0.5`}>Offline</div>
              </>
            )}
            {offlineCams === 0 && (
              <div className={`text-[9px] UI_SURFACES.textMuted mt-1`}>0 Offline</div>
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
            <div className={`mt-1 space-y-0.5 text-[9px] UI_SURFACES.textSoftMid`}>
              <div>
                Target: <span className={`font-semibold UI_SURFACES.textNearAlt`}>
                  {selectedCriticalZone.requiredQuality.toUpperCase()}
                </span>
                {selectedTargetRequirement ? (
                  <span className={`UI_SURFACES.textMuted`}> · default {selectedTargetRequirement.defaultRequiredQuality} for {selectedCriticalZone.targetType.replace(/_/g, " ")}</span>
                ) : null}
              </div>
              {selectedTargetRequirement ? (
                <div className="UI_SURFACES.textMuted7">
                  Threshold: {selectedTargetRequirement.ppmThreshold} · {selectedTargetRequirement.rationale}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`mt-1 text-[9px] UI_SURFACES.textSoftMid`}>
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
            <div className={`text-[9px] UI_SURFACES.textSoftMid mt-1`}>{blockageLabel}</div>
            {fragilityPct !== null ? (
              <div className={`{mt-2 border-t UI_SURFACES.borderPanel pt-1.5}`}>
                <div className={`text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textMuted`}>Fragility</div>
                <div className="text-[13px] font-semibold leading-none" style={{ color: fragilityColor }}>
                  {fragilityPct}% <span className="text-[9px] font-normal" style={{ color: fragilityColor }}>
                    {fragilityPct <= 30 ? "ROBUST" : fragilityPct <= 60 ? "MODERATE" : "FRAGILE"}
                  </span>
                </div>
                <div className={`mt-0.5 text-[8px] UI_SURFACES.textMuted`}>
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
              <div className={`text-[22px] font-bold ${UI_TONES.success.textBright} leading-none`}>
                {Math.round(result.recognitionAreaPct)}%
              </div>
              <div className={`text-[8px] UI_SURFACES.textSoftMid mt-1`}>Recognition</div>
            </div>
            <div className={`h-8 w-px UI_SURFACES.bgPanel`} />
            <div className="text-center">
              <div className={`text-[22px] font-bold ${UI_TONES.info.textBright} leading-none`}>
                {Math.round(result.identificationAreaPct)}%
              </div>
              <div className={`text-[8px] UI_SURFACES.textSoftMid mt-1`}>Identification</div>
            </div>
          </div>
        </MetricCard>

      </div>

      {/* ── Advanced Signals + Confidence ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {advancedSignals.length > 0 && (
          <div>
            <div className={`mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>
              <span>Advanced Coverage Signals</span>
              <span className={`UI_SURFACES.textDim font-normal`}>· {advancedSignals.length} metrics</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {advancedSignals.map((signal) => (
                <SignalRow key={signal.label} {...signal} />
              ))}
            </div>
          </div>
        )}
        {overallConfidence && (
          <ConfidenceCard confidence={overallConfidence} zones={result.criticalZoneResults} />
        )}
      </div>
    </div>
  );
}
