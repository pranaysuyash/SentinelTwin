import { describe, expect, test, beforeEach } from "bun:test";
import { useStudioStore } from "@/store/studio-store";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createCameraNode } from "@sentineltwin/core";

describe("Multi-floor store actions & cleanup (D-328)", () => {
  beforeEach(() => {
    const blank = createBlankSecurityScene();
    useStudioStore.getState().setScene({
      ...blank,
      levels: [
        { id: "lvl_1", name: "Floor 1", elevation: 0, height: 3.5, order: 0 },
        { id: "lvl_2", name: "Floor 2", elevation: 3.5, height: 3.0, order: 1 },
      ],
      cameras: [
        {
          ...createCameraNode([5, 3, 5], {
            name: "Cam 1",
            yawDeg: 0,
            pitchDeg: -15,
            mountType: "wall",
            mountHeightM: 3,
            fovHorizontalDeg: 90,
            fovVerticalDeg: 60,
            rangeM: 15,
            resolutionMP: 4,
            nightMode: "ir",
            irRangeM: 15,
            clarity: "good",
          }),
          id: "cam_1",
          levelId: "lvl_1",
        },
        {
          ...createCameraNode([15, 3, 5], {
            name: "Cam 2",
            yawDeg: 0,
            pitchDeg: -15,
            mountType: "wall",
            mountHeightM: 3,
            fovHorizontalDeg: 90,
            fovVerticalDeg: 60,
            rangeM: 15,
            resolutionMP: 4,
            nightMode: "ir",
            irRangeM: 15,
            clarity: "good",
          }),
          id: "cam_2",
          levelId: "lvl_2",
        },
      ],
      walls: [
        { ...blank.walls[0], id: "wall_1", levelId: "lvl_1" },
        { ...blank.walls[1], id: "wall_2", levelId: "lvl_2" },
      ],
    });
    useStudioStore.getState().setActiveLevelId("lvl_1");
    useStudioStore.getState().setLevelDisplayMode("stacked");
  });

  test("addLevel creates a new level and sets it as active", () => {
    const store = useStudioStore.getState();
    store.addLevel({ name: "Roof", elevation: 6.5, height: 2.5 });

    const state = useStudioStore.getState();
    expect(state.scene.levels).toHaveLength(3);
    const roof = state.scene.levels?.[2];
    expect(roof?.name).toBe("Roof");
    expect(state.activeLevelId).toBe(roof?.id ?? null);
  });

  test("updateLevel updates level properties", () => {
    const store = useStudioStore.getState();
    store.updateLevel("lvl_1", { name: "Ground Floor Renamed", elevation: 0.5 });

    const state = useStudioStore.getState();
    const lvl1 = state.scene.levels?.find((l) => l.id === "lvl_1");
    expect(lvl1?.name).toBe("Ground Floor Renamed");
    expect(lvl1?.elevation).toBe(0.5);
  });

  test("deleteLevel removes the level AND cleans up nodes assigned to that level", () => {
    const store = useStudioStore.getState();
    expect(store.scene.cameras).toHaveLength(2);
    expect(store.scene.walls).toHaveLength(2);

    // Delete lvl_1 -> should remove cam_1 and wall_1
    store.deleteLevel("lvl_1");

    const state = useStudioStore.getState();
    expect(state.scene.levels).toHaveLength(1);
    expect(state.scene.levels?.[0]?.id).toBe("lvl_2");

    // Check node cleanup
    expect(state.scene.cameras).toHaveLength(1);
    expect(state.scene.cameras[0]?.id).toBe("cam_2");
    expect(state.scene.walls).toHaveLength(1);
    expect(state.scene.walls[0]?.id).toBe("wall_2");

    // Active level should switch to remaining level
    expect(state.activeLevelId).toBe("lvl_2");
  });

  test("addNode automatically assigns activeLevelId to newly created nodes", () => {
    const store = useStudioStore.getState();
    store.setActiveLevelId("lvl_2");

    store.addNode({
      ...createCameraNode([5, 5, 5], {
        name: "New Camera",
        yawDeg: 0,
        pitchDeg: -15,
        mountType: "wall",
        mountHeightM: 3,
        fovHorizontalDeg: 90,
        fovVerticalDeg: 60,
        rangeM: 15,
        resolutionMP: 4,
        nightMode: "ir",
        irRangeM: 15,
        clarity: "good",
      }),
      id: "cam_new",
    });

    const state = useStudioStore.getState();
    const newCam = state.scene.cameras.find((c) => c.id === "cam_new");
    expect(newCam).toBeDefined();
    expect(newCam?.levelId).toBe("lvl_2");
  });
});
