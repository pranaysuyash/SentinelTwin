import { describe, expect, test } from "bun:test";

import {
  ANALYSIS_TAB_ORDER,
  ALWAYS_CORE_TABS,
  DEFAULT_MAX_FOREGROUND_TABS,
  computeForegroundTabs,
  contextualBottomTabForNode,
  getFirstEnabledAnalysisTab,
  viewModeToBottomTab,
} from "@/lib/contextual-tabs";
import type { BottomTab } from "@/store/slices/core/layout-slice";
import type { SecurityScene } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** An enabled-modules map with every tab enabled (baseline preset shape). */
function allEnabled(): Record<BottomTab, boolean> {
  const out = {} as Record<BottomTab, boolean>;
  for (const tab of ANALYSIS_TAB_ORDER) out[tab] = true;
  return out;
}

/** An enabled-modules map with only the named tabs enabled. */
function onlyEnabled(...tabs: BottomTab[]): Record<BottomTab, boolean> {
  const out = {} as Record<BottomTab, boolean>;
  for (const tab of ANALYSIS_TAB_ORDER) out[tab] = tabs.includes(tab);
  return out;
}

/** A blank scene with a single node added to the named collection. */
function sceneWithNode(collection: keyof SecurityScene, id: string): SecurityScene {
  const scene = createBlankSecurityScene();
  // We only need the id to be findable; the node shape beyond { id } is not
  // read by `resolveSelectedNodeType`.
  (scene[collection] as unknown[]).push({ id } as never);
  return scene;
}

// ─── ANALYSIS_TAB_ORDER ───────────────────────────────────────────────────

describe("ANALYSIS_TAB_ORDER (canonical ordering)", () => {
  test("contains every member of the BottomTab union exactly once", () => {
    // The union has 19 members (see layout-slice.ts:49-68). The prior copies
    // had diverged — one omitted scenario, another omitted outcome/help/budgeting.
    // The canonical copy must include all of them so the fallback in
    // getFirstEnabledAnalysisTab never silently misses a tab.
    const allBottomTabs: BottomTab[] = [
      "outcome", "metrics", "issues", "sensors", "timeline", "beforeafter",
      "report", "help", "debug", "counterfactual", "threat", "redundancy",
      "temporal", "assumptions", "governance", "provenance", "novel",
      "budgeting", "scenario",
    ];
    expect(new Set(ANALYSIS_TAB_ORDER)).toEqual(new Set(allBottomTabs));
    expect(ANALYSIS_TAB_ORDER).toHaveLength(allBottomTabs.length);
  });

  test("leads with the Job-#1 cluster (outcome/metrics/issues)", () => {
    // First-principles ordering: posture legible at a glance comes first.
    expect(ALWAYS_CORE_TABS).toEqual(["outcome", "metrics", "issues"]);
    expect(ANALYSIS_TAB_ORDER.slice(0, 3)).toEqual(ALWAYS_CORE_TABS);
  });

  test("debug is last (developer surface, disabled in baseline presets)", () => {
    expect(ANALYSIS_TAB_ORDER[ANALYSIS_TAB_ORDER.length - 1]).toBe("debug");
  });
});

// ─── viewModeToBottomTab ──────────────────────────────────────────────────

describe("viewModeToBottomTab", () => {
  test("maps every view mode (including analytics — the case the scene-slice duplicate omitted)", () => {
    expect(viewModeToBottomTab("map")).toBe("metrics");
    expect(viewModeToBottomTab("replay")).toBe("timeline");
    expect(viewModeToBottomTab("camera_view")).toBe("timeline");
    expect(viewModeToBottomTab("compare")).toBe("beforeafter");
    expect(viewModeToBottomTab("report")).toBe("report");
    // Regression guard: the scene-slice copy omitted this branch silently.
    expect(viewModeToBottomTab("analytics")).toBe("metrics");
    expect(viewModeToBottomTab("wall")).toBe("metrics");
  });
});

// ─── contextualBottomTabForNode ───────────────────────────────────────────

describe("contextualBottomTabForNode", () => {
  test("returns null for no selection", () => {
    expect(contextualBottomTabForNode(createBlankSecurityScene(), null)).toBeNull();
  });

  test("returns null for an unknown id", () => {
    expect(contextualBottomTabForNode(createBlankSecurityScene(), "does-not-exist")).toBeNull();
  });

  test("maps each node type to its contextual tab", () => {
    expect(contextualBottomTabForNode(sceneWithNode("cameras", "c1"), "c1")).toBe("metrics");
    expect(contextualBottomTabForNode(sceneWithNode("paths", "p1"), "p1")).toBe("timeline");
    expect(contextualBottomTabForNode(sceneWithNode("sensors", "s1"), "s1")).toBe("sensors");
    expect(contextualBottomTabForNode(sceneWithNode("obstructions", "o1"), "o1")).toBe("issues");
    expect(contextualBottomTabForNode(sceneWithNode("criticalZones", "z1"), "z1")).toBe("issues");
    expect(contextualBottomTabForNode(sceneWithNode("doors", "d1"), "d1")).toBe("threat");
    expect(contextualBottomTabForNode(sceneWithNode("walls", "w1"), "w1")).toBe("assumptions");
  });
});

// ─── getFirstEnabledAnalysisTab ───────────────────────────────────────────

