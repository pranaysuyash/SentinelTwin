import { describe, expect, test } from "bun:test";

import { computeCrowdOcclusion, DEFAULT_RETAIL_ARCHETYPES } from "@sentineltwin/simulation";
import type { SecurityScene, CrowdProfile } from "@sentineltwin/core";

// Minimal scene fixture — crowd-sim only reads criticalZones
const baseScene = {
  criticalZones: [] as SecurityScene["criticalZones"],
} as unknown as SecurityScene;

const coverageCells = [
  { x: 0, z: 0, quality: "identification", coverageIncluded: true },
  { x: 1, z: 0, quality: "recognition", coverageIncluded: true },
  { x: 2, z: 0, quality: "none", coverageIncluded: true },
  { x: 3, z: 0, quality: "none", coverageIncluded: false },
];

describe("computeCrowdOcclusion", () => {
  test("returns zero penalty when no profiles are enabled", () => {
    const profile: CrowdProfile = {
      id: "p1",
      label: "Empty",
      archetypes: [],
      enabled: false,
    };
    const result = computeCrowdOcclusion(baseScene, coverageCells, [profile], 12);
    expect(result.totalAgentCount).toBe(0);
    expect(result.occlusionPenaltyPct).toBe(0);
    expect(result.effectiveCoveragePct).toBe(result.geometricCoveragePct);
    expect(result.chokepoints).toHaveLength(0);
  });

  test("returns zero penalty when profiles array is empty", () => {
    const result = computeCrowdOcclusion(baseScene, coverageCells, [], 12);
    expect(result.totalAgentCount).toBe(0);
    expect(result.occlusionPenaltyPct).toBe(0);
  });

  test("geometric coverage counts non-excluded cells with quality != none", () => {
    const result = computeCrowdOcclusion(baseScene, coverageCells, [], 12);
    // 3 included cells: 2 covered, 1 none
    expect(result.geometricCoveragePct).toBeCloseTo((2 / 3) * 100, 1);
  });

  test("Poisson model reduces effective coverage under high agent density", () => {
    const sceneWithZone: SecurityScene = {
      ...baseScene,
      criticalZones: [
        {
          id: "zone_1",
          nodeType: "critical_zone",
          label: "Test Zone",
          polygon: [[-10, -10], [10, -10], [10, 10], [-10, 10]],
          heightM: 3,
          priority: "high",
          requiredDoriClass: "recognition",
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
      ],
    } as unknown as SecurityScene;

    const denseProfile: CrowdProfile = {
      id: "p_dense",
      label: "Dense crowd",
      enabled: true,
      archetypes: [
        {
          archetypeId: "a1",
          label: "Person",
          bodyRadiusM: 0.4,
          heightM: 1.8,
          preferredZones: ["zone_1"],
          // 100 people at hour 12 in a zone implied by polygon area
          countByHour: [0,0,0,0,0,0,0,0,0,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0],
        },
      ],
    };

    const result = computeCrowdOcclusion(sceneWithZone, coverageCells, [denseProfile], 12);
    expect(result.totalAgentCount).toBe(100);
    expect(result.effectiveCoveragePct).toBeLessThan(result.geometricCoveragePct);
    expect(result.occlusionPenaltyPct).toBeGreaterThan(0);
  });

  test("chokepoints are only reported for covered cells with occlusionP > 0.4", () => {
    // A low-density crowd — should produce no chokepoints
    const sparseProfile: CrowdProfile = {
      id: "p_sparse",
      label: "Sparse",
      enabled: true,
      archetypes: [
        {
          archetypeId: "a1",
          label: "Person",
          bodyRadiusM: 0.3,
          heightM: 1.7,
          preferredZones: [],
          countByHour: [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
        },
      ],
    };
    const result = computeCrowdOcclusion(baseScene, coverageCells, [sparseProfile], 12);
    // With 1 agent over a large implicit area, probability should be very low
    expect(result.chokepoints.length).toBe(0);
  });

  test("output fields are in valid ranges", () => {
    const result = computeCrowdOcclusion(baseScene, coverageCells, [], 8);
    expect(result.hour).toBe(8);
    expect(result.geometricCoveragePct).toBeGreaterThanOrEqual(0);
    expect(result.geometricCoveragePct).toBeLessThanOrEqual(100);
    expect(result.effectiveCoveragePct).toBeGreaterThanOrEqual(0);
    expect(result.effectiveCoveragePct).toBeLessThanOrEqual(100);
    expect(result.occlusionPenaltyPct).toBeGreaterThanOrEqual(0);
  });

  test("DEFAULT_RETAIL_ARCHETYPES have valid 24-element countByHour arrays", () => {
    for (const archetype of DEFAULT_RETAIL_ARCHETYPES) {
      expect(archetype.countByHour).toHaveLength(24);
      for (const count of archetype.countByHour) {
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("DEFAULT_RETAIL_ARCHETYPES peak customers at midday", () => {
    const customer = DEFAULT_RETAIL_ARCHETYPES.find((a) => a.archetypeId === "customer");
    expect(customer).toBeDefined();
    const noonCount = customer!.countByHour[12];
    const midnightCount = customer!.countByHour[0];
    expect(noonCount).toBeGreaterThan(midnightCount);
  });
});
