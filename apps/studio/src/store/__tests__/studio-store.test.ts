import { beforeEach, describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@/simulation/simulate-studio";
import { useStudioStore } from "@/store/studio-store";

describe("studio store", () => {
  beforeEach(() => {
    useStudioStore.setState(useStudioStore.getInitialState(), true);
  });

  test("runs obstruction counterfactuals and records the simulated delta", () => {
    const baseline = simulateStudio(smallRetailShopScene);

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: baseline,
      simulationDirty: false,
    });

    useStudioStore.getState().runCounterfactual("obs_cupboard_blocker");

    const state = useStudioStore.getState();

    expect(state.counterfactualObsId).toBe("obs_cupboard_blocker");
    expect(state.counterfactualResult).toBeDefined();
    expect(state.counterfactualResult?.totalCoveragePct).toBeGreaterThanOrEqual(baseline.totalCoveragePct);
    expect(
      state.counterfactualResult?.criticalZoneResults[0]?.status === "pass"
        || state.counterfactualResult?.criticalZoneResults[0]?.status === "partial"
        || state.counterfactualResult?.criticalZoneResults[0]?.status === "fail",
    ).toBe(true);
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
  });
});
