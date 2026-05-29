import { beforeEach, describe, expect, test } from "bun:test";

import { createCameraNode } from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { useStudioStore } from "@/store/studio-store";

describe("studio store editor mutations", () => {
  beforeEach(() => {
    useStudioStore.getState().setScene(createBlankSecurityScene());
  });

  test("delete selection is undoable and redoable through the canonical store actions", () => {
    const camera = createCameraNode([2, 2.8, 3]);
    useStudioStore.getState().addNode(camera);
    useStudioStore.getState().selectNode(camera.id);

    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(true);

    useStudioStore.getState().removeSelectedNodes();

    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(false);
    expect(useStudioStore.getState().canUndo()).toBe(true);

    useStudioStore.getState().undo();
    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(true);
    expect(useStudioStore.getState().canRedo()).toBe(true);

    useStudioStore.getState().redo();
    expect(useStudioStore.getState().scene.cameras.some((entry) => entry.id === camera.id)).toBe(false);
  });
});
