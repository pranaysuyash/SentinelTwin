import { describe, expect, test } from "bun:test";

import {
  clampPositiveNumber,
  resolveSafeNumber,
  sanitizeDimensions,
  sanitizePoint2D,
  sanitizePoint3D,
  sanitizeScenePath,
} from "../SharedScene";

describe("SharedScene geometry sanitation helpers", () => {
  test("resolveSafeNumber handles malformed inputs", () => {
    expect(resolveSafeNumber(undefined, 1)).toBe(1);
    expect(resolveSafeNumber("2.4", 1)).toBe(2.4);
    expect(resolveSafeNumber(NaN, 1)).toBe(1);
  });

  test("clampPositiveNumber clamps to minimum", () => {
    expect(clampPositiveNumber(-3, 0.1)).toBe(0.1);
    expect(clampPositiveNumber(12, 0.5)).toBe(12);
    expect(clampPositiveNumber("bad", 0.5, 0.5)).toBe(0.5);
  });

  test("sanitizePoint2D returns fallback for malformed points", () => {
    expect(sanitizePoint2D(undefined)).toEqual([0, 0]);
    expect(sanitizePoint2D([9, 6])).toEqual([9, 6]);
    expect(sanitizePoint2D([Infinity, 4], [1, 1])).toEqual([1, 4]);
    expect(sanitizePoint2D([NaN, NaN], [5, 6])).toEqual([5, 6]);
  });

  test("sanitizePoint3D handles malformed dimensions", () => {
    expect(sanitizePoint3D(undefined, [3, 4, 5])).toEqual([3, 4, 5]);
    expect(sanitizePoint3D([1, 2, 3])).toEqual([1, 2, 3]);
    expect(sanitizePoint3D([1, 2], [3, 4, 5])).toEqual([3, 4, 5]);
    expect(sanitizePoint3D([1, Infinity, 3], [3, 4, 5])).toEqual([1, 4, 3]);
  });

  test("sanitizeDimensions keeps non-zero minima", () => {
    expect(sanitizeDimensions(undefined)).toEqual([1, 1, 1]);
    expect(sanitizeDimensions([0, -1, 0.001])).toEqual([0.02, 0.02, 0.02]);
    expect(sanitizeDimensions(["1.1", "2.3", "4.5"])).toEqual([1.1, 2.3, 4.5]);
  });

  test("sanitizeScenePath filters malformed waypoints", () => {
    expect(sanitizeScenePath([
      [0, 0],
      [NaN, 2],
      [1.5, 2.5],
      ["bad", 1],
      [3, 4],
    ])).toEqual([
      [0, 0],
      [1.5, 2.5],
      [3, 4],
    ]);
  });
});
