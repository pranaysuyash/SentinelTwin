import { create } from "zustand";

/**
 * Top-level product view model.
 *
 * These are the primary app surfaces. Studio sub-views
 * (camera_operations, incident_review, counterfactual_compare,
 * audit_report) are handled by ViewMode + WorkspacePreset inside
 * the Studio workspace — they are not separate product views.
 */
export type ProductView =
  | "product_home"
  | "site_intake"
  | "scan_site"
  | "manual_builder"
  | "floor_plan_import"
  | "ai_layout_draft"
  | "site_draft_review"
  | "studio"
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
