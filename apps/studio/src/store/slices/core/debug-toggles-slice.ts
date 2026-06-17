/**
 * Debug Toggles slice.
 *
 * The Camera Studio spec (sentineltwin_camerastudio_fullcamerasuite_product_spec.md
 * §11.6) calls for 10 explicit debug toggles in the bottom-panel Debug tab.
 * This slice owns the on/off state for each. The actual 3D rendering
 * wiring is the renderer's job — this slice only exposes the boolean
 * state. Components read the flags via `useStudioStore` selectors and
 * decide what to overlay in their own rendering path.
 *
 * Toggle inventory (per spec §11.6):
 *   - showCoverageGrid         → coverage cell overlay in 3D viewport
 *   - showRaycasts             → primary raycast visualisation
 *   - showOcclusionHits        → per-obstruction occlusion hit markers
 *   - showFrustumBounds        → camera FOV frustum wireframes
 *   - showPathSamplePoints     → adversarial path waypoint dots
 *   - showRecomputeTime        → overlay the last simulation wall-time
 *   - showVisionColliders      → vision BVH collider bounds
 *   - showPhysicsColliders     → physics BVH collider bounds
 *   - showRawPpmValues         → raw PPM (pixels per metre) on cells
 *   - showBvhRebuildTime       → BVH rebuild time overlay
 *
 * Master switch
 * -------------
 * `showDebugOverlays` (owned by layout-slice) is the umbrella flag
 * that gates whether any debug overlay is rendered. This slice
 * provides the per-overlay flags. A render path that wants to draw
 * the raycast overlay should:
 *
 *   if (showDebugOverlays && debugToggles.showRaycasts) {
 *     drawRaycasts();
 *   }
 *
 * No rendering code in this slice.
 */

export interface DebugTogglesState {
  showCoverageGrid: boolean;
  showRaycasts: boolean;
  showOcclusionHits: boolean;
  showFrustumBounds: boolean;
  showPathSamplePoints: boolean;
  showRecomputeTime: boolean;
  showVisionColliders: boolean;
  showPhysicsColliders: boolean;
  showRawPpmValues: boolean;
  showBvhRebuildTime: boolean;
}

export interface DebugTogglesActions {
  setDebugToggle: (key: keyof DebugTogglesState, value: boolean) => void;
  resetDebugToggles: () => void;
}

const DEFAULT_DEBUG_TOGGLES: DebugTogglesState = {
  showCoverageGrid: false,
  showRaycasts: false,
  showOcclusionHits: false,
  showFrustumBounds: false,
  showPathSamplePoints: false,
  showRecomputeTime: false,
  showVisionColliders: false,
  showPhysicsColliders: false,
  showRawPpmValues: false,
  showBvhRebuildTime: false,
};

export const DEBUG_TOGGLE_KEYS: ReadonlyArray<keyof DebugTogglesState> = [
  "showCoverageGrid",
  "showRaycasts",
  "showOcclusionHits",
  "showFrustumBounds",
  "showPathSamplePoints",
  "showRecomputeTime",
  "showVisionColliders",
  "showPhysicsColliders",
  "showRawPpmValues",
  "showBvhRebuildTime",
] as const;

export const DEBUG_TOGGLE_LABELS: ReadonlyArray<{ key: keyof DebugTogglesState; label: string; description: string }> = [
  { key: "showCoverageGrid", label: "Show coverage grid", description: "Render the coverage grid cells on the floor plane." },
  { key: "showRaycasts", label: "Show raycasts", description: "Visualise primary raycasts from each camera." },
  { key: "showOcclusionHits", label: "Show occlusion hits", description: "Mark per-obstruction occlusion hits." },
  { key: "showFrustumBounds", label: "Show camera frustum bounds", description: "Draw camera FOV frustum wireframes." },
  { key: "showPathSamplePoints", label: "Show path sample points", description: "Highlight adversarial path waypoint dots." },
  { key: "showRecomputeTime", label: "Show recompute time", description: "Overlay the last simulation wall-time." },
  { key: "showVisionColliders", label: "Show vision colliders", description: "Render vision BVH collider bounds." },
  { key: "showPhysicsColliders", label: "Show physics colliders", description: "Render physics BVH collider bounds." },
  { key: "showRawPpmValues", label: "Show raw PPM values", description: "Annotate cells with raw pixels-per-metre." },
  { key: "showBvhRebuildTime", label: "Show BVH rebuild time", description: "Overlay BVH rebuild time after edits." },
];

export type DebugTogglesSlice = DebugTogglesState & DebugTogglesActions;

export const createDebugTogglesSlice = (_set: any, _get: any): DebugTogglesSlice => ({
  ...DEFAULT_DEBUG_TOGGLES,
  setDebugToggle: (key, value) => _set({ [key]: value } as Partial<DebugTogglesState>),
  resetDebugToggles: () => _set({ ...DEFAULT_DEBUG_TOGGLES }),
});