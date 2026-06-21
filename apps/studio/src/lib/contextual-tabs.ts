/**
 * @sentineltwin/studio — contextual bottom-tab logic (canonical source of truth)
 *
 * Single owner of three concerns that were previously duplicated across
 * `layout-slice.ts`, `scene-slice.ts`, and `governance-slice.ts`:
 *   1. The canonical ordering of analysis tabs (`ANALYSIS_TAB_ORDER`).
 *   2. The view-mode → bottom-tab mapping (`viewModeToBottomTab`).
 *   3. The node-type → bottom-tab mapping (`contextualBottomTabForNode`).
 *   4. The "first enabled tab" resolver (`getFirstEnabledAnalysisTab`).
 *
 * Per `motto_v3` §11 ("Avoid duplicate or parallel implementations where a
 * single source of truth should exist") and §10 ("Prefer systemic fixes over
 * one-off local fixes when the pattern is recurring") — these helpers are
 * consolidated here. The three prior copies had divergent tab orderings (one
 * omitted `scenario`, another omitted `outcome`/`help`/`budgeting`), which is
 * exactly the parallel-truth failure the consolidation fixes.
 *
 * This module also exposes the foreground/overflow selector that lets the
 * bottom-panel tab strip honor the contextual layer the store already computes
 * (see `Docs/review/UI_REVIEW_2026-06-19.md`, Density Pass D1 / Option 4).
 *
 * Feature-preserving by construction: every tab remains reachable in one
 * interaction — either foreground or behind the "More" overflow. No tab is
 * deleted, disabled, or removed from the data model. Per `motto_v3` §11
 * ("hide them from the UI instead of deleting the code").
 */

import type { SecurityScene } from "@/schema/security-scene";
// Type-only imports — safe even though layout-slice value-imports helpers from
// this module (type-only imports are erased at compile time, so there is no
// runtime circular dependency).
import type { BottomTab, ViewMode } from "@/store/slices/core/layout-slice";

// ─── 1. Canonical analysis-tab ordering ───────────────────────────────────

/**
 * Canonical priority order of all `BottomTab` members. Used as the fallback
 * ordering when `getFirstEnabledAnalysisTab` cannot honor a preferred tab.
 *
 * Order rationale (first principles — the four jobs of the UI, see
 * `Docs/review/UI_REVIEW_2026-06-19.md` Part 1):
 *   - Lead with `outcome` (the product's headline answer: "are we safe"),
 *     then `metrics`, `issues` (the Job-#1 cluster: coverage / blind spots /
 *     severity).
 *   - Then operator-authoring surfaces (sensors, redundancy, counterfactual,
 *     threat) that respond to edits.
 *   - Then temporal surfaces (timeline, temporal, beforeafter).
 *   - Then evidence/governance/provenance/report.
 *   - Then operator/secondary (assumptions, novel, scenario, budgeting, help).
 *   - `debug` last — it is a developer surface, disabled in baseline presets.
 *
 * Must contain every member of the `BottomTab` union so the
 * `getFirstEnabledAnalysisTab` fallback never silently misses a tab.
 */
export const ANALYSIS_TAB_ORDER: BottomTab[] = [
  // Job-#1 cluster: posture legible at a glance.
  "outcome",
  "metrics",
  "issues",
  // Operator-authoring surfaces.
  "sensors",
  "redundancy",
  "counterfactual",
  "threat",
  // Temporal surfaces.
  "timeline",
  "temporal",
  "beforeafter",
  // Evidence / governance / report.
  "report",
  "governance",
  "provenance",
  "assumptions",
  // Operator / secondary.
  "novel",
  "scenario",
  "budgeting",
  "help",
  // Developer surface (disabled in baseline presets).
  "debug",
];

// ─── 2. View-mode → bottom-tab mapping ────────────────────────────────────

/**
 * The single bottom tab that the view mode most implies. Used as a foreground
 * candidate by `computeForegroundTabs` and as a fallback by
 * `getFirstEnabledAnalysisTab` when the store switches view modes.
 *
 * Canonical copy — previously duplicated (with divergence: the scene-slice
 * copy omitted the `analytics` case) across layout-slice.ts:155 and
 * scene-slice.ts:750.
 */
