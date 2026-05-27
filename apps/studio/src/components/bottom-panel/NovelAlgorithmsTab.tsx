"use client";

import { AlertTriangle, BarChart3, MapPinned, Radar, ShieldAlert, Sigma, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";
import { useStudioStore } from "@/store/studio-store";

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function CandidateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{label}</span>
      <span className="text-[9px] font-mono text-[#d2d9e8]">{value}</span>
    </div>
  );
}

export function NovelAlgorithmsTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-[#3a4158]">
        Run simulation to populate the novel algorithm outputs.
      </div>
    );
  }

  const kRobustness = result.kRobustness;
  const placementOracle = result.placementOracle;
  const fragility = result.fragilitySummary;
  const occlusion = result.occlusionBlame ?? [];
  const anomalies = temporalProfile?.anomalyWindows ?? [];
  const blindRegions = result.blindRegions ?? [];

  const fragilityPct = fragility ? Math.round(fragility.meanFragility * 100) : null;
  const kCriticalSet = kRobustness?.criticalSets[0];
  const bestCandidate = placementOracle?.bestCandidate;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2">
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard
          icon={<Sigma className="h-3.5 w-3.5" />}
          label="Coverage Fragility"
          value={fragilityPct != null ? `${fragilityPct}%` : "—"}
          color={fragilityPct == null ? "text-[#8090a8]" : fragilityPct <= 30 ? "text-emerald-400" : fragilityPct <= 60 ? "text-amber-400" : "text-red-400"}
        />
        <StatCard
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label="K-Robustness"
          value={kRobustness ? `K=${kRobustness.kRobustness}` : "—"}
          color={kRobustness?.isRobust ? "text-emerald-400" : "text-amber-400"}
        />
        <StatCard
          icon={<MapPinned className="h-3.5 w-3.5" />}
          label="Placement Oracle"
          value={placementOracle ? `${placementOracle.candidateCount}` : "—"}
          color={bestCandidate ? "text-blue-300" : "text-[#8090a8]"}
        />
        <StatCard
          icon={<TriangleAlert className="h-3.5 w-3.5" />}
          label="Temporal Anomalies"
          value={temporalProfile ? `${anomalies.length}` : "—"}
          color={anomalies.length > 0 ? "text-amber-300" : "text-emerald-400"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Section title="Coverage Fragility" icon={<BarChart3 className="h-3 w-3 text-emerald-400" />}>
          {fragility ? (
            <div className="space-y-1.5">
              <CandidateLine label="Mean fragility" value={`${Math.round(fragility.meanFragility * 100)}%`} />
              <CandidateLine label="Fragile cells" value={`${fragility.fragileCellCount}/${fragility.totalCells}`} />
              <CandidateLine label="Robust cells" value={`${fragility.robustCellCount}`} />
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">Fragility field not computed yet.</div>
          )}
        </Section>

        <Section title="K-Robustness" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
          {kRobustness ? (
            <div className="space-y-1.5">
              <CandidateLine label="Robustness" value={`K=${kRobustness.kRobustness} / ${kRobustness.totalCameras}`} />
              <CandidateLine label="Robust setup" value={kRobustness.isRobust ? "Yes" : "No"} />
              <div className="text-[9px] text-[#8b96ab]">
                {kCriticalSet
                  ? `Critical failure set: ${kCriticalSet.cameraNames.join(", ")} (exposure ${kCriticalSet.exposureScore.toFixed(1)})`
                  : "No single failure set opened a viable route in the tested range."}
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">K-robustness not computed yet.</div>
          )}
        </Section>

        <Section title="Placement Oracle" icon={<Radar className="h-3 w-3 text-blue-300" />}>
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
                    <div className="mt-1 text-[9px] text-[#d2d9e8]">
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

        <Section title="Temporal Anomalies" icon={<TriangleAlert className="h-3 w-3 text-amber-400" />}>
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
                    <div className="mt-1 text-[9px] text-[#d2d9e8]">
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

      <div className="grid grid-cols-2 gap-2">
        <Section title="Occlusion Blame" icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}>
          {occlusion.length > 0 ? (
            <div className="space-y-1.5">
              {occlusion.slice(0, 3).map((entry) => (
                <div key={entry.zoneId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  <div className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{entry.zoneLabel}</div>
                  <div className="mt-1 space-y-0.5">
                    {entry.obstructions.slice(0, 3).map((obstruction) => (
                      <div key={obstruction.obstructionId} className="flex items-center justify-between gap-2 text-[9px] text-[#d2d9e8]">
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

        <Section title="Blind Spot Topology" icon={<AlertTriangle className="h-3 w-3 text-red-400" />}>
          {blindRegions.length > 0 ? (
            <div className="space-y-1.5">
              {blindRegions.slice(0, 3).map((region) => (
                <div key={region.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-[#8b96ab]">{region.classification}</span>
                    <Badge variant={region.severity === "critical" ? "red" : region.severity === "high" ? "amber" : "gray"}>{region.severity}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#d2d9e8]">{region.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-[#59637a]">No blind regions detected.</div>
          )}
        </Section>
      </div>
    </div>
  );
}
