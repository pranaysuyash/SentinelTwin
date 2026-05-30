import { describe, expect, test } from "bun:test";

import { computeCoverageEntropy } from "@sentineltwin/simulation";

describe("computeCoverageEntropy", () => {
  test("returns null for an empty cell set", () => {
    expect(computeCoverageEntropy([])).toBeNull();
  });

  test("measures concentration across quality bands", () => {
    const summary = computeCoverageEntropy([
      { quality: "none" },
      { quality: "none" },
      { quality: "recognition" },
      { quality: "recognition" },
      { quality: "recognition" },
      { quality: "identification" },
    ]);

    expect(summary).toBeDefined();
    expect(summary?.cellCount).toBe(6);
    expect(summary?.dominantQuality).toBe("recognition");
    expect(summary?.dominantQualityCount).toBe(3);
    expect(summary?.dominantQualityShare).toBe(50);
    expect(summary?.entropyBits).toBeGreaterThan(0);
    expect(summary?.normalizedEntropy).toBeGreaterThan(0);
    expect(summary?.qualityCounts.none).toBe(2);
    expect(summary?.qualityCounts.recognition).toBe(3);
  });

  test("normalizes to zero for a uniform distribution", () => {
    const summary = computeCoverageEntropy([
      { quality: "observation" },
      { quality: "observation" },
      { quality: "observation" },
      { quality: "observation" },
    ]);

    expect(summary?.entropyBits).toBe(0);
    expect(summary?.normalizedEntropy).toBe(0);
    expect(summary?.dominantQuality).toBe("observation");
  });
});
