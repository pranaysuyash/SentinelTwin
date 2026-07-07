import { describe, expect, test } from "bun:test";

import { constrainMoveDelta } from "@/components/workspace/editing/TransformHandles";

describe("gizmo axis constraints", () => {
  test("free move passes both deltas through", () => {
    expect(constrainMoveDelta("move", 1.5, -2.25)).toEqual([1.5, -2.25]);
  });

  test("X arrow zeroes the Z delta", () => {
    expect(constrainMoveDelta("move_x", 1.5, -2.25)).toEqual([1.5, 0]);
  });

  test("Z arrow zeroes the X delta", () => {
    expect(constrainMoveDelta("move_z", 1.5, -2.25)).toEqual([0, -2.25]);
  });

  test("non-move handles are untouched (defensive)", () => {
    expect(constrainMoveDelta("rotate", 3, 4)).toEqual([3, 4]);
  });
});
