import { afterEach, describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@sentineltwin/simulation";
import { __resetSimulationRunnerForTests, runStudioSimulation } from "@/lib/simulation-runner";
import { computeTemporalProfileForResult } from "@/lib/simulation-run-core";

afterEach(() => {
  __resetSimulationRunnerForTests();
});

describe("runStudioSimulation", () => {
  it("produces the same deterministic result as the synchronous engine", async () => {
    const scene = createSmallRetailShopScene();
    const direct = simulateStudio(scene);
    const run = await runStudioSimulation(scene, { includeTemporalProfile: false });

    // No `window` in bun tests, so this exercises the canonical fallback path.
    expect(run.executionPath).toBe("main_thread");
    expect(run.temporalProfile).toBeNull();
    expect(run.result.totalCoveragePct).toBeCloseTo(direct.totalCoveragePct, 5);
    expect(run.result.criticalZoneResults.length).toBe(direct.criticalZoneResults.length);
    expect(run.result.issues.length).toBe(direct.issues.length);
  });

  it("computes the 24h temporal profile in the same run by default", async () => {
    const scene = createSmallRetailShopScene();
    const run = await runStudioSimulation(scene);

    expect(run.temporalProfile).not.toBeNull();
    expect(run.temporalProfile!.hourlySnapshots.length).toBe(96);
  }, 30_000);
});

describe("computeTemporalProfileForResult", () => {
  it("stamps the fresh result onto a clone without mutating the input scene", () => {
    const scene = createSmallRetailShopScene();
    const originalSimulation = scene.simulation;
    const result = simulateStudio(scene);

    const profile = computeTemporalProfileForResult(scene, result);

    expect(profile.hourlySnapshots.length).toBe(96);
    expect(scene.simulation).toBe(originalSimulation);
  }, 30_000);
});
