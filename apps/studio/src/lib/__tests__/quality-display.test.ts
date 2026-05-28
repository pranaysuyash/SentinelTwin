import { describe, expect, test } from "bun:test";

import { QUALITY_RANK } from "@/lib/quality-display";

describe("quality-display", () => {
  test("keeps the full OODPCVS ladder ordered above the DORI baseline levels", () => {
    expect(QUALITY_RANK.none).toBe(0);
    expect(QUALITY_RANK.detection).toBeLessThan(QUALITY_RANK.overview);
    expect(QUALITY_RANK.overview).toBeLessThan(QUALITY_RANK.outline);
    expect(QUALITY_RANK.outline).toBeLessThan(QUALITY_RANK.observation);
    expect(QUALITY_RANK.observation).toBeLessThan(QUALITY_RANK.discern);
    expect(QUALITY_RANK.discern).toBeLessThan(QUALITY_RANK.perceive);
    expect(QUALITY_RANK.perceive).toBeLessThan(QUALITY_RANK.recognition);
    expect(QUALITY_RANK.recognition).toBeLessThan(QUALITY_RANK.characterize);
    expect(QUALITY_RANK.characterize).toBeLessThan(QUALITY_RANK.validate);
    expect(QUALITY_RANK.validate).toBeLessThan(QUALITY_RANK.identification);
    expect(QUALITY_RANK.identification).toBeLessThan(QUALITY_RANK.scrutinize);
    expect(QUALITY_RANK.scrutinize).toBe(11);
  });
});
