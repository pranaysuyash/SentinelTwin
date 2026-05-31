import type {
  AssumptionSensitivity,
  DoriQuality,
  SecurityScene,
  SimulationResult,
} from "@sentineltwin/core";
import { cloneSecuritySceneSimulation, qualityToScore } from "@sentineltwin/core";
import { simulateStudio } from "./simulate-studio";

/**
 * Sensitivity test configuration.
 *
 * Each test changes one assumption/setting and measures the
 * impact on coverage, quality, and zone pass/fail status.
 */
type SensitivityTest = {
  name: string;
  currentValue: string | number | boolean;
  testValue: string | number | boolean;
  apply: (scene: SecurityScene) => void;
};

/**
 * Run assumption sensitivity analysis against the baseline simulation.
 *
 * Tests which inputs most affect failed zones:
 * - Person height (±20%)
 * - Wall height (±20%)
 * - Camera range (±20%)
 * - Camera FOV (±10%)
 * - Night penalty on/off
 * - Light level change
 * - Exterior light lux (if set)
 * - Backlight intensity change
 * - Glare intensity change
 *
 * Returns a sorted list of sensitivity results (most sensitive first).
 */
export function computeAssumptionSensitivity(
  scene: SecurityScene,
  baseline: SimulationResult,
): AssumptionSensitivity[] {
  const results: AssumptionSensitivity[] = [];
  const baseZonePass = baseline.criticalZoneResults.filter(z => z.status === "pass").length;
  const baseZoneCount = baseline.criticalZoneResults.length;

  const tests: SensitivityTest[] = [];

  // Person height sensitivity
  tests.push({
    name: "personHeightM +20%",
    currentValue: scene.assumptions.personHeightM,
    testValue: Number((scene.assumptions.personHeightM * 1.2).toFixed(2)),
    apply: (s) => { s.assumptions.personHeightM *= 1.2; },
  });
  tests.push({
    name: "personHeightM -20%",
    currentValue: scene.assumptions.personHeightM,
    testValue: Number((scene.assumptions.personHeightM * 0.8).toFixed(2)),
    apply: (s) => { s.assumptions.personHeightM *= 0.8; },
  });

  // Night penalty toggle
  if (scene.assumptions.timeOfDay !== "day") {
    tests.push({
      name: "nightPenaltyMode=none",
      currentValue: scene.assumptions.nightPenaltyMode,
      testValue: "none",
      apply: (s) => { s.assumptions.nightPenaltyMode = "none"; },
    });
    tests.push({
      name: "nightPenaltyMode=detailed",
      currentValue: scene.assumptions.nightPenaltyMode,
      testValue: "detailed",
      apply: (s) => { s.assumptions.nightPenaltyMode = "detailed"; },
    });
  }

  // Interior light level shifts
  const lightLevels: Array<SecurityScene["assumptions"]["interiorLightLevel"]> = ["dark", "dim", "normal", "bright"];
  const currentLightIdx = lightLevels.indexOf(scene.assumptions.interiorLightLevel);
  if (currentLightIdx > 0) {
    const darker = lightLevels[currentLightIdx - 1];
    tests.push({
      name: `interiorLightLevel=${darker}`,
      currentValue: scene.assumptions.interiorLightLevel,
      testValue: darker,
      apply: (s) => { s.assumptions.interiorLightLevel = darker; },
    });
  }
  if (currentLightIdx < lightLevels.length - 1) {
    const brighter = lightLevels[currentLightIdx + 1];
    tests.push({
      name: `interiorLightLevel=${brighter}`,
      currentValue: scene.assumptions.interiorLightLevel,
      testValue: brighter,
      apply: (s) => { s.assumptions.interiorLightLevel = brighter; },
    });
  }

  // Exterior light lux sensitivity (if set)
  if (scene.assumptions.exteriorLightLux != null) {
    tests.push({
      name: "exteriorLightLux 50%",
      currentValue: scene.assumptions.exteriorLightLux,
      testValue: scene.assumptions.exteriorLightLux * 0.5,
      apply: (s) => { s.assumptions.exteriorLightLux = s.assumptions.exteriorLightLux! * 0.5; },
    });
    tests.push({
      name: "exteriorLightLux 200%",
      currentValue: scene.assumptions.exteriorLightLux,
      testValue: scene.assumptions.exteriorLightLux * 2,
      apply: (s) => { s.assumptions.exteriorLightLux = s.assumptions.exteriorLightLux! * 2; },
    });
  }

  // Backlight sensitivity
  const backlightLevels: Array<"none" | "low" | "medium" | "high"> = ["none", "low", "medium", "high"];
  const currentBacklightIdx = backlightLevels.indexOf(scene.assumptions.backlightIntensity ?? "none");
  if (currentBacklightIdx < backlightLevels.length - 1) {
    const worse = backlightLevels[currentBacklightIdx + 1];
    tests.push({
      name: `backlightIntensity=${worse}`,
      currentValue: scene.assumptions.backlightIntensity ?? "none",
      testValue: worse,
      apply: (s) => { s.assumptions.backlightIntensity = worse; },
    });
  }

  // Glare sensitivity
  const glareLevels: Array<"none" | "low" | "medium" | "high"> = ["none", "low", "medium", "high"];
  const currentGlareIdx = glareLevels.indexOf(scene.assumptions.glareIntensity ?? "none");
  if (currentGlareIdx < glareLevels.length - 1) {
    const worse = glareLevels[currentGlareIdx + 1];
    tests.push({
      name: `glareIntensity=${worse}`,
      currentValue: scene.assumptions.glareIntensity ?? "none",
      testValue: worse,
      apply: (s) => { s.assumptions.glareIntensity = worse; },
    });
  }

  // Run each sensitivity test
  for (const test of tests) {
    const testScene = cloneSecuritySceneSimulation(scene);
    test.apply(testScene);

    const testResult = simulateStudio(testScene);
    const testZonePass = testResult.criticalZoneResults.filter(z => z.status === "pass").length;

    const zoneStatusChanges = countZoneStatusChanges(baseline, testResult);

    const sensitivity = classifySensitivity(
      Math.abs(testResult.totalCoveragePct - baseline.totalCoveragePct),
      Math.abs(qualityToScore(testResult.worstAreaQuality) - qualityToScore(baseline.worstAreaQuality)),
      zoneStatusChanges,
    );

    const affectedZones = findAffectedZones(baseline, testResult);

    results.push({
      assumptionName: test.name,
      currentValue: test.currentValue,
      testValue: test.testValue,
      coverageDeltaPct: Number((testResult.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
      qualityDelta: qualityToScore(testResult.worstAreaQuality) - qualityToScore(baseline.worstAreaQuality),
      zoneStatusChanges,
      sensitivity,
      affectedZones,
      description: buildSensitivityDescription(test.name, test.currentValue, test.testValue, sensitivity),
    });
  }

  // Sort by sensitivity severity (critical first), then by absolute coverage delta
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  results.sort((a, b) => {
    const sRank = severityRank[a.sensitivity] - severityRank[b.sensitivity];
    if (sRank !== 0) return sRank;
    return Math.abs(b.coverageDeltaPct) - Math.abs(a.coverageDeltaPct);
  });

  return results;
}

function countZoneStatusChanges(baseline: SimulationResult, test: SimulationResult): number {
  let changes = 0;
  for (const bz of baseline.criticalZoneResults) {
    const tz = test.criticalZoneResults.find(z => z.zoneId === bz.zoneId);
    if (tz && tz.status !== bz.status) changes++;
  }
  return changes;
}

function findAffectedZones(baseline: SimulationResult, test: SimulationResult): string[] {
  const affected: string[] = [];
  for (const bz of baseline.criticalZoneResults) {
    const tz = test.criticalZoneResults.find(z => z.zoneId === bz.zoneId);
    if (tz && tz.status !== bz.status) {
      affected.push(bz.label || bz.zoneId);
    }
  }
  return affected;
}

function classifySensitivity(
  coverageDelta: number,
  qualityDelta: number,
  zoneChanges: number,
): "critical" | "high" | "medium" | "low" | "none" {
  if (coverageDelta > 10 || qualityDelta > 2 || zoneChanges >= 3) return "critical";
  if (coverageDelta > 5 || qualityDelta > 1 || zoneChanges >= 1) return "high";
  if (coverageDelta > 2 || qualityDelta > 0.5) return "medium";
  if (coverageDelta > 0.5) return "low";
  return "none";
}

function buildSensitivityDescription(
  name: string,
  currentValue: string | number | boolean,
  testValue: string | number | boolean,
  sensitivity: string,
): string {
  const prefix = sensitivity === "critical" || sensitivity === "high"
    ? "Highly sensitive"
    : sensitivity === "medium"
      ? "Moderately sensitive"
      : "Minimally sensitive";
  return `${prefix} to "${name}" (${currentValue} → ${testValue}).`;
}
