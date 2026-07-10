"use client";

import { AlertTriangle, Clock, Settings, Shield, ShieldAlert, Sun, Moon, Sunset, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ScheduleEditor } from "@/components/inspector/ScheduleEditor";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { useStudioStore } from "@/store/studio-store";
import { computeTemporalProfile } from "@sentineltwin/simulation";
import type { HourlySecuritySnapshot, TemporalAnomalyWindow, VulnerabilityWindow } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const DAY_COLORS = [
  "#22c55e", // 0  – safe
  "#84cc16", // 1
  "#eab308", // 2
  "#f97316", // 3
  "#ef4444", // 4 – dangerous
] as const;

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  high:   { bg: "bg-red-950/40",  border: "border-red-500/40",  text: "text-red-300",  icon: "#ef4444" },
  medium: { bg: "bg-orange-950/40", border: "border-orange-500/40", text: "text-orange-300", icon: "#f97316" },
  low:    { bg: "bg-yellow-950/30", border: "border-yellow-600/30", text: "text-yellow-300", icon: "#eab308" },
};

function hourToTime(h: number, m: number): string {
  if (h >= 24) return `0:${m.toString().padStart(2, "0")} AM`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function coverageScoreToColor(pct: number): string {
  if (pct >= 90) return DAY_COLORS[0];
  if (pct >= 75) return DAY_COLORS[1];
  if (pct >= 60) return DAY_COLORS[2];
  if (pct >= 40) return DAY_COLORS[3];
  return DAY_COLORS[4];
}

/** 24-hour coverage timeline bar — each 15-min slot colored by coverage */
function CoverageTimelineBar({ snapshots }: { snapshots: HourlySecuritySnapshot[] }) {
  const setTemporalScrub = useStudioStore((s) => s.setTemporalScrub);
  const scrubHour = useStudioStore((s) => s.temporalScrubHour);
  const scrubMinute = useStudioStore((s) => s.temporalScrubMinute);
  const activeSlot = useMemo(() => {
    return snapshots.findIndex((s) => s.hour === scrubHour && s.minute === scrubMinute);
  }, [snapshots, scrubHour, scrubMinute]);

  // Group 96 slots (24h × 4 per hour) into hourly segments
  const hourlyBuckets = useMemo(() => {
    const buckets: { hour: number; slots: HourlySecuritySnapshot[] }[] = [];
    for (let h = 0; h < 24; h++) {
      const slots = snapshots.filter((s) => s.hour === h);
      if (slots.length > 0) {
        buckets.push({ hour: h, slots });
      }
    }
    return buckets;
  }, [snapshots]);

  return (
    <div className="space-y-0.5">
      {/* Timeline bar */}
      <div className="flex h-3 gap-px overflow-hidden rounded">
        {snapshots.slice(0, 96).map((snap, i) => {
          const isActive = i === activeSlot;
          return (
            <button type="button"
              key={`${snap.hour}-${snap.minute}`}
              onClick={() => setTemporalScrub(snap.hour, snap.minute)}
              className={`flex-1 rounded-px transition-all cursor-pointer hover:opacity-90 ${
                isActive ? "ring-1 ring-white ring-offset-[#0b0f17] ring-offset-1" : ""
              }`}
              style={{ backgroundColor: coverageScoreToColor(snap.overallCoveragePct) }}
              title={`${hourToTime(snap.hour, snap.minute)} — ${snap.overallCoveragePct.toFixed(0)}% coverage`}
            />
          );
        })}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between px-px">
        {hourlyBuckets.map((bucket) => (
          <div
            key={bucket.hour}
            className={`text-[6px] font-mono ${UI_SURFACES.textDim}`}
            style={{ width: `${(bucket.slots.length / snapshots.length) * 100}%` }}
          >
            {bucket.hour % 6 === 0 ? `${bucket.hour}:00` : ""}
          </div>
        ))}
      </div>

      {/* State label above the bar for current position */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-medium text-green-300">
          {activeSlot >= 0 ? snapshots[activeSlot]?.stateLabel ?? "" : ""}
        </span>
        <span className={`text-[8px] font-mono ${UI_SURFACES.textMuted}`}>
          {activeSlot >= 0
            ? `${hourToTime(snapshots[activeSlot]!.hour, snapshots[activeSlot]!.minute)}`
            : ""}
        </span>
      </div>
    </div>
  );
}

function VulnerabilityCard({ window, label }: { window: VulnerabilityWindow; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const c = SEVERITY_COLORS[window.severity] ?? SEVERITY_COLORS.medium!;
  const setTemporalScrub = useStudioStore((s) => s.setTemporalScrub);

  const durationMinutes = useMemo(() => {
    const start = window.startHour * 60 + window.startMinute;
    const end = window.endHour * 60 + window.endMinute;
    return end - start;
  }, [window]);

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.icon }} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>
                {window.severity} Risk — {label}
              </span>
              <span className={`text-[8px] ${UI_SURFACES.textMuted} font-mono`}>
                {durationMinutes > 60
                  ? `${(durationMinutes / 60).toFixed(1)}h`
                  : `${durationMinutes}min`}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className={`w-2.5 h-2.5 ${UI_SURFACES.textMuted}`} />
              <span className={`text-[9px] font-mono ${UI_SURFACES.textSoftMid}`}>
                {hourToTime(window.startHour, window.startMinute)} → {hourToTime(window.endHour, window.endMinute)}
              </span>
              <button type="button"
                onClick={() => setTemporalScrub(window.startHour, window.startMinute)}
                className="text-[8px] text-blue-400 hover:text-blue-300 underline"
              >
                Jump to start
              </button>
            </div>
          </div>
        </div>
        <button type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 p-0.5 rounded hover:bg-white/5"
        >
          {expanded ? <ChevronUp className={`w-3 h-3 ${UI_SURFACES.textMuted}`} /> : <ChevronDown className={`w-3 h-3 ${UI_SURFACES.textMuted}`} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pl-5 space-y-1">
          {window.reasons.length > 0 && (
            <div>
              <span className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wide`}>Reasons</span>
              <ul className="mt-0.5 space-y-0.5">
                {window.reasons.map((reason, i) => (
                  <li key={i} className={`text-[9px] ${UI_SURFACES.textMuted5} flex items-start gap-1`}>
                    <span className="text-red-400 mt-0.5">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {window.criticalZonesFailing.length > 0 && (
            <div>
              <span className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wide`}>Failing Zones</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {window.criticalZonesFailing.map((zone) => (
                  <span key={zone} className="px-1.5 py-0.5 rounded bg-red-950/30 border border-red-800/30 text-[8px] text-red-300">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          )}
          {window.adversarialRouteAvailable && (
            <div className="flex items-center gap-1 text-[9px] text-orange-400">
              <AlertTriangle className="w-3 h-3" />
              Adversarial route available during this window
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: TemporalAnomalyWindow }) {
  const c = SEVERITY_COLORS[anomaly.severity] ?? SEVERITY_COLORS.medium!;
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[9px] font-semibold ${UI_SURFACES.textBody}`}>{anomaly.anomalyType.replace(/_/g, " ").toUpperCase()}</div>
          <div className={`text-[8px] ${UI_SURFACES.textMuted}`}>
            {anomaly.startHour.toString().padStart(2, "0")}:{anomaly.startMinute.toString().padStart(2, "0")} → {anomaly.endHour.toString().padStart(2, "0")}:{anomaly.endMinute.toString().padStart(2, "0")}
          </div>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${c.text} border ${c.border}`}>{anomaly.severity}</span>
      </div>
      <div className={`mt-1.5 text-[9px] leading-relaxed ${UI_SURFACES.textSoftMuted}`}>{anomaly.description}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {anomaly.affectedZones.slice(0, 3).map((zone) => (
          <span key={zone} className={`rounded ${UI_SURFACES.card} px-1.5 py-0.5 text-[8px] ${UI_SURFACES.textNearAlt}`}>
            {zone}
          </span>
        ))}
      </div>
    </div>
  );
}

type ForecastCondition = "clear" | "fair" | "degraded" | "watch" | "storm";

const FORECAST_STYLE: Record<ForecastCondition, { bg: string; border: string; text: string; label: string; icon: typeof Sun }> = {
  clear:    { bg: "bg-sky-950/30",    border: "border-sky-500/30",    text: "text-sky-300",    label: "Clear Skies",          icon: Sun },
  fair:     { bg: "bg-green-950/30",  border: "border-green-500/30",  text: "text-green-300",  label: "Fair",                 icon: Shield },
  degraded: { bg: "bg-yellow-950/30", border: "border-yellow-500/30", text: "text-yellow-300", label: "Degraded",             icon: AlertTriangle },
  watch:    { bg: "bg-orange-950/30", border: "border-orange-500/30", text: "text-orange-300", label: "Watch",                icon: ShieldAlert },
  storm:    { bg: "bg-red-950/40",    border: "border-red-500/40",    text: "text-red-300",    label: "Storm Warning",        icon: ShieldAlert },
};

function coverageToCondition(pct: number, highSeverityWindows: number): ForecastCondition {
  if (highSeverityWindows > 0) return "storm";
  if (pct >= 85) return "clear";
  if (pct >= 70) return "fair";
  if (pct >= 50) return "degraded";
  return "watch";
}

function ForecastStrip({
  snapshots,
  vulnerabilityWindows,
  currentHour,
  currentMinute,
}: {
  snapshots: HourlySecuritySnapshot[];
  vulnerabilityWindows: VulnerabilityWindow[];
  currentHour: number;
  currentMinute: number;
}) {
  const currentSnap = snapshots.find((s) => s.hour === currentHour && s.minute === currentMinute)
    ?? snapshots.find((s) => s.hour === currentHour);
  const currentCoverage = currentSnap?.overallCoveragePct ?? 0;
  const highCount = vulnerabilityWindows.filter((w) => w.severity === "high").length;
  const condition = coverageToCondition(currentCoverage, highCount);
  const style = FORECAST_STYLE[condition];
  const ForecastIcon = style.icon;

  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const nextWindow = vulnerabilityWindows
    .map((w) => ({ ...w, startMin: w.startHour * 60 + w.startMinute }))
    .filter((w) => w.startMin > currentTimeMinutes)
    .sort((a, b) => a.startMin - b.startMin)[0];

  const leadTimeMinutes = nextWindow ? nextWindow.startMin - currentTimeMinutes : null;
  const activeWindow = vulnerabilityWindows.find((w) => {
    const start = w.startHour * 60 + w.startMinute;
    const end = w.endHour * 60 + w.endMinute;
    return currentTimeMinutes >= start && currentTimeMinutes < end;
  });

  return (
    <div className={`flex items-center gap-3 rounded-lg border ${style.border} ${style.bg} px-3 py-2`}>
      <ForecastIcon className={`w-5 h-5 flex-shrink-0 ${style.text}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-[11px] font-bold ${style.text}`}>{style.label}</span>
          <span className={`text-[9px] font-mono ${UI_SURFACES.textSoftMid}`}>
            {Math.round(currentCoverage)}% coverage at {hourToTime(currentHour, currentMinute)}
            {currentSnap?.crowdAgentCount != null && currentSnap.crowdAgentCount > 0 && (
              <> · {currentSnap.crowdAgentCount} people on site</>
            )}
          </span>
        </div>
        <div className={`text-[9px] ${UI_SURFACES.textMuted5} mt-0.5`}>
          {activeWindow ? (
            <span className="text-red-300">
              Vulnerability window active. Duration: {(() => {
                const end = activeWindow.endHour * 60 + activeWindow.endMinute;
                const remaining = end - currentTimeMinutes;
                return remaining > 60 ? `${(remaining / 60).toFixed(0)}h ${remaining % 60}min` : `${remaining} minutes`;
              })()}{" "}remaining.
            </span>
          ) : nextWindow && leadTimeMinutes != null && leadTimeMinutes <= 120 ? (
            <span className="text-amber-300">
              Vulnerability window opens in {leadTimeMinutes > 60
                ? `${Math.floor(leadTimeMinutes / 60)}h ${leadTimeMinutes % 60}min`
                : `${leadTimeMinutes} minutes`}.
              Duration: {(() => {
                const dur = (nextWindow.endHour * 60 + nextWindow.endMinute) - nextWindow.startMin;
                return dur > 60 ? `${Math.floor(dur / 60)}h ${dur % 60}min` : `${dur} minutes`;
              })()}.
            </span>
          ) : condition === "clear" ? (
            "All clear. No vulnerability windows approaching."
          ) : condition === "fair" ? (
            "Coverage nominal. Monitor for changes."
          ) : (
            `${vulnerabilityWindows.length} vulnerability window${vulnerabilityWindows.length !== 1 ? "s" : ""} in the 24h forecast.`
          )}
        </div>
      </div>
      {condition === "storm" && (
        <span className="flex-shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-red-300 animate-pulse">
          Severe
        </span>
      )}
    </div>
  );
}

function StateTransitionMap({ snapshots }: { snapshots: HourlySecuritySnapshot[] }) {
  // Show unique state labels with their time ranges
  const states = useMemo(() => {
    const unique: { label: string; start: number; end: number }[] = [];
    for (const snap of snapshots) {
      const last = unique[unique.length - 1];
      if (last && last.label === snap.stateLabel) {
        last.end = snap.hour + snap.minute / 60;
      } else {
        unique.push({
          label: snap.stateLabel,
          start: snap.hour + snap.minute / 60,
          end: snap.hour + snap.minute / 60,
        });
      }
    }
    return unique;
  }, [snapshots]);

  const STATE_COLORS: Record<string, string> = {
    "Business Hours": "#22c55e",
    "Morning": "#84cc16",
    "Staff Arrival": "#86efac",
    "Peak Hours": "#22c55e",
    "Afternoon": "#84cc16",
    "Closing": "#eab308",
    "After Hours": "#f97316",
    "Cleaning": "#facc15",
    "Night": "#6b21a8",
    "Deep Night": "#581c87",
    "Timer Cutout": "#dc2626",
    "Pre-Dawn": "#9333ea",
    "Daylight": "#22c55e",
    "Midnight": "#4c1d95",
    "Dusk": "#f97316",
    "Dawn": "#a855f7",
  };

  return (
    <div className="flex h-2 gap-px overflow-hidden rounded">
      {states.map((state) => {
        const color = STATE_COLORS[state.label] ?? "#4a5568";
        const pct = ((state.end - state.start) / 24) * 100;
        return (
          <div
            key={state.label}
            className="h-full flex-shrink-0"
            style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
            title={`${state.label}: ${hourToTime(Math.floor(state.start), 0)} — ${hourToTime(Math.floor(state.end), 0)}`}
          />
        );
      })}
    </div>
  );
}

function generateTemporalProfileSnapshot(
  snapshots: HourlySecuritySnapshot[],
): { coveragePct: number; zoneCount: number; zoneTotal: number; safe: boolean } {
  if (snapshots.length === 0) return { coveragePct: 0, zoneCount: 0, zoneTotal: 0, safe: false };
  // Average coverage across the worst 4 hours
  const sorted = [...snapshots].sort((a, b) => a.overallCoveragePct - b.overallCoveragePct);
  const worst4 = sorted.slice(0, Math.min(4, sorted.length));
  const avg = worst4.reduce((sum, s) => sum + s.overallCoveragePct, 0) / worst4.length;
  const worst = sorted[0]!;
  return {
    coveragePct: Math.round(avg),
    zoneCount: worst.criticalZonePassCount,
    zoneTotal: worst.criticalZoneTotalCount,
    safe: worst.overallCoveragePct >= 80 && worst.criticalZonePassCount === worst.criticalZoneTotalCount,
  };
}

export function TemporalProfileView() {
  const scene = useStudioStore((s) => s.scene);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);
  const setTemporalProfile = useStudioStore((s) => s.setTemporalProfile);
  const temporalScrubHour = useStudioStore((s) => s.temporalScrubHour);
  const temporalScrubMinute = useStudioStore((s) => s.temporalScrubMinute);
  const environmentMode = useStudioStore((s) => s.environmentMode);
  const [loading, setLoading] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  const handleCompute = useCallback(() => {
    setLoading(true);
    // Defer computation to let React commit the loading state render first
    requestAnimationFrame(() => {
      const profile = computeTemporalProfile(scene as never);
      setTemporalProfile(profile);
      setLoading(false);
    });
  }, [scene, setTemporalProfile]);

  const snapshot = useMemo(
    () => temporalProfile ? generateTemporalProfileSnapshot(temporalProfile.hourlySnapshots) : null,
    [temporalProfile],
  );

  // Display: if no profile yet, show compute prompt; else show full dashboard
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header row */}
      <div className={`{flex items-center justify-between px-3 py-1.5 border-b ${UI_SURFACES.borderPanel} flex-shrink-0}`}>
        <div className="flex items-center gap-2">
          <TruthBadge label="simulated" />
          <Clock className="w-3.5 h-3.5 text-green-400" />
          <span className={`text-[10px] font-semibold ${UI_SURFACES.textBody}`}>Temporal Security Profile</span>
          {temporalProfile && (
            <span className={`text-[8px] ${UI_SURFACES.textMuted} font-mono`}>
              {temporalProfile.hourlySnapshots.length} samples
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowScheduleEditor((v) => !v)}
            title="Configure site schedule"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-colors ${
              showScheduleEditor
                ? `${UI_SURFACES.hoverBgDark} border ${UI_SURFACES.borderDark} ${UI_SURFACES.textBody}`
                : "${UI_SURFACES.chip} ${UI_SURFACES.hoverBgDark} ${UI_SURFACES.textMuted5}"
            }`}
          >
            <Settings className="w-3 h-3" />
            Schedule
          </button>
          <button type="button"
            onClick={handleCompute}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-1 rounded ${UI_SURFACES.chip} ${UI_SURFACES.hoverBgDark} text-[9px] ${UI_SURFACES.textMuted5} transition-colors disabled:opacity-50`}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Computing..." : temporalProfile ? "Recompute" : "Compute 24h Profile"}
          </button>
        </div>
      </div>

      {/* Collapsible schedule editor */}
      {showScheduleEditor && (
        <div className={`{border-b ${UI_SURFACES.borderPanel} overflow-y-auto max-h-[280px] flex-shrink-0}`}>
          <div className="px-2 pt-1.5 pb-0.5">
            <span className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Site Schedule Configuration</span>
          </div>
          <ScheduleEditor />
        </div>
      )}

      {!temporalProfile ? (
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 text-[11px] ${UI_SURFACES.textDim}`}>
          <Clock className={`w-8 h-8 ${UI_SURFACES.textMuted}`} />
          <div className="text-center">
            <p className={`${UI_SURFACES.textMuted} font-medium`}>No temporal profile computed</p>
            <p className={`text-[9px] ${UI_SURFACES.textDim} mt-1`}>
              Analyze security posture across 24 hours — vulnerability windows, safest periods, and coverage changes.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* ── Summary cards ── */}
          <div className={`{grid grid-cols-3 gap-2 px-3 py-2 border-b ${UI_SURFACES.borderPanel}}`}>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2.5 py-2}`}>
              <div className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wide`}>Worst Coverage</div>
              <div className={`text-[18px] font-bold font-mono mt-0.5 ${
                snapshot && snapshot.coveragePct >= 75 ? "text-green-400"
                  : snapshot && snapshot.coveragePct >= 50 ? "text-yellow-400"
                  : "text-red-400"
              }`}>
                {snapshot ? `${snapshot.coveragePct}%` : "—"}
              </div>
              <div className={`text-[8px] ${UI_SURFACES.textDim} mt-0.5`}>4-hour trough average</div>
            </div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2.5 py-2}`}>
              <div className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wide`}>Vulnerability Windows</div>
              <div className="text-[18px] font-bold font-mono mt-0.5 text-orange-400">
                {temporalProfile.peakVulnerabilityWindows.length}
              </div>
              <div className={`text-[8px] ${UI_SURFACES.textDim} mt-0.5`}>
                {temporalProfile.peakVulnerabilityWindows.filter(w => w.severity === "high").length} high severity
              </div>
            </div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2.5 py-2}`}>
              <div className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wide`}>Safe Periods</div>
              <div className="text-[18px] font-bold font-mono mt-0.5 text-green-400">
                {temporalProfile.safestPeriods.length}
              </div>
              <div className={`text-[8px] ${UI_SURFACES.textDim} mt-0.5`}>periods with full coverage</div>
            </div>
          </div>

          {/* ── FORECAST strip ── */}
          <div className={`{px-3 py-2 border-b ${UI_SURFACES.borderPanel}}`}>
            <ForecastStrip
              snapshots={temporalProfile.hourlySnapshots}
              vulnerabilityWindows={temporalProfile.peakVulnerabilityWindows}
              currentHour={temporalScrubHour}
              currentMinute={temporalScrubMinute}
            />
          </div>

          {/* ── Current time indicator ── */}
          <div className={`{flex items-center gap-2 px-3 py-1.5 border-b ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt}}`}>
            <span className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wider`}>Current</span>
            <span className="text-[10px] font-bold font-mono text-white">
              {hourToTime(temporalScrubHour, temporalScrubMinute)}
            </span>
            <span className={`text-[8px] ${UI_SURFACES.textSoftMid}`}>
              {environmentMode === "night" ? "Night" : environmentMode === "dusk" ? "Dusk" : "Day"} mode
            </span>
            <div className="flex items-center gap-1 ml-1">
              {environmentMode === "night" ? <Moon className="w-2.5 h-2.5 text-[#6b21a8]" />
                : environmentMode === "dusk" ? <Sunset className="w-2.5 h-2.5 text-orange-400" />
                : <Sun className="w-2.5 h-2.5 text-yellow-400" />}
            </div>
          </div>

          {/* ── State transition map ── */}
          <div className={`{px-3 py-1.5 border-b ${UI_SURFACES.borderPanel}}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wider`}>State Timeline</span>
              <span className={`text-[7px] ${UI_SURFACES.textDim}`}>Hover for state details</span>
            </div>
            <StateTransitionMap snapshots={temporalProfile.hourlySnapshots} />
          </div>

          {/* ── Coverage Timeline ── */}
          <div className={`{px-3 py-1.5 border-b ${UI_SURFACES.borderPanel}}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[8px] ${UI_SURFACES.textMuted} uppercase tracking-wider`}>Coverage Over 24 Hours</span>
              <span className={`text-[7px] ${UI_SURFACES.textDim}`}>Click to scrub</span>
            </div>
            <CoverageTimelineBar snapshots={temporalProfile.hourlySnapshots} />
          </div>

          {/* ── Latest snapshot details ── */}
          <div className={`{px-3 py-1.5 border-b ${UI_SURFACES.borderPanel}}`}>
            <div className={`flex items-center gap-3 text-[8px] ${UI_SURFACES.textMuted}`}>
              <span>Active Cameras: <span className={`${UI_SURFACES.textBody} font-semibold`}>
                {temporalProfile.hourlySnapshots.find(s => s.hour === temporalScrubHour)?.activeCameraCount ?? 0}
              </span></span>
              <span>Active Lights: <span className={`${UI_SURFACES.textBody} font-semibold`}>
                {temporalProfile.hourlySnapshots.find(s => s.hour === temporalScrubHour)?.activeLightCount ?? 0}
              </span></span>
              <span>Zones: <span className={`${UI_SURFACES.textBody} font-semibold`}>
                {temporalProfile.hourlySnapshots.find(s => s.hour === temporalScrubHour)?.criticalZonePassCount ?? 0}
                /{temporalProfile.hourlySnapshots.find(s => s.hour === temporalScrubHour)?.criticalZoneTotalCount ?? 0}
              </span></span>
            </div>
          </div>

          {/* ── Vulnerability Windows ── */}
          {temporalProfile.peakVulnerabilityWindows.length > 0 && (
            <div className={`{px-3 py-2 border-b ${UI_SURFACES.borderPanel}}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="w-3 h-3 text-orange-400" />
                <span className={`text-[9px] font-semibold ${UI_SURFACES.textBody}`}>Vulnerability Windows</span>
                <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>
                  ({temporalProfile.peakVulnerabilityWindows.length} found)
                </span>
              </div>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {temporalProfile.peakVulnerabilityWindows.map((window, i) => (
                  <VulnerabilityCard
                    key={`${window.startHour}:${window.startMinute}-${window.endHour}:${window.endMinute}`}
                    window={window}
                    label={`Window ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Temporal Anomalies ── */}
          {temporalProfile.anomalyWindows.length > 0 && (
            <div className={`{px-3 py-2 border-b ${UI_SURFACES.borderPanel}}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className={`text-[9px] font-semibold ${UI_SURFACES.textBody}`}>Temporal Anomalies</span>
                <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>
                  ({temporalProfile.anomalyWindows.length} found)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2 py-1}`}>
                  <div className={`text-[9px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>High</div>
                  <div className="text-[14px] font-bold text-red-400">{temporalProfile.anomalySummary?.highSeverityCount ?? 0}</div>
                </div>
                <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2 py-1}`}>
                  <div className={`text-[7px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Medium</div>
                  <div className="text-[14px] font-bold text-orange-300">{temporalProfile.anomalySummary?.mediumSeverityCount ?? 0}</div>
                </div>
                <div className={`{rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2 py-1}`}>
                  <div className={`text-[7px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Low</div>
                  <div className="text-[14px] font-bold text-yellow-300">{temporalProfile.anomalySummary?.lowSeverityCount ?? 0}</div>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {temporalProfile.anomalyWindows.map((anomaly, i) => (
                  <AnomalyCard key={`${anomaly.startHour}:${anomaly.startMinute}-${anomaly.endHour}:${anomaly.endMinute}-${i}`} anomaly={anomaly} />
                ))}
              </div>
            </div>
          )}

          {/* ── Safest Periods ── */}
          {temporalProfile.safestPeriods.length > 0 && (
            <div className={`{px-3 py-2 border-b ${UI_SURFACES.borderPanel}}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Shield className="w-3 h-3 text-green-400" />
                <span className={`text-[9px] font-semibold ${UI_SURFACES.textBody}`}>Safest Periods</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {temporalProfile.safestPeriods.map((period) => (
                  <div key={`${period.startHour}-${period.endHour}`} className="px-2 py-1 rounded bg-green-950/30 border border-green-800/30">
                    <span className="text-[8px] text-green-300 font-mono">
                      {hourToTime(period.startHour, 0)} — {period.endHour >= 24 ? "Midnight" : hourToTime(period.endHour, 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Coverage by critical zone ── */}
          {Object.keys(temporalProfile.criticalZoneCoverageByHour).length > 0 && (
            <div className="px-3 py-2">
              <div className={`text-[9px] font-semibold ${UI_SURFACES.textBody} mb-1.5`}>Zone Coverage Stability</div>
              <div className="space-y-1">
                {Object.entries(temporalProfile.criticalZoneCoverageByHour).map(([zoneLabel, values]) => {
              const numValues = values as number[];
              const avg = numValues.reduce((s, v) => s + v, 0) / numValues.length;
              const variance = numValues.reduce((s, v) => s + (v - avg) ** 2, 0) / numValues.length;
                  const stable = variance < 100;
                  return (
                    <div key={zoneLabel} className="flex items-center gap-2">
                      <span className={`text-[8px] ${UI_SURFACES.textMuted5} w-24 truncate`}>{zoneLabel}</span>
                      <div className={`flex-1 h-1 rounded-full ${UI_SURFACES.chip}`}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(avg)}%`,
                            backgroundColor: stable ? "#22c55e" : variance > 400 ? "#ef4444" : "#eab308",
                          }}
                        />
                      </div>
                      <span className={`text-[8px] font-mono min-w-[32px] text-right ${
                        avg >= 80 ? "text-green-400" : avg >= 50 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {Math.round(avg)}%
                      </span>
                      <span className={`text-[7px] ${stable ? "text-green-500" : "text-orange-400"}`}>
                        {stable ? "stable" : "volatile"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
