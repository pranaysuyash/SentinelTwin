import { describe, expect, test } from "bun:test";
import { StubTier2Provider } from "@/lib/vlm-pipeline/tier2-cloud-pass";
import type { Tier1Output } from "@/lib/vlm-pipeline/types";

describe("StubTier2Provider", () => {
  const provider = new StubTier2Provider();

  const tier1: Tier1Output = {
    imageQuality: {
      isBlurry: false,
      blurScore: 0.7,
      lowLight: false,
      overexposed: false,
      resolutionSufficient: true,
      qualityScore: 0.8,
    },
    sceneType: "retail",
    sceneTypeConfidence: 0.7,
    roomCount: 1,
    rooms: [{ index: 0, label: "main_floor", boundingBox: [0, 0, 100, 100] }],
    ocrTexts: [{ text: "Room A", boundingBox: [10, 10, 100, 30], confidence: 0.7 }],
    overallConfidence: 0.72,
    ambiguityFlags: [],
  };

  test("extractScene returns wall segments for each room", async () => {
    const result = await provider.extractScene(tier1, "data:image/png;base64,x");
    expect(result.walls.length).toBeGreaterThanOrEqual(4);
    expect(result.walls[0].start).toHaveLength(2);
    expect(result.walls[0].end).toHaveLength(2);
    expect(result.walls[0].confidence).toBeGreaterThan(0);
  });

  test("extractScene returns at least one door", async () => {
    const result = await provider.extractScene(tier1, "data:image/png;base64,x");
    expect(result.doors.length).toBeGreaterThan(0);
    expect(result.doors[0].kind).toBe("door");
    expect(result.doors[0].widthM).toBeGreaterThan(0);
  });

  test("extractScene returns adjacency graph", async () => {
    const result = await provider.extractScene(tier1, "data:image/png;base64,x");
    expect(result.adjacencyGraph).toBeDefined();
    expect(result.adjacencyGraph!.edges.length).toBeGreaterThan(0);
  });

  test("extractScene returns overall confidence", async () => {
    const result = await provider.extractScene(tier1, "data:image/png;base64,x");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test("extractScene returns no warnings for clean input", async () => {
    const result = await provider.extractScene(tier1, "data:image/png;base64,x");
    expect(result.warnings).toHaveLength(0);
  });
});