export function viewModeToBottomTab(mode: ViewMode): BottomTab {
  switch (mode) {
    case "map":
      return "metrics";
    case "replay":
    case "camera_view":
      return "timeline";
    case "compare":
      return "beforeafter";
    case "report":
      return "report";
    case "analytics":
      return "metrics";
    case "wall":
    default:
      return "metrics";
  }
}

// ─── 3. Node-type → bottom-tab mapping ────────────────────────────────────

/**
 * Resolve the node type behind a selection id. Extracted as a sibling helper
 * so `contextualBottomTabForNode` is pure over `(scene, id)` and unit-testable
 * without standing up the full store.
 *
 * Returns `null` when id is falsy, multi-selection is collapsed to its primary
 * (the caller is responsible for picking the primary id before calling), or
 * the id does not match any scene collection.
 *
 * Behavior preserved verbatim from the original at scene-slice.ts:664 —
 * non-optional collection access. Per `motto_v3` §6.1, a migration must not
 * silently change behavior; the original assumed all collections are present,
 * so this version does too.
 */
function resolveSelectedNodeType(scene: SecurityScene, id: string | null): string | null {
  if (!id) return null;
  if (scene.cameras.some((entry) => entry.id === id)) return "camera";
  if (scene.paths.some((entry) => entry.id === id)) return "path";
  if (scene.sensors.some((entry) => entry.id === id)) return "sensor";
  if (scene.obstructions.some((entry) => entry.id === id)) return "obstruction";
  if (scene.securityLights.some((entry) => entry.id === id)) return "security_light";
  if (scene.walls.some((entry) => entry.id === id)) return "wall";
  if (scene.doors.some((entry) => entry.id === id)) return "door";
  if (scene.windows.some((entry) => entry.id === id)) return "window";
  if (scene.criticalZones.some((entry) => entry.id === id)) return "critical_zone";
  if (scene.privacyZones.some((entry) => entry.id === id)) return "privacy_zone";
  if (scene.entryPoints.some((entry) => entry.id === id)) return "entry_point";
  if (scene.comments.some((entry) => entry.id === id)) return "comment";
  return null;
}

/**
 * The single bottom tab that a node selection most implies, or `null` if no
 * contextual tab applies (no selection, or a node type without a mapping).
 *
 * Canonical copy — previously at scene-slice.ts:624. The mapping is preserved
 * verbatim; only the node-type resolution was extracted into
 * `resolveSelectedNodeType` (also moved here so this function is pure and
 * testable in isolation).
 */
export function contextualBottomTabForNode(scene: SecurityScene, id: string | null): BottomTab | null {
  const nodeType = resolveSelectedNodeType(scene, id);
  if (nodeType === "camera") return "metrics";
  if (nodeType === "path") return "timeline";
  if (nodeType === "sensor") return "sensors";
  if (nodeType === "security_light") return "metrics";
  if (nodeType === "obstruction") return "issues";
  if (nodeType === "critical_zone" || nodeType === "privacy_zone") return "issues";
  if (nodeType === "door" || nodeType === "window" || nodeType === "entry_point") return "threat";
  if (nodeType === "wall") return "assumptions";
  return null;
}

// ─── 4. First-enabled resolver ────────────────────────────────────────────

/**
 * Resolve a concrete enabled tab given the enabled-modules map and (optionally)
 * a preferred tab. Falls back to the first enabled entry of
 * `ANALYSIS_TAB_ORDER`, then to `metrics`.
 *
 * Canonical copy — previously duplicated (with the divergent orderings noted
 * above) across layout-slice.ts:190, scene-slice.ts:681, and
 * governance-slice.ts:236.
 */
export function getFirstEnabledAnalysisTab(
  enabledAnalysisModules: Record<BottomTab, boolean>,
  preferred?: BottomTab | null,
): BottomTab {
  if (preferred && enabledAnalysisModules[preferred]) return preferred;
  return ANALYSIS_TAB_ORDER.find((tab) => enabledAnalysisModules[tab]) ?? "metrics";
}

