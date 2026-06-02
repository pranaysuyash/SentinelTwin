"use client";

import { cn } from "@/lib/cn";
import type { SecurityIssue } from "@/schema/security-scene";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { HideSectionButton } from "./HideSectionButton";

export interface CoverageMetricsCardsProps {
  /**
   * Overall coverage percentage (0-100), or null if simulation pending.
   */
  displayCoverage: number | null;
  /**
   * A class-name generator for how the coverage text color should be rendered.
   * The function will NOT be called when `displayCoverage` is `null`.
   */
  coverageTone: (v: number) => string;
  /** Number of passed zones. */
  displayPassCount: number;
  /** Total zones. */
  displayTotalZones: number;
  /** Worst quality value. */
  displayWorstQualityValue?: string | null;
  /** Map DORI/OODPCVS level -> tailwind text-* color class. */
  QUALITY_TEXT_COLOR: Record<string, string>;
  /** Label of the worst quality (e.g., "Identifying"). */
  displayWorstQualityLabel: string | null;
  /** User-defined primary risk or null. */
  displayPrimaryRisk: string | null;
  /** Worst open issue or null. */
  displayWorstIssue: SecurityIssue | null;
  /** List of open issues. */
  displayIssues: SecurityIssue[];
  /** Number of redundancy tests that failed. */
  displayRedundancyFailCount: number;
  /** Number of cameras with redundancy configured. */
  displayRedundancyCount: number;
  /** "Just now", "20 minutes ago", etc. */
  displayRunLabel: string;
  /** Extra detail under the last-run label (timestamp). */
  lastRunDetail: ReactNode;
  /** Hides the whole metrics area. */
  onHide: () => void;
}

export function CoverageMetricsCards({
  displayCoverage,
  coverageTone,
  displayPassCount,
  displayTotalZones,
  displayWorstQualityValue,
  QUALITY_TEXT_COLOR,
  displayWorstQualityLabel,
  displayPrimaryRisk,
  displayWorstIssue,
  displayIssues,
  displayRedundancyFailCount,
  displayRedundancyCount,
  displayRunLabel,
  lastRunDetail,
  onHide,
}: CoverageMetricsCardsProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 lg:grid-cols-6">
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="-mx-1 -mt-1 mb-1 flex justify-end">
          <HideSectionButton label="summary metrics" onClick={onHide} />
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">COVERAGE</div>
        <div className={cn("text-xl font-bold tracking-tight", displayCoverage != null ? coverageTone(displayCoverage) : "text-slate-200")}>
          {displayCoverage != null ? `${Math.round(displayCoverage)}%` : "Pending"}
        </div>
        <div className="text-[10px] text-[color:var(--st-muted)]">{displayCoverage == null ? "Run baseline simulation" : "vs last run"}</div>
      </div>
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">CRITICAL ZONES</div>
        <div className={cn("text-xl font-bold", displayTotalZones > 0 && displayPassCount === displayTotalZones ? "text-emerald-300" : "text-amber-300")}>
          {displayPassCount}/{displayTotalZones}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[color:var(--st-muted)]">
          {displayTotalZones > 0 && displayPassCount < displayTotalZones ? <TriangleAlert className="h-3 w-3 text-amber-400" /> : null}
          Passing
        </div>
      </div>
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">WORST QUALITY</div>
        <div className={cn("text-xl font-bold", displayWorstQualityValue ? QUALITY_TEXT_COLOR[displayWorstQualityValue] : "text-slate-200")}>
          {displayWorstQualityLabel ?? "Pending"}
        </div>
        <div className="truncate text-[10px] text-[color:var(--st-muted)]">
          {(displayPrimaryRisk ?? displayWorstIssue?.description ?? "Baseline required").slice(0, 30)}
        </div>
      </div>
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">ISSUES</div>
        <div className={cn("text-xl font-bold", displayIssues.length > 0 ? "text-amber-300" : "text-emerald-300")}>{displayIssues.length}</div>
        <div className="text-[10px] text-[color:var(--st-muted)]">Open</div>
      </div>
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">REDUNDANCY</div>
        <div className={cn("text-xl font-bold", displayRedundancyFailCount > 0 ? "text-red-300" : displayRedundancyCount === 0 ? "text-sky-200" : "text-emerald-300")}>
          {displayRedundancyFailCount > 0 ? "FAILS" : displayRedundancyCount === 0 ? "Not set" : "OK"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[color:var(--st-muted)]">
          {displayRedundancyFailCount > 0 ? <TriangleAlert className="h-3 w-3 text-red-400" /> : null}
          {displayRedundancyFailCount > 0 ? `If CAM 1 offline` : displayRedundancyCount === 0 ? "No redundancy required" : "Coverage intact"}
        </div>
      </div>
      <div className="flex min-h-[98px] flex-col gap-1 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">LAST RUN</div>
        <div className="text-sm font-bold text-sky-200" suppressHydrationWarning>{displayRunLabel}</div>
        <div className="text-[10px] text-[color:var(--st-muted)]" suppressHydrationWarning>{lastRunDetail}</div>
      </div>
    </div>
  );
}
