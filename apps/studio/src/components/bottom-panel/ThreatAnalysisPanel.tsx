"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Crosshair,
  EyeOff,
  Fence,
  Loader2,
  MapPin,
  ShieldAlert,
  Siren,
  Target,
  Timer,
  Zap,
} from "lucide-react";

import { QUALITY_ABBR, QUALITY_COLOR } from "@/lib/quality-display";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { ExposureBar } from "@/components/shared/ExposureBar";
import { StatCard } from "@/components/shared/StatCard";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


function ExposureBreakdown({ exposure }: { exposure: Record<string, number> }) {
  const keys = ["identification", "recognition", "observation", "detection"] as const;
  const maxExposure = Math.max(...keys.map((k) => exposure[k] ?? 0), 1);

  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Evidence Quality Along Route</div>
      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key}>
            <div className="mb-0.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: QUALITY_COLOR[key] }} />
                <span className={`text-[9px] uppercase tracking-[0.05em] ${UI_SURFACES.textSoftBright}`}>{key}</span>
              </div>
              <span className={`text-[9px] font-mono ${UI_SURFACES.textDimMid}`}>{(exposure[key] ?? 0).toFixed(1)}s</span>
            </div>
            <ExposureBar color={QUALITY_COLOR[key]} valuePct={((exposure[key] ?? 0) / maxExposure) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailList({
  items,
  icon,
  emptyText,
  emptyColor,
}: {
  items: string[];
  icon: React.ReactNode;
  emptyText: string;
  emptyColor?: string;
}) {
  if (items.length === 0) {
    return <div className={`text-[9px] italic ${emptyColor ?? "text-emerald-400/60"}`}>{emptyText}</div>;
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item} className={`flex items-center gap-1.5 text-[10px] ${UI_SURFACES.textSoftMuted}`}>
          <span className="flex-shrink-0">{icon}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function ThreatAnalysisPanel() {
  const result = useStudioStore((s) => s.simulationResult);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);

  const failurePath = result?.adversarialPath && result.adversarialPath.waypoints.length > 0
    ? result.adversarialPath
    : null;

  const blindspotSegments = failurePath?.coverageGapsUsed ?? [];
  const camerasWithoutCoverageOnRoute = failurePath?.camerasWithoutCoverageOnRoute ?? [];
  const criticalZonesReachable = failurePath?.criticalZonesReachableAlongRoute ?? [];
  const criticalZoneReachableAlongRoute = failurePath?.criticalZoneReachable ?? false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col gap-2 overflow-y-auto p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TruthBadge label="simulated" />
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <span className={`block text-[11px] font-semibold ${UI_SURFACES.textBody}`}>Route Exposure Review</span>
            <span className={`block text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>
              Recomputes the current site twin and refreshes authorized route visibility
            </span>
          </div>
        </div>
        <button type="button"
          onClick={runSimulation}
          disabled={simulationRunning}
          className={`inline-flex items-center gap-1.5 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-3 py-1.5 text-[10px] font-medium text-rose-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {simulationRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {simulationRunning ? "Reviewing..." : "Run Route Review"}
        </button>
      </div>

      {!failurePath ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Target className={`h-8 w-8 ${UI_SURFACES.textDim}`} />
          <p className="max-w-[240px] text-center text-[10px] leading-relaxed text-[#4d566b]">
            Run the simulation to review route exposure, uncovered sections, and reachable critical zones.
          </p>
          {!result && (
            <p className={`text-center text-[9px] ${UI_SURFACES.textDim}`}>
              No route review yet. Use the button above or &quot;Run Review&quot; in the status bar.
            </p>
          )}
        </div>
      ) : (
        <>
          {criticalZoneReachableAlongRoute && (
            <span className="flex w-fit items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-red-400">
              <Siren className="h-3 w-3" />
              Critical Zone Reachable
            </span>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            <StatCard
              icon={<Crosshair className="h-3.5 w-3.5" />}
              label="Route Exposure"
              value={failurePath.totalExposureScore.toFixed(1)}
              color="text-rose-400"
            />
            <StatCard
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Route Duration"
              value={`${failurePath.totalDurationS.toFixed(1)}s`}
            />
            <StatCard
              icon={<EyeOff className="h-3.5 w-3.5" />}
              label="Cameras Missing Route"
              value={`${camerasWithoutCoverageOnRoute.length}`}
              color="text-amber-400"
            />
            <StatCard
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Waypoints"
              value={`${failurePath.waypoints.length}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <StatCard
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Strongest Detection"
              value={`${(failurePath.maxDetectionProbability * 100).toFixed(0)}%`}
              color={failurePath.maxDetectionProbability > 0.7 ? "text-red-400" : "text-amber-400"}
            />
            <StatCard
              icon={<Fence className="h-3.5 w-3.5" />}
              label="Uncovered Sections"
              value={`${blindspotSegments.length}`}
            />
            <StatCard
              icon={<Target className="h-3.5 w-3.5" />}
              label="Critical Zones Reachable"
              value={`${criticalZonesReachable.length}`}
              color={criticalZoneReachableAlongRoute ? "text-red-400" : "text-emerald-400"}
            />
          </div>

          <ExposureBreakdown exposure={failurePath.detectionQualityExposure} />

          <div className="grid grid-cols-2 gap-1.5">
            <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
              <div className={`mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
                <EyeOff className="h-3 w-3 text-amber-400" />
                Uncovered Route Sections
              </div>
              <DetailList
                items={blindspotSegments}
                icon={<span className="text-amber-400/70">■</span>}
                emptyText="No uncovered route sections found."
                emptyColor="text-emerald-400/60"
              />
            </div>

            <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
              <div className={`mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
                <EyeOff className="h-3 w-3 text-rose-400" />
                Cameras Missing This Route
              </div>
              <DetailList
                items={camerasWithoutCoverageOnRoute.map((id) => `📷 ${id}`)}
                icon={<span className="text-rose-400/70">■</span>}
                emptyText="Route had camera coverage throughout."
              />
            </div>
          </div>

          <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
            <div className={`mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
              <Target className="h-3 w-3 text-red-400" />
              Critical Zones Reachable
            </div>
            {criticalZonesReachable.length > 0 ? (
              <div className="space-y-1">
                {criticalZonesReachable.map((zone) => (
                  <div key={zone} className="flex items-center gap-1.5 text-[10px] text-red-300">
                    <Siren className="h-3 w-3" />
                    <span>{zone}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] italic text-emerald-400/60">
                No critical zones were reachable along this route.
              </div>
            )}
          </div>

          {failurePath.failureReason && (
            <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
              <div className={`mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Coverage Finding</div>
              <p className="text-[10px] leading-relaxed text-amber-300/80">{failurePath.failureReason}</p>
            </div>
          )}

          <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Route Visibility Ribbon</span>
              <span className="text-[8px] text-[#4d566b]">{failurePath.waypoints.length} waypoints</span>
            </div>
            <div className={`flex h-3 overflow-hidden rounded-full border border-[#202536] ${UI_SURFACES.card}`}>
              {failurePath.waypoints.map((wp) => (
                <div
                  key={`${wp.timeS}-${wp.position[0]}-${wp.position[1]}`}
                  className="h-full flex-1"
                  style={{
                    backgroundColor: QUALITY_COLOR[wp.detectionQuality] ?? "#ef4444",
                    opacity: wp.detectionQuality === "none" ? 0.85 : 0.92,
                  }}
                  title={`${QUALITY_ABBR[wp.detectionQuality]} at waypoint ${wp.position[0].toFixed(1)}, ${wp.position[1].toFixed(1)}`}
                />
              ))}
            </div>
            <div className={`mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>
              <span>Entry</span>
              <span>Target</span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
