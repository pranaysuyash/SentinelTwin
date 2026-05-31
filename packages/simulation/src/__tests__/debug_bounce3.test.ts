import { describe, expect, test } from "bun:test";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene, findCellNear } from "./helpers";

test("debug bounce v2", () => {
  const scene = createTestScene({
    width: 8,
    depth: 8,
    cameras: [
      createTestCamera({
        id: "cam_test",
        position: [4, 2.5, 1],
        yawDeg: 180,
        pitchDeg: -25,
        fovHorizontalDeg: 80,
        rangeM: 12,
        clarity: "excellent",
      }),
    ],
  });

  scene.windows = [
    {
      id: "window_reflective",
      nodeType: "window" as const,
      label: "Reflective Window",
      position: [4, 1.5, 3],
      dimensions: [2.5, 3, 0.1],
      state: "reflective" as const,
      visionTransmission: 0.4,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  const evaluator = createCoverageEvaluator(scene);
  const cell: [number, number] = [4.125, 6.875];
  
  // Direct evaluation
  const direct = evaluator.evaluatePoint(scene.cameras[0], cell);
  console.log("DIRECT: visible:", direct.visible, "quality:", direct.quality, 
    "ppm:", direct.ppm, "blockedBy:", direct.blockedBy,
    "inFov:", direct.inFov, "withinRange:", direct.withinRange,
    "mt:", direct.materialTransmission, "gp:", direct.glarePenalty,
    "reasonCodes:", JSON.stringify(direct.reasonCodes));
  
  // Window visibility from camera
  const winVis = evaluator.evaluatePoint(scene.cameras[0], [4, 3], 1.5);
  console.log("WINDOW: visible:", winVis.visible, "quality:", winVis.quality,
    "reasonCodes:", JSON.stringify(winVis.reasonCodes));

  // Full coverage (which includes bounce)
  const cells = computeCoverageCells(scene, 4);
  const target = findCellNear(cells, 4.125, 6.875);
  console.log("CELL quality:", target.quality, "ppm:", target.ppm);
  
  const ce = target.cameraEvaluations?.cam_test;
  if (ce) {
    console.log("CELL eval:", JSON.stringify({
      visible: ce.visible, quality: ce.quality, ppm: ce.ppm,
      reasonCodes: ce.reasonCodes, mt: ce.materialTransmission,
      gp: ce.glarePenalty, inFov: ce.inFov, blockedBy: ce.blockedBy,
    }));
  } else {
    console.log("No eval");
  }

  // Check ALL cells with bounce
  const bounceCells = cells.filter(c => c.cameraEvaluations?.cam_test?.reasonCodes?.includes("REFLECTIVE_BOUNCE"));
  console.log("Total cells with reflective bounce:", bounceCells.length);
});
