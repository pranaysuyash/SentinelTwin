"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/cn";
import { computeForegroundTabs } from "@/lib/contextual-tabs";
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
import { ScenarioComparisonPanel } from "./ScenarioComparisonPanel";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import { WorkflowChips } from "./WorkflowChips";
import { AmbientEditDelta } from "./AmbientEditDelta";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const PANEL_EXPLAINERS: Record<BottomTab, string> = {
  outcome: "Use this first after a run. It translates the simulation into the current security verdict, top failures, camera responsibility, redundancy, and next actions.",
  metrics: "Use this to check overall coverage quality and whether critical areas meet the selected operating target under current assumptions.",
  issues: "Use this to work the prioritized finding list, focus the scene, and hand off fixes for before/after verification.",
  sensors: "Use this to review non-camera sensor inventory and live evidence that may confirm or challenge camera coverage.",
  timeline: "Use this during replay to see when a route is visible, degraded, or uncovered.",
  temporal: "Use this to find weak time windows across day, dusk, and night operating conditions.",
  beforeafter: "Use this before approving a change. It compares baseline and proposed site twins with measured deltas.",
  assumptions: "Use this to understand the lighting, target, and environment assumptions behind every result and report statement.",
  provenance: "Use this when you need the evidence trail: source files, user actions, approvals, and computed results behind the current site twin.",
  governance: "Use this to review role, approval, and publishing controls before sharing audit evidence.",
  redundancy: "Use this to test whether a critical zone still has coverage if one camera goes offline.",
  counterfactual: "Use this to test a proposed fix before changing the active site twin.",
  threat: "Use this for defensive route exposure review: where an authorized replay route loses usable camera evidence.",
  novel: "Use this for advanced risk signals such as backup coverage, coverage stability, and blind-spot patterns.",
  scenario: "Use this to compare Day, Night, and Night-No-Lights scenarios against the baseline — and test which assumptions most affect results.",
  report: "Use this to prepare an evidence-backed audit handoff from the same verified simulation.",
  help: "Use this for workflow guidance, glossary definitions, and shortcuts.",
  debug: "Use this only for implementation diagnostics and troubleshooting.",
  budgeting: "Use this to estimate equipment and labor impact from camera presets, lights, and obstruction moves.",
};

const TABS: { id: BottomTab; label: string; hasCount?: boolean }[] = [
  { id: "outcome", label: "SECURITY OUTCOME" },
  { id: "metrics", label: "METRICS" },
  { id: "issues", label: "ISSUES", hasCount: true },
  { id: "sensors", label: "SENSORS" },
  { id: "redundancy", label: "REDUNDANCY" },
  { id: "counterfactual", label: "FIX OPTIONS" },
  { id: "threat", label: "ROUTE EXPOSURE" },
  { id: "novel", label: "ADVANCED RISK SIGNALS" },
  { id: "scenario", label: "SCENARIO COMPARISON" },
  { id: "budgeting", label: "BUDGET" },
  { id: "report", label: "REPORT LITE" },
  { id: "assumptions", label: "ASSUMPTIONS" },
  { id: "governance", label: "GOVERNANCE" },
  { id: "provenance", label: "EVIDENCE TRAIL" },
  { id: "timeline", label: "TIMELINE" },
  { id: "temporal", label: "24H PROFILE" },
  { id: "beforeafter", label: "BEFORE / AFTER" },
  { id: "help", label: "HELP" },
  { id: "debug", label: "DIAGNOSTICS" },
];

const TAB_GROUPS: { label: string; ids: BottomTab[] }[] = [
  { label: "Analysis", ids: ["outcome", "metrics", "issues", "sensors", "redundancy", "counterfactual", "threat", "novel", "scenario", "budgeting"] },
  { label: "Report", ids: ["report", "assumptions", "governance", "provenance"] },
  { label: "Timeline", ids: ["timeline", "temporal", "beforeafter"] },
  { label: "Dev", ids: ["help", "debug"] },
];

const EXCLUSIVE_TABS = new Set<BottomTab>(["counterfactual", "temporal"]);

