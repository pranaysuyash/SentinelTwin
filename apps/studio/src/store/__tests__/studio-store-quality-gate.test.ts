import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { createCameraNode, createObstructionNode } from "@/lib/node-factory";
import { buildCompareReportData } from "@sentineltwin/report";
import { simulateStudio } from "@sentineltwin/simulation";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createTestCamera, createTestScene } from "@sentineltwin/simulation/__tests__/helpers";
import type { SecurityScene } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

const testWithTimeout = test as unknown as (
  name: string,
  options: { timeout: number },
  fn: () => void,
) => void;

describe("studio store quality gate", () => {
  beforeEach(() => {
    useStudioStore.setState(useStudioStore.getInitialState(), true);
    useStudioStore.getState().setScene(createBlankSecurityScene());
  });

  test("selects and updates a node through the canonical store API", () => {
    const camera = createCameraNode([2, 2.8, 3]);
    useStudioStore.getState().addNode(camera);
    useStudioStore.getState().selectNode(camera.id);

    expect(useStudioStore.getState().selectedNodeId).toBe(camera.id);
    expect(useStudioStore.getState().selectedNodeIds).toContain(camera.id);

    useStudioStore.getState().updateNode(camera.id, {
      status: "off",
      clarity: "average",
    });

    expect(useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera.id)?.status).toBe("off");
    expect(useStudioStore.getState().simulationDirty).toBe(true);
  });

  test("routes contextual dock targets for major node types", () => {
    const scene = createSmallRetailShopScene();
    useStudioStore.getState().setScene(scene);
    const camera = scene.cameras[0];
    const light = scene.securityLights[0];
    const obstruction = scene.obstructions[0];
    const criticalZone = scene.criticalZones[0];
    const privacyZone = scene.privacyZones[0];
    const door = scene.doors[0];
    const windowNode = scene.windows[0];
    const entryPoint = scene.entryPoints[0];
    const wall = scene.walls[0];
    expect(camera).toBeTruthy();

    useStudioStore.getState().selectNode(camera.id);
    expect(useStudioStore.getState().rightPanelMode).toBe("camera_controls");
    expect(useStudioStore.getState().bottomTab).toBe("metrics");
    expect(useStudioStore.getState().activeTool).toBe("camera");
    expect(useStudioStore.getState().inspectorTab).toBe("view");
    expect(useStudioStore.getState().rightDockCollapsed).toBe(false);
    expect(useStudioStore.getState().bottomDockCollapsed).toBe(false);

    if (light) {
      useStudioStore.getState().selectNode(light.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("metrics");
      expect(useStudioStore.getState().activeTool).toBe("light");
      expect(useStudioStore.getState().inspectorTab).toBe("properties");
    }

    if (obstruction) {
      useStudioStore.getState().selectNode(obstruction.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("issues");
      expect(useStudioStore.getState().activeTool).toBe("obstruction");
      expect(useStudioStore.getState().inspectorTab).toBe("properties");
    }

    if (criticalZone) {
      useStudioStore.getState().selectNode(criticalZone.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("issues");
      expect(useStudioStore.getState().activeTool).toBe("zone");
      expect(useStudioStore.getState().inspectorTab).toBe("failures");
    }

    if (privacyZone) {
      useStudioStore.getState().selectNode(privacyZone.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("issues");
      expect(useStudioStore.getState().activeTool).toBe("zone");
      expect(useStudioStore.getState().inspectorTab).toBe("failures");
    }

    if (door) {
      useStudioStore.getState().selectNode(door.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("threat");
      expect(useStudioStore.getState().activeTool).toBe("door_window");
      expect(useStudioStore.getState().inspectorTab).toBe("status");
    }

    if (windowNode) {
      useStudioStore.getState().selectNode(windowNode.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("threat");
      expect(useStudioStore.getState().activeTool).toBe("door_window");
      expect(useStudioStore.getState().inspectorTab).toBe("status");
    }

    if (entryPoint) {
      useStudioStore.getState().selectNode(entryPoint.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("threat");
    }

    if (wall) {
      useStudioStore.getState().selectNode(wall.id);
      expect(useStudioStore.getState().rightPanelMode).toBe("inspector");
      expect(useStudioStore.getState().bottomTab).toBe("assumptions");
      expect(useStudioStore.getState().activeTool).toBe("wall");
      expect(useStudioStore.getState().inspectorTab).toBe("properties");
    }
  });

  test("adds and removes a node through the canonical store API", () => {
    const obstruction = createObstructionNode([4, 1, 5], "shelf");
    useStudioStore.getState().addNode(obstruction);

    expect(useStudioStore.getState().scene.obstructions.some((entry) => entry.id === obstruction.id)).toBe(true);

    useStudioStore.getState().removeNode(obstruction.id);

    expect(useStudioStore.getState().scene.obstructions.some((entry) => entry.id === obstruction.id)).toBe(false);
    expect(useStudioStore.getState().simulationDirty).toBe(true);
  });

  testWithTimeout("creates snapshots and compares them from the current scene", { timeout: 20000 }, () => {
    const scene = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          id: "cam_compare",
          position: [4, 2.5, 1.4],
          yawDeg: 0,
          pitchDeg: -20,
          rangeM: 12,
        }),
      ],
    });
    scene.criticalZones = [
      {
        id: "zone_compare",
        nodeType: "critical_zone",
        label: "Compare Zone",
        polygon: [
          [3.5, 4.2],
          [4.5, 4.2],
          [4.5, 5.2],
          [3.5, 5.2],
        ],
        heightM: 2,
        priority: "high",
        requiredQuality: "recognition",
        targetType: "person_detection",
        nightRequired: false,
        redundancyRequired: false,
        privacyZone: false,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];
    useStudioStore.getState().setScene(scene);

    const baselineResult = simulateStudio(scene);
    useStudioStore.getState().setSimulationResult(baselineResult, 42);
    useStudioStore.getState().saveSnapshot("Baseline");

    const compareCamera = useStudioStore.getState().scene.cameras.find((camera) => camera.id === "cam_compare");
    if (!compareCamera) {
      throw new Error("Expected the compare camera in the test scene");
    }
    useStudioStore.getState().updateNode(compareCamera.id, { status: "off" });

    const afterResult = simulateStudio(useStudioStore.getState().scene);
    useStudioStore.getState().setSimulationResult(afterResult, 56);
    useStudioStore.getState().saveSnapshot("Entrance Off");

    const snapshots = useStudioStore.getState().snapshots;
    expect(snapshots).toHaveLength(2);

    useStudioStore.getState().setCompareReportSelection({
      snapshotAId: snapshots[0]?.id ?? "",
      snapshotBId: snapshots[1]?.id ?? "",
      provenanceNote: null,
    });

    expect(useStudioStore.getState().compareReportSelection).toBeTruthy();

    const compareSceneA = snapshots[0]?.scene ?? scene;
    const compareSceneB = snapshots[1]?.scene ?? scene;
    const compare = buildCompareReportData(
      compareSceneA,
      snapshots[0]?.simulation ?? baselineResult,
      compareSceneB,
      snapshots[1]?.simulation ?? afterResult,
    );

    expect(compare.deltas.totalCoveragePctDelta).toBeLessThan(0);
    expect(compare.zoneChanges.length).toBeGreaterThan(0);
  });

  test("rejects invalid JSON scene imports without mutating the current scene", () => {
    const currentSceneId = useStudioStore.getState().scene.id;
    const outcome = useStudioStore.getState().importScene({ invalid: true });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBeTruthy();
    expect(useStudioStore.getState().scene.id).toBe(currentSceneId);
    expect(useStudioStore.getState().simulationDirty).toBe(true);
  });

  testWithTimeout("dirty state clears after simulation and returns when marked dirty again", { timeout: 15000 }, () => {
    const scene = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          id: "cam_dirty",
          position: [4, 2.5, 1.4],
          yawDeg: 0,
          pitchDeg: -20,
          rangeM: 12,
        }),
      ],
    });
    scene.criticalZones = [
      {
        id: "zone_dirty",
        nodeType: "critical_zone",
        label: "Dirty Zone",
        polygon: [
          [3.5, 4.2],
          [4.5, 4.2],
          [4.5, 5.2],
          [3.5, 5.2],
        ],
        heightM: 2,
        priority: "high",
        requiredQuality: "recognition",
        targetType: "person_detection",
        nightRequired: false,
        redundancyRequired: false,
        privacyZone: false,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];
    useStudioStore.getState().setScene(scene);

    const result = simulateStudio(scene);
    useStudioStore.getState().setSimulationResult(result, 33);

    expect(useStudioStore.getState().simulationDirty).toBe(false);

    useStudioStore.getState().markDirty();

    expect(useStudioStore.getState().simulationDirty).toBe(true);
  });
});
