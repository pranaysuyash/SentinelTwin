"use client";

import { cn } from "@/lib/cn";
import { useStudioStore, type BottomTab } from "@/store/studio-store";
import { AssumptionsTab } from "./AssumptionsTab";
import { BeforeAfterTab } from "./BeforeAfterTab";
import { CameraStatusSummaryPanel } from "./CameraStatusSummaryPanel";
import { CounterfactualPanel } from "./CounterfactualPanel";
import { DebugTab } from "./DebugTab";
import { ThreatAnalysisPanel } from "./ThreatAnalysisPanel";
import { IssuesTab } from "./IssuesTab";
import { MetricsTab } from "./MetricsTab";
import { ReportLiteTab } from "./ReportLiteTab";
import { TimelineTab } from "./TimelineTab";
import { RedundancyTab } from "./RedundancyTab";
import { TemporalProfileView } from "./TemporalProfileView";

const TABS: { id: BottomTab; label: string; hasCount?: boolean }[] = [
  { id: "metrics", label: "METRICS" },
  { id: "issues", label: "ISSUES", hasCount: true },
  { id: "timeline", label: "TIMELINE" },
  { id: "beforeafter", label: "BEFORE / AFTER" },
  { id: "assumptions", label: "ASSUMPTIONS" },
  { id: "report", label: "REPORT LITE" },
  { id: "debug", label: "DEBUG" },
];

export function BottomPanel() {
  const activeTab = useStudioStore((s) => s.bottomTab);
  const setTab = useStudioStore((s) => s.setBottomTab);
  const viewMode = useStudioStore((s) => s.viewMode);
  const result = useStudioStore((s) => s.simulationResult);
  const issueCount = result?.issues.length ?? 0;

  // Camera Wall: dedicated camera status summary (no tabs)
  if (viewMode === "wall") {
    return (
      <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex-1 overflow-hidden bg-[#0b0f17]">
          <CameraStatusSummaryPanel />
        </div>
      </div>
    );
  }

  // Compare mode: show before/after tab by default
  if (viewMode === "compare") {
    return (
      <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex items-end gap-0.5 border-b border-[#1e2130] px-1.5 pt-1.5">
          {[{ id: "beforeafter" as BottomTab, label: "COMPARISON METRICS" }, { id: "metrics" as BottomTab, label: "METRICS" }].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
                activeTab === id
                  ? "bg-[#0b0f17] text-green-300 ring-1 ring-inset ring-[#1f2536]"
                  : "text-[#59637a] hover:text-[#9da8c0]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden bg-[#0b0f17]">
          {activeTab === "metrics" ? <MetricsTab /> : <BeforeAfterTab />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
      {/* Tab strip — scrollable so 8 tabs don't overflow on narrow layouts */}
      <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto border-b border-[#1e2130] px-1.5 pt-1.5 scrollbar-none">
        {TABS.map(({ id, label, hasCount }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex-shrink-0 rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
              activeTab === id
                ? "bg-[#0b0f17] text-green-300 ring-1 ring-inset ring-[#1f2536]"
                : "text-[#59637a] hover:text-[#9da8c0]",
            )}
          >
            <span>{label}</span>
            {hasCount && issueCount > 0 ? (
              <span className="ml-1 text-red-400">({issueCount})</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden bg-[#0b0f17]">
        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "issues" && <IssuesTab />}
        {activeTab === "timeline" && <TimelineTab />}
        {activeTab === "temporal" && <TemporalProfileView />}
        {activeTab === "beforeafter" && <BeforeAfterTab />}
        {activeTab === "assumptions" && <AssumptionsTab />}
        {activeTab === "redundancy" && <RedundancyTab />}
        {activeTab === "counterfactual" && <CounterfactualPanel />}
        {activeTab === "report" && <ReportLiteTab />}
        {activeTab === "threat" && <ThreatAnalysisPanel />}
        {activeTab === "debug" && <DebugTab />}
      </div>
    </div>
  );
}
