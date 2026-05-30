import { describe, expect, test } from "bun:test";

import * as studioLib from "@/lib";

describe("apps/studio/src/lib public API", () => {
  test("exports a curated SDK-facing helper surface", () => {
    expect(Object.keys(studioLib).sort()).toEqual([
      "applySceneOperation",
      "applySceneOperations",
      "createSceneFromFloorPlan",
      "extractFloorPlan",
      "getFloorPlanDiagnostics",
      "normalizeFloorPlanResult",
      "parseOfflineCommand",
      "recalibrateFloorPlanResult",
      "shareLinkOrCopy",
      "validateFloorPlan",
    ]);
  });

  test("lets consumers compose floor-plan import and scene mutation helpers from one entrypoint", () => {
    const scene = studioLib.createSceneFromFloorPlan("Public API Scene", {
      imageWidth: 800,
      imageHeight: 600,
      scalePixelsPerMeter: 100,
      confidence: 1,
      roomDimensions: { widthM: 8, depthM: 6, heightM: 3 },
      walls: [
        { start: { x: 100, y: 100 }, end: { x: 700, y: 100 }, detected: true },
        { start: { x: 700, y: 100 }, end: { x: 700, y: 500 }, detected: true },
      ],
      doors: [],
      windows: [],
    });

    const result = studioLib.applySceneOperation(scene, {
      type: "save_snapshot",
      label: "SDK smoke test",
    });

    expect(result.success).toBe(true);
    expect(result.description).toBe('Saved snapshot: "SDK smoke test"');
    expect(studioLib.parseOfflineCommand("open report", scene)).toEqual({
      message: "Opened report panel",
      operations: [],
      action: { type: "set_bottom_tab", tab: "report" },
    });
  });
});
