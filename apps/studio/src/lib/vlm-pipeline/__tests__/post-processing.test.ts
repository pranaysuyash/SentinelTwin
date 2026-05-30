import { describe, expect, test } from "bun:test";
import { DefaultPostProcessor } from "@/lib/vlm-pipeline/post-processing";
import type { Tier1Output, Tier2Output, WallCoordinate } from "@/lib/vlm-pipeline/types";

function makeTier1(roomCount: number = 1): Tier1Output {
  return {
    imageQuality: {
      isBlurry: false,
      blurScore: 0.7,
      lowLight: false,
      overexposed: false,
      resolutionSufficient: true,
      qualityScore: 0.75,
    },
    sceneType: "retail",
    sceneTypeConfidence: 0.7,
    roomCount,
    rooms: Array.from({ length: roomCount }, (_, i) => ({
      index: i,
      label: `room_${i}`,
      boundingBox: [i * 100, 0, (i + 1) * 100, 100] as [number, number, number, number],
    })),
    ocrTexts: [],
    overallConfidence: 0.7,
    ambiguityFlags: [],
  };
}

function makeTier2(walls: WallCoordinate[] = []): Tier2Output {
  return {
    walls,
    doors: [],
    windows: [],
    obstructions: [],
    criticalZones: [],
    confidence: 0.7,
    warnings: [],
  };
}

function makeRectWalls(count: number): WallCoordinate[] {
  return Array.from({ length: count }, (_, i) => ({
    start: [0, i * 0.2] as [number, number],
    end: [1, i * 0.2] as [number, number],
    confidence: 0.6,
  }));
}

describe("DefaultPostProcessor", () => {
  const processor = new DefaultPostProcessor();

  test("passes valid output", async () => {
    const walls: WallCoordinate[] = [
      { start: [0, 0], end: [1, 0], confidence: 0.7 },
      { start: [1, 0], end: [1, 1], confidence: 0.7 },
      { start: [0, 1], end: [1, 1], confidence: 0.7 },
      { start: [0, 0], end: [0, 1], confidence: 0.7 },
    ];
    const result = await processor.validate(makeTier1(1), makeTier2(walls));
    expect(result.overallPass).toBe(true);
    expect(result.validationIssues).toHaveLength(0);
  });

  test("warns when wall count is too low for number of rooms", async () => {
    const result = await processor.validate(makeTier1(3), makeTier2(makeRectWalls(2)));
    const wallIssues = result.validationIssues.filter((i) => i.code === "WALL_COUNT_TOO_LOW");
    expect(wallIssues.length).toBeGreaterThan(0);
    expect(result.overallPass).toBe(true);
  });

  test("warns when wall count is excessive", async () => {
    const result = await processor.validate(makeTier1(1), makeTier2(makeRectWalls(20)));
    const wallIssues = result.validationIssues.filter((i) => i.code === "WALL_COUNT_EXCESSIVE");
    expect(wallIssues.length).toBeGreaterThan(0);
  });

  test("blocks unreasonably small rooms", async () => {
    const walls: WallCoordinate[] = [
      { start: [0, 0], end: [0.005, 0], confidence: 0.5 },
      { start: [0.005, 0], end: [0.005, 0.005], confidence: 0.5 },
      { start: [0, 0.005], end: [0.005, 0.005], confidence: 0.5 },
      { start: [0, 0], end: [0, 0.005], confidence: 0.5 },
    ];
    const result = await processor.validate(makeTier1(1), makeTier2(walls));
    const smallIssues = result.validationIssues.filter((i) => i.code === "ROOM_TOO_SMALL");
    expect(smallIssues.length).toBeGreaterThan(0);
    expect(smallIssues[0].severity).toBe("blocking");
    expect(result.overallPass).toBe(false);
  });

  test("adjusts confidence down with validation issues", async () => {
    const result = await processor.validate(makeTier1(1), makeTier2(makeRectWalls(0)));
    expect(result.confidence).toBeLessThan(0.7);
  });
});
