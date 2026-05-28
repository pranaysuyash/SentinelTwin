import { afterEach, describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { useStudioStore } from "@/store/studio-store";

type StorageShape = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function makeStorage(): StorageShape {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function installStorage() {
  const storage = makeStorage();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true });
  useStudioStore.getState().setScene(createSmallRetailShopScene());
  useStudioStore.setState({ savedProjects: [], savedScenes: [] });
});

describe("studio store project metadata", () => {
  test("persists folder, tag, and pin metadata for saved workspaces", () => {
    const storage = installStorage();
    const scene = createSmallRetailShopScene();
    const { setScene, saveSceneToStorage, updateSavedSceneMetadata, refreshSavedScenesList, getSceneStorageKey } = useStudioStore.getState();

    setScene(scene);
    saveSceneToStorage();
    updateSavedSceneMetadata(scene.id, {
      folder: "Retail",
      tags: ["client-alpha", "retail", "retail"],
      pinned: true,
      lastOpenedAt: 1234567890,
    });
    refreshSavedScenesList();

    const state = useStudioStore.getState();
    const saved = state.savedProjects.find((record) => record.scene.id === scene.id);

    expect(getSceneStorageKey()).toBe("sentineltwin_saved_projects_v2");
    expect(saved).toBeTruthy();
    expect(saved?.folder).toBe("Retail");
    expect(saved?.tags).toEqual(["client-alpha", "retail"]);
    expect(saved?.pinned).toBe(true);
    expect(saved?.lastOpenedAt).toBe(1234567890);
    expect(storage.getItem("sentineltwin_saved_projects_v2")).toContain("\"folder\":\"Retail\"");
  });
});
