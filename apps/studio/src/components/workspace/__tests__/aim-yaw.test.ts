import { describe, expect, it } from "bun:test";

import { getYawPitchDirection } from "@sentineltwin/core";
import { computeAimYawDeg, DEFAULT_PLACEMENT_YAW_DEG } from "@/components/workspace/workspace-canvas-utils";

describe("computeAimYawDeg", () => {
  it("matches the engine yaw convention for the four cardinal directions", () => {
    // Engine: yaw 0 faces -Z, yaw 90 faces +X.
    expect(computeAimYawDeg([0, 0], [0, -5])).toBe(0);
    expect(computeAimYawDeg([0, 0], [5, 0])).toBe(90);
    expect(computeAimYawDeg([0, 0], [0, 5])).toBe(180);
    expect(computeAimYawDeg([0, 0], [-5, 0])).toBe(270);
  });

  it("round-trips through getYawPitchDirection back toward the target", () => {
    const anchor: [number, number] = [3, 4];
    const target: [number, number] = [7.5, 1.2];
    const yaw = computeAimYawDeg(anchor, target);
    const direction = getYawPitchDirection(yaw, 0);
    const expected = [target[0] - anchor[0], target[1] - anchor[1]];
    const length = Math.hypot(expected[0], expected[1]);
    // Direction XZ should align with the normalized anchor→target vector (±1° rounding).
    expect(direction.x).toBeCloseTo(expected[0] / length, 1);
    expect(direction.z).toBeCloseTo(expected[1] / length, 1);
  });

  it("returns the factory default yaw for a zero-length drag", () => {
    expect(computeAimYawDeg([2, 2], [2, 2])).toBe(DEFAULT_PLACEMENT_YAW_DEG);
  });

  it("normalizes into 0–359", () => {
    for (const target of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as [number, number][]) {
      const yaw = computeAimYawDeg([0, 0], target);
      expect(yaw).toBeGreaterThanOrEqual(0);
      expect(yaw).toBeLessThan(360);
    }
  });
});