// ─── 4b. Issue-category → bottom-tab mapping (Loop Pass L2) ───────────────

/**
 * Issue categories produced by the simulation engine, mirrored from
 * `packages/core/src/schema/security-scene.ts` (`securityIssueSchema`).
 * Duplicated here as a string union (rather than imported) so this module
 * stays a leaf with no runtime dependency on the core package — `computeForegroundTabs`
 * and the L2 attention producer can therefore run in pure unit tests without
 * standing up the schema. If the upstream union changes, update this mirror.
 */
export type IssueCategory = "blindspot" | "quality_fail" | "redundancy" | "night" | "privacy";

/**
 * Map a simulation issue category to the bottom-panel tab that surfaces it.
 *
 * Canonical owner — no prior mapping existed in the codebase (verified via
 * search; the only consumers of `issue.category` were narrative aggregators in
 * `security-outcome-model.ts` and section filters in `IssuesTab.tsx`).
 *
 * Rationale (first principles — surface the issue where its analysis lives):
 *   - `blindspot`     → `issues` (the prioritized finding list is the primary
 *                       blind-spot surface; selecting the issue focuses the scene).
 *   - `quality_fail`  → `metrics` (coverage-quality breakdown by DORI level).
 *   - `redundancy`    → `redundancy` (single-camera-failure coverage testing).
 *   - `night`         → `temporal` (24h profile is where day/dusk/night windows live).
 *   - `privacy`       → `issues` (IssuesTab already has a dedicated Privacy Review
 *                       section at IssuesTab.tsx:106).
 *
 * Returns `null` for unknown categories so the caller can skip — never falls
 * back to a default tab, because a spurious attention signal is worse than none.
 */
export function bottomTabForIssueCategory(category: string): BottomTab | null {
  switch (category) {
    case "blindspot":
      return "issues";
    case "quality_fail":
      return "metrics";
    case "redundancy":
      return "redundancy";
    case "night":
      return "temporal";
    case "privacy":
      return "issues";
    default:
      return null;
  }
}

// ─── 5. Foreground / overflow selector ────────────────────────────────────

/**
 * The always-foreground cluster — the tabs that answer the UI's Job #1
 * ("are we covered / where are we blind / how bad"). Permanent regardless of
 * context. See `Docs/review/UI_REVIEW_2026-06-19.md` Part 1.
 */
export const ALWAYS_CORE_TABS: BottomTab[] = ["outcome", "metrics", "issues"];

/**
 * Default cap on foreground tab count. Keeps the strip scannable in the
 * 208px-tall bottom dock's single tab row (~matches design-pack primary-row
 * density). The operator's currently-active tab is added *after* the cap and
 * may take the foreground count to cap+1.
 */
export const DEFAULT_MAX_FOREGROUND_TABS = 6;

export interface ComputeForegroundTabsInput {
  viewMode: ViewMode;
  scene: SecurityScene;
  selectedNodeId: string | null;
  bottomTab: BottomTab;
  enabledAnalysisModules: Record<BottomTab, boolean>;
  /** Tabs the contextual layer has flagged as wanting attention this render. */
  pendingTabAttention?: BottomTab[];
  /** Override the foreground cap (defaults to `DEFAULT_MAX_FOREGROUND_TABS`). */
  maxForeground?: number;
}

export interface ComputeForegroundTabsResult {
  /** Tabs to render in the strip's foreground row, in display order. */
  foreground: BottomTab[];
  /** Remaining enabled tabs, in `ANALYSIS_TAB_ORDER` order, to render behind "More". */
  overflow: BottomTab[];
  /** Subset of `overflow` that currently wants attention (drives the More badge). */
  attentionInOverflow: BottomTab[];
}

