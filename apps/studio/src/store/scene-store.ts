import { createStore, type StoreApi } from "zustand/vanilla";

import {
  type AnyEditableNode,
  type SecurityScene,
  type SimulationResult,
  type SceneSnapshot,
  cloneSecurityScene,
  parseSecurityScene,
  safeParseSecurityScene,
} from "@/schema/security-scene";

type ImportResult = { success: true } | { success: false; error: string };

export type SceneStoreState = {
  scene: SecurityScene | null;
  simulationDirty: boolean;
  snapshots: SceneSnapshot[];
  addNode: (node: AnyEditableNode) => void;
  updateNode: (id: string, patch: Partial<AnyEditableNode>) => void;
  removeNode: (id: string) => void;
  markDirty: () => void;
  setSimulationResult: (result: SimulationResult) => void;
  importScene: (json: unknown) => ImportResult;
  exportScene: () => SecurityScene | null;
  saveSnapshot: (label: string) => void;
};

const collectionKeys = [
  "walls",
  "doors",
  "windows",
  "cameras",
  "securityLights",
  "obstructions",
  "criticalZones",
  "privacyZones",
  "entryPoints",
  "paths",
] as const;

function patchSceneNode(
  scene: SecurityScene,
  id: string,
  patch: Partial<AnyEditableNode>,
): SecurityScene {
  const nextScene = cloneSecurityScene(scene);

  for (const key of collectionKeys) {
    const idx = nextScene[key].findIndex((node) => node.id === id);
    if (idx !== -1) {
      nextScene[key][idx] = {
        ...nextScene[key][idx],
        ...patch,
      } as (typeof nextScene)[typeof key][number];
      nextScene.updatedAt = Date.now();
      return nextScene;
    }
  }

  return nextScene;
}

function removeSceneNode(scene: SecurityScene, id: string): SecurityScene {
  const nextScene = cloneSecurityScene(scene);

  for (const key of collectionKeys) {
    const existingLength = nextScene[key].length;
    (nextScene as unknown as Record<string, { id: string }[]>)[key] = (nextScene[key] as { id: string }[]).filter((node) => node.id !== id);
    if (nextScene[key].length !== existingLength) {
      nextScene.updatedAt = Date.now();
      return nextScene;
    }
  }

  return nextScene;
}

function insertSceneNode(scene: SecurityScene, node: AnyEditableNode): SecurityScene {
  const nextScene = cloneSecurityScene(scene);

  switch (node.nodeType) {
    case "wall":
      nextScene.walls.push(node);
      break;
    case "door":
      nextScene.doors.push(node);
      break;
    case "window":
      nextScene.windows.push(node);
      break;
    case "camera":
      nextScene.cameras.push(node);
      break;
    case "security_light":
      nextScene.securityLights.push(node);
      break;
    case "obstruction":
      nextScene.obstructions.push(node);
      break;
    case "critical_zone":
      nextScene.criticalZones.push(node);
      break;
    case "privacy_zone":
      nextScene.privacyZones.push(node);
      break;
    case "entry_point":
      nextScene.entryPoints.push(node);
      break;
    case "path":
      nextScene.paths.push(node);
      break;
  }

  nextScene.updatedAt = Date.now();
  return nextScene;
}

function buildSceneStoreState(
  set: StoreApi<SceneStoreState>["setState"],
  get: () => SceneStoreState,
): SceneStoreState {
  return {
    scene: null,
    simulationDirty: true,
    snapshots: [],
    addNode: (node) =>
      set((state) => ({
        scene: state.scene ? insertSceneNode(state.scene, node) : state.scene,
        simulationDirty: true,
      })),
    updateNode: (id, patch) =>
      set((state) => ({
        scene: state.scene ? patchSceneNode(state.scene, id, patch) : state.scene,
        simulationDirty: true,
      })),
    removeNode: (id) =>
      set((state) => ({
        scene: state.scene ? removeSceneNode(state.scene, id) : state.scene,
        simulationDirty: true,
      })),
    markDirty: () => set({ simulationDirty: true }),
    setSimulationResult: (result) =>
      set((state) => {
        if (!state.scene) {
          return state;
        }

        const scene = cloneSecurityScene(state.scene);
        scene.simulation = result;
        scene.updatedAt = Date.now();

        return {
          ...state,
          scene,
          simulationDirty: false,
        };
      }),
    importScene: (json) => {
      const parsed = safeParseSecurityScene(json);

      if (!parsed.success) {
        return {
          success: false as const,
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        };
      }

      const scene = cloneSecurityScene(parsed.data);
      set((state) => ({
        ...state,
        scene,
        snapshots: scene.snapshots,
        simulationDirty: true,
      }));

      return { success: true as const };
    },
    exportScene: () => {
      const scene = get().scene;
      return scene ? cloneSecurityScene(scene) : null;
    },
    saveSnapshot: (label) =>
      set((state) => {
        if (!state.scene) {
          return state;
        }

        const parsedScene = parseSecurityScene(state.scene);
        const snapshot: SceneSnapshot = {
          id: `snap_${Math.random().toString(36).slice(2, 10)}`,
          label,
          createdAt: Date.now(),
          scene: {
            ...cloneSecurityScene(parsedScene),
            simulation: parsedScene.simulation,
          },
          simulation: parsedScene.simulation,
        };

        const nextSnapshots = [...state.snapshots, snapshot];
        const nextScene = cloneSecurityScene(parsedScene);
        nextScene.snapshots = nextSnapshots;

        return {
          ...state,
          scene: nextScene,
          snapshots: nextSnapshots,
        };
      }),
  };
}

export const createSceneStore = createStore<SceneStoreState>()((set, get) =>
  buildSceneStoreState(set, get),
);

Object.assign(createSceneStore, {
  getInitialState: () =>
    buildSceneStoreState(createSceneStore.setState, createSceneStore.getState),
});
