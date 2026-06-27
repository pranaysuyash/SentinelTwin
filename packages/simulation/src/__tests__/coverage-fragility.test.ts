import { describe, expect, test } from "bun:test";

import { computeCoverageFragility } from "@sentineltwin/simulation";
import type { CoverageCellResult } from "@sentineltwin/core";

function cell(overrides: Partial<CoverageCellResult>): CoverageCellResult {
  return {
    x: 0,
    z: 0,
    quality: "none",
    ppm: 0,
    coverageIncluded: true,
    privacyRestricted: false,
    coveringCameras: [],
    blockedBy: [],
    ...overrides,
  };
}

describe("computeCoverageFragility", () => {
  test("returns empty summary for empty cell set", () => {
    const result = computeCoverageFragility([]);
    expect(result.totalCells).toBe(0);
    expect(result.cells).toEqual([]);
    expect(result.meanFragility).toBe(0);
  });

  test("returns empty summary when all cells have no quality", () => {
    const result = computeCoverageFragility([
      cell({ quality: "none", ppm: 0 }),
      cell({ quality: "none", ppm: 0 }),
    ]);
    expect(result.totalCells).toBe(0);
  });

  test("returns empty summary when all cells have no ppm", () => {
    const result = computeCoverageFragility([
      cell({ quality: "detection", ppm: 0 }),
    ]);
    expect(result.totalCells).toBe(0);
  });

  test("cell at exact threshold boundary is maximally fragile", () => {
    const result = computeCoverageFragility([
      cell({ quality: "detection", ppm: 25 }),
    ]);
    expect(result.totalCells).toBe(1);
    expect(result.cells[0].fragility).toBeCloseTo(1, 1);
    expect(result.fragileCellCount).toBe(1);
  });

  test("cell at midpoint between thresholds has fragility 0.5", () => {
    const result = computeCoverageFragility([
      cell({ quality: "detection", ppm: 43.75 }),
    ]);
    expect(result.totalCells).toBe(1);
    expect(result.cells[0].fragility).toBeCloseTo(0.5, 1);
    expect(result.fragileCellCount).toBe(1);
  });

  test("cell well above identification threshold is robust", () => {
    const result = computeCoverageFragility([
      cell({ quality: "identification", ppm: 500 }),
    ]);
    expect(result.totalCells).toBe(1);
    expect(result.cells[0].fragility).toBeLessThan(0.5);
    expect(result.fragileCellCount).toBe(0);
  });

  test("cell barely above recognition threshold is fragile", () => {
    const result = computeCoverageFragility([
      cell({ quality: "recognition", ppm: 130 }),
    ]);
    expect(result.totalCells).toBe(1);
    expect(result.cells[0].fragility).toBeGreaterThan(0.8);
    expect(result.fragileCellCount).toBe(1);
  });

  test("mixed cells produce correct fragile/robust counts", () => {
    const result = computeCoverageFragility([
      cell({ quality: "detection", ppm: 26 }),
      cell({ quality: "recognition", ppm: 200 }),
      cell({ quality: "identification", ppm: 500 }),
    ]);
    expect(result.totalCells).toBe(3);
    expect(result.fragileCellCount + result.robustCellCount).toBe(3);
    expect(result.meanFragility).toBeGreaterThan(0);
    expect(result.meanFragility).toBeLessThan(1);
  });

  test("supports oodpcvs_2025 standard", () => {
    const result = computeCoverageFragility(
      [cell({ quality: "detection", ppm: 12 })],
      "oodpcvs_2025",
    );
    expect(result.totalCells).toBe(1);
    expect(result.cells[0].fragility).toBeCloseTo(1, 1);
  });

  test("fragile threshold at 0.2 correctly classifies boundary cells", () => {
    const result = computeCoverageFragility([
      cell({ quality: "detection", ppm: 30 }),
    ]);
    expect(result.totalCells).toBe(1);
    const isFragile = result.cells[0].fragility >= 0.2;
    expect(result.fragileCellCount).toBe(isFragile ? 1 : 0);
    expect(result.robustCellCount).toBe(isFragile ? 0 : 1);
  });
});