describe("getFirstEnabledAnalysisTab", () => {
  test("honors the preferred tab when it is enabled", () => {
    expect(getFirstEnabledAnalysisTab(allEnabled(), "threat")).toBe("threat");
  });

  test("ignores the preferred tab when it is disabled, falling back to canonical order", () => {
    const enabled = onlyEnabled("metrics", "issues");
    expect(getFirstEnabledAnalysisTab(enabled, "threat")).toBe("metrics");
  });

  test("falls back to metrics when nothing is enabled", () => {
    expect(getFirstEnabledAnalysisTab(onlyEnabled(), "threat")).toBe("metrics");
  });

  test("respects the canonical ordering for the fallback (outcome first)", () => {
    // outcome leads the canonical order, so if outcome is enabled it wins the
    // fallback over every other enabled tab.
    const enabled = onlyEnabled("debug", "outcome");
    expect(getFirstEnabledAnalysisTab(enabled, null)).toBe("outcome");
  });
});

// ─── computeForegroundTabs ────────────────────────────────────────────────

describe("computeForegroundTabs", () => {
  test("always-core cluster is always foregrounded", () => {
    const { foreground } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",
      enabledAnalysisModules: allEnabled(),
    });
    for (const core of ALWAYS_CORE_TABS) {
      expect(foreground).toContain(core);
    }
  });

  test("view-mode primary tab is foregrounded", () => {
    const { foreground } = computeForegroundTabs({
      viewMode: "compare", // -> beforeafter
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",
      enabledAnalysisModules: allEnabled(),
    });
    expect(foreground).toContain("beforeafter");
  });

  test("selection-contextual tab is foregrounded", () => {
    const scene = sceneWithNode("doors", "d1"); // -> threat
    const { foreground } = computeForegroundTabs({
      viewMode: "map",
      scene,
      selectedNodeId: "d1",
      bottomTab: "metrics",
      enabledAnalysisModules: allEnabled(),
    });
    expect(foreground).toContain("threat");
  });

  test("active tab is always foregrounded even when nothing else suggests it", () => {
    // scenario is not in the always-core cluster, not implied by `map` mode,
    // and nothing is selected. It would normally be in overflow — but the
    // operator's active tab must never be hidden behind More.
    const { foreground, overflow } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "scenario",
      enabledAnalysisModules: allEnabled(),
    });
    expect(foreground).toContain("scenario");
    expect(overflow).not.toContain("scenario");
  });

  test("respects the foreground cap (active-tab override aside)", () => {
    // With every tab enabled and no contextual additions beyond the cap,
    // foreground length should not exceed cap+1 (cap + active override).
    const { foreground } = computeForegroundTabs({
      viewMode: "map",           // adds metrics (already in core)
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",      // already in core
      enabledAnalysisModules: allEnabled(),
    });
    expect(foreground.length).toBeLessThanOrEqual(DEFAULT_MAX_FOREGROUND_TABS + 1);
  });

  test("overflow excludes foreground tabs and contains the rest", () => {
    const { foreground, overflow } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",
      enabledAnalysisModules: allEnabled(),
    });
    // No overlap.
    for (const tab of foreground) {
      expect(overflow).not.toContain(tab);
    }
    // Union of foreground + overflow equals the full enabled set.
    const union = new Set<BottomTab>([...foreground, ...overflow]);
    for (const tab of ANALYSIS_TAB_ORDER) {
      expect(union.has(tab)).toBe(true);
    }
  });

  test("disabled tabs appear in neither foreground nor overflow", () => {
    const { foreground, overflow } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",
      enabledAnalysisModules: onlyEnabled("metrics", "issues", "outcome"),
    });
    const visible = new Set<BottomTab>([...foreground, ...overflow]);
    expect(visible.has("metrics")).toBe(true);
    expect(visible.has("issues")).toBe(true);
    expect(visible.has("outcome")).toBe(true);
    expect(visible.has("threat")).toBe(false);
    expect(visible.has("debug")).toBe(false);
  });

  test("attention is computed only for overflow tabs in the pending list", () => {
    // scenario + budgeting are pending attention. scenario is the active tab,
    // so it must be foregrounded and therefore NOT in attentionInOverflow.
    // budgeting stays in overflow and IS flagged.
    const { foreground, attentionInOverflow } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "scenario",
      enabledAnalysisModules: allEnabled(),
      pendingTabAttention: ["scenario", "budgeting", "nonexistent-tab" as BottomTab],
    });
    expect(foreground).toContain("scenario");
    expect(attentionInOverflow).toContain("budgeting");
    expect(attentionInOverflow).not.toContain("scenario");
  });

  test("empty pending list produces empty attention", () => {
    const { attentionInOverflow } = computeForegroundTabs({
      viewMode: "map",
      scene: createBlankSecurityScene(),
      selectedNodeId: null,
      bottomTab: "metrics",
      enabledAnalysisModules: allEnabled(),
    });
    expect(attentionInOverflow).toEqual([]);
  });

  test("is pure: same inputs produce same outputs across calls", () => {
    const input = {
      viewMode: "compare" as const,
      scene: sceneWithNode("doors", "d1"),
      selectedNodeId: "d1",
      bottomTab: "metrics" as BottomTab,
      enabledAnalysisModules: allEnabled(),
      pendingTabAttention: ["governance" as BottomTab],
    };
    const a = computeForegroundTabs(input);
    const b = computeForegroundTabs(input);
    expect(a).toEqual(b);
  });
});
