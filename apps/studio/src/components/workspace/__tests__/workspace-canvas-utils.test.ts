import { describe, expect, test } from "bun:test";

import type { ObstructionNode } from "@/schema/security-scene";

import {
  DEFAULT_SCENE_DIMENSION_FLOOR,
  findObstructionForBlindspotIssue,
  isPrimaryMouseEvent,
  sanitizeSceneDimensions,
} from "../workspace-canvas-utils";

describe("workspace-canvas-utils helpers", () => {
  test("sanitizeSceneDimensions clamps malformed geometry inputs", () => {
    expect(sanitizeSceneDimensions(12, 9)).toEqual([12, 9]);
    expect(sanitizeSceneDimensions(-5, 0.25, DEFAULT_SCENE_DIMENSION_FLOOR)).toEqual([
      DEFAULT_SCENE_DIMENSION_FLOOR,
      DEFAULT_SCENE_DIMENSION_FLOOR,
    ]);
    expect(sanitizeSceneDimensions(Number.NaN, 1.2, DEFAULT_SCENE_DIMENSION_FLOOR)).toEqual([
      DEFAULT_SCENE_DIMENSION_FLOOR,
      1.2,
    ]);
  });

  test("findObstructionForBlindspotIssue handles issue text variants and fuzzy fallbacks", () => {
    const obstructions = [
      { id: "obs_1", label: "Main Corridor Stack" },
      { id: "obs_2", label: "Reception Desk" },
    ] as ObstructionNode[];

    expect(
      findObstructionForBlindspotIssue(
        { description: "Main corridor stack is obstructing entrance" } as never,
        obstructions,
      )?.id,
    ).toBe("obs_1");

    expect(
      findObstructionForBlindspotIssue(
        { description: "obstruction: reception desk near camera 2" } as never,
        obstructions,
      )?.id,
    ).toBe("obs_2");

    expect(
      findObstructionForBlindspotIssue(
        { description: "A large glass rack blocks line-of-sight" } as never,
        [
          { id: "obs_3", label: "glass rack" } as ObstructionNode,
        ],
      )?.id,
    ).toBe("obs_3");

    expect(findObstructionForBlindspotIssue({ description: "obstruction: unknown source near camera 4" } as never, obstructions))
      .toBeNull();
  });

  test("isPrimaryMouseEvent requires primary pointer button", () => {
    expect(isPrimaryMouseEvent({ nativeEvent: { button: 0 } })).toBe(true);
    expect(isPrimaryMouseEvent({ nativeEvent: { button: 1 } })).toBe(false);
    expect(isPrimaryMouseEvent({ nativeEvent: { button: 2 } })).toBe(false);
  });
});
