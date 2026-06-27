import { describe, expect, test } from "bun:test";
import {
  WALL_TARGET_FPS,
  WALL_FPS_DECLINE_THRESHOLD,
  WALL_FPS_INCLINE_THRESHOLD,
  WALL_DPR_RANGE,
  WALL_DPR_RANGE_DENSE,
  WALL_INITIAL_DPR,
  WALL_TILE_DRAW_CALL_BUDGET,
  WALL_TILE_GPU_MEMORY_MB_BUDGET,
  WALL_PERF_MONITOR_ITERATIONS,
  WALL_PERF_MONITOR_MS,
  WALL_PERF_DPR_STEP,
  WALL_PERF_FLIPFLOPS,
  SINGLE_TARGET_FPS,
  SINGLE_FPS_DECLINE_THRESHOLD,
  SINGLE_FPS_INCLINE_THRESHOLD,
  SINGLE_DPR_RANGE,
  SINGLE_INITIAL_DPR,
  SINGLE_PERF_MONITOR_ITERATIONS,
  SINGLE_PERF_MONITOR_MS,
  SINGLE_PERF_DPR_STEP,
  SINGLE_PERF_FLIPFLOPS,
  selectWallDprRange,
  computeWallTileDpr,
  computeSingleCanvasDpr,
  wallPerformanceBounds,
  singlePerformanceBounds,
} from "@/lib/adaptive-dpr-budget";

describe("Adaptive DPR budget contract", () => {
  test("exports expected wall constants", () => {
    expect(WALL_TARGET_FPS).toBe(45);
    expect(WALL_FPS_DECLINE_THRESHOLD).toBe(35);
    expect(WALL_FPS_INCLINE_THRESHOLD).toBe(55);
    expect(WALL_INITIAL_DPR).toBe(1.0);
    expect(WALL_TILE_DRAW_CALL_BUDGET).toBe(120);
    expect(WALL_TILE_GPU_MEMORY_MB_BUDGET).toBe(80);
    expect(WALL_PERF_MONITOR_ITERATIONS).toBeGreaterThan(0);
    expect(WALL_PERF_MONITOR_MS).toBeGreaterThan(0);
    expect(WALL_PERF_DPR_STEP).toBeGreaterThan(0);
    expect(WALL_PERF_FLIPFLOPS).toBeGreaterThan(0);
  });

  test("exports expected single-canvas constants", () => {
    expect(SINGLE_TARGET_FPS).toBe(50);
    expect(SINGLE_FPS_DECLINE_THRESHOLD).toBe(40);
    expect(SINGLE_FPS_INCLINE_THRESHOLD).toBe(58);
    expect(SINGLE_INITIAL_DPR).toBe(1.0);
    expect(SINGLE_PERF_MONITOR_ITERATIONS).toBeGreaterThan(0);
    expect(SINGLE_PERF_MONITOR_MS).toBeGreaterThan(0);
    expect(SINGLE_PERF_DPR_STEP).toBeGreaterThan(0);
    expect(SINGLE_PERF_FLIPFLOPS).toBeGreaterThan(0);
  });

  test("DPR ranges are ordered and single-canvas is higher than wall", () => {
    expect(WALL_DPR_RANGE[0]).toBeLessThan(WALL_DPR_RANGE[1]);
    expect(WALL_DPR_RANGE_DENSE[0]).toBeLessThan(WALL_DPR_RANGE_DENSE[1]);
    expect(SINGLE_DPR_RANGE[0]).toBeLessThan(SINGLE_DPR_RANGE[1]);
    expect(SINGLE_DPR_RANGE[0]).toBeGreaterThanOrEqual(WALL_DPR_RANGE[0]);
    expect(SINGLE_DPR_RANGE[1]).toBeGreaterThan(WALL_DPR_RANGE[1]);
  });

  test("selectWallDprRange picks dense range only in dense mode", () => {
    expect(selectWallDprRange(false)).toEqual(WALL_DPR_RANGE);
    expect(selectWallDprRange(true)).toEqual(WALL_DPR_RANGE_DENSE);
  });

  test("computeWallTileDpr clamps to range and responds to factor", () => {
    const [min, max] = WALL_DPR_RANGE;
    expect(computeWallTileDpr(0, false)).toBe(min);
    expect(computeWallTileDpr(1, false)).toBe(max);
    const mid = computeWallTileDpr(0.5, false);
    expect(mid).toBeGreaterThan(min);
    expect(mid).toBeLessThan(max);
  });

  test("computeWallTileDpr uses dense range in dense mode", () => {
    const [denseMin, denseMax] = WALL_DPR_RANGE_DENSE;
    expect(computeWallTileDpr(0, true)).toBe(denseMin);
    expect(computeWallTileDpr(1, true)).toBe(denseMax);
  });

  test("computeSingleCanvasDpr clamps to single-canvas range", () => {
    const [min, max] = SINGLE_DPR_RANGE;
    expect(computeSingleCanvasDpr(0)).toBe(min);
    expect(computeSingleCanvasDpr(1)).toBe(max);
    const mid = computeSingleCanvasDpr(0.5);
    expect(mid).toBeGreaterThan(min);
    expect(mid).toBeLessThan(max);
  });

  test("performance bounds return fixed FPS thresholds", () => {
    expect(wallPerformanceBounds(60)).toEqual([
      WALL_FPS_DECLINE_THRESHOLD,
      WALL_FPS_INCLINE_THRESHOLD,
    ]);
    expect(wallPerformanceBounds(144)).toEqual([
      WALL_FPS_DECLINE_THRESHOLD,
      WALL_FPS_INCLINE_THRESHOLD,
    ]);
    expect(singlePerformanceBounds(60)).toEqual([
      SINGLE_FPS_DECLINE_THRESHOLD,
      SINGLE_FPS_INCLINE_THRESHOLD,
    ]);
    expect(singlePerformanceBounds(144)).toEqual([
      SINGLE_FPS_DECLINE_THRESHOLD,
      SINGLE_FPS_INCLINE_THRESHOLD,
    ]);
  });
});
