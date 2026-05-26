"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Crosshair,
  EyeOff,
  Fence,
  MapPin,
  ShieldAlert,
  Siren,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

import { useStudioStore } from "@/store/studio-store";

// ── Quality colors ──

const QUALITY_COLORS: Record<string, string> = {
  identification: "#3b82f6",
  recognition: "#22c55e",
  observation: "#eab308",
  detection: "#f97316",
  none: "#ef4444",
};

const QUALITY_LABELS: Record<string, string> = {
  identification: "ID",
  recognition: "REC",
  observation: "OBS",
  detection: "DET",
  none: "NONE",
};

// ── Stat card ──

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-2">
        <div className={color ?? "text-[#556076]"}>
          {icon}
        </div>
        <div>
          <div className={`text-[13px] font-semibold font-mono ${color ?? "text-[#d7deed]"}`}>{value}</div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ── Exposure breakdown bars ──

function ExposureBreakdown({ exposure }: { exposure: Record<string, number> }) {
  const keys = ["identification", "recognition", "observation", "detection"] as const;
  const maxExposure = Math.max(...keys.map((k) => exposure[k] ?? 0), 1);

  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Exposure by Quality</div>
      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key}>
            <div className="mb-0.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: QUALITY_COLORS[key] }} />
                <span className="text-[9px] uppercase tracking-[0.05em] text-[#8b96ab]">{key}</span>
              </div>
              <span className="text-[9px] font-mono text-[#5b667c]">{(exposure[key] ?? 0).toFixed(1)}s</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a2333]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((exposure[key] ?? 0) / maxExposure) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: QUALITY_COLORS[key] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail items ──

function DetailList({ items, icon, emptyText, emptyColor }: {
  items: string[];
  icon: React.ReactNode;
  emptyText: string;
  emptyColor?: string;
}) {
  if (items.length === 0) {
    return (
      <div className={`text-[9px] italic ${emptyColor ?? "text-emerald-400/60"}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px] text-[#9da8c0]">
          <span className="flex-shrink-0">{icon}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ──

export function ThreatAnalysisPanel() {
  const result = useStudioStore((s) => s.simulationResult);
  const [showDetails, setShowDetails] = useState(false);
  const adversarialPath = result?.adversarialPath;

  const handleRunAnalysis = useCallback(() => {
    setShowDetails(true);
  }, []);

  const hasLoadout = adversarialPath && adversarialPath.waypoints.length > 0;

  // ── Empty state ──

  if (!showDetails || !hasLoadout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {hasLoadout ? (
          <>
            <ShieldAlert className="h-8 w-8 text-rose-400/40" />
            <p className="text-center text-[10px] text-[#5b667c] leading-relaxed max-w-[220px]">
              Coverage failure path computed. Run analysis to see detailed failure breakdown.
            </p>
            <button
              onClick={handleRunAnalysis}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 py-2 text-[10px] font-medium text-rose-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10"
            >
              <Zap className="h-3.5 w-3.5" />
              Run Coverage Failure Analysis
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center">
              <Target className="h-8 w-8 text-[#3a4158]" />
            </div>
            <p className="text-center text-[10px] text-[#4d566b] max-w-[200px] leading-relaxed">
              Run simulation first to generate a coverage failure path for analysis.
            </p>
            {!result && (
              <p className="text-[9px] text-[#3a4158]">Click &quot;Run Simulation&quot; in the status bar.</p>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Coverage failure report ──

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col gap-2 overflow-y-auto p-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span className="text-[11px] font-semibold text-[#c7d0e4]">Coverage Failure Analysis Report</span>
        </div>
        {adversarialPath.targetReached && (
          <span className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-red-400">
            <Siren className="h-3 w-3" />
            BREACH DETECTED
          </span>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard
          icon={<Crosshair className="h-3.5 w-3.5" />}
          label="Exposure Score"
          value={adversarialPath.totalExposureScore.toFixed(1)}
          color="text-rose-400"
        />
        <StatCard
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Path Duration"
          value={`${adversarialPath.totalDurationS.toFixed(1)}s`}
        />
        <StatCard
          icon={<EyeOff className="h-3.5 w-3.5" />}
          label="Cameras Affected"
          value={`${adversarialPath.camerasEvaded.length}`}
          color="text-amber-400"
        />
        <StatCard
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Waypoints"
          value={`${adversarialPath.waypoints.length}`}
        />
      </div>

      {/* Failure details */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Max Detection"
          value={`${(adversarialPath.maxDetectionProbability * 100).toFixed(0)}%`}
          color={adversarialPath.maxDetectionProbability > 0.7 ? "text-red-400" : "text-amber-400"}
        />
        <StatCard
          icon={<Fence className="h-3.5 w-3.5" />}
          label="Blindspots Used"
          value={`${adversarialPath.blindspotsExploited.length}`}
        />
        <StatCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Zones Reached"
          value={`${adversarialPath.criticalZonesReached.length}`}
          color={adversarialPath.targetReached ? "text-red-400" : "text-emerald-400"}
        />
      </div>

      {/* Exposure breakdown */}
      <ExposureBreakdown exposure={adversarialPath.detectionQualityExposure} />

      {/* Detailed lists */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Blindspots exploited */}
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
            <EyeOff className="h-3 w-3 text-amber-400" />
            Blindspots Exploited
          </div>
          <DetailList
            items={adversarialPath.blindspotsExploited}
            icon={<span className="text-amber-400/70">■</span>}
            emptyText="No blindspots exploited — coverage is solid."
            emptyColor="text-emerald-400/60"
          />
        </div>

        {/* Cameras affected */}
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
            <EyeOff className="h-3 w-3 text-rose-400" />
            Cameras Affected
          </div>
          <DetailList
            items={adversarialPath.camerasEvaded.map((id) => `📷 ${id}`)}
            icon={<span className="text-rose-400/70">■</span>}
            emptyText="All cameras detected the path."
          />
        </div>
      </div>

      {/* Critical zones reached */}
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
          <Target className="h-3 w-3 text-red-400" />
          Critical Zones Reached
        </div>
        {adversarialPath.criticalZonesReached.length > 0 ? (
          <div className="space-y-1">
            {adversarialPath.criticalZonesReached.map((zone, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-red-300">
                <Siren className="h-3 w-3" />
                <span>{zone}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[9px] italic text-emerald-400/60">
            No critical zones were reached — security perimeter held.
          </div>
        )}
      </div>

      {/* Failure reason */}
      {adversarialPath.failureReason && (
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Failure Analysis</div>
          <p className="text-[10px] text-amber-300/80 leading-relaxed">{adversarialPath.failureReason}</p>
        </div>
      )}

      {/* Waypoint quality distribution */}
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Path Coverage Ribbon</span>
          <span className="text-[8px] text-[#4d566b]">{adversarialPath.waypoints.length} waypoints</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full border border-[#202536] bg-[#111521]">
          {adversarialPath.waypoints.map((wp, i) => (
            <div
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: QUALITY_COLORS[wp.detectionQuality] ?? "#ef4444",
                opacity: wp.detectionQuality === "none" ? 0.85 : 0.92,
              }}
              title={`${QUALITY_LABELS[wp.detectionQuality]} at waypoint ${i + 1}`}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-[#556076]">
          <span>Entry</span>
          <span>Target</span>
        </div>
      </div>
    </motion.div>
  );
}
