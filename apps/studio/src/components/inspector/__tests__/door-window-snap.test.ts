import { describe, expect, test } from "bun:test";

import { snapDoorWindowToWall } from "@/components/inspector/door-window-snap";
import { createDoorNode, createWindowNode } from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

describe("door/window wall snap", () => {
  test("projects doors and windows onto the nearest wall", () => {
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

    const door = createDoorNode([3.4, 0.9, 2.8]);
    const windowNode = createWindowNode([4.1, 1.8, 2.6]);

    const doorPatch = snapDoorWindowToWall(door, scene);
    const windowPatch = snapDoorWindowToWall(windowNode, scene);

    expect(doorPatch?.position[0]).toBeCloseTo(3.4, 0);
    expect(doorPatch?.position[2]).toBeCloseTo(1, 0);
    expect(windowPatch?.position[2]).toBeCloseTo(1, 0);
    expect(windowPatch?.position[1]).toBeGreaterThanOrEqual(1);
  });
});
