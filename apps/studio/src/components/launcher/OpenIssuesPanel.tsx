"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { HideSectionButton } from "@/components/launcher/HideSectionButton";
import type { SecurityIssue } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function issueSeverityLabel(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
    default:
      return "Low";
  }
}

function issueSeverityTone(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "text-red-300";
    case "high":
      return "text-orange-300";
    case "medium":
      return "text-amber-300";
    default:
      return "text-sky-300";
  }
}

export type OpenIssuesPanelProps = {
  displayIssues: SecurityIssue[];
  onOpenIssues: () => void;
  onHide: () => void;
};

export function OpenIssuesPanel({
  displayIssues,
  onOpenIssues,
  onHide,
}: OpenIssuesPanelProps) {
  return (
    <div className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
          OPEN ISSUES ({displayIssues.length})
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenIssues} className="text-[10px] text-sky-300 hover:text-sky-200">
            View all
          </button>
          <HideSectionButton label="open issues" onClick={onHide} />
        </div>
      </div>
      {displayIssues.length > 0 ? (
        <div className="mt-2 space-y-1">
          {displayIssues.slice(0, 4).map((issue, index) => (
            <button
              key={`issue-${index}`}
              type="button"
              onClick={onOpenIssues}
              className={`group w-full rounded-xl border UI_SURFACES.borderFaint bg-white/[0.015] p-2.5 text-left transition-colors hover:border-amber-400/20 hover:bg-amber-500/5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 flex-none rounded-full",
                      issue.severity === "critical" ? "bg-red-400" :
                      issue.severity === "high" ? "bg-orange-400" :
                      issue.severity === "medium" ? "bg-amber-400" : "bg-sky-400"
                    )} />
                    <span className={cn("text-[9px] font-bold uppercase tracking-[0.12em]", issueSeverityTone(issue.severity))}>
                      {issueSeverityLabel(issue.severity)}
                    </span>
                  </div>
                  <div className={`mt-1 text-[10px] leading-[1.4] UI_SURFACES.textBody`}>{issue.description}</div>
                </div>
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-none text-[color:var(--st-muted)] opacity-40 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenIssues}
            className={`w-full rounded-xl border border-dashed border-[color:var(--st-border)] px-3 py-2 text-[10px] UI_SURFACES.textSoftBright transition-colors hover:text-white`}
          >
            See all issues &amp; recommendations
          </button>
        </div>
      ) : (
        <div className={`mt-2 rounded-xl border UI_SURFACES.borderFaint bg-white/[0.015] px-3 py-2 text-[10px] leading-4 UI_SURFACES.textSoftBright`}>
          No open issues in the latest review. Run a fresh review after changes to confirm the current site state.
        </div>
      )}
    </div>
  );
}
