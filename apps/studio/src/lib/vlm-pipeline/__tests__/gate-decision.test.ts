import { describe, expect, test } from "bun:test";
import { evaluateGateDecision, getGateWarning } from "@/lib/vlm-pipeline/gate-decision";
import type { Tier1Output } from "@/lib/vlm-pipeline/types";

function makeTier1(overrides: Partial<Tier1Output> = {}): Tier1Output {
  return {
    imageQuality: {
      isBlurry: false,
      blurScore: 0.65,
      lowLight: false,
      overexposed: false,
      resolutionSufficient: true,
      qualityScore: 0.72,
    },
    sceneType: "retail",
    sceneTypeConfidence: 0.65,
    roomCount: 1,
    rooms: [{ index: 0, label: "main", boundingBox: [0, 0, 100, 100] }],
    ocrTexts: [],
    overallConfidence: 0.68,
    ambiguityFlags: [],
    ...overrides,
  };
}

describe("evaluateGateDecision", () => {
  test("proceeds to tier2 when all checks pass", () => {
    const decision = evaluateGateDecision(makeTier1());
    expect(decision.action).toBe("proceed_to_tier2");
    expect(getGateWarning(decision)).toBeNull();
  });

  test("rejects blurry images", () => {
    const decision = evaluateGateDecision(makeTier1({
      imageQuality: {
        isBlurry: true,
        blurScore: 0.08,
        lowLight: false,
        overexposed: false,
        resolutionSufficient: true,
        qualityScore: 0.15,
      },
    }));
    expect(decision.action).toBe("reject_blurry");
    expect(getGateWarning(decision)).not.toBeNull();
  });

  test("rejects low quality images", () => {
    const decision = evaluateGateDecision(makeTier1({
      imageQuality: {
        isBlurry: false,
        blurScore: 0.3,
        lowLight: false,
        overexposed: false,
        resolutionSufficient: true,
        qualityScore: 0.2,
      },
    }));
    expect(decision.action).toBe("reject_blurry");
  });

  test("flags unknown scene type for human review", () => {
    const decision = evaluateGateDecision(makeTier1({
      sceneType: "unknown",
      sceneTypeConfidence: 0.2,
    }));
    expect(decision.action).toBe("human_review");
  });

  test("flags low scene confidence for human review", () => {
    const decision = evaluateGateDecision(makeTier1({
      sceneTypeConfidence: 0.2,
    }));
    expect(decision.action).toBe("human_review");
  });

  test("flags too many ambiguity flags for human review", () => {
    const decision = evaluateGateDecision(makeTier1({
      ambiguityFlags: ["blurry", "low_light", "unknown_scene_type"],
    }));
    expect(decision.action).toBe("human_review");
  });

  test("flags low overallConfidence for human review", () => {
    const decision = evaluateGateDecision(makeTier1({
      overallConfidence: 0.25,
    }));
    expect(decision.action).toBe("human_review");
  });

  test("forceTier2 bypasses gate checks", () => {
    const decision = evaluateGateDecision(
      makeTier1({
        imageQuality: {
          isBlurry: true,
          blurScore: 0.05,
          lowLight: false,
          overexposed: false,
          resolutionSufficient: true,
          qualityScore: 0.1,
        },
      }),
      { forceTier2: true },
    );
    expect(decision.action).toBe("proceed_to_tier2");
  });
});
