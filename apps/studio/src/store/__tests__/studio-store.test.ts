import { beforeEach, describe, expect, test } from "bun:test";

import { useStudioStore } from "@/store/studio-store";
import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";

describe("studio store", () => {
  beforeEach(() => {
    useStudioStore.setState(useStudioStore.getInitialState(), true);
  });

  test("boots the demo scene with a seeded simulation result on first load", () => {
    const state = useStudioStore.getState();

    expect(state.scene.source).toBe("demo");
    expect(state.simulationDirty).toBe(false);
    expect(state.simulationResult).toBeDefined();
    const seededSimulation = state.scene.simulation;
    const seededResult = state.simulationResult;
    if (!seededSimulation) {
      throw new Error("Expected the demo scene to start with a seeded simulation result");
    }
    if (!seededResult) {
      throw new Error("Expected the demo store to start with a seeded simulation result");
    }
    expect(seededSimulation).toBe(seededResult);
    expect(state.lastRunMs).not.toBeNull();
  });

  test("seeds at least one real draft workspace alongside the demo baseline", () => {
    const state = useStudioStore.getState();
    const manualWorkspace = state.savedProjects.find((record) => record.scene.source !== "demo");

    expect(manualWorkspace).toBeDefined();
    expect(manualWorkspace?.scene.source).toBe("manual");
    expect(manualWorkspace?.scene.name).toContain("Shop Layout Draft");
    expect(manualWorkspace?.scene.cameras.length).toBeGreaterThan(0);
    expect(manualWorkspace?.scene.criticalZones.length).toBeGreaterThan(0);
    expect(manualWorkspace?.scene.simulation).toBeDefined();
    expect(state.savedProjects.length).toBeGreaterThan(1);
  });

  test("seeds unique saved project scene ids on first load", () => {
    const state = useStudioStore.getState();
    const ids = state.savedProjects.map((record) => record.scene.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("runs the shared simulation action and stores a fresh result", async () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: true,
      simulationRunning: false,
      lastRunMs: null,
    });

    useStudioStore.getState().runSimulation();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const state = useStudioStore.getState();

    expect(state.simulationRunning).toBe(false);
    expect(state.simulationDirty).toBe(false);
    expect(state.simulationResult).toBeDefined();
    expect(state.scene.simulation).toBeDefined();
    expect(state.lastRunMs).not.toBeNull();
  });

  test("clears activePathId when the active path is removed", () => {
    const activePathId = smallRetailShopScene.paths[0]?.id;

    expect(activePathId).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      activePathId,
    });

    useStudioStore.getState().commitSceneChange((draft) => ({
      ...draft,
      paths: draft.paths.filter((path) => path.id !== activePathId),
    }));

    expect(useStudioStore.getState().activePathId).toBeNull();
  });

  test("stores and clears map focus requests for the 3D workspace", () => {
    useStudioStore.getState().setFocusScenePointRequest({ point: [4.5, 2.25], source: "minimap" });

    expect(useStudioStore.getState().focusScenePointRequest).toEqual({
      point: [4.5, 2.25],
      source: "minimap",
    });

    useStudioStore.getState().setFocusScenePointRequest(null);

    expect(useStudioStore.getState().focusScenePointRequest).toBeNull();
  });

  test("stores the active camera placement preset in shared editor state", () => {
    useStudioStore.getState().setCameraPresetId("bullet_outdoor");

    expect(useStudioStore.getState().cameraPresetId).toBe("bullet_outdoor");

    useStudioStore.getState().setCameraPresetId(null);

    expect(useStudioStore.getState().cameraPresetId).toBeNull();
  });

  test("resets shared map viewport state when a new scene is loaded", () => {
    useStudioStore.setState({
      mapState: {
        minimap: { zoom: 2.4, pan: [32, -18] },
        pathMap: { zoom: 1.7, pan: [-12, 6] },
      },
    });

    useStudioStore.getState().setScene(smallRetailShopScene);

    expect(useStudioStore.getState().mapState).toEqual({
      minimap: { zoom: 1, pan: [0, 0] },
      pathMap: { zoom: 1, pan: [0, 0] },
    });
  });

  test("rebuilds the scene intelligence graph when snapshots are saved", () => {
    useStudioStore.getState().setScene(smallRetailShopScene);

    const before = useStudioStore.getState().sceneIntelligenceGraph.summary.snapshotCount;
    useStudioStore.getState().saveSnapshot("Graph Snapshot");

    const state = useStudioStore.getState();

    expect(state.sceneIntelligenceGraph.summary.sceneSourceLabel).toBe("Demo Scene");
    expect(state.sceneIntelligenceGraph.summary.snapshotCount).toBe(before + 1);
    expect(state.scene.snapshots).toHaveLength(before + 1);
  });

  test("duplicates the selected node and selects the duplicate", () => {
    const originalCamera = smallRetailShopScene.cameras[0];
    expect(originalCamera).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: originalCamera!.id,
    });

    useStudioStore.getState().duplicateNode(originalCamera!.id);

    const state = useStudioStore.getState();
    const duplicated = state.scene.cameras.find((camera) => camera.id !== originalCamera!.id && camera.name.startsWith(originalCamera!.name));

    expect(state.scene.cameras).toHaveLength(smallRetailShopScene.cameras.length + 1);
    expect(state.selectedNodeId).toBe(duplicated?.id ?? null);
    expect(duplicated?.name).toContain("Copy");
    expect(duplicated?.position[0]).toBeCloseTo(originalCamera!.position[0] + 0.4, 6);
    expect(duplicated?.position[2]).toBeCloseTo(originalCamera!.position[2] + 0.4, 6);
    expect(state.selectedNodeIds).toEqual([duplicated?.id ?? ""]);
  });

  test("supports grouped selection actions in shared editor state", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.getState().setScene(smallRetailShopScene);
    useStudioStore.getState().setSelectedNodes([first!.id, second!.id]);

    expect(useStudioStore.getState().selectedNodeIds).toEqual([first!.id, second!.id]);
    expect(useStudioStore.getState().selectedNodeId).toBe(first!.id);

    useStudioStore.getState().toggleSelectedNode(first!.id);

    expect(useStudioStore.getState().selectedNodeIds).toEqual([second!.id]);
    expect(useStudioStore.getState().selectedNodeId).toBe(second!.id);
  });

  test("duplicates grouped selections when multiple nodes are selected", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().duplicateNode(first!.id);

    const state = useStudioStore.getState();

    expect(state.scene.cameras).toHaveLength(smallRetailShopScene.cameras.length + 2);
    expect(state.selectedNodeIds).toHaveLength(2);
    expect(state.selectedNodeIds[0]).not.toBe(first!.id);
    expect(state.selectedNodeIds[1]).not.toBe(second!.id);
  });

  test("translates the current grouped selection as one scene edit", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().translateSelectedNodes([0.5, -0.25]);

    const state = useStudioStore.getState();
    const movedFirst = state.scene.cameras.find((camera) => camera.id === first!.id);
    const movedSecond = state.scene.cameras.find((camera) => camera.id === second!.id);

    expect(movedFirst?.position[0]).toBeCloseTo(first!.position[0] + 0.5, 6);
    expect(movedFirst?.position[2]).toBeCloseTo(first!.position[2] - 0.25, 6);
    expect(movedSecond?.position[0]).toBeCloseTo(second!.position[0] + 0.5, 6);
    expect(movedSecond?.position[2]).toBeCloseTo(second!.position[2] - 0.25, 6);
  });

  test("removes the whole grouped selection when deleting multiple nodes", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().removeSelectedNodes();

    const state = useStudioStore.getState();
    expect(state.scene.cameras.find((camera) => camera.id === first!.id)).toBeUndefined();
    expect(state.scene.cameras.find((camera) => camera.id === second!.id)).toBeUndefined();
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
  });
});
