"use client";

import { AlertTriangle, ArrowRight, BarChart3, Clock3, Fingerprint, MapPinned, Play, Radar, ShieldAlert, Sigma, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { computeCoverageEntropy } from "@sentineltwin/simulation";
import { computeCoverageTimeBudget } from "@sentineltwin/simulation";
import { computeCoveragePostureVariation } from "@sentineltwin/simulation";
import { computeCoverageUncertainty } from "@sentineltwin/simulation";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { useStudioStore } from "@/store/studio-store";
import type { DoriQuality } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


function Section({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
        {icon}
        {title}
        {actions ? <div className="ml-auto flex items-center gap-1">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function CandidateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{label}</span>
      <span className={`text-[9px] font-mono ${UI_SURFACES.textBody2}`}>{value}</span>
    </div>
  );
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} min`;
  return `${seconds.toFixed(1)} s`;
}

function formatSignedPercent(delta: number | null | undefined) {
  if (delta == null || Number.isNaN(delta)) return "—";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

type ActionTone = "blue" | "amber" | "emerald" | "violet";

function ActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  tone = "blue",
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: ActionTone;
}) {
  const toneClass: Record<ActionTone, string> = {
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-200 hover:border-blue-400/35 hover:bg-blue-500/15",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200 hover:border-amber-400/35 hover:bg-amber-500/15",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/35 hover:bg-emerald-500/15",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-200 hover:border-violet-400/35 hover:bg-violet-500/15",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[tone]}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function NovelAlgorithmsTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const activePathId = useStudioStore((s) => s.activePathId);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const setFocusScenePointHighlight = useStudioStore((s) => s.setFocusScenePointHighlight);
  const selectNode = useStudioStore((s) => s.selectNode);
  const setActivePathId = useStudioStore((s) => s.setActivePathId);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const [threshold, setThreshold] = useState<DoriQuality>("observation");
  const [exposureBudgetS, setExposureBudgetS] = useState(2);
  const [uncertaintySamples, setUncertaintySamples] = useState(12);
  const focusClearTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (focusClearTimerRef.current != null) {
      window.clearTimeout(focusClearTimerRef.current);
    }
  }, []);

  const kRobustness = result?.kRobustness;
  const placementOracle = result?.placementOracle;
  const fragility = result?.fragilitySummary;
  const entropy = useMemo(() => (result ? computeCoverageEntropy(result.coverageCells) : null), [result]);
  const occlusion = result?.occlusionBlame ?? [];
  const anomalies = temporalProfile?.anomalyWindows ?? [];
  const blindRegions = result?.blindRegions ?? [];
  const blindSpotFingerprint = result?.blindSpotFingerprint;
  const reflectiveBounce = result?.reflectiveBounce;
  const coverageCells = result?.coverageCells;
  const activePath = useMemo(
    () => (activePathId ? (scene.paths.find((path) => path.id === activePathId) ?? null) : null),
    [activePathId, scene.paths],
  );
  const timeBudget = useMemo(
    () => (activePath && coverageCells ? computeCoverageTimeBudget(activePath, coverageCells, threshold, exposureBudgetS) : null),
    [activePath, coverageCells, exposureBudgetS, threshold],
  );
  const uncertainty = useMemo(
    () => computeCoverageUncertainty(scene as never, { sampleCount: uncertaintySamples }),
    [scene, uncertaintySamples],
  );
  const postureVariation = useMemo(
    () => computeCoveragePostureVariation(scene as never),
    [scene],
  );

  const fragilityPct = fragility ? Math.round(fragility.meanFragility * 100) : null;
  const kCriticalSet = kRobustness?.criticalSets[0];
  const bestCandidate = placementOracle?.bestCandidate;
  const visibleBands = timeBudget?.segments.filter((segment) => segment.visible) ?? [];
  const largestBlindRegion = useMemo(
    () => [...blindRegions].sort((a, b) => b.areaSqM - a.areaSqM)[0] ?? null,
    [blindRegions],
  );
  const largestBlindRegionPoint = useMemo(() => {
    if (!largestBlindRegion || largestBlindRegion.cells.length === 0) return null;
    const sums = largestBlindRegion.cells.reduce(
      (acc, cell) => ({ x: acc.x + cell.x, z: acc.z + cell.z }),
      { x: 0, z: 0 },
    );
    return [
      sums.x / largestBlindRegion.cells.length,
      sums.z / largestBlindRegion.cells.length,
    ] as [number, number];
  }, [largestBlindRegion]);
  const bestCandidatePoint = bestCandidate ? ([bestCandidate.position[0], bestCandidate.position[2]] as [number, number]) : null;

  const openMapFocus = (point: [number, number], selectionId?: string | null) => {
    setViewMode("map");
    queueMicrotask(() => setBottomTab("novel"));
    if (selectionId) {
      selectNode(selectionId);
    }
    setFocusScenePointHighlight({ point, source: "minimap" });
    setFocusScenePointRequest({ point, source: "minimap" });
    if (focusClearTimerRef.current != null) {
      window.clearTimeout(focusClearTimerRef.current);
    }
    focusClearTimerRef.current = window.setTimeout(() => {
      setFocusScenePointHighlight(null);
      focusClearTimerRef.current = null;
    }, 1400);
  };

  const openReplay = () => {
    if (!activePath) return;
    setActivePathId(activePath.id);
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
    setViewMode("replay");
    queueMicrotask(() => setBottomTab("timeline"));
  };

  if (!result) {
    return (
      <RunSimulationPrompt
        className="h-full px-4"
        message="Run the shared simulation to populate advanced risk signals."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2">
      <div className="flex items-center gap-2 px-1 py-0.5">
        <TruthBadge label="simulated" />
        <span className="text-[9px] uppercase tracking-[0.16em] text-[#556076]">Advanced Risk Algorithms</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-5">
        <StatCard
          icon={<Sigma className="h-3.5 w-3.5" />}
          label="Coverage Stability"
          value={fragilityPct != null ? `${fragilityPct}%` : "—"}
          color={fragilityPct == null ? "text-[#8090a8]" : fragilityPct <= 30 ? "text-emerald-400" : fragilityPct <= 60 ? "text-amber-400" : "text-red-400"}
        />
        <StatCard
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label="Backup Coverage"
          value={kRobustness ? `K=${kRobustness.kRobustness}` : "—"}
          color={kRobustness?.isRobust ? "text-emerald-400" : "text-amber-400"}
        />
        <StatCard
          icon={<MapPinned className="h-3.5 w-3.5" />}
          label="Recommended Mounts"
          value={placementOracle ? `${placementOracle.candidateCount}` : "—"}
          color={bestCandidate ? "text-blue-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<TriangleAlert className="h-3.5 w-3.5" />}
          label="Time-Based Weaknesses"
          value={temporalProfile ? `${anomalies.length}` : "—"}
          color={anomalies.length > 0 ? "text-amber-300" : "text-emerald-400"}
        />
        <StatCard
          icon={<Clock3 className="h-3.5 w-3.5" />}
          label="First Usable View"
          value={timeBudget ? formatSeconds(timeBudget.firstVisibleTimeS ?? timeBudget.totalDurationS) : "—"}
          color={timeBudget?.budgetMet ? "text-emerald-400" : "text-amber-400"}
        />
        <StatCard
          icon={<Sigma className="h-3.5 w-3.5" />}
          label="Coverage Stability Index"
          value={entropy ? `${entropy.normalizedEntropy.toFixed(2)}` : "—"}
          color={entropy ? "text-fuchsia-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<Sigma className="h-3.5 w-3.5" />}
          label="Assumption Sensitivity"
          value={uncertainty ? `${uncertainty.sampleCount} runs` : "—"}
          color={uncertainty ? "text-violet-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Operating Posture"
          value={postureVariation ? `${postureVariation.worstProfileLabel ?? "—"} ${postureVariation.worstProfileCoveragePct != null ? `${postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""}` : "—"}
          color={postureVariation ? "text-sky-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<Fingerprint className="h-3.5 w-3.5" />}
          label="Blind-Spot Pattern"
          value={blindSpotFingerprint ? blindSpotFingerprint.fingerprint : "—"}
          color={blindSpotFingerprint ? "text-fuchsia-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Blind Regions"
          value={blindRegions ? `${blindRegions.length}` : "—"}
          color={blindRegions.length > 0 ? "text-red-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Reflective Bounce"
          value={reflectiveBounce ? `${reflectiveBounce.affectedCellCount}` : "—"}
          color={reflectiveBounce?.affectedCellCount ? "text-cyan-300" : "text-[#8090a8]"}
        />
      </div>

      <Section title="Navigator" icon={<MapPinned className="h-3 w-3 text-blue-300" />}>
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <div className="rounded-lg border border-[#1a2030] bg-[#0f141f] p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Best placement</div>
                <div className={`mt-0.5 text-[10px] ${UI_SURFACES.textBody2}`}>
                  {bestCandidate ? `${bestCandidate.mountType} at ${bestCandidate.position[0].toFixed(1)}, ${bestCandidate.position[2].toFixed(1)}` : "No ranked candidate"}
                </div>
              </div>
              <Badge variant={bestCandidate ? "blue" : "gray"}>
                {bestCandidate ? bestCandidate.score.toFixed(1) : "—"}
              </Badge>
            </div>
            <div className="mt-1 text-[9px] text-[#6a748b]">
              {bestCandidate
                ? `${bestCandidate.estimatedCoverageDeltaPct.toFixed(1)}% coverage gain · ${bestCandidate.estimatedCriticalZoneGain.toFixed(1)} critical-zone gain`
                : "Run simulation with novel analytics enabled to generate ranked placement candidates."}
            </div>
            <div className="mt-2">
              <ActionButton
                label="Inspect on Map"
                icon={<ArrowRight className="h-3 w-3" />}
                tone="blue"
                disabled={!bestCandidatePoint}
                onClick={() => {
                  if (!bestCandidatePoint) return;
                  openMapFocus(bestCandidatePoint);
                }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2030] bg-[#0f141f] p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Largest blind region</div>
                <div className={`mt-0.5 text-[10px] ${UI_SURFACES.textBody2}`}>
                  {largestBlindRegion ? `${largestBlindRegion.severity} · ${largestBlindRegion.areaSqM.toFixed(1)} m²` : "No blind regions"}
                </div>
              </div>
              <Badge
                variant={
                  largestBlindRegion
                    ? largestBlindRegion.severity === "critical"
                      ? "red"
                      : largestBlindRegion.severity === "high"
                        ? "amber"
                        : "gray"
                    : "gray"
                }
              >
                {largestBlindRegion ? largestBlindRegion.classification : "—"}
              </Badge>
            </div>
            <div className="mt-1 text-[9px] text-[#6a748b]">
              {largestBlindRegion
                ? largestBlindRegion.description
                : "The topology view will populate here once the scene produces blind spot regions."}
            </div>
            <div className="mt-2">
              <ActionButton
                label="Focus Region"
                icon={<ArrowRight className="h-3 w-3" />}
                tone="amber"
                disabled={!largestBlindRegionPoint}
                onClick={() => {
                  if (!largestBlindRegionPoint || !largestBlindRegion) return;
                  openMapFocus(largestBlindRegionPoint, largestBlindRegion.affectedZoneIds[0] ?? null);
                }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2030] bg-[#0f141f] p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Path replay</div>
                <div className={`mt-0.5 text-[10px] ${UI_SURFACES.textBody2}`}>
                  {activePath ? activePath.label : "No active path"}
                </div>
              </div>
              <Badge variant={timeBudget?.budgetMet ? "green" : "amber"}>
                {timeBudget ? (timeBudget.budgetMet ? "Budget met" : "Budget missed") : "—"}
              </Badge>
            </div>
            <div className="mt-1 text-[9px] text-[#6a748b]">
              {timeBudget
                ? `${formatSeconds(timeBudget.firstVisibleTimeS)} to first visible segment · ${formatSeconds(timeBudget.totalDurationS)} total path time`
                : "Select a path and run simulation to compute an exposure budget."}
            </div>
            <div className="mt-2">
              <ActionButton
                label="Open Replay"
                icon={<Play className="h-3 w-3" />}
                tone="emerald"
                disabled={!activePath}
                onClick={openReplay}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2030] bg-[#0f141f] p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Temporal profile</div>
                <div className={`mt-0.5 text-[10px] ${UI_SURFACES.textBody2}`}>
                  {temporalProfile ? `${anomalies.length} anomaly windows` : "No temporal profile yet"}
                </div>
              </div>
              <Badge variant={anomalies.length > 0 ? "amber" : "gray"}>
                {temporalProfile ? `${temporalProfile.hoursAnalyzed}h` : "—"}
              </Badge>
            </div>
            <div className="mt-1 text-[9px] text-[#6a748b]">
              {temporalProfile
                ? `Worst coverage drop ${Math.abs(temporalProfile.anomalySummary?.worstCoverageDropPct ?? 0).toFixed(1)}% and worst exposure jump ${(temporalProfile.anomalySummary?.worstExposureJump ?? 0).toFixed(1)}.`
                : "Open the 24-hour profile to inspect schedule-driven vulnerability windows."}
            </div>
            <div className="mt-2">
              <ActionButton
                label="Open 24H Profile"
                icon={<ArrowRight className="h-3 w-3" />}
                tone="violet"
                disabled={!temporalProfile}
                onClick={() => setBottomTab("temporal")}
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <Section title="Coverage Stability" icon={<BarChart3 className="h-3 w-3 text-emerald-400" />}>
          {fragility ? (
            <div className="space-y-1.5">
              <CandidateLine label="Mean fragility" value={`${Math.round(fragility.meanFragility * 100)}%`} />
              <CandidateLine label="Fragile cells" value={`${fragility.fragileCellCount}/${fragility.totalCells}`} />
              <CandidateLine label="Robust cells" value={`${fragility.robustCellCount}`} />
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Coverage stability not computed yet.</div>
          )}
        </Section>

        <Section title="Coverage Stability Index" icon={<Sigma className="h-3 w-3 text-fuchsia-400" />}>
          {entropy ? (
            <div className="space-y-1.5">
              <CandidateLine label="Normalized" value={entropy.normalizedEntropy.toFixed(2)} />
              <CandidateLine label="Raw bits" value={entropy.entropyBits.toFixed(2)} />
              <CandidateLine label="Dominant band" value={`${entropy.dominantQuality} ${entropy.dominantQualityShare.toFixed(1)}%`} />
              <div className="text-[9px] text-[#8b96ab]">
                {entropy.normalizedEntropy < 0.33
                  ? "Coverage is concentrated in a few quality bands, which reads as a more stable layout."
                  : entropy.normalizedEntropy < 0.66
                    ? "Coverage is moderately mixed across bands."
                    : "Coverage is spread across many quality bands, which suggests a more varied but less concentrated layout."}
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Coverage stability index not computed yet.</div>
          )}
        </Section>

        <Section title="Backup Coverage" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
          {kRobustness ? (
            <div className="space-y-1.5">
              <CandidateLine label="Backup depth" value={`K=${kRobustness.kRobustness} / ${kRobustness.totalCameras}`} />
              <CandidateLine label="Backup setup" value={kRobustness.isRobust ? "Yes" : "No"} />
              <div className="text-[9px] text-[#8b96ab]">
                {kCriticalSet
                  ? `Critical failure set: ${kCriticalSet.cameraNames.join(", ")} (exposure ${kCriticalSet.exposureScore.toFixed(1)})`
                  : "No single failure set opened a viable route in the tested range."}
              </div>
              {kRobustness.criticalSets.length > 1 ? (
                <div className="space-y-1">
                  {kRobustness.criticalSets.slice(0, 3).map((set) => (
                    <div key={`${set.k}-${set.cameraIds.join("-")}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">K={set.k}</span>
                        <Badge variant={set.exposureScore < 3 ? "green" : "gray"}>{set.exposureScore.toFixed(1)}</Badge>
                      </div>
                      <div className={`mt-1 text-[9px] ${UI_SURFACES.textBody2}`}>
                        {set.cameraNames.join(", ")}
                      </div>
                      <div className="mt-0.5 text-[8px] text-[#5b667c]">{set.waypointCount} waypoints</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Backup coverage not computed yet.</div>
          )}
        </Section>

        <Section
          title="Recommended Mount Points"
          icon={<Radar className="h-3 w-3 text-blue-300" />}
          actions={bestCandidatePoint ? (
            <ActionButton
              label="Inspect"
              icon={<ArrowRight className="h-3 w-3" />}
              tone="blue"
              onClick={() => openMapFocus(bestCandidatePoint)}
            />
          ) : null}
        >
          {bestCandidate ? (
            <div className="space-y-1.5">
              <CandidateLine
                label="Best placement"
                value={`${bestCandidate.mountType} @ ${bestCandidate.position[0].toFixed(1)}, ${bestCandidate.position[2].toFixed(1)}`}
              />
              <CandidateLine label="Estimated coverage gain" value={`${bestCandidate.estimatedCoverageDeltaPct.toFixed(1)}%`} />
              <CandidateLine label="Estimated critical gain" value={`${bestCandidate.estimatedCriticalZoneGain.toFixed(1)}`} />
              <div className="text-[9px] text-[#8b96ab]">
                {bestCandidate.privacyZoneHits.length > 0
                  ? `Privacy exposure warning: ${bestCandidate.privacyZoneHits.join(", ")}`
                  : "No privacy-zone hit in the top candidate."}
              </div>
              <div className="space-y-1">
                {placementOracle?.candidates.slice(0, 3).map((candidate, index) => (
                  <div key={`${candidate.mountType}-${candidate.position.join("-")}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Rank {index + 1}</span>
                      <Badge variant={index === 0 ? "green" : "gray"}>{candidate.score.toFixed(1)}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textBody2}`}>
                      {candidate.mountType} at {candidate.position[0].toFixed(1)}, {candidate.position[2].toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Placement oracle has no ranked candidates yet.</div>
          )}
        </Section>

        <Section
          title="Temporal Anomalies"
          icon={<TriangleAlert className="h-3 w-3 text-amber-400" />}
          actions={temporalProfile ? (
            <ActionButton
              label="Open Profile"
              icon={<ArrowRight className="h-3 w-3" />}
              tone="amber"
              onClick={() => setBottomTab("temporal")}
            />
          ) : null}
        >
          {temporalProfile ? (
            <div className="space-y-1.5">
              <CandidateLine label="Anomaly windows" value={`${anomalies.length}`} />
              <CandidateLine label="Worst coverage drop" value={`${Math.abs(temporalProfile.anomalySummary?.worstCoverageDropPct ?? 0).toFixed(1)}%`} />
              <CandidateLine label="Worst exposure jump" value={`${(temporalProfile.anomalySummary?.worstExposureJump ?? 0).toFixed(1)}`} />
              <div className="space-y-1">
                {anomalies.slice(0, 3).map((window) => (
                  <div key={`${window.startHour}:${window.startMinute}-${window.endHour}:${window.endMinute}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{window.severity}</span>
                      <Badge variant={window.severity === "high" ? "red" : window.severity === "medium" ? "amber" : "gray"}>{window.anomalyType}</Badge>
                    </div>
                    <div className={`mt-1 text-[9px] ${UI_SURFACES.textBody2}`}>
                      {window.startHour.toString().padStart(2, "0")}:{window.startMinute.toString().padStart(2, "0")} to {window.endHour.toString().padStart(2, "0")}:{window.endMinute.toString().padStart(2, "0")}
                    </div>
                    <div className="mt-0.5 text-[9px] text-[#8b96ab]">{window.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Temporal profile has not been computed yet.</div>
          )}
        </Section>
      </div>

      <Section title="Coverage Uncertainty" icon={<Sigma className="h-3 w-3 text-violet-400" />}>
        {uncertainty ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Samples" value={`${uncertainty.sampleCount}`} />
              <CandidateLine label="Mean coverage" value={`${uncertainty.meanCoveragePct.toFixed(1)}%`} />
              <CandidateLine label="95% band" value={`${uncertainty.p5CoveragePct.toFixed(1)}–${uncertainty.p95CoveragePct.toFixed(1)}%`} />
              <CandidateLine label="Worst zone" value={uncertainty.worstZoneLabel ? `${uncertainty.worstZoneLabel} (${Math.round((uncertainty.worstZonePassRate ?? 0) * 100)}%)` : "—"} />
            </div>

            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              {([8, 12, 16, 24] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setUncertaintySamples(count)}
                  className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                    uncertaintySamples === count
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                      : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                  }`}
                >
                  <div className="uppercase tracking-[0.08em]">{count} runs</div>
                  <div className="mt-0.5 text-[8px] text-[#6a748b]">
                    {count <= 8 ? "Fast preview" : count <= 16 ? "Balanced preview" : "Heavier preview"}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {uncertainty.zonePassRates.slice(0, 3).map((zone) => (
                <div key={zone.zoneId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{zone.label}</span>
                    <Badge variant={zone.passRate >= 0.8 ? "green" : zone.passRate >= 0.5 ? "amber" : "red"}>
                      {(zone.passRate * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${UI_SURFACES.card}`}>
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{ width: `${Math.max(4, zone.passRate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-[#6a748b]">
              Monte Carlo samples the current scene with camera installation and spec uncertainty, then reports the spread of coverage and critical-zone pass rates.
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">Add cameras and critical zones to compute uncertainty.</div>
        )}
      </Section>

      <Section title="Coverage Under Posture Variation" icon={<BarChart3 className="h-3 w-3 text-sky-400" />}>
        {postureVariation ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Baseline" value={postureVariation.baselineProfileLabel} />
              <CandidateLine label="Worst profile" value={postureVariation.worstProfileLabel ?? "—"} />
              <CandidateLine label="Largest drop" value={`${postureVariation.largestDropProfileLabel ?? "—"} ${formatSignedPercent(postureVariation.largestDropDeltaPct)}`} />
              <CandidateLine label="Weakest zone" value={postureVariation.worstZoneLabel ? `${postureVariation.worstZoneLabel} (${postureVariation.worstZoneProfileLabel ?? "—"})` : "—"} />
            </div>

            <div className="space-y-1.5">
              {postureVariation.profiles.map((profile) => (
                <div key={profile.profileId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{profile.label}</div>
                      <div className="mt-0.5 text-[9px] text-[#59637a]">{profile.description} · {profile.targetHeightM.toFixed(2)}m target</div>
                    </div>
                    <Badge variant={profile.label === postureVariation.worstProfileLabel ? "amber" : "gray"}>
                      {profile.totalCoveragePct.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-[9px] text-[#8b96ab] lg:grid-cols-4">
                    <div>Zones: <span className={`${UI_SURFACES.textBody2}`}>{profile.zonesPassing}/{profile.zonesTotal}</span></div>
                    <div>Recognition: <span className={`${UI_SURFACES.textBody2}`}>{profile.recognitionAreaPct.toFixed(1)}%</span></div>
                    <div>Identification: <span className={`${UI_SURFACES.textBody2}`}>{profile.identificationAreaPct.toFixed(1)}%</span></div>
                    <div>Average: <span className={`${UI_SURFACES.textBody2}`}>{profile.averageWalkableQuality.toFixed(2)}</span></div>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">
                    {profile.worstZoneLabel
                      ? `Worst zone: ${profile.worstZoneLabel} (${profile.worstZoneStatus ?? "fail"}${profile.worstZoneActualQuality ? ` · ${profile.worstZoneActualQuality}` : ""})`
                      : "No critical zones to compare."}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-[#6a748b]">
              Posture variation compares the same scene at crouching, seated, child, and standing target heights to show where a setup only works for one body posture.
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">Add cameras and critical zones to compute posture variation.</div>
        )}
      </Section>

      <Section
        title="Coverage Time Budget"
        icon={<Clock3 className="h-3 w-3 text-cyan-400" />}
        actions={activePath ? (
          <ActionButton
            label="Open Replay"
            icon={<Play className="h-3 w-3" />}
            tone="emerald"
            onClick={openReplay}
          />
        ) : null}
      >
        {timeBudget ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Threshold" value={threshold} />
              <CandidateLine label="Exposure budget" value={formatSeconds(exposureBudgetS)} />
              <CandidateLine label="First visible" value={formatSeconds(timeBudget.firstVisibleTimeS)} />
              <CandidateLine label="Budget status" value={timeBudget.budgetMet ? "Met" : "Needs faster pass"} />
            </div>

            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-5">
              {(["detection", "observation", "recognition", "identification"] as DoriQuality[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setThreshold(level)}
                  className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                    threshold === level
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                  }`}
                >
                  <div className="uppercase tracking-[0.08em]">{level}</div>
                  <div className="mt-0.5 text-[8px] text-[#6a748b]">
                    {level === "none" ? "No visibility threshold" : "Set analysis threshold"}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExposureBudgetS(1)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  exposureBudgetS === 1
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">1s budget</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Tight crossing window</div>
              </button>
              <button
                type="button"
                onClick={() => setExposureBudgetS(2)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  exposureBudgetS === 2
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">2s budget</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Default planning pace</div>
              </button>
              <button
                type="button"
                onClick={() => setExposureBudgetS(3)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  exposureBudgetS === 3
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">3s budget</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">More permissive crossing window</div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Total path" value={`${timeBudget.totalDistanceM.toFixed(1)} m`} />
              <CandidateLine label="Current duration" value={formatSeconds(timeBudget.totalDurationS)} />
              <CandidateLine label="Visible stretch" value={formatSeconds(timeBudget.visibleDurationS)} />
              <CandidateLine label="Hidden stretch" value={formatSeconds(timeBudget.hiddenDurationS)} />
            </div>

            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">Selected path</div>
                  <div className={`mt-0.5 text-[10px] ${UI_SURFACES.textBody2}`}>{activePath?.label ?? "—"}</div>
                </div>
                <Badge variant={timeBudget.budgetMet ? "green" : "amber"}>
                  {timeBudget.budgetMet ? "Budget met" : "Budget missed"}
                </Badge>
              </div>
              <div className="mt-2 space-y-1.5">
                {visibleBands.length > 0 ? (
                  visibleBands.slice(0, 3).map((segment, i) => (
                    <div key={`${segment.startDistanceM}-${segment.endDistanceM}`} className={`rounded-md border border-[#1a2030] ${UI_SURFACES.panel} px-2 py-1.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">
                          Visible segment {i + 1}
                        </span>
                        <span className={`font-mono text-[9px] ${UI_SURFACES.textBody2}`}>
                          {segment.startDistanceM.toFixed(1)}m → {segment.endDistanceM.toFixed(1)}m
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1.5 text-[9px] text-[#8b96ab]">
                        <div>Quality: <span className={`${UI_SURFACES.textBody2}`}>{segment.quality}</span></div>
                        <div>Duration: <span className={`${UI_SURFACES.textBody2}`}>{formatSeconds(segment.durationS)}</span></div>
                        <div>Min speed: <span className={`${UI_SURFACES.textBody2}`}>{segment.minSpeedMps != null ? `${segment.minSpeedMps.toFixed(1)} m/s` : "—"}</span></div>
                        <div>Status: <span className={`${UI_SURFACES.textBody2}`}>{segment.meetsBudget ? "Meets budget" : "Too slow"}</span></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`rounded-md border border-[#1a2030] ${UI_SURFACES.panel} px-2 py-1.5 text-[9px] text-[#59637a]`}>
                    No segments at or above the selected threshold were detected on the active path.
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-[#6a748b]">
              Coverage Time Budget answers the path question: how fast must the actor move to keep visible stretches inside the selected exposure budget while traversing the current scene?
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">Add a path and run simulation to compute a time budget.</div>
        )}
      </Section>

      <Section title="Coverage Uncertainty" icon={<Sigma className="h-3 w-3 text-violet-400" />}>
        {uncertainty ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Samples" value={`${uncertainty.sampleCount}`} />
              <CandidateLine label="Mean coverage" value={`${uncertainty.meanCoveragePct.toFixed(1)}%`} />
              <CandidateLine label="95% band" value={`${uncertainty.p5CoveragePct.toFixed(1)}–${uncertainty.p95CoveragePct.toFixed(1)}%`} />
              <CandidateLine label="Worst zone" value={uncertainty.worstZoneLabel ? `${uncertainty.worstZoneLabel} (${Math.round((uncertainty.worstZonePassRate ?? 0) * 100)}%)` : "—"} />
            </div>

            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setUncertaintySamples(8)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  uncertaintySamples === 8
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">8 runs</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Fast preview</div>
              </button>
              <button
                type="button"
                onClick={() => setUncertaintySamples(12)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  uncertaintySamples === 12
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">12 runs</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Balanced preview</div>
              </button>
              <button
                type="button"
                onClick={() => setUncertaintySamples(16)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  uncertaintySamples === 16
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">16 runs</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Sharper bounds</div>
              </button>
              <button
                type="button"
                onClick={() => setUncertaintySamples(24)}
                className={`rounded-md border px-2 py-1 text-left text-[9px] transition-colors ${
                  uncertaintySamples === 24
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                    : `border-[#1a2030] bg-[#0f141f] text-[#8b96ab] hover:border-[#24304a] hover:${UI_SURFACES.textBody2}`
                }`}
              >
                <div className="uppercase tracking-[0.08em]">24 runs</div>
                <div className="mt-0.5 text-[8px] text-[#6a748b]">Heavier preview</div>
              </button>
            </div>

            <div className="space-y-1.5">
              {uncertainty.zonePassRates.slice(0, 3).map((zone) => (
                <div key={zone.zoneId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{zone.label}</span>
                    <Badge variant={zone.passRate >= 0.8 ? "green" : zone.passRate >= 0.5 ? "amber" : "red"}>
                      {(zone.passRate * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${UI_SURFACES.card}`}>
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{ width: `${Math.max(4, zone.passRate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-[#6a748b]">
              Monte Carlo samples the current scene with camera mounting and spec uncertainty, then reports the spread of coverage and critical-zone pass rates.
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">Add cameras and critical zones to compute uncertainty.</div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <Section title="Occlusion Blame" icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}>
          {occlusion.length > 0 ? (
            <div className="space-y-1.5">
              {occlusion.slice(0, 3).map((entry) => (
                <div key={entry.zoneId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{entry.zoneLabel}</div>
                  <div className="mt-1 space-y-0.5">
                    {entry.obstructions.slice(0, 3).map((obstruction) => (
                      <div key={obstruction.obstructionId} className={`flex items-center justify-between gap-2 text-[9px] ${UI_SURFACES.textBody2}`}>
                        <span>{obstruction.label}</span>
                        <span className="font-mono text-[#8b96ab]">{Math.round(obstruction.blameFraction * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">No occlusion blame candidates were generated.</div>
          )}
        </Section>

        <Section
          title="Blind Spot Topology"
          icon={<AlertTriangle className="h-3 w-3 text-red-400" />}
          actions={largestBlindRegionPoint ? (
            <ActionButton
              label="Focus"
              icon={<ArrowRight className="h-3 w-3" />}
              tone="amber"
              onClick={() => {
                if (!largestBlindRegion || !largestBlindRegionPoint) return;
                openMapFocus(largestBlindRegionPoint, largestBlindRegion.affectedZoneIds[0] ?? null);
              }}
            />
          ) : null}
        >
          {blindRegions.length > 0 ? (
            <div className="space-y-1.5">
              {blindRegions.slice(0, 3).map((region) => (
                <div key={region.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{region.classification}</span>
                    <Badge variant={region.severity === "critical" ? "red" : region.severity === "high" ? "amber" : "gray"}>{region.severity}</Badge>
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textBody2}`}>{region.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">No blind regions detected.</div>
          )}
        </Section>
      </div>

      <Section title="Blind-Spot Pattern" icon={<Fingerprint className="h-3 w-3 text-fuchsia-400" />}>
        {blindSpotFingerprint ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Pattern ID" value={blindSpotFingerprint.fingerprint} />
              <CandidateLine label="Regions" value={`${blindSpotFingerprint.regionCount}`} />
              <CandidateLine label="Total blind area" value={`${blindSpotFingerprint.totalBlindAreaSqM.toFixed(1)} m²`} />
              <CandidateLine label="Affected zones" value={`${blindSpotFingerprint.affectedZoneCount}`} />
            </div>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              <CandidateLine label="Critical regions" value={`${blindSpotFingerprint.criticalRegionCount}`} />
              <CandidateLine label="Entry-linked" value={`${blindSpotFingerprint.entryConnectedRegionCount}`} />
              <CandidateLine label="Isolated" value={`${blindSpotFingerprint.isolatedRegionCount}`} />
              <CandidateLine label="Largest region" value={`${blindSpotFingerprint.largestRegionAreaSqM.toFixed(1)} m²`} />
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-2 text-[9px] text-[#8b96ab]">
              <div className="uppercase tracking-[0.08em] text-[#8b96ab]">Signature</div>
              <div className={`mt-1 ${UI_SURFACES.textBody2}`}>{blindSpotFingerprint.signature}</div>
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">Blind spot fingerprint not computed yet.</div>
        )}
      </Section>

      <Section title="Reflective Bounce Vision" icon={<Sparkles className="h-3 w-3 text-cyan-400" />}>
        {reflectiveBounce ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
              <CandidateLine label="Reflective windows" value={`${reflectiveBounce.reflectiveWindowCount}`} />
              <CandidateLine label="Affected cells" value={`${reflectiveBounce.affectedCellCount}`} />
              <CandidateLine label="Affected cameras" value={`${reflectiveBounce.affectedCameraCount}`} />
            </div>
            <div className="text-[9px] text-[#6a748b]">
              Reflective windows can act as deterministic mirror proxies when they improve quality on the far side of the reflective surface.
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-[#59637a]">No reflective bounce candidates were generated.</div>
        )}
      </Section>
    </div>
  );
}
