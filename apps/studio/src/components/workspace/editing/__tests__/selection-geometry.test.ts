import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { getSceneSelectionIds, normalizeBounds } from "@/components/workspace/editing/selection-geometry";

describe("selection geometry", () => {
  test("normalizes rectangular bounds", () => {
    expect(normalizeBounds([6, 2], [2, 8])).toEqual({
      minX: 2,
      maxX: 6,
      minZ: 2,
      maxZ: 8,
    });
  });

  test("finds selectable scene nodes inside a drag box", () => {
    const scene = createSmallRetailShopScene();
    const camera = scene.cameras[0];
    expect(camera).toBeTruthy();

    const bounds = normalizeBounds(
      [camera!.position[0] - 0.8, camera!.position[2] - 0.8],
      [camera!.position[0] + 0.8, camera!.position[2] + 0.8],
    );

    expect(getSceneSelectionIds(scene, bounds)).toContain(camera!.id);
  });
});