/**
 * Pure selector that derives which tabs belong in the foreground row of the
 * bottom-panel strip vs behind the "More" overflow, given the current context.
 *
 * Composition rule (foreground = union of, capped at `maxForeground`):
 *   1. `ALWAYS_CORE_TABS` (outcome / metrics / issues).
 *   2. `viewModeToBottomTab(viewMode)` — what this mode most implies.
 *   3. `contextualBottomTabForNode(scene, selectedNodeId)` — what this
 *      selection most implies.
 *   4. `bottomTab` — the operator's currently-active tab. **Always foregrounded**,
 *      even if it makes the count exceed the cap, so the operator never loses
 *      their active tab from the strip. Honors `motto_v3` §11 (no feature loss)
 *      and the existing product comment at scene-slice.ts:720-721 ("a
 *      deliberate 'go deeper' surface, not an auto-reaction to every click").
 *
 * Tabs are filtered to the enabled set and de-duplicated. Foreground ordering
 * follows the rule priority above; overflow follows `ANALYSIS_TAB_ORDER`.
 */
export function computeForegroundTabs(input: ComputeForegroundTabsInput): ComputeForegroundTabsResult {
  const { viewMode, scene, selectedNodeId, bottomTab, enabledAnalysisModules } = input;
  const pendingTabAttention = input.pendingTabAttention ?? [];
  const maxForeground = input.maxForeground ?? DEFAULT_MAX_FOREGROUND_TABS;

  // Build the candidate list in priority order. We collect first, then cap.
  const candidates: BottomTab[] = [];
  const pushIfEnabled = (tab: BottomTab | null | undefined) => {
    if (tab && enabledAnalysisModules[tab] && !candidates.includes(tab)) {
      candidates.push(tab);
    }
  };

  // (1) Always-core cluster.
  ALWAYS_CORE_TABS.forEach(pushIfEnabled);
  // (2) View-mode primary.
  pushIfEnabled(viewModeToBottomTab(viewMode));
  // (3) Selection-contextual.
  pushIfEnabled(contextualBottomTabForNode(scene, selectedNodeId));

  // Cap the contextual candidates. The active tab (step 4) is added AFTER the
  // cap so it always renders even if it pushes the count to cap+1.
  const capped = candidates.slice(0, maxForeground);

  // (4) Active-tab override — always foregrounded.
  if (enabledAnalysisModules[bottomTab] && !capped.includes(bottomTab)) {
    capped.push(bottomTab);
  }

  const foregroundSet = new Set(capped);

  // Overflow = every enabled tab not in foreground, in canonical order.
  const overflow = ANALYSIS_TAB_ORDER.filter(
    (tab) => enabledAnalysisModules[tab] && !foregroundSet.has(tab),
  );

  // Attention = pending tabs that ended up in overflow (those are the ones the
  // More button needs to advertise).
  const attentionSet = new Set(pendingTabAttention);
  const attentionInOverflow = overflow.filter((tab) => attentionSet.has(tab));

  return { foreground: capped, overflow, attentionInOverflow };
}

// ─── 6. Issue-diff attention producer (Loop Pass L2) ──────────────────────

/**
 * Minimal structural shape of a `SecurityIssue` sufficient for diffing. Mirrors
 * the subset of fields from `packages/core/src/schema/security-scene.ts:573-586`
 * that this diff cares about. Kept local (not imported from the schema) so this
 * module remains a pure leaf.
 */
export interface DiffableIssue {
  category: string;
  severity: string;
  description: string;
  affectedZones: string[];
  affectedCameras: string[];
  pathId?: string;
}

export interface IssueDiffResult {
  /**
   * Tabs (resolved via `bottomTabForIssueCategory`) whose issue set changed
   * between the previous and current simulation results. These are the tabs
   * the L2 producer should append to `pendingTabAttention` so the bottom-panel
   * "More" button lights up.
   *
   * Restricted to tabs the operator does NOT currently have open (`excludeTab`)
   * and not already in the pending list (`currentAttention`) — the caller
   * passes these in so this function stays pure and testable without store
   * access. Order follows `ANALYSIS_TAB_ORDER`.
   */
  tabsToFlag: BottomTab[];
  /**
   * Stable issue fingerprints that changed — used by IssuesTab to float those
   * issues to the top with a "changed by last edit" tag.
   */
  changedIssueKeys: string[];
}

