"use client";

import { cn } from "@/lib/cn";
import { HideSectionButton } from "@/components/launcher/HideSectionButton";
import type { SecurityIssue } from "@/schema/security-scene";
import { TruthBadge } from "@/components/shared/TruthBadge";

export type SecurityStatusPanelProps = {
  displayOutcomeStatus: string;
  displayPrimaryRisk: string;
  displayIssues: SecurityIssue[];
  railWorstQuality: string;
  railNightStatus: string;
  displayCoverage: number | null;
  overallCoverageLabel: string;
  railCoveragePct: string;
  onHide: () => void;
};

export function SecurityStatusPanel({
  displayOutcomeStatus,
  displayPrimaryRisk,
  displayIssues,
  railWorstQuality,
  railNightStatus,
  displayCoverage,
  overallCoverageLabel,
  railCoveragePct,
  onHide,
}: SecurityStatusPanelProps) {
  return (
    <div className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7dd3fc]">SECURITY STATUS</div>
        <div className="flex items-center gap-2">
          <TruthBadge label={displayCoverage != null ? "simulated" : "placeholder"} />
          <HideSectionButton label="security status" onClick={onHide} />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 rounded-xl border border-[#1a2030] bg-white/[0.02] px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#8b96ab]">SITE RISK</div>
          <div className="mt-1 text-[12px] font-semibold text-white">{displayOutcomeStatus}</div>
          <div className="mt-1 text-[10px] text-[#aab7d1]">{displayPrimaryRisk}</div>
        </div>
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8b96ab]">OUTCOME SUMMARY</div>
          <div className="space-y-1">
          {[
            { id: "cash-counter", label: "Cash Counter", detail: "Recognition required", badge: displayIssues.some((i) => i.severity === "critical") ? "FAILS" : railWorstQuality, tone: "danger" as const },
            { id: "main-entry", label: "Main Entry", detail: "Minimum requirement", badge: railWorstQuality, tone: "warn" as const },
            { id: "night-mode", label: "Night Mode", detail: "Low light performance", badge: railNightStatus, tone: "warn" as const },
          ].map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-xl border border-[#1a2030] bg-white/[0.015] px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-white">{row.label}</div>
                <div className="text-[9px] text-[#8b96ab]">{row.detail}</div>
              </div>
              <span className={cn(
                "ml-2 flex-none rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]",
                row.tone === "danger"
                  ? "border-red-400/30 bg-red-500/12 text-red-300"
                  : "border-amber-400/30 bg-amber-500/12 text-amber-300",
              )}>
                {row.badge}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl border border-[#1a2030] bg-white/[0.015] px-3 py-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-white">Overall Coverage</div>
              <div className="text-[9px] text-[#8b96ab]">{overallCoverageLabel}</div>
            </div>
            <span className={cn(
              "ml-2 flex-none rounded border px-1.5 py-0.5 text-[8px] font-bold",
              displayCoverage == null ? "border-slate-400/20 bg-slate-500/8 text-slate-300" :
              displayCoverage >= 70 ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" :
              displayCoverage >= 40 ? "border-amber-400/30 bg-amber-500/12 text-amber-300" : "border-red-400/30 bg-red-500/12 text-red-300"
            )}>
              {railCoveragePct}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
