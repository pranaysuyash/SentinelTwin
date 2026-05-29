import { describe, expect, test } from "bun:test";

import { makeSnapEngine } from "@/components/workspace/editing/SnapEngine";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

describe("SnapEngine", () => {
  test("snaps to wall endpoints and wall segments", () => {
    const scene = createBlankSecurityScene();
    scene.walls.push({
      id: "wall_test",
      nodeType: "wall",
      label: "Wall",
      start: [1, 1],
      end: [5, 1],
      heightM: 3,
      thicknessM: 0.18,
      material: "solid",
      visionTransmission: 0,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    });

    const engine = makeSnapEngine(scene, {
      snapEnabled: true,
      snapDistanceM: 0.35,
      gridSnapM: 0.5,
    });

    expect(engine.snapToGrid([1.12, 3.26])).toEqual([1, 3.5]);

    const wallEndpoint = engine.snapToWallEndpoint([1.15, 1.08]);
    expect(wallEndpoint.snappedToWallEndpoint).toBe(true);
    expect(wallEndpoint.point).toEqual([1, 1]);

    const wallAttachment = engine.snapToWall([3.04, 1.18]);
    expect(wallAttachment.snappedToWall).toBe(true);
    expect(wallAttachment.point[1]).toBeCloseTo(1, 5);

    const placement = engine.snapForPlacement([3.04, 1.18], true);
    expect(placement.snappedToWall).toBe(true);
    expect(placement.point[1]).toBeCloseTo(1, 5);
  });

  test("returns unsnapped placement when outside snap distance", () => {
    const scene = createBlankSecurityScene();
    const engine = makeSnapEngine(scene, {
      snapEnabled: true,
      snapDistanceM: 0.25,
      gridSnapM: 0.5,
    });

    const placement = engine.snapForPlacement([7.3, 4.4], true);
    expect(placement.snappedToWall).toBe(false);
    expect(placement.snappedToWallEndpoint).toBe(false);
  });
});
