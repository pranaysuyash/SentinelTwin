import { describe, expect, test } from "bun:test";

import {
  doorSwingPath,
  nearestWallAngle,
  wallAlignedSegment,
} from "@/components/map/map-geometry";
import type { SecurityScene, WallNode } from "@/schema/security-scene";

function wall(id: string, start: [number, number], end: [number, number]): WallNode {
  return {
    id: `wall_${id}`,
    nodeType: "wall",
    label: id,
    start,
    end,
    heightM: 3,
    thicknessM: 0.2,
    material: "solid",
    visionTransmission: 0,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

const scene = {
  walls: [
    wall("h", [0, 0], [10, 0]),   // horizontal along X
    wall("v", [0, 0], [0, 8]),    // vertical along Z
  ],
} as Pick<SecurityScene, "walls">;

const identityProject = (p: [number, number]) => ({ x: p[0], y: p[1] });

describe("nearestWallAngle", () => {
  test("uses the preferred wall when its id is given", () => {
    expect(nearestWallAngle(scene, [5, 5], "wall_h")).toBeCloseTo(0);
    expect(nearestWallAngle(scene, [5, 5], "wall_v")).toBeCloseTo(Math.PI / 2);
  });

  test("falls back to the nearest wall segment", () => {
    // Close to the horizontal wall
    expect(nearestWallAngle(scene, [5, 0.2])).toBeCloseTo(0);
    // Close to the vertical wall
    expect(nearestWallAngle(scene, [0.2, 5])).toBeCloseTo(Math.PI / 2);
  });

  test("returns 0 for a scene without walls", () => {
    expect(nearestWallAngle({ walls: [] }, [3, 3])).toBe(0);
  });
});

describe("wallAlignedSegment", () => {
  test("aligns the segment with the wall direction", () => {
    const horizontal = wallAlignedSegment([5, 0], 2, 0);
    expect(horizontal.start[0]).toBeCloseTo(4);
    expect(horizontal.end[0]).toBeCloseTo(6);
    expect(horizontal.start[1]).toBeCloseTo(0);

    const vertical = wallAlignedSegment([0, 4], 2, Math.PI / 2);
    expect(vertical.start[1]).toBeCloseTo(3);
    expect(vertical.end[1]).toBeCloseTo(4 + 1);
    expect(vertical.start[0]).toBeCloseTo(0);
  });

  test("enforces a minimum opening width", () => {
    const tiny = wallAlignedSegment([1, 1], 0.001, 0);
    expect(tiny.end[0] - tiny.start[0]).toBeGreaterThan(0.05);
  });
});

describe("doorSwingPath", () => {
  test("builds leaf and arc paths with the hinge on the wall line", () => {
    const swing = doorSwingPath([5, 0], 1, 0, identityProject);
    // Hinge sits half a width along the wall from center.
    expect(swing.hinge[0]).toBeCloseTo(4.5);
    expect(swing.hinge[1]).toBeCloseTo(0);
    expect(swing.leaf.startsWith("M 4.5 0")).toBe(true);
    // Leaf ends perpendicular to the wall at door-width distance.
    expect(swing.leaf).toContain("L 4.5 1");
    expect(swing.arc.startsWith("M 5.5 0")).toBe(true);
    expect(swing.arc).toContain("A 1 1");
  });
});
