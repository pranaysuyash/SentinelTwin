import { create } from "zustand";

/**
 * Navigation grammar — Density Pass D2 reconciliation.
 *
 * The studio has three navigation layers. They are NOT redundant — each owns
 * a distinct scope, and the mapping between them is strictly one-directional
 * (intent → canvas → analysis). Resolving OQ-UI-03 (long-term density
 * direction): Option 4 (contextual priority) is canonical; the three layers
 * are documented here as a deliberate architecture rather than collapsed.
 *
 *   1. ProductView (this store) — INTENT-LEVEL routing. What the operator
 *      wants to do: intake / scan / build / review / a specific studio intent.
 *      Owns the URL and the top-level surface swap.
 *
 *   2. ViewMode (layout-slice) — CANVAS configuration. How the studio renders
 *      once you're in it: map / wall / replay / compare / report / analytics.
 *      Derived from ProductView via the intent→viewMode redirects in
 *      ProductViewRouter (e.g. `incident_review` → replay).
 *
 *   3. BottomTab (layout-slice, contextualized via `computeForegroundTabs` in
 *      `@/lib/contextual-tabs`) — ANALYSIS surface. Which data panel is
 *      foregrounded given the current selection + view mode + pending
 *      attention. Density Pass D1.
 *
 * The four "studio sub-view" ProductView entries below
 * (`camera_operations`, `incident_review`, `counterfactual_compare`,
 * `audit_report`) are deliberate deep-link entry points: external links and
 * nav items target them by intent, and `ProductViewRouter` maps each to a
 * specific (viewMode, preset, bottomTab) triple via `StudioModeRedirect`.
 * They are not parallel to ViewMode — they sit ABOVE it and derive it.
 *
 * Per `motto_v3 §11` (no parallel implementations): the mapping is
 * centralized in ProductViewRouter's `StudioModeRedirect` calls — there is
 * exactly one place where each intent → canvas binding lives.
 */
export type ProductView =
  // First-run / intake surfaces.
  | "product_home"
  | "site_intake"
  | "scan_site"
  | "manual_builder"
  | "floor_plan_import"
  | "ai_layout_draft"
  | "site_draft_review"
  // Job lens — first-run persona/workflow selection (D-331). Shown before the
  // intake redirect when lensConfirmed === false.
  | "job_lens"
  // The studio workspace itself.
  | "studio"
  // Intent-level deep-links into specific studio configurations (see header
  // comment — these derive ViewMode + WorkspacePreset + BottomTab, they are
  // not separate surfaces).
  | "camera_operations"
  | "incident_review"
  | "counterfactual_compare"
  | "audit_report"
  // Browse / config.
  | "reference_sites"
  | "settings";

interface ProductViewStoreState {
  /** The current top-level product view. */
  view: ProductView;
  /** Optional sub-context — e.g. which intake source was selected. */
  subContext: string | null;
  /** Navigate to a product view. Clears subContext unless provided. */
  navigate: (view: ProductView, subContext?: string | null) => void;
  /** Go back to product home. */
  goHome: () => void;
}

export const useProductViewStore = create<ProductViewStoreState>((set) => ({
  view: "product_home",
  subContext: null,
  navigate: (view, subContext = null) => set({ view, subContext }),
  goHome: () => set({ view: "product_home", subContext: null }),
}));
