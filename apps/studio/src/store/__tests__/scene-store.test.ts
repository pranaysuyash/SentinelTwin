import { beforeEach, describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { createSceneStore } from "@/store/scene-store";

describe("scene store", () => {
  beforeEach(() => {
    createSceneStore.setState(createSceneStore.getInitialState(), true);
  });

  test("imports the demo scene and marks simulation stale after edits", () => {
    const result = createSceneStore.getState().importScene(smallRetailShopScene);

    expect(result.success).toBe(true);
    expect(createSceneStore.getState().scene?.cameras).toHaveLength(2);

    createSceneStore.getState().updateNode("cam_entrance", { yawDeg: 30 });

    expect(createSceneStore.getState().scene?.cameras[0]?.yawDeg).toBe(30);
    expect(createSceneStore.getState().simulationDirty).toBe(true);
  });

  test("saves a named snapshot from the current scene", () => {
    createSceneStore.getState().importScene(smallRetailShopScene);

    createSceneStore.getState().saveSnapshot("Baseline");

    const snapshots = createSceneStore.getState().snapshots;

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.label).toBe("Baseline");
    expect(snapshots[0]?.scene.name).toBe("Small Retail Shop Demo");
  });
});
