import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { computeCoveragePostureVariation } from "@/simulation/coverage-posture";

describe("coverage posture variation", () => {
  test("produces posture summaries across common heights", () => {
    const scene = createSmallRetailShopScene();
    const variation = computeCoveragePostureVariation(scene);

    expect(variation).toBeDefined();
    expect(variation?.baselineProfileLabel).toBe("Standing");
    expect(variation?.profiles.length).toBeGreaterThan(0);
    expect(variation?.profiles.some((profile) => profile.label === "Seated")).toBe(true);
    expect(variation?.profiles.some((profile) => profile.label === "Crouching")).toBe(true);
    expect(variation?.worstProfileLabel).toBeDefined();
    expect(variation?.worstZoneLabel).toBeDefined();
    expect(Number.isFinite(variation?.largestDropDeltaPct ?? Number.NaN)).toBe(true);
  });
});
