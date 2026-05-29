import { describe, expect, it } from "vitest";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import {
  createCameraNode,
  createCriticalZoneNode,
  createDoorNode,
  createScenarioPathNode,
  createWallNode,
  createWindowNode,
} from "@/lib/node-factory";

import {
  buildContextualMenuModel,
  findContextualNode,
  planContextualAction,
} from "../object-context-actions";

function buildScene() {
  const scene = createBlankSecurityScene();
  scene.cameras = [createCameraNode([2.5, 2.8, 2.5])];
  scene.criticalZones = [createCriticalZoneNode([
    [2, 2],
    [4, 2],
    [4, 4],
  ])];
  scene.doors = [createDoorNode([5, 1.1, 0.16])];
  scene.windows = [createWindowNode([7, 1.4, 7.84])];
  scene.paths = [createScenarioPathNode([
    { position: [1, 1] },
    { position: [3, 2] },
    { position: [4, 3] },
  ])];
  scene.walls = [
    createWallNode([0, 0], [10, 0]),
    createWallNode([0, 8], [10, 8]),
    createWallNode([10, 0], [10, 8]),
    createWallNode([0, 0], [0, 8]),
  ];
  return scene;
}

describe("buildContextualMenuModel", () => {
  it("surfaces camera alignment actions and zone targeting", () => {
    const scene = buildScene();
    const camera = findContextualNode(scene, scene.cameras[0]!.id);
    expect(camera?.nodeType).toBe("camera");

    const model = buildContextualMenuModel(scene, camera!, [scene.criticalZones[0]!.id]);
    const alignGroup = model.groups.find((group) => group.id === "align");
    expect(alignGroup).toBeTruthy();
    expect(alignGroup?.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["snap_camera_wall", "snap_camera_ceiling", "aim_at_selected_zone", "open_camera_view"]),
    );
    expect(alignGroup?.actions.find((action) => action.id === "aim_at_selected_zone")?.enabled).toBe(true);
  });

  it("surfaces door wall snapping and state controls", () => {
    const scene = buildScene();
    const door = findContextualNode(scene, scene.doors[0]!.id);
    const model = buildContextualMenuModel(scene, door!, []);

    expect(model.groups.find((group) => group.id === "align")?.actions.some((action) => action.id === "snap_to_wall")).toBe(true);
    expect(model.groups.find((group) => group.id === "state")?.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(["Open Door", "Lock Door"]),
    );
  });
});

describe("planContextualAction", () => {
  it("snaps cameras to wall mounts", () => {
    const scene = buildScene();
    const camera = scene.cameras[0]!;
    const plan = planContextualAction(scene, camera, "snap_camera_wall", []);

    expect(plan.kind).toBe("patch");
    if (plan.kind !== "patch") return;
    const patch = plan.patch as { mountType?: string; position?: [number, number, number] };
    expect(patch.mountType).toBe("wall");
    expect((patch.position as [number, number, number])[1]).toBeCloseTo(2.75, 2);
  });

  it("snaps doors to the nearest wall", () => {
    const scene = buildScene();
    const door = scene.doors[0]!;
    const plan = planContextualAction(scene, door, "snap_to_wall", []);

    expect(plan.kind).toBe("patch");
    if (plan.kind !== "patch") return;
    const patch = plan.patch as { position?: [number, number, number] };
    expect((patch.position as [number, number, number])[2]).toBeLessThanOrEqual(0.2);
  });

  it("reverses a path", () => {
    const scene = buildScene();
    const path = scene.paths[0]!;
    const plan = planContextualAction(scene, path, "path_reverse", []);

    expect(plan.kind).toBe("patch");
    if (plan.kind !== "patch") return;
    const patch = plan.patch as { points?: { position: [number, number] }[] };
    expect(patch.points?.[0]?.position).toEqual([4, 3]);
  });

  it("flips a wall by swapping its endpoints", () => {
    const scene = buildScene();
    const wall = scene.walls[0]!;
    const plan = planContextualAction(scene, wall, "wall_reverse", []);

    expect(plan.kind).toBe("patch");
    if (plan.kind !== "patch") return;
    const patch = plan.patch as { start?: [number, number]; end?: [number, number] };
    expect(patch.start).toEqual([10, 0]);
    expect(patch.end).toEqual([0, 0]);
  });
});