/**
 * Compute a stable fingerprint for an issue. Two issues with the same
 * (category, severity, description, primary affected ids) are treated as the
 * same finding across simulation runs — the simulation is deterministic so this
 * is a reliable identity for "did this finding appear/disappear/change."
 *
 * Description is part of the fingerprint because the engine emits
 * human-readable descriptions that differ per finding; combining category +
 * description captures the finding identity without being thrown off by
 * reordered `affectedZones`/`affectedCameras` arrays.
 */
export function issueFingerprint(issue: DiffableIssue): string {
  const zones = [...issue.affectedZones].sort().join(",");
  const cameras = [...issue.affectedCameras].sort().join(",");
  const path = issue.pathId ?? "";
  return `${issue.category}|${issue.severity}|${issue.description}|z:${zones}|c:${cameras}|p:${path}`;
}

/**
 * Diff the previous and current simulation issue lists and return the tabs
 * that should be flagged for attention, plus the stable keys of the changed
 * issues.
 *
 * Pure over its inputs — no store access. The L2 producer in the simulation
 * slice calls this with `(scene.previousSimulation?.issues, result.issues)`
 * and forwards `tabsToFlag` to `setPendingTabAttention`.
 *
 * Why a diff and not "flag every category present in the new result": the L1
 * goal (Loop Pass) is to make *cause legible on edit* — the operator should be
 * notified when an edit *changed* the issue set, not when issues merely exist.
 * Flagging on every recompute would make the badge fire constantly and become
 * ignorable noise. Per `motto_v3 §0.2` (confidence honesty): don't emit a
 * signal that doesn't carry information.
 */
export function diffIssuesForAttention(input: {
  previousIssues: DiffableIssue[] | null | undefined;
  currentIssues: DiffableIssue[] | null | undefined;
  /** The operator's currently-active tab; never flagged (it's already foregrounded). */
  excludeTab?: BottomTab;
  /** Tabs already in the pending list; not re-flagged (avoids duplicate signals). */
  currentAttention?: BottomTab[];
  /** Enabled-modules map; disabled tabs are skipped (flagging them is a no-op). */
  enabledAnalysisModules: Record<BottomTab, boolean>;
}): IssueDiffResult {
  const { previousIssues, currentIssues, excludeTab, currentAttention, enabledAnalysisModules } = input;
  const prevSet = new Set((previousIssues ?? []).map(issueFingerprint));
  const currSet = new Set((currentIssues ?? []).map(issueFingerprint));
  const alreadyFlagged = new Set(currentAttention ?? []);

  const changedTabs = new Set<BottomTab>();
  const changedIssueKeys: string[] = [];

  for (const issue of currentIssues ?? []) {
    const key = issueFingerprint(issue);
    if (prevSet.has(key)) continue; // unchanged — not interesting
    changedIssueKeys.push(key);
    const tab = bottomTabForIssueCategory(issue.category);
    if (!tab) continue;
    if (!enabledAnalysisModules[tab]) continue; // disabled tab — don't flag
    if (excludeTab && tab === excludeTab) continue; // already foregrounded
    if (alreadyFlagged.has(tab)) continue; // already pending
    changedTabs.add(tab);
  }

  // Also detect disappeared issues (an edit resolved a finding) — those are
  // equally causally interesting and belong in the same attention signal.
  // We resolve the category from the key prefix (the fingerprint starts with
  // `${category}|...`).
  for (const key of prevSet) {
    if (currSet.has(key)) continue;
    changedIssueKeys.push(key);
    const category = key.split("|")[0];
    const tab = bottomTabForIssueCategory(category);
    if (!tab) continue;
    if (!enabledAnalysisModules[tab]) continue;
    if (excludeTab && tab === excludeTab) continue;
    if (alreadyFlagged.has(tab)) continue;
    changedTabs.add(tab);
  }

  // Stable order — canonical ANALYSIS_TAB_ORDER so the badge is deterministic.
  const tabsToFlag = ANALYSIS_TAB_ORDER.filter((tab) => changedTabs.has(tab));

  return { tabsToFlag, changedIssueKeys };
}
