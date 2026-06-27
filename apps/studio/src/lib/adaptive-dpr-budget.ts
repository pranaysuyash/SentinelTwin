/**
 * Adaptive DPR Performance Budget — SentinelTwin Studio
 *
 * Defines the rendering contract for all adaptive-resolution R3F canvases.
 * Includes both multi-tile (Camera Wall) and single-canvas (Camera View,
 * Path Replay) surfaces.
 *
 * The budget is intentionally conservative: the app must remain usable on
 * lower-end GPUs while still showing security-critical overlays (coverage
 * heatmap, DORI arcs, blindspot highlights, path replay actor).
 *
 * These constants are used by the `PerformanceMonitor` + `AdaptiveDpr`
 * adaptive-quality path. They are not hard runtime limits — the browser/GPU
 * decides what is possible — but they are the acceptance contract the product
 * should be tested against.
 *
 * Reference: `threejs-performance` skill and `r3f-drei` documentation.
 */

// ── Wall / multi-tile budget ──

/** Target minimum FPS for a smooth operator experience in the wall. */
export const WALL_TARGET_FPS = 45;

/** FPS below which the adaptive quality path starts reducing DPR. */
export const WALL_FPS_DECLINE_THRESHOLD = 35;

/** FPS above which adaptive quality can restore DPR. */
export const WALL_FPS_INCLINE_THRESHOLD = 55;

/** Default DPR range for wall tiles. Lower bound keeps tiles crisp enough on
 *  retina displays; upper bound avoids burning GPU on 3×/4× DPR laptops. */
export const WALL_DPR_RANGE: [min: number, max: number] = [0.75, 1.25];

/** DPR range used in dense mode where many tiles compete for GPU. */
export const WALL_DPR_RANGE_DENSE: [min: number, max: number] = [0.5, 1.0];

/** Default renderer pixel ratio when no adaptive signal has been received. */
export const WALL_INITIAL_DPR = 1.0;

/** Maximum draw calls per wall tile before we consider the tile too heavy. */
export const WALL_TILE_DRAW_CALL_BUDGET = 120;

/** Maximum estimated GPU memory (MB) per wall tile for textures/geometries. */
export const WALL_TILE_GPU_MEMORY_MB_BUDGET = 80;

/** How many consecutive FPS averages must be below threshold before DPR is
 *  reduced. A higher value makes the system less jittery. */
export const WALL_PERF_MONITOR_ITERATIONS = 12;

/** Sampling window (ms) for each FPS average. */
export const WALL_PERF_MONITOR_MS = 300;

/** Step size for each DPR adjustment. Small steps prevent visible popping. */
export const WALL_PERF_DPR_STEP = 0.05;

/** Number of back-and-forth DPR flips before `onFallback` is called. */
export const WALL_PERF_FLIPFLOPS = 5;

// ── Single-canvas budget ──

/** Target minimum FPS for full-screen single-canvas modes. */
export const SINGLE_TARGET_FPS = 50;

/** FPS below which single-canvas modes start reducing DPR. */
export const SINGLE_FPS_DECLINE_THRESHOLD = 40;

/** FPS above which single-canvas modes can restore DPR. */
export const SINGLE_FPS_INCLINE_THRESHOLD = 58;

/**
 * DPR range for full-screen single-canvas modes.
 *
 * Kept higher than wall tiles because a single full-screen canvas is
 * expected to look crisp, but the lower bound still protects against
 * overwhelming weak GPUs during dense coverage/heat-map rendering.
 */
export const SINGLE_DPR_RANGE: [min: number, max: number] = [0.85, 1.5];

/** Default initial DPR for single-canvas modes. */
export const SINGLE_INITIAL_DPR = 1.0;

/** Same step size as the wall to keep all adaptive surfaces consistent. */
export const SINGLE_PERF_DPR_STEP = 0.05;

/** Number of back-and-forth DPR flips before `onFallback` for single canvas. */
export const SINGLE_PERF_FLIPFLOPS = 5;

/** Iterations and window for single-canvas PerformanceMonitor. */
export const SINGLE_PERF_MONITOR_ITERATIONS = 12;
export const SINGLE_PERF_MONITOR_MS = 300;

// ── Helpers ──

/** Layout-dependent DPR range selector for the wall. */
export function selectWallDprRange(isDense: boolean): [min: number, max: number] {
  return isDense ? WALL_DPR_RANGE_DENSE : WALL_DPR_RANGE;
}

/** Compute the Canvas `dpr` prop from the adaptive factor and wall layout.
 *
 * `factor` comes from `PerformanceMonitor` (0..1). It is multiplied by the
 * layout-specific max DPR, then clamped to the layout min DPR. */
export function computeWallTileDpr(
  factor: number,
  isDense: boolean,
): number {
  const [min, max] = selectWallDprRange(isDense);
  return Math.max(min, min + factor * (max - min));
}

/** Compute the Canvas `dpr` prop for a single full-screen canvas.
 *
 * `factor` comes from `PerformanceMonitor` (0..1). It is multiplied by
 * `SINGLE_DPR_RANGE` and clamped to its minimum. */
export function computeSingleCanvasDpr(factor: number): number {
  const [min, max] = SINGLE_DPR_RANGE;
  return Math.max(min, min + factor * (max - min));
}

/** Bounds for Drei `PerformanceMonitor` in the wall. */
export function wallPerformanceBounds(_refreshrate: number): [lower: number, upper: number] {
  return [WALL_FPS_DECLINE_THRESHOLD, WALL_FPS_INCLINE_THRESHOLD];
}

/** Bounds for Drei `PerformanceMonitor` in single-canvas modes. */
export function singlePerformanceBounds(_refreshrate: number): [lower: number, upper: number] {
  return [SINGLE_FPS_DECLINE_THRESHOLD, SINGLE_FPS_INCLINE_THRESHOLD];
}
