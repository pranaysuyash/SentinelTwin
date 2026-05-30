"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { useStudioStore, type BottomTab } from "@/store/studio-store";
import { AssumptionsTab } from "./AssumptionsTab";
import { BeforeAfterTab } from "./BeforeAfterTab";
import { CameraStatusSummaryPanel } from "./CameraStatusSummaryPanel";
import { CounterfactualPanel } from "./CounterfactualPanel";
import { DebugTab } from "./DebugTab";
import { GovernanceTab } from "./GovernanceTab";
import { SceneIntelligenceTab } from "./SceneIntelligenceTab";
import { ThreatAnalysisPanel } from "./ThreatAnalysisPanel";
import { IssuesTab } from "./IssuesTab";
import { MetricsTab } from "./MetricsTab";
import { NovelAlgorithmsTab } from "./NovelAlgorithmsTab";
import { ReportLiteTab } from "./ReportLiteTab";
import { HelpTab } from "./HelpTab";
import { TimelineTab } from "./TimelineTab";
import { RedundancyTab } from "./RedundancyTab";
import { CoverageBudgetTab } from "./CoverageBudgetTab";
import { SensorsTab } from "./SensorsTab";
import { TemporalProfileView } from "./TemporalProfileView";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";

const PANEL_EXPLAINERS: Record<BottomTab, string> = {
  outcome: "Security verdict, top failures, camera responsibility, redundancy, and recommended next actions.",
  metrics: "Coverage quality totals and health indicators for the current scene assumptions.",
  issues: "Prioritized issue stack with scene focus controls and fix handoff actions.",
  sensors: "Sensor layer summary and live schema-backed sensor inventory.",
  timeline: "Path replay visibility over time, including where coverage is lost.",
  temporal: "24-hour environment profile showing vulnerable windows and safest periods.",
  beforeafter: "Baseline vs proposed snapshots with delta metrics and outcome changes.",
  assumptions: "Model assumptions that qualify all simulation claims and report language.",
  provenance: "Evidence graph: what data and operations produced the current result.",
  governance: "Role, approval, and publish policy controls for the scene control plane.",
  redundancy: "Single-point-failure checks and camera-offline impact review.",
  counterfactual: "What-if simulation lane for proposed scene changes before applying them.",
  threat: "Defensive coverage-failure analysis for hardening, not attacker optimization.",
  novel: "Advanced experimental signals used for deeper analysis and diagnostics.",
  report: "Client-facing summary output with exports from the same simulation evidence.",
  help: "Workflow guidance and shortcuts for first-run and power-user operation.",
  debug: "Low-level inspection output for implementation and troubleshooting.",
  budgeting: "Hardware cost estimation based on camera presets, light models, and obstruction move costs.",
};

const TABS: { id: BottomTab; label: string; hasCount?: boolean }[] = [
  { id: "outcome", label: "SECURITY OUTCOME" },
  { id: "metrics", label: "METRICS" },
  { id: "sensors", label: "SENSORS" },
  { id: "issues", label: "ISSUES", hasCount: true },
  { id: "timeline", label: "TIMELINE" },
  { id: "temporal", label: "24H PROFILE" },
  { id: "beforeafter", label: "BEFORE / AFTER" },
  { id: "assumptions", label: "ASSUMPTIONS" },
  { id: "governance", label: "GOVERNANCE" },
  { id: "provenance", label: "PROVENANCE" },
  { id: "redundancy", label: "REDUNDANCY" },
  { id: "budgeting", label: "BUDGET" },
  { id: "counterfactual", label: "COUNTERFACTUAL" },
  { id: "threat", label: "THREAT REVIEW" },
  { id: "novel", label: "NOVEL ALGORITHMS" },
  { id: "report", label: "REPORT LITE" },
  { id: "help", label: "HELP" },
  { id: "debug", label: "DEBUG" },
];

function getTabLabel(tab: BottomTab) {
  return TABS.find((entry) => entry.id === tab)?.label ?? tab.toUpperCase();
}

function TabBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "amber" | "red" }) {
  const toneClass = {
    slate: "border-[#273246] bg-[#111521] text-[#8ea5cc]",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
  }[tone];

  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${toneClass}`}>
      {children}
    </span>
  );
}

export function BottomPanel() {
  const activeTab = useStudioStore((s) => s.bottomTab);
  const setTab = useStudioStore((s) => s.setBottomTab);
  const setBottomDrawerMode = useStudioStore((s) => s.setBottomDrawerMode);
  const viewMode = useStudioStore((s) => s.viewMode);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const enabledAnalysisModules = useStudioStore((s) => s.enabledAnalysisModules);
  const bottomDrawerMode = useStudioStore((s) => s.bottomDrawerMode);
  const pinnedAnalysisModule = useStudioStore((s) => s.pinnedAnalysisModule);
  const result = useStudioStore((s) => s.simulationResult);
  const issueCount = result?.issues.length ?? 0;
  const [showPanelExplain, setShowPanelExplain] = useState(false);
  const enabledTabs = TABS.filter((tab) => enabledAnalysisModules[tab.id]);
  const activeTabSafe = enabledAnalysisModules[activeTab] ? activeTab : enabledTabs[0]?.id ?? "metrics";
  const singleModuleTab = pinnedAnalysisModule && enabledAnalysisModules[pinnedAnalysisModule]
    ? pinnedAnalysisModule
    : activeTabSafe;
  const panelExplainer = PANEL_EXPLAINERS[activeTabSafe] ?? "Analysis module details.";

  const renderTab = (tab: BottomTab) => {
    switch (tab) {
      case "outcome":
        return <SecurityOutcomePanel />;
      case "metrics":
        return <MetricsTab />;
      case "sensors":
        return <SensorsTab />;
      case "issues":
        return <IssuesTab />;
      case "timeline":
        return <TimelineTab />;
      case "temporal":
        return <TemporalProfileView />;
      case "beforeafter":
        return <BeforeAfterTab />;
      case "assumptions":
        return <AssumptionsTab />;
      case "governance":
        return <GovernanceTab />;
      case "provenance":
        return <SceneIntelligenceTab />;
      case "redundancy":
        return <RedundancyTab />;
      case "budgeting":
        return <CoverageBudgetTab />;
      case "counterfactual":
        return <CounterfactualPanel />;
      case "threat":
        return <ThreatAnalysisPanel />;
      case "novel":
        return <NovelAlgorithmsTab />;
      case "report":
        return <ReportLiteTab />;
      case "help":
        return <HelpTab />;
      case "debug":
        return <DebugTab />;
      default:
        return <MetricsTab />;
    }
  };

  // Camera Wall: dedicated camera status summary (no tabs)
  if (workspacePreset === "camera_wall") {
    return (
      <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex items-center gap-2 border-b border-[#1e2130] px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">Camera Wall Summary</div>
          <TabBadge tone="blue">Live multiview</TabBadge>
          <div className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[#6a7b99]">Focus on active feeds and coverage gaps</div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#0b0f17]">
          <CameraStatusSummaryPanel />
        </div>
      </div>
    );
  }

  if (bottomDrawerMode === "hidden") {
    return (
      <div className="flex h-[72px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex h-full items-center gap-2 px-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">Analysis Drawer Hidden</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#6a7b99]">
            {workspacePreset.replace(/_/g, " ")} · {enabledTabs.length > 0 ? `${enabledTabs.length} modules available` : "No modules enabled"}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[10px] font-semibold text-[#8ea5cc]">
              {getTabLabel(singleModuleTab)}
            </span>
            <button
              type="button"
              onClick={() => {
                setBottomDrawerMode("single_module");
                setTab(singleModuleTab);
              }}
              className="rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[10px] font-semibold text-[#d7deed] transition-colors hover:border-sky-400/30 hover:text-white"
            >
              Show Current Module
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bottomDrawerMode === "single_module") {
    return (
      <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex items-center gap-2 border-b border-[#1e2130] px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">Single-Module Drawer</div>
          <TabBadge tone="amber">{getTabLabel(singleModuleTab)}</TabBadge>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBottomDrawerMode("tabs")}
              className="rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[10px] font-semibold text-[#d7deed] transition-colors hover:border-sky-400/30 hover:text-white"
            >
              Show Tabs
            </button>
            <button
              type="button"
              onClick={() => setBottomDrawerMode("hidden")}
              className="rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[10px] font-semibold text-[#d7deed] transition-colors hover:border-amber-400/30 hover:text-white"
            >
              Hide Drawer
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#0b0f17]">
          {renderTab(singleModuleTab)}
        </div>
      </div>
    );
  }

  // Compare mode: show before/after tab by default
  if (viewMode === "compare") {
    const compareTabs = enabledTabs.filter((tab) => tab.id === "beforeafter" || tab.id === "metrics" || tab.id === "outcome");
    const compareActiveTab = compareTabs.some((tab) => tab.id === activeTabSafe) ? activeTabSafe : compareTabs[0]?.id ?? activeTabSafe;
    return (
      <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
        <div className="flex items-center gap-2 border-b border-[#1e2130] px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">Compare Drawer</div>
          <TabBadge tone="green">Before / After</TabBadge>
          <div className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[#6a7b99]">Snapshot deltas and comparison metrics</div>
        </div>
        <div className="flex items-end gap-0.5 border-b border-[#1e2130] px-1.5 pt-1.5">
          {compareTabs.map(({ id }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
                compareActiveTab === id
                  ? "bg-[#0b0f17] text-green-300 ring-1 ring-inset ring-[#1f2536]"
                  : "text-[#59637a] hover:text-[#9da8c0]",
              )}
            >
              {getTabLabel(id)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden bg-[#0b0f17]">
          {renderTab(compareActiveTab)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
      {/* Tab strip — scrollable so the dock tabs don't overflow on narrow layouts */}
      <div className="flex min-w-0 items-center gap-2 border-b border-[#1e2130] px-3 py-1.5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">Analysis Drawer</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#6a7b99]">
            {viewMode === "replay"
              ? "Timeline-first replay analysis"
              : viewMode === "camera_view"
                ? "Single-camera evidence and DORI"
                : "Metrics, issues, timeline, provenance, report, and help"}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPanelExplain((state) => !state)}
            className="rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[10px] text-[#9bb0cf] transition-colors hover:border-sky-400/30 hover:text-white"
          >
            Explain this panel
          </button>
          <TabBadge tone={issueCount > 0 ? "red" : "green"}>
            {issueCount > 0 ? `${issueCount} issues` : "No issues"}
          </TabBadge>
          <TabBadge tone={viewMode === "replay" ? "blue" : "slate"}>
            {viewMode.replace(/_/g, " ")}
          </TabBadge>
        </div>
      </div>

      <div className="relative flex min-w-0 items-end gap-0.5 border-b border-[#1e2130] px-1.5 pt-1.5">
        {/* Scroll fade hint */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-[#0d1017] to-transparent" />
        <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto scrollbar-none">
          {enabledTabs.map(({ id, label, hasCount }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex-shrink-0 rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
                activeTabSafe === id
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
      </div>

      {showPanelExplain ? (
        <div className="border-b border-[#1e2130] bg-[#0f141f] px-3 py-1.5 text-[11px] text-[#9bb0cf]">
          <span className="font-medium text-[#d8e5ff]">{getTabLabel(activeTabSafe)}:</span> {panelExplainer}
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden bg-[#0b0f17]">
        {enabledTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-[#72809a]">
            All analysis modules are hidden in this layout.
          </div>
        ) : (
          renderTab(activeTabSafe)
        )}
      </div>
    </div>
  );
}
