"use client";

import { cn } from "@/lib/cn";
import { useStudioStore, type BottomTab } from "@/store/studio-store";
import { BeforeAfterTab } from "./BeforeAfterTab";
import { DebugTab } from "./DebugTab";
import { IssuesTab } from "./IssuesTab";
import { MetricsTab } from "./MetricsTab";
import { ReportLiteTab } from "./ReportLiteTab";
import { TimelineTab } from "./TimelineTab";

const TABS: { id: BottomTab; label: string; hasCount?: boolean }[] = [
  { id: "metrics", label: "METRICS" },
  { id: "issues", label: "ISSUES", hasCount: true },
  { id: "timeline", label: "TIMELINE" },
  { id: "beforeafter", label: "BEFORE / AFTER" },
  { id: "report", label: "REPORT LITE" },
  { id: "debug", label: "DEBUG" },
];

export function BottomPanel() {
  const activeTab = useStudioStore((s) => s.bottomTab);
  const setTab = useStudioStore((s) => s.setBottomTab);
  const result = useStudioStore((s) => s.simulationResult);
  const issueCount = result?.issues.length ?? 0;

  return (
    <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
      <div className="flex items-end gap-0.5 border-b border-[#1e2130] px-1.5 pt-1.5">
        {TABS.map(({ id, label, hasCount }) => (
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
        {activeTab === "beforeafter" && <BeforeAfterTab />}
        {activeTab === "report" && <ReportLiteTab />}
        {activeTab === "debug" && <DebugTab />}
      </div>
    </div>
  );
}
