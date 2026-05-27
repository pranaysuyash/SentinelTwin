import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const importReviewPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/scan-to-scene/ImportReview.tsx";

describe("ImportReview", () => {
  test("exposes detection correction controls for walls, doors, and windows", () => {
    const source = readFileSync(importReviewPath, "utf8");

    expect(source).toContain("Detection Corrections");
    expect(source).toContain("Apply Corrections");
    expect(source).toContain("onUpdateResult");
    expect(source).toContain("draftWalls.filter");
    expect(source).toContain("draftDoors.filter");
    expect(source).toContain("draftWindows.filter");
    expect(source).toContain("Spatial Preview");
    expect(source).toContain("normalizeFloorPlanResult(filtered)");
    expect(source).toContain("Drag wall endpoints and door/window markers");
    expect(source).toContain("Split First Kept Wall");
    expect(source).toContain("Merge First Two Kept Walls");
    expect(source).toContain("Snap Kept Walls Orthogonal");
  });
});
