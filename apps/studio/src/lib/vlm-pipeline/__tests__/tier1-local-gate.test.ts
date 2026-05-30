import { describe, expect, test } from "bun:test";
import {
  StubTier1Provider,
  runTier1Heuristic,
} from "@/lib/vlm-pipeline/tier1-local-gate";

describe("StubTier1Provider", () => {
  const provider = new StubTier1Provider();

  test("assessImageQuality returns non-blurry result", async () => {
    const quality = await provider.assessImageQuality("data:image/png;base64,x");
    expect(quality.isBlurry).toBe(false);
    expect(quality.blurScore).toBeGreaterThan(0);
    expect(quality.qualityScore).toBeGreaterThan(0);
    expect(quality.resolutionSufficient).toBe(true);
  });

  test("classifyScene returns a scene type", async () => {
    const result = await provider.classifyScene("data:image/png;base64,x");
    expect(["retail", "warehouse", "office", "residential", "industrial", "outdoor", "unknown"]).toContain(result.sceneType);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test("extractOcr returns text entries", async () => {
    const entries = await provider.extractOcr("data:image/png;base64,x");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].text.length).toBeGreaterThan(0);
    expect(entries[0].confidence).toBeGreaterThan(0);
  });

  test("detectRooms returns at least one room", async () => {
    const result = await provider.detectRooms("data:image/png;base64,x");
    expect(result.roomCount).toBeGreaterThanOrEqual(1);
    expect(result.rooms.length).toBeGreaterThanOrEqual(1);
    expect(result.rooms[0].label).toBe("main_floor");
  });
});

describe("runTier1Heuristic (Canvas)", () => {
  const MINIMAL_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  test("returns a complete Tier1Output", async () => {
    const output = await runTier1Heuristic(MINIMAL_PNG, "test.png");
    expect(output.imageQuality).toBeDefined();
    expect(typeof output.imageQuality.isBlurry).toBe("boolean");
    expect(typeof output.sceneType).toBe("string");
    expect(typeof output.roomCount).toBe("number");
    expect(Array.isArray(output.rooms)).toBe(true);
    expect(Array.isArray(output.ocrTexts)).toBe(true);
    expect(Array.isArray(output.ambiguityFlags)).toBe(true);
    expect(output.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(output.overallConfidence).toBeLessThanOrEqual(1);
  });
});
