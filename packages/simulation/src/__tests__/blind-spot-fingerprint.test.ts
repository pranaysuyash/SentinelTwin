import { describe, expect, test } from "bun:test";

import type { BlindRegionResult } from "@sentineltwin/core";
import { computeBlindSpotFingerprint } from "@sentineltwin/simulation";

describe("computeBlindSpotFingerprint", () => {
  test("produces a stable fingerprint independent of region order", () => {
    const regions: BlindRegionResult[] = [
      {
        id: "blind_a",
        cells: [
          { x: 1, z: 1 },
          { x: 1.5, z: 1 },
        ],
        areaSqM: 4.2,
        classification: "entry_corridor",
        severity: "critical",
        touchesCriticalZone: true,
        affectedZoneIds: ["zone_cash", "zone_entry"],
        description: "Front corridor blind region",
      },
      {
        id: "blind_b",
        cells: [
          { x: 3, z: 3 },
        ],
        areaSqM: 1.1,
        classification: "isolated",
        severity: "low",
        touchesCriticalZone: false,
        affectedZoneIds: ["zone_storage"],
        description: "Storage pocket blind region",
      },
    ];

    const summaryA = computeBlindSpotFingerprint(regions);
    const summaryB = computeBlindSpotFingerprint([...regions].reverse());

    expect(summaryA.fingerprint).toBe(summaryB.fingerprint);
    expect(summaryA.signature).toBe(summaryB.signature);
    expect(summaryA.regionCount).toBe(2);
    expect(summaryA.criticalRegionCount).toBe(1);
    expect(summaryA.entryConnectedRegionCount).toBe(1);
    expect(summaryA.isolatedRegionCount).toBe(1);
    expect(summaryA.affectedZoneCount).toBe(3);
    expect(summaryA.severityCounts.critical).toBe(1);
    expect(summaryA.severityCounts.low).toBe(1);
    expect(summaryA.classificationCounts.entry_corridor).toBe(1);
    expect(summaryA.classificationCounts.isolated).toBe(1);
  });
});