function getTabLabel(tab: BottomTab) {
  return TABS.find((entry) => entry.id === tab)?.label ?? tab.toUpperCase();
}

function TabBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "amber" | "red" }) {
  const toneClass = {
    slate: `border-[#273246] ${UI_SURFACES.card} ${UI_SURFACES.textMuted3}`,
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
  // Contextual-priority inputs (see `@/lib/contextual-tabs`). The strip's
  // foreground cluster is derived from these — pure rendering, no store
  // mutation. The operator's active tab is always foregrounded regardless.
  const scene = useStudioStore((s) => s.scene);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const pendingTabAttention = useStudioStore((s) => s.pendingTabAttention);
  const issueCount = result?.issues.length ?? 0;
  const [showPanelExplain, setShowPanelExplain] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const enabledTabs = TABS.filter((tab) => enabledAnalysisModules[tab.id]);
  const activeTabSafe = enabledAnalysisModules[activeTab] ? activeTab : enabledTabs[0]?.id ?? "metrics";
  const singleModuleTab = pinnedAnalysisModule && enabledAnalysisModules[pinnedAnalysisModule]
    ? pinnedAnalysisModule
    : activeTabSafe;
  const panelExplainer = PANEL_EXPLAINERS[activeTabSafe] ?? "Analysis module details.";

  // Foreground vs overflow split. Derived purely from contextual inputs; the
  // operator's active tab is always foregrounded (active-tab override) so the
  // strip never hides what the operator is looking at.
  const { foreground, overflow, attentionInOverflow } = useMemo(
    () =>
      computeForegroundTabs({
        viewMode,
        scene,
        selectedNodeId,
        bottomTab: activeTabSafe,
        enabledAnalysisModules,
        pendingTabAttention,
      }),
    [viewMode, scene, selectedNodeId, activeTabSafe, enabledAnalysisModules, pendingTabAttention],
  );

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
      case "scenario":
        return <ScenarioComparisonPanel />;
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
      <div className={`flex h-[208px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`}>
        <div className={`flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5`}>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted2}`}>Camera Wall Summary</div>
          <TabBadge tone="blue">Live multiview</TabBadge>
          <div className={`ml-auto text-[10px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted2}`}>Focus on active feeds and coverage gaps</div>
        </div>
        <div className={`flex-1 overflow-hidden ${UI_SURFACES.panel}`}>
          <CameraStatusSummaryPanel />
        </div>
      </div>
    );
  }

  if (bottomDrawerMode === "hidden") {
    return (
      <div className={`flex h-[72px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`}>
        <div className="flex h-full items-center gap-2 px-3">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted2}`}>Analysis Drawer Hidden</div>
          <div className={`text-[10px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted2}`}>
            {workspacePreset.replace(/_/g, " ")} · {enabledTabs.length > 0 ? `${enabledTabs.length} modules available` : "No modules enabled"}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className={`rounded border border-[#273246] ${UI_SURFACES.card} px-2 py-1 text-[10px] font-semibold ${UI_SURFACES.textMuted3}`}>
              {getTabLabel(singleModuleTab)}
            </span>
            <button
              type="button"
              onClick={() => {
                setBottomDrawerMode("single_module");
                setTab(singleModuleTab);
              }}
              className={`rounded border border-[#273246] ${UI_SURFACES.card} px-2 py-1 text-[10px] font-semibold ${UI_SURFACES.textBody} transition-colors hover:border-sky-400/30 hover:text-white`}
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
      <div className={`flex h-[208px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`}>
        <div className={`flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5`}>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted2}`}>Single-Module Drawer</div>
          <TabBadge tone="amber">{getTabLabel(singleModuleTab)}</TabBadge>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBottomDrawerMode("tabs")}
              className={`rounded border border-[#273246] ${UI_SURFACES.card} px-2 py-1 text-[10px] font-semibold ${UI_SURFACES.textBody} transition-colors hover:border-sky-400/30 hover:text-white`}
            >
              Show Tabs
            </button>
            <button
              type="button"
              onClick={() => setBottomDrawerMode("hidden")}
              className={`rounded border border-[#273246] ${UI_SURFACES.card} px-2 py-1 text-[10px] font-semibold ${UI_SURFACES.textBody} transition-colors hover:border-amber-400/30 hover:text-white`}
            >
              Hide Drawer
            </button>
          </div>
        </div>
        <div className={`flex-1 overflow-hidden ${UI_SURFACES.panel}`}>
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
      <div className={`flex h-[208px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`}>
        <div className={`flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5`}>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted2}`}>Compare Drawer</div>
          <TabBadge tone="green">Before / After</TabBadge>
          <div className={`ml-auto text-[10px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted2}`}>Snapshot deltas and comparison metrics</div>
        </div>
        <div className={`flex items-end gap-0.5 border-b ${UI_SURFACES.borderPanel} px-1.5 pt-1.5`}>
          {compareTabs.map(({ id }) => (
            <button type="button"
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
                compareActiveTab === id
                  ? `${UI_SURFACES.panel} text-green-300 ring-1 ring-inset ring-[#1f2536]`
                  : `${UI_SURFACES.textMuted} hover:text-[#9da8c0]`,
              )}
            >
              {getTabLabel(id)}
            </button>
          ))}
        </div>
        <div className={`flex-1 overflow-hidden ${UI_SURFACES.panel}`}>
          {renderTab(compareActiveTab)}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-[208px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`}>
      {/* Tab strip — scrollable so the dock tabs don't overflow on narrow layouts */}
      <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5`}>
        <div className="min-w-[180px] flex-1">
          <div className={`truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted}`}>Analysis Drawer</div>
          <div className={`truncate text-[10px] uppercase tracking-[0.12em] ${UI_SURFACES.textMuted2}`}>
            {viewMode === "replay"
              ? "Timeline-first replay analysis"
              : viewMode === "camera_view"
                ? "Single-camera evidence and DORI"
                : "Metrics, issues, timeline, provenance, report, and help"}
          </div>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
          {/* Loop Pass L1 — ambient edit-delta chips. Announces the headline
              metric changes from the most recent simulation recompute, then
              fades. Renders null when there's no delta to show. */}
          <AmbientEditDelta />
          <button
            type="button"
            onClick={() => setShowPanelExplain((state) => !state)}
            className={`rounded border border-[#273246] ${UI_SURFACES.card} px-2 py-1 text-[10px] ${UI_SURFACES.textMuted4} transition-colors hover:border-sky-400/30 hover:text-white`}
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

      <div className={`flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-3 py-1`}>
        <WorkflowChips activeTab={activeTabSafe} />
      </div>

      <div className={`relative flex min-w-0 items-end gap-0.5 border-b ${UI_SURFACES.borderPanel} px-1.5 pt-1.5`}>
        {/* Foreground cluster — contextually-prioritized tabs (always-core ∪
            view-mode primary ∪ selection-contextual ∪ active tab). The rest
            of the enabled tabs live behind the "More" overflow button below.
            See `@/lib/contextual-tabs` and `Docs/review/UI_REVIEW_2026-06-19.md`
            Density Pass D1 / Option 4. */}
        <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto scrollbar-none">
          {foreground.map((id) => {
            const tab = TABS.find((t) => t.id === id);
            if (!tab) return null;
            const { label, hasCount } = tab;
            return (
              <button type="button"
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex-shrink-0 rounded-t-lg px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
                  activeTabSafe === id
                    ? `${UI_SURFACES.panel} text-green-300 ring-1 ring-inset ring-[#1f2536]`
                    : `${UI_SURFACES.textMuted} hover:text-[#9da8c0]`,
                )}
              >
                <span>{label}</span>
                {EXCLUSIVE_TABS.has(id) && (
                  <span className="ml-0.5 text-[8px] text-amber-400" title="Feature exclusive to SentinelTwin">★</span>
                )}
                {hasCount && issueCount > 0 ? (
                  <span className="ml-1 text-red-400">({issueCount})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Overflow — every enabled tab not in foreground, grouped by
            Analysis / Report / Timeline / Dev. The "More" button shows an
            amber count when the contextual layer has flagged attention tabs
            behind it (seed of Loop Pass L2). Reuses the TopBar "More" idiom:
            aria-haspopup, onMouseLeave dismiss, z-[420] above the strip's
            scroll-fade hint. */}
        {overflow.length > 0 ? (
          <div className="relative ml-auto flex items-end" onMouseLeave={() => setMoreOpen(false)}>
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls="bottom-panel-more-menu"
              title={attentionInOverflow.length > 0
                ? `${attentionInOverflow.length} tab${attentionInOverflow.length === 1 ? "" : "s"} want attention`
                : `${overflow.length} more analysis modules`}
              className={cn(
                `relative mb-0.5 ml-1 flex flex-shrink-0 items-center gap-1 rounded-t-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-2.5 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors`,
                moreOpen
                  ? `${UI_SURFACES.textMuted3} ring-1 ring-inset ring-[#1f2536]`
                  : `${UI_SURFACES.textMuted} hover:text-[#9da8c0]`,
              )}
            >
              <MoreHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>More</span>
              {attentionInOverflow.length > 0 ? (
                <span className="ml-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-200">
                  {attentionInOverflow.length}
                </span>
              ) : null}
            </button>
            {moreOpen ? (
              <div
                id="bottom-panel-more-menu"
                role="menu"
                className={`absolute bottom-full right-0 z-[420] mb-1 w-64 max-h-80 overflow-y-auto rounded-md border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} py-1 shadow-2xl shadow-black/60`}
              >
                {TAB_GROUPS.flatMap((group) => {
                  const groupTabs = group.ids
                    .map((id) => ({ id, tab: TABS.find((t) => t.id === id) }))
                    .filter((entry): entry is { id: BottomTab; tab: { id: BottomTab; label: string; hasCount?: boolean } } =>
                      Boolean(entry.tab) && overflow.includes(entry.id),
                    );
                  if (groupTabs.length === 0) return [];
                  return [
                    <div key={`group-${group.label}`} className={`px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted2}`}>
                      {group.label}
                    </div>,
                    ...groupTabs.map(({ id, tab }) => {
                      const wantsAttention = attentionInOverflow.includes(id);
                      return (
                        <button
                          type="button"
                          key={id}
                          role="menuitem"
                          onClick={() => {
                            setTab(id);
                            setMoreOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors",
                            activeTabSafe === id
                              ? `${UI_SURFACES.card} text-green-300`
                              : `${UI_SURFACES.textMuted3} ${UI_SURFACES.hoverBg} ${UI_SURFACES.hoverText}`,
                          )}
                        >
                          <span className="flex-1 truncate">
                            {tab.label}
                            {EXCLUSIVE_TABS.has(id) && (
                              <span className="ml-0.5 text-[8px] text-amber-400" title="Feature exclusive to SentinelTwin">★</span>
                            )}
                          </span>
                          {tab.hasCount && issueCount > 0 ? (
                            <span className="text-red-400">({issueCount})</span>
                          ) : null}
                          {wantsAttention ? (
                            <span
                              title="Contextual layer suggests this tab"
                              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
                            />
                          ) : null}
                        </button>
                      );
                    }),
                    <div key={`sep-${group.label}`} className={`{my-0.5 border-t ${UI_SURFACES.borderPanel}}`} />,
                  ];
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showPanelExplain ? (
        <div className={`border-b ${UI_SURFACES.borderPanel} bg-[#0f141f] px-3 py-1.5 text-[11px] ${UI_SURFACES.textMuted4}`}>
          <span className={`font-medium ${UI_SURFACES.textBody}`}>{getTabLabel(activeTabSafe)}:</span> {panelExplainer}
        </div>
      ) : null}

      <div className={`flex-1 overflow-hidden ${UI_SURFACES.panel}`}>
        {enabledTabs.length === 0 ? (
          <div className={`flex h-full items-center justify-center px-4 text-center text-[11px] ${UI_SURFACES.textMuted2}`}>
            All analysis modules are hidden in this layout.
          </div>
        ) : (
          renderTab(activeTabSafe)
        )}
      </div>
    </div>
  );
}
