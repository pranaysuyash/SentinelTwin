import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const importReviewPath = join(import.meta.dir, "../..", "components/scan-to-scene/ImportReview.tsx");

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
    expect(source).toContain("Drag wall endpoints and opening markers");
    expect(source).toContain("Split First Kept Wall");
    expect(source).toContain("Merge First Two Kept Walls");
    expect(source).toContain("Snap Kept Walls Orthogonal");
    expect(source).toContain("Import trust");
    expect(source).toContain("Manual footprint");
    expect(source).toContain("Tier 1 Gate");
    expect(source).toContain("Preview is zoomed to the extracted geometry");
    expect(source).toContain("What to check before continuing");
    expect(source).toContain("Use known room dimensions to lock the scene footprint and refine scale.");
  });
});
