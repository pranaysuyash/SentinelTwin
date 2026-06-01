import { describe, expect, test } from "bun:test";

import {
  applyShiftLock,
  clampToScene,
  insertPointAtIndex,
  insertPolygonVertex,
  nearestPointOnWall,
  pathLength,
  pointDistance,
  removePathPoint,
  removePolygonVertex,
  snapPoint,
} from "@/components/workspace/editing/editor-geometry";

describe("editor geometry", () => {
  test("clamps points to scene bounds", () => {
    expect(clampToScene([-1, 12], 10, 8, 0.2)).toEqual([0.2, 7.8]);
  });

  test("clamps with invalid scene dimensions", () => {
    expect(clampToScene([1, 2], NaN, 8)).toEqual([1, 2]);
    expect(clampToScene([1, 2], 10, NaN)).toEqual([1, 2]);
    expect(clampToScene([1, 2], 0, 0)).toEqual([0, 0]);
  });

  test("snaps points to the grid", () => {
    expect(snapPoint([1.12, 3.26], 0.5)).toEqual([1, 3.5]);
  });

  test("snap is stable with malformed coordinates", () => {
    expect(snapPoint([NaN, 3.26] as [number, number], 0.5)).toEqual([0, 0]);
    expect(snapPoint([1.12, 3.26], -2)).toEqual([1.12, 3.26]);
  });

  test("inserts and removes path and polygon vertices", () => {
    expect(insertPointAtIndex([[0, 0], [2, 2]], 1, [1, 1])).toEqual([[0, 0], [1, 1], [2, 2]]);
    expect(insertPointAtIndex([[0, 0], [2, 2]], 99, [4, 4])).toEqual([[0, 0], [2, 2], [4, 4]]);
    expect(insertPointAtIndex([[0, 0], [2, 2]], -10, [4, 4])).toEqual([[4, 4], [0, 0], [2, 2]]);
    expect(insertPointAtIndex([[0, 0], [2, 2]], 1, [NaN, 2] as [number, number])).toEqual([[0, 0], [2, 2]]);

    expect(insertPolygonVertex([[0, 0], [4, 0], [4, 4]], 1, [4, 2])).toEqual([[0, 0], [4, 0], [4, 2], [4, 4]]);
    expect(removePolygonVertex([[0, 0], [4, 0], [4, 4], [0, 4]], 1)).toEqual([[0, 0], [4, 4], [0, 4]]);
    expect(removePolygonVertex([[0, 0], [4, 0], [4, 4]], 1)).toEqual(null);
    expect(removePathPoint([[0, 0], [2, 2]], 0)).toEqual(null);
    expect(removePathPoint([[0, 0], [2, 2], [4, 4]], 1)).toEqual([[0, 0], [4, 4]]);
  });

  test("remove functions ignore out-of-range indexes", () => {
    expect(removePolygonVertex([[0, 0], [4, 0], [4, 4], [0, 4]], -1)).toEqual([[0, 0], [4, 0], [4, 4], [0, 4]]);
    expect(removePathPoint([[0, 0], [2, 2], [4, 4]], 99)).toEqual([[0, 0], [2, 2], [4, 4]]);
  });

  test("applies shift-lock to horizontal or vertical alignment", () => {
    expect(applyShiftLock([2, 2], [5, 3], true)).toEqual([5, 2]);
    expect(applyShiftLock([2, 2], [3, 6], true)).toEqual([2, 6]);
    expect(applyShiftLock([2, 2], [3, 6], false)).toEqual([3, 6]);
  });

  test("shift-lock handles malformed points", () => {
    expect(applyShiftLock([2, 2], [NaN, 6] as [number, number], true)).toEqual([0, 0]);
  });

  test("finds nearest wall projection", () => {
    const result = nearestPointOnWall([3, 2], [{ start: [1, 1], end: [5, 1] }]);
    expect(result.wallPoint).toEqual([3, 1]);
    expect(result.wallIndex).toBe(0);
  });

  test("finds nearest wall projection when all walls are invalid", () => {
    expect(nearestPointOnWall([3, 2], [{ start: [NaN, 1], end: [5, 1] }])).toEqual({
      wallPoint: [3, 2],
      dist: Number.POSITIVE_INFINITY,
      wallIndex: -1,
    });
  });

  test("measures point distance and path length", () => {
    expect(pointDistance([1, 1], [4, 5])).toBeCloseTo(5, 5);
    expect(pointDistance([NaN, 1], [4, 5])).toBe(Number.POSITIVE_INFINITY);

    expect(pathLength([[0, 0], [3, 4], [6, 4]])).toBeCloseTo(8, 5);
    expect(pathLength([[0, 0], [NaN, 1], [6, 4]])).toBe(Number.POSITIVE_INFINITY);
  });
});
